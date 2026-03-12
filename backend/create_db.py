import psycopg2

conn = psycopg2.connect("postgresql://postgres:1234@localhost:5432/postgres")
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname='ticketdb'")
if not cur.fetchone():
    cur.execute("CREATE DATABASE ticketdb")
    print("Database ticketdb created.")
else:
    print("Database ticketdb already exists.")
conn.close()
