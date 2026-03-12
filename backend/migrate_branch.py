import os
import psycopg2

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:1234@localhost:5432/ticketdb"
)

def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn:
            with conn.cursor() as cur:
                print("Checking for 'branch' column...")
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name='tickets' AND column_name='branch';
                """)
                if not cur.fetchone():
                    print("Adding 'branch' column...")
                    cur.execute("ALTER TABLE tickets ADD COLUMN branch TEXT;")
                    print("Column 'branch' added successfully.")
                else:
                    print("Column 'branch' already exists.")
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
