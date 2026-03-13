from database import _get_conn

def migrate_manager():
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE admin_users SET receiver_position = 'Manager' WHERE receiver_position = 'Admin Manager'")
                count = cur.rowcount
                print(f"Migrated {count} users from Admin Manager to Manager.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    migrate_manager()
