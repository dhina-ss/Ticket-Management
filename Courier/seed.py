"""
Run once to initialise the database and import historical Excel data.
Usage:
    python seed.py
"""
import os
from datetime import date, datetime
import pandas as pd
from app import create_app, db
from app.models import Branch, User, Courier

EXCEL_FILE = r'C:\Users\Admin\Downloads\Coimbatore CCCD - Courier Register.xlsx'

app = create_app('development')

def clean(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if s not in ('nan', 'None', '') else None

def parse_date(val):
    try:
        if val is None or pd.isnull(val):
            return None
    except Exception:
        pass
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        ts = pd.to_datetime(str(val), dayfirst=True)
        if pd.isnull(ts):
            return None
        return ts.date()
    except Exception:
        return None

def parse_float(val):
    try:
        f = float(str(val).replace('kgs', '').replace('kg', '').strip())
        return f if f == f else None
    except Exception:
        return None

with app.app_context():
    db.create_all()
    print("[OK] Tables created.")

    # Branches
    default_branches = [
        ('CCCD Head Office', 'CCCD-HO', 'Coimbatore', 'CCCD'),
        ('DST Head Office',  'DST-HO',  'Coimbatore', 'DST'),
        ('CC Vengamedu',     'CC-VNG',  'Karur',       'CCCD'),
    ]
    branch_map = {}
    for name, code, loc, company in default_branches:
        b = Branch.query.filter_by(code=code).first()
        if not b:
            b = Branch(name=name, code=code, location=loc, company=company)
            db.session.add(b)
            db.session.flush()
            print(f"  + Branch: {name}")
        branch_map[code] = b
    db.session.commit()

    default_branch = branch_map['CCCD-HO']

    # Superadmin user
    if not User.query.filter_by(username='admin').first():
        admin = User(
            name='Administrator',
            email='admin@cccd.com',
            username='admin',
            role='superadmin',
            branch_id=None,
        )
        admin.set_password('Admin@2026')
        db.session.add(admin)
        db.session.commit()
        print("[OK] Superadmin created: username=admin  password=Admin@2026")
    else:
        print("  (superadmin already exists)")

    # Import Excel
    if not os.path.exists(EXCEL_FILE):
        print(f"[WARN] Excel file not found at: {EXCEL_FILE}")
        print("  Skipping data import.")
        exit()

    xl = pd.ExcelFile(EXCEL_FILE)
    total_imported = 0

    # Old-format sheets (Oct-Dec 2025)
    OLD_SHEETS = ['Oct 2025', 'Nov 2025', 'Dec 2025']
    for sheet in OLD_SHEETS:
        if sheet not in xl.sheet_names:
            continue
        df = pd.read_excel(xl, sheet_name=sheet)
        df.columns = [c.strip() for c in df.columns]
        count = 0
        for _, row in df.iterrows():
            awb = clean(row.get('AWB No'))
            d = parse_date(row.get('DATE'))
            if d is None:
                continue
            if awb and Courier.query.filter_by(awb_no=awb, branch_id=default_branch.id).first():
                continue
            c = Courier(
                branch_id=default_branch.id,
                date=d,
                transaction_type='Dispatch',
                sender=clean(row.get('SENDER')),
                department=clean(row.get('Department')),
                sending_from=clean(row.get('SENDING FROM')),
                receiver=clean(row.get('RECEIVER (ATTN)')),
                supplier_buyer_type=clean(row.get('Supplier/Buyer')),
                supplier_buyer_name=clean(row.get('Supplier /Buyer Name')),
                destination=clean(row.get('DESTINATION')),
                product_description=clean(row.get('Product Descriptions')),
                package_type=clean(row.get('Package type')),
                num_packages=1,
                order_related='YES' if str(row.get('Order related / General(Yes/NO)', '')).strip().upper() == 'YES' else 'NO',
                order_reference=clean(row.get('PI/SO/ENQ/Sample order')),
                budgeted=clean(row.get('BUDGETED / NON BUDGETED')) or 'Non Budgeted',
                courier_name=clean(row.get('Courier Name')),
                awb_no=awb,
                weight_kg=parse_float(row.get('Weight in Kgs')),
                box_measurement=clean(row.get('Box measurement')),
                chargeable_weight=parse_float(row.get('Chargeable weight KG')),
                courier_cost=parse_float(row.get('Courier Cost')),
                payment_mode=clean(row.get('Monthly Bill / Petty Cash - Mode')),
                remarks=clean(row.get('Remarks')),
            )
            db.session.add(c)
            count += 1
        db.session.commit()
        print(f"  + {sheet}: {count} rows imported")
        total_imported += count

    # New-format sheet (2026-COIMBATORE)
    NEW_SHEET = '2026-COIMBATORE'
    if NEW_SHEET in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=NEW_SHEET, header=1)
        df.columns = [str(c).strip() for c in df.columns]

        def resolve_branch(from_val):
            fv = str(from_val or '').strip().upper()
            if 'DST' in fv:
                return branch_map.get('DST-HO', default_branch)
            if 'VENG' in fv or 'VNG' in fv:
                return branch_map.get('CC-VNG', default_branch)
            return default_branch

        count = 0
        for _, row in df.iterrows():
            d = parse_date(row.get('DATE'))
            if d is None:
                continue
            awb = clean(row.get('AWB#'))
            from_val = clean(row.get('FROM'))
            branch = resolve_branch(from_val)

            if awb and Courier.query.filter_by(awb_no=awb, branch_id=branch.id).first():
                continue

            num_pkg = 1
            try:
                raw_pkg = row.get('NUMBER OF PACKAGE', 1)
                if raw_pkg is not None and not pd.isnull(raw_pkg):
                    num_pkg = int(float(str(raw_pkg)))
            except Exception:
                num_pkg = 1

            c = Courier(
                branch_id=branch.id,
                date=d,
                transaction_type=clean(row.get('TYPE')) or 'Dispatch',
                sender=clean(row.get('FROM.1')),
                department=clean(row.get('DEPT')),
                sending_from=from_val,
                receiver=clean(row.get('TO')),
                receiver_office=clean(row.get('RECEIVER (OFFICE)')),
                destination=clean(row.get('DESTINATION')),
                product_description=clean(row.get('ITEM')),
                package_type=clean(row.get('PACKAGE TYPE')),
                num_packages=num_pkg,
                order_related='YES' if str(row.get('ORDER RELATED', '')).strip().upper() == 'YES' else 'NO',
                order_reference=clean(row.get('ORDER REFERENCE#\nPI/SO/ENQ/SAMPLE REF')),
                budgeted=clean(row.get('BUDGETED / NON BUDGETED')) or 'Non Budgeted',
                courier_name=clean(row.get('COURIER NAME')),
                awb_no=awb,
                weight_kg=parse_float(row.get('TOTAL WEIGHT IN KGS')),
                box_measurement=clean(row.get('PACKAGE SIZE')),
                chargeable_weight=parse_float(row.get('CHARGE.WT IN KGS')),
                courier_cost=parse_float(row.get('COURIER COST')),
                payment_mode=clean(row.get('MONTHLY BILL/PETTY CASH')),
                remarks=clean(row.get('REMARKS')),
            )
            db.session.add(c)
            count += 1

        db.session.commit()
        print(f"  + {NEW_SHEET}: {count} rows imported")
        total_imported += count

    print(f"\n[OK] Done. Total records imported: {total_imported}")
    print("\nLogin at: http://localhost:5000")
    print("  Username: admin")
    print("  Password: Admin@2026")
