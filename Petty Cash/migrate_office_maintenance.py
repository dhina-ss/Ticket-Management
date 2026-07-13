"""One-time migration: set subcategory for Office Maintenance records.
  - Descriptions containing corporation-related keywords → Corporation
  - Everything else → Other
"""
import sys
sys.path.insert(0, r'D:\Petty Cash')

from app import app, db, Expense
from sqlalchemy import func

CORPORATION_WORDS = [
    'corporation', 'corp ',
    'municipal', 'municipality',
    'property tax', 'water tax', 'water charges', 'water bill',
    'cleaning charges', 'corporation cleaning',
    'solid waste', 'sanitation',
    'sewage', 'drainage',
]

with app.app_context():
    records = Expense.query.filter_by(category='Office Maintenance').all()
    print(f"Total Office Maintenance records: {len(records)}")

    corp_count  = 0
    other_count = 0
    skip_count  = 0

    for e in records:
        if e.subcategory:
            skip_count += 1
            continue

        desc = e.description.lower()
        if any(w in desc for w in CORPORATION_WORDS):
            e.subcategory = 'Corporation'
            corp_count += 1
        else:
            e.subcategory = 'Other'
            other_count += 1

    db.session.commit()

    print(f"  -> Corporation : {corp_count}")
    print(f"  -> Other       : {other_count}")
    print(f"  -> Already set : {skip_count}")

    # Show final breakdown
    print()
    rows = (db.session.query(Expense.subcategory, func.count(), func.sum(Expense.amount))
            .filter_by(category='Office Maintenance')
            .group_by(Expense.subcategory)
            .all())
    print("Final breakdown:")
    print("-" * 44)
    for sub, cnt, total in rows:
        print(f"  {(sub or '(blank)'):<14} | {cnt:>4} records | Rs.{total:>10.2f}")

    # Show Corporation records for verification
    corp_recs = Expense.query.filter_by(category='Office Maintenance', subcategory='Corporation').order_by(Expense.date).all()
    print(f"\nCorporation records ({len(corp_recs)}):")
    for e in corp_recs:
        print(f"  [{e.id}] {e.date} | Rs.{e.amount:>8.2f} | {e.description[:70]}")
