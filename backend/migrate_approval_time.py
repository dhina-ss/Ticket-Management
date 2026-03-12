import psycopg2
from database import _get_conn

def migrate_approval_time():
    print("Starting migration to add approval_request_time...")
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    ALTER TABLE tickets
                    ADD COLUMN IF NOT EXISTS approval_request_time TIMESTAMPTZ;
                """)
                print("Successfully added approval_request_time column if it didn't exist.")
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate_approval_time()
