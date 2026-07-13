"""One-time migration: add user permission columns + create lookup_items table."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models import LookupItem

app = create_app('development')

DEPARTMENTS = ['Merch', 'Marketing', 'PD', 'Factory Merch', 'Docs',
               'Accounts', 'Admin', 'DST', 'IT', 'Design', 'BIU']
SUPPLIER_TYPES = ['Buyer', 'HO', 'Testing Lab', 'Vendor', 'Factory', 'Agent', 'Other']
PACKAGE_TYPES = ['Cover', 'Box', 'Carton', 'Samples', '1 Box', '2 Box', 'Other']

with app.app_context():
    # Add missing columns to users (SQLite-safe)
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    existing = {c['name'] for c in inspector.get_columns('users')}

    new_cols = [
        ("perm_view_cost",    "BOOLEAN DEFAULT 0"),
        ("perm_view_reports", "BOOLEAN DEFAULT 1"),
        ("perm_view_entries", "BOOLEAN DEFAULT 1"),
        ("perm_add",          "BOOLEAN DEFAULT 1"),
        ("perm_edit",         "BOOLEAN DEFAULT 0"),
        ("perm_delete",       "BOOLEAN DEFAULT 0"),
    ]
    with db.engine.connect() as conn:
        for col, typedef in new_cols:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
                print(f"  + users.{col}")
        conn.commit()

    # Create lookup_items table
    db.create_all()
    print("  tables synced")

    # Seed lookups (skip if already exist)
    seeds = (
        [('department', v) for v in DEPARTMENTS] +
        [('supplier_type', v) for v in SUPPLIER_TYPES] +
        [('package_type', v) for v in PACKAGE_TYPES]
    )
    added = 0
    for i, (cat, val) in enumerate(seeds):
        if not LookupItem.query.filter_by(category=cat, value=val).first():
            db.session.add(LookupItem(category=cat, value=val, sort_order=i))
            added += 1
    db.session.commit()
    print(f"  seeded {added} lookup items")
    print("Migration complete.")
