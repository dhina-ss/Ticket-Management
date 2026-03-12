import psycopg2
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:1234@localhost:5432/ticketdb"
)

def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn:
            with conn.cursor() as cur:
                # Add column if not exists
                cur.execute("""
                    ALTER TABLE tickets 
                    ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT FALSE;
                """)
                print("Migration successful: is_delete column added/verified.")
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
