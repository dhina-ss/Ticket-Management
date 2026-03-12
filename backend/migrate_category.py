import psycopg2
from database import _get_conn

conn = _get_conn()
cur  = conn.cursor()

cur.execute(
    "UPDATE tickets SET category = %s WHERE category = %s",
    ("Material request", "New asset request")
)
print(f"Migrated {cur.rowcount} ticket(s).")
conn.commit()
cur.close()
conn.close()
