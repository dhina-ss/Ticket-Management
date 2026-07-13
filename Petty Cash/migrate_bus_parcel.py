"""One-time migration: set subcategory for Bus Parcel records based on description keywords."""
import sys
sys.path.insert(0, r'D:\Petty Cash')

from app import app, db, Expense

PICKUP_WORDS = [
    'pickup', 'pick up', 'pick-up',
    'receiving', 'received', 'receive',
    'collect', 'collection',
    'unloading', 'inward',
    'from bangalore', 'from chennai', 'from coimbatore', 'from mumbai',
    'from mithun', 'from parvath',
    # typo "form" instead of "from" in source data
    'form bangalore', 'form chennai', 'form coimbatore', 'form mumbai',
    # "From: person" pattern
    'from:', 'form:',
]
DROP_WORDS = [
    'drop', 'delivery', 'deliver', 'dispatch', 'despatch',
    'send', 'sending', 'outward',
    'for buyer', 'to buyer', 'fien design buyer',
    'india post', 'post cost',
]

# Records that are clearly ambiguous / wrong-category: leave subcategory blank
SKIP_IDS = {335}  # "auto charges" for signboard — not a bus parcel

with app.app_context():
    bus_parcels = Expense.query.filter_by(category='Bus Parcel').all()
    print(f"Total Bus Parcel records: {len(bus_parcels)}")

    pickup_count = drop_count = skip_count = 0

    for e in bus_parcels:
        desc = e.description.lower()
        if e.subcategory:          # already set, skip
            skip_count += 1
            continue
        if e.id in SKIP_IDS:
            continue

        if any(w in desc for w in PICKUP_WORDS):
            e.subcategory = 'Pickup'
            pickup_count += 1
        elif any(w in desc for w in DROP_WORDS):
            e.subcategory = 'Drop'
            drop_count += 1
        # else: leave blank (ambiguous)

    db.session.commit()

    print(f"  -> Pickup : {pickup_count}")
    print(f"  -> Drop   : {drop_count}")
    print(f"  -> Skipped (already set or ambiguous): {skip_count + (len(bus_parcels) - pickup_count - drop_count - skip_count)}")

    # Show sample of ambiguous ones so user can manually review
    ambiguous = [e for e in bus_parcels if not e.subcategory]
    if ambiguous:
        print(f"\n  Ambiguous records ({len(ambiguous)}) — subcategory left blank:")
        for e in ambiguous[:20]:
            print(f"    [{e.id}] {e.date} | {e.description[:80]}")
        if len(ambiguous) > 20:
            print(f"    ... and {len(ambiguous)-20} more")
    else:
        print("\n  All Bus Parcel records categorised successfully.")
