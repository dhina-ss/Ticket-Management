"""
Import historical petty cash data from Excel into the database.
Run once: py import_excel.py "path\to\PettyCash.xlsx"
"""
import sys
import os
import pandas as pd
from datetime import datetime, date
from app import app, db, User, Expense, DayLedger

EXCEL_PATH = r"C:\Users\Admin\Downloads\PettyCash 01-04-2026 to 31-03-2027.xlsx"

# ── Category mapping from Excel ledger values ─────────────────────────────────
def map_category(ledger, main, particular):
    l = str(ledger).strip().lower()
    m = str(main).strip().lower()
    p = str(particular).strip().lower()

    # Bus / parcel
    if 'bus parcel' in l or 'courier' in l or 'transport charges' in l or 'unloading' in l:
        return 'Bus / Parcel Charges'

    # Travel
    if 'travel claim' in l or 'travel claim' in m or 'auto charges' in l or 'cab charges' in l:
        return 'Travel & Conveyance'
    if 'travelling' in m:
        return 'Travel & Conveyance'

    # Fuel
    if 'fuel' in l or 'own vehicle' in m or 'office bike' in m:
        return 'Fuel / Vehicle'

    # Maintenance / office
    if l in ('maintanance', 'garden maintanance', 'corporation cleaning',
             'creative room', 'stitching charges', 'auto charges', 'printout'):
        return 'Maintenance'
    if 'office maintanance' in m and 'stationery' not in l and 'printout' not in l and 'visiting card' not in l:
        return 'Maintenance'

    # Stationery / printing
    if 'stationery' in l or 'printout' in l or 'visiting card' in l:
        return 'Stationery & Printing'

    # Donations
    if 'donation' in m or 'missionaries' in p or 'charity' in p:
        return 'Donations & Welfare'
    if l == 'welfare expenses' and 'donation' in m:
        return 'Donations & Welfare'

    # Tea / drinks
    if 'pantry' in l:
        return 'Tea & Refreshments'
    if any(kw in p for kw in ['tea', 'coconut', 'water can', 'drinking water', 'milk', 'coffee', 'biscuit']):
        return 'Tea & Refreshments'

    # Food / welfare
    if l in ('welfare', 'pooja expenses', 'birthday cake', 'buyer snacks', 'buyer visit ',
             'welfare expenses') or 'welfare' in l:
        return 'Food & Meals'
    if 'welfare' in m:
        return 'Food & Meals'

    return 'Miscellaneous'


def parse_date(val):
    if pd.isna(val):
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.date()
    try:
        return pd.to_datetime(val).date()
    except Exception:
        return None


def run_import():
    print("Starting import...")

    with app.app_context():
        db.create_all()

        # Get admin user
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            print("ERROR: Admin user not found. Run the app once first to create default users.")
            return

        # Clear old test data (keep users and ledger entries)
        deleted = Expense.query.delete()
        db.session.commit()
        print(f"Cleared {deleted} existing expense records.")

        xl = pd.ExcelFile(EXCEL_PATH)
        total_imported = 0
        skipped = 0

        for sheet in xl.sheet_names:
            print(f"\nProcessing sheet: {sheet}")
            df = pd.read_excel(xl, sheet_name=sheet, header=None)
            df.columns = ['sno', 'date', 'particular', 'credit', 'debit', 'ledger', 'main', 'category']

            # Parse opening balance (row 1 = index 0 after drop of header)
            # Row index 1 in original df has Opening Balance
            opening_row = df.iloc[1]
            opening_balance = 0.0
            if pd.notna(opening_row['credit']) and str(opening_row['particular']).strip() == 'Opening Balance':
                try:
                    opening_balance = float(opening_row['credit'])
                    print(f"  Opening Balance: Rs.{opening_balance:,.2f}")
                except (ValueError, TypeError):
                    pass

            # Parse cash withdrawals
            cash_withdrawals = []
            for _, row in df.iterrows():
                if str(row.get('particular', '')).strip().lower() == 'cash withdraw':
                    w_date = parse_date(row['date'])
                    try:
                        w_amt = float(row['credit'])
                        if w_date and w_amt > 0:
                            cash_withdrawals.append((w_date, w_amt))
                    except (ValueError, TypeError):
                        pass

            if cash_withdrawals:
                print(f"  Cash withdrawals: {len(cash_withdrawals)} entries, Total = Rs.{sum(a for _,a in cash_withdrawals):,.2f}")

            # Import expense rows (skip row 0 = header)
            month_count = 0
            for _, row in df.iloc[1:].iterrows():
                particular = str(row.get('particular', '')).strip()

                # Skip empty, summary, or credit-only rows
                if pd.isna(row.get('debit')) or row.get('debit') == 0:
                    continue
                if not particular or particular in ('nan', 'Opening Balance', 'cash withdraw', ''):
                    continue
                try:
                    amount = float(row['debit'])
                    if amount <= 0:
                        continue
                except (ValueError, TypeError):
                    skipped += 1
                    continue

                exp_date = parse_date(row['date'])
                if exp_date is None:
                    skipped += 1
                    continue

                ledger = str(row.get('ledger', '')).strip()
                main   = str(row.get('main', '')).strip()

                # Clean description — remove embedded newlines
                description = particular.replace('\n', ' | ').replace('\r', '').strip()
                if len(description) > 500:
                    description = description[:497] + '...'

                category = map_category(ledger, main, description)

                expense = Expense(
                    date=exp_date,
                    category=category,
                    amount=round(amount, 2),
                    description=description,
                    submitted_by_id=admin.id,
                    status='approved',
                    approved_by_id=admin.id,
                    approved_at=datetime.utcnow(),
                    manager_notes='Imported from Excel',
                    created_at=datetime.utcnow(),
                )
                db.session.add(expense)
                month_count += 1

            db.session.commit()
            print(f"  Imported: {month_count} expense records")
            total_imported += month_count

            # Create/update DayLedger for opening balance and cash withdrawals
            # Map month name to first day of month for the ledger
            month_map = {
                'April 2026': date(2026, 4, 1),
                'May 2026':   date(2026, 5, 1),
                'June 2026':  date(2026, 6, 1),
            }
            month_start = month_map.get(sheet)
            if month_start and opening_balance > 0:
                existing = DayLedger.query.filter_by(date=month_start).first()
                if not existing:
                    total_cash = opening_balance + sum(a for _, a in cash_withdrawals)
                    total_exp = sum(
                        e.amount for e in Expense.query.filter(
                            Expense.date >= month_start,
                            Expense.date < date(month_start.year, month_start.month + 1 if month_start.month < 12 else 1, 1),
                            Expense.status == 'approved'
                        ).all()
                    )
                    closing = opening_balance + sum(a for _, a in cash_withdrawals) - total_exp
                    ledger_entry = DayLedger(
                        date=month_start,
                        opening_balance=opening_balance,
                        added_cash=sum(a for _, a in cash_withdrawals),
                        total_expenses=total_exp,
                        closing_balance=closing,
                        notes=f"Imported from Excel — {sheet}",
                        is_closed=True,
                        closed_by_id=admin.id,
                        closed_at=datetime.utcnow(),
                    )
                    db.session.add(ledger_entry)
                    db.session.commit()
                    print(f"  Month ledger: Opening={opening_balance:.2f}, Cash In={sum(a for _,a in cash_withdrawals):.2f}, Expenses={total_exp:.2f}, Closing={closing:.2f}")

        print(f"\n{'='*50}")
        print(f"IMPORT COMPLETE")
        print(f"  Total records imported: {total_imported}")
        print(f"  Skipped rows:           {skipped}")

        # Category summary
        print("\nCategory breakdown:")
        from collections import Counter
        cats = Counter(e.category for e in Expense.query.all())
        for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
            total = sum(e.amount for e in Expense.query.filter_by(category=cat).all())
            print(f"  {cat:<30} {cnt:>4} entries  Rs.{total:>10,.2f}")

        grand = sum(e.amount for e in Expense.query.all())
        print(f"\n  Grand Total: Rs.{grand:,.2f}")
        print(f"\nDone! Open http://127.0.0.1:5000 to see your data.")


if __name__ == '__main__':
    if len(sys.argv) > 1:
        EXCEL_PATH = sys.argv[1]
    if not os.path.exists(EXCEL_PATH):
        print(f"ERROR: File not found: {EXCEL_PATH}")
        sys.exit(1)
    run_import()
