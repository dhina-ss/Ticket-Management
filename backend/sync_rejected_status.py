import psycopg2
from database import _get_conn

def sync_rejected_tickets():
    """
    Finds all tickets where admin_manager_status/management_status is 'Rejected'
    and ensures the main 'status' is also 'Rejected'.
    """
    try:
        conn = _get_conn()
        cur  = conn.cursor()

        # Update tickets where Admin Manager rejected
        cur.execute(
            "UPDATE tickets SET status = 'Rejected' WHERE admin_manager_status = 'Rejected' AND status != 'Rejected'"
        )
        am_count = cur.rowcount

        # Update tickets where Management rejected
        cur.execute(
            "UPDATE tickets SET status = 'Rejected' WHERE management_status = 'Rejected' AND status != 'Rejected'"
        )
        mgmt_count = cur.rowcount

        conn.commit()
        print(f"Migration Complete:")
        print(f" - Updated {am_count} ticket(s) rejected by Manager.")
        print(f" - Updated {mgmt_count} ticket(s) rejected by Management.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    sync_rejected_tickets()
