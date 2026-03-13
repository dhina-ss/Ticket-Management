"""
database.py — PostgreSQL data layer.
Replaces sheets.py. All function signatures are kept identical so that
app.py import lines are the only thing that needs to change.

Environment variable required:
    DATABASE_URL = postgresql://user:password@host:5432/dbname
"""

import os
import random
import string
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta

env = os.environ.get("APP_ENV", "local")
db_pwd = "cotton123" if env == "prod" else "1234"
DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"postgresql://postgres:{db_pwd}@localhost:5432/ticketdb"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_conn():
    return psycopg2.connect(DATABASE_URL)


def _row_to_ticket(row: dict) -> dict:
    """Convert a DB row (RealDictRow) to the API-facing dict."""
    attachment_name = row.get("attachment_name") or ""
    return {
        "ticket_id":              row.get("ticket_id", ""),
        "timestamp":              row["created_at"].strftime("%d-%m-%Y %I:%M %p") if row.get("created_at") else "",
        "fullName":               row.get("full_name", ""),
        "mobile":                 row.get("mobile", ""),
        "category":               row.get("category", ""),
        "mode":                   row.get("mode", ""),
        "description":            row.get("description", ""),
        "attachment":             attachment_name,          # just the filename for URL building
        "assignee":               row.get("assignee", ""),
        "status":                 "Rejected" if (row.get("admin_manager_status") == "Rejected" or row.get("management_status") == "Rejected") else row.get("status", "Not Started"),
        "subCategory":            row.get("sub_category") or "",
        "adminDescription":       row.get("admin_description") or "",
        "admin_description":      row.get("admin_description") or "",
        "adminManagerStatus":     row.get("admin_manager_status") or "",
        "managementStatus":       row.get("management_status") or "",
        "adminManagerComments":   row.get("admin_manager_comments") or "",
        "managementComments":     row.get("management_comments") or "",
        "branch":                 row.get("branch") or "",
        "department":             row.get("department") or "",
        "supportType":            row.get("support_type") or "",
        "approval_request_time":  row["approval_request_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("approval_request_time") else "",
        "adminManagerMailTime":   row["admin_manager_mail_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("admin_manager_mail_time") else "",
        "adminManagerStatusTime": row["admin_manager_status_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("admin_manager_status_time") else "",
        "managementMailTime":     row["management_mail_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("management_mail_time") else "",
        "managementStatusTime":   row["management_status_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("management_status_time") else "",
        "pendingTime":            row["pending_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("pending_time") else "",
        "completedTime":          row["completed_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("completed_time") else "",
        "resolutionComments":     row.get("resolution_comments") or "",
        "pendingComments":         row.get("pending_comments") or "",
        "adminManagerHasMail":    row.get("admin_manager_has_mail", False),
        "expenseAmount":          str(row.get("expense_amount", "")) if row.get("expense_amount") is not None else "",
        "billAttachmentName":     row.get("bill_attachment_name") or "",
        "userConfirmation":       row.get("user_confirmation") or "Pending",
        "inProgressTime":         row["in_progress_time"].strftime("%d-%m-%Y %I:%M %p") if row.get("in_progress_time") else "",
    }


def normalize_mobile(mobile: str) -> str:
    """Strip country code (+91 / 0), spaces, dashes and return 10-digit number."""
    import re
    cleaned = re.sub(r'[\s\-().]+', '', str(mobile))
    # Remove leading +91, 91, or 0 when followed by exactly 10 digits
    cleaned = re.sub(r'^(\+91|91|0)(?=\d{10}$)', '', cleaned)
    return cleaned


# ---------------------------------------------------------------------------
# DB Initialisation
# ---------------------------------------------------------------------------

def init_db():
    """Create the tickets table if it doesn't already exist."""
    sql = """
    CREATE TABLE IF NOT EXISTS tickets (
        id                      SERIAL PRIMARY KEY,
        ticket_id               VARCHAR(16) UNIQUE NOT NULL,
        created_at              TIMESTAMPTZ DEFAULT NOW(),
        full_name               TEXT NOT NULL,
        mobile                  TEXT,
        category                TEXT,
        mode                    TEXT,
        subject                 TEXT,
        description             TEXT,
        attachment              BYTEA,
        attachment_name         TEXT,
        assignee                TEXT,
        status                  TEXT DEFAULT 'Not Started',
        sub_category            TEXT,
        admin_description       TEXT,
        admin_manager_status    TEXT,
        management_status       TEXT,
        admin_manager_comments  TEXT,
        management_comments     TEXT,
        branch                  TEXT,
        department              TEXT,
        support_type            TEXT,
        is_delete               BOOLEAN DEFAULT FALSE,
        approval_request_time   TIMESTAMPTZ,
        resolution_comments     TEXT,
        admin_manager_has_mail  BOOLEAN DEFAULT FALSE
    );
    """
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql)
        conn.close()

        # Safely add new timestamp tracking columns to existing table
        alter_statements = [
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_manager_mail_time TIMESTAMPTZ;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_manager_status_time TIMESTAMPTZ;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS management_mail_time TIMESTAMPTZ;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS management_status_time TIMESTAMPTZ;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pending_time TIMESTAMPTZ;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS completed_time TIMESTAMPTZ;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS in_progress_time TIMESTAMPTZ;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_comments TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_manager_has_mail BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pending_comments TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS expense_amount NUMERIC(15,2);",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bill_attachment BYTEA;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bill_attachment_name TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS department TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS support_type TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_confirmation TEXT DEFAULT 'Pending';"
        ]
        try:
            conn = _get_conn()
            with conn:
                with conn.cursor() as cur:
                    for stmt in alter_statements:
                        cur.execute(stmt)
            conn.close()
        except Exception as e:
            print(f"ERROR: init_db ALTER failed: {e}")

        print("DEBUG: DB initialised.")
    except Exception as e:
        print(f"ERROR: init_db failed: {e}")

    # ---- admin_users table ----
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS admin_users (
                        id         SERIAL PRIMARY KEY,
                        name       TEXT NOT NULL,
                        email      TEXT UNIQUE NOT NULL,
                        password   TEXT NOT NULL,
                        access     TEXT DEFAULT 'View',
                        support_type TEXT DEFAULT 'IT Support,Admin Support',
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                # Add access column to existing table if missing
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS access TEXT DEFAULT 'View';")
                # Add support_type column to existing table if missing
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS support_type TEXT DEFAULT 'IT Support,Admin Support';")
                # Add is_first_login column
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT TRUE;")
                # Add security questions columns
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS security_question TEXT;")
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS security_answer TEXT;")
                # Add mail receiver settings
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS can_receive_mail BOOLEAN DEFAULT FALSE;")
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS receiver_position TEXT;")
                # Seed default admin if table is empty
                cur.execute("SELECT COUNT(*) FROM admin_users;")
                if cur.fetchone()[0] == 0:
                    cur.execute(
                        "INSERT INTO admin_users (name, email, password, access, support_type) VALUES (%s, %s, %s, %s, %s)",
                        ("Admin User", "admin@support.com", "Admin@123", "View,Edit,Export", "IT Support,Admin Support")
                    )
        conn.close()
        print("DEBUG: admin_users table ready.")
    except Exception as e:
        print(f"ERROR: admin_users init failed: {e}")

    # ---- assignees table ----
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS assignees (
                        id           SERIAL PRIMARY KEY,
                        name         TEXT NOT NULL,
                        support_type TEXT NOT NULL DEFAULT 'IT Support,Admin Support',
                        is_delete    BOOLEAN DEFAULT FALSE,
                        created_at   TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                cur.execute("ALTER TABLE assignees ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT FALSE;")
        conn.close()
        print("DEBUG: assignees table ready.")
    except Exception as e:
        print(f"ERROR: assignees init failed: {e}")

    # ---- departments table ----
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS departments (
                        id           SERIAL PRIMARY KEY,
                        name         TEXT NOT NULL,
                        support_type TEXT NOT NULL,
                        is_delete    BOOLEAN DEFAULT FALSE,
                        created_at   TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                cur.execute("ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT FALSE;")
                
                # Seed with default departments if empty
                cur.execute("SELECT COUNT(*) FROM departments;")
                if cur.fetchone()[0] == 0:
                    default_departments = [
                        ("Marketing/Business development", "Admin Support"),
                        ("Product Development", "Admin Support"),
                        ("Designing", "Admin Support"),
                        ("Visual Merchandising", "Admin Support"),
                        ("BIU", "Admin Support"),
                        ("Merchandising", "Admin Support"),
                        ("HR", "Admin Support"),
                        ("Admin & IT", "IT Support,Admin Support"),
                        ("Accounts", "Admin Support"),
                        ("Documentation", "Admin Support"),
                        ("Operations", "Admin Support")
                    ]
                    for dept in default_departments:
                        cur.execute(
                            "INSERT INTO departments (name, support_type) VALUES (%s, %s)",
                            dept
                        )
        conn.close()
        print("DEBUG: departments table ready.")
    except Exception as e:
        print(f"ERROR: departments init failed: {e}")

    # ---- categories table ----
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS categories (
                        id           SERIAL PRIMARY KEY,
                        name         TEXT NOT NULL,
                        support_type TEXT NOT NULL,
                        is_delete    BOOLEAN DEFAULT FALSE,
                        created_at   TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                cur.execute("ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT FALSE;")
        conn.close()
        print("DEBUG: categories table ready.")
    except Exception as e:
        print(f"ERROR: categories init failed: {e}")

    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                # Seed with default categories if empty
                cur.execute("SELECT COUNT(*) FROM categories;")
                if cur.fetchone()[0] == 0:
                    default_categories = [
                        ("Asset Request", "Admin Support"), ("New Purchase Request", "Admin Support"), 
                        ("Stock Shortage", "Admin Support"), ("Stationery Request", "Admin Support"), 
                        ("New SIM Request", "Admin Support"), ("ID Card Request", "Admin Support"), 
                        ("Electrical Issue", "Admin Support"), ("Water Supply Issue", "Admin Support"), 
                        ("AC / HVAC", "Admin Support"), ("Plumbing Issue", "Admin Support"), 
                        ("Pest Control", "Admin Support"), ("Civil Work / Maintenance", "Admin Support"), 
                        ("Housekeeping / Cleaning", "Admin Support"), ("Drinking Water", "Admin Support"), 
                        ("Parking Issue", "Admin Support"), ("Office Shifting / Setup", "Admin Support"), 
                        ("Vendor Issue", "Admin Support"), ("Furniture / Fixtures", "Admin Support"), 
                        ("Others", "IT Support,Admin Support"), ("System issue", "IT Support"), 
                        ("Network issue", "IT Support"), ("Software issue", "IT Support"), 
                        ("Printer issues", "IT Support"), ("Material request", "IT Support"), 
                        ("Tonner issues", "IT Support"), ("Server issue", "IT Support"), 
                        ("Keyboard & mouse issue", "IT Support"), ("Outlook issue", "IT Support"), 
                        ("Mail storage issue", "IT Support")
                    ]
                    for cat in default_categories:
                        cur.execute("INSERT INTO categories (name, support_type) VALUES (%s, %s)", cat)
        conn.close()
        print("DEBUG: categories seeded.")
    except Exception as e:
        print(f"ERROR: categories seeding failed: {e}")


# ---------------------------------------------------------------------------
# Admin user CRUD
# ---------------------------------------------------------------------------

def get_admin_users() -> list:
    conn = _get_conn()
    with conn.cursor() as cur:
        # LEFT JOIN with assignees to check if user is also an assignee.
        # We match by name and ensured it's not soft-deleted.
        cur.execute("""
            SELECT 
                u.id, u.name, u.email, u.access, u.support_type, u.is_first_login, u.created_at, u.can_receive_mail, u.receiver_position,
                EXISTS (SELECT 1 FROM assignees a WHERE a.name = u.name AND a.is_delete = false) as is_assignee
            FROM admin_users u
            ORDER BY u.created_at ASC;
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].strftime("%d-%m-%Y %I:%M %p")
    return rows


def create_admin_user(name: str, email: str, password: str, access: str = "View", support_type: str = "IT Support,Admin Support", can_receive_mail: bool = False, receiver_position: str = None) -> dict:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO admin_users (name, email, password, access, support_type, can_receive_mail, receiver_position) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;",
                (name, email, password, access, support_type, can_receive_mail, receiver_position)
            )
            new_id = cur.fetchone()[0]
    conn.close()
    return {"id": new_id}


def update_admin_user(user_id: int, name: str, email: str, password: str, access: str, support_type: str, can_receive_mail: bool = False, receiver_position: str = None) -> bool:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            if password:
                cur.execute(
                    "UPDATE admin_users SET name = %s, email = %s, password = %s, access = %s, support_type = %s, can_receive_mail = %s, receiver_position = %s WHERE id = %s;",
                    (name, email, password, access, support_type, can_receive_mail, receiver_position, user_id)
                )
            else:
                cur.execute(
                    "UPDATE admin_users SET name = %s, email = %s, access = %s, support_type = %s, can_receive_mail = %s, receiver_position = %s WHERE id = %s;",
                    (name, email, access, support_type, can_receive_mail, receiver_position, user_id)
                )
            updated = cur.rowcount > 0
    conn.close()
    return updated


def delete_admin_user(user_id: int) -> bool:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM admin_users WHERE id = %s;", (user_id,))
            deleted = cur.rowcount > 0
    conn.close()
    return deleted


def verify_admin_login(email: str, password: str) -> dict | None:
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, email, access, support_type, is_first_login FROM admin_users WHERE email = %s AND password = %s;",
            (email, password)
        )
        row = cur.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "name": row[1], "email": row[2], "access": row[3], "support_type": row[4], "is_first_login": row[5] if len(row) > 5 else True}
    return None

def update_admin_password(user_id: int, new_password: str, security_question: str = None, security_answer: str = None) -> bool:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE admin_users SET password = %s, is_first_login = FALSE, security_question = %s, security_answer = %s WHERE id = %s;",
                (new_password, security_question, security_answer, user_id)
            )
            updated = cur.rowcount > 0
    conn.close()
    return updated

def verify_security_answer(email: str, question: str, answer: str) -> int | None:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM admin_users WHERE email = %s AND security_question = %s AND security_answer = %s;",
                (email, question, answer)
            )
            row = cur.fetchone()
            if row:
                return row[0]
    conn.close()
    return None

def reset_admin_password(user_id: int, new_password: str) -> bool:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE admin_users SET password = %s WHERE id = %s;",
                (new_password, user_id)
            )
            updated = cur.rowcount > 0
    conn.close()
    return updated



def append_to_sheet(data: dict) -> dict:
    """Insert a new ticket row. 'attachment' key should be the filename; the actual
    bytes must be read and passed as data['attachment_bytes'] if present."""
    try:
        # Read attachment bytes from data if present
        attachment_bytes = data.get("attachment_bytes")   # raw bytes
        attachment_name  = data.get("attachment", "")     # original filename

        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tickets
                        (ticket_id, full_name, mobile, category, mode,
                         description, attachment, attachment_name, assignee,
                         status, sub_category, branch, department, support_type)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        data.get("ticket_id"),
                        data.get("fullName", ""),
                        normalize_mobile(data.get("mobile", "")),  # store normalised
                        data.get("category", ""),
                        data.get("mode", ""),
                        data.get("description", ""),
                        psycopg2.Binary(attachment_bytes) if attachment_bytes else None,
                        attachment_name,
                        data.get("assignee", ""),
                        "Not Started",
                        data.get("subCategory", ""),
                        data.get("branch", ""),
                        data.get("department", ""),
                        data.get("supportType", ""),
                    ),
                )
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_existing_ids() -> list:
    """Return list of all existing ticket_id values."""
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT ticket_id FROM tickets")
            ids = [row[0] for row in cur.fetchall()]
        conn.close()
        return ids
    except Exception as e:
        print(f"ERROR: get_existing_ids: {e}")
        return []


def get_max_sequential_id(prefix: str, suffix: str = "") -> int:
    """
    Finds the highest numeric value for ticket_ids matching the prefix and optional suffix.
    Returns the max integer found, or 0 if none.
    """
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            # Use SQL to match prefix and suffix
            pattern = f"{prefix}%{suffix}"
            cur.execute(
                "SELECT ticket_id FROM tickets WHERE ticket_id LIKE %s",
                (pattern,)
            )
            
            all_ids = [row[0] for row in cur.fetchall()]
            conn.close()
            
            max_num = 0
            import re
            escaped_prefix = re.escape(prefix)
            escaped_suffix = re.escape(suffix)
            regex_str = f"^{escaped_prefix}(\\d+){escaped_suffix}$"
            
            for tid in all_ids:
                match = re.match(regex_str, tid)
                if match:
                    num = int(match.group(1))
                    if num > max_num:
                        max_num = num
            return max_num
    except Exception as e:
        print(f"ERROR: get_max_sequential_id: {e}")
        return 0


def get_ticket_by_id(ticket_id: str) -> dict | None:
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM tickets WHERE ticket_id = %s AND is_delete = FALSE", (ticket_id,))
            row = cur.fetchone()
        conn.close()
        return _row_to_ticket(row) if row else None
    except Exception as e:
        print(f"ERROR: get_ticket_by_id: {e}")
        return None

def get_attachment(ticket_id: str) -> dict | None:
    """Return the raw bytes and filename of an attachment."""
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT attachment, attachment_name FROM tickets WHERE ticket_id = %s", (ticket_id,))
            row = cur.fetchone()
        conn.close()
        if row and row['attachment']:
            return {
                "blob": row['attachment'],
                "name": row['attachment_name'] or "attachment"
            }
        return None
    except Exception as e:
        print(f"ERROR: get_attachment: {e}")
        return None


def get_all_tickets(support_types: list = None) -> list:
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if support_types:
                # Include tickets that match ANY of the support types, OR if the ticket has no support type assigned yet
                # Note: PostgreSQL ANY array matching does not cleanly work with TEXT arrays, so we use string overlap 
                # but tickets.support_type should be exact match per ticket. Let's use ANY(%s::text[])
                cur.execute(
                    "SELECT * FROM tickets WHERE is_delete = FALSE AND (support_type = ANY(%s::text[]) OR support_type IS NULL OR support_type = '') ORDER BY created_at DESC", 
                    (support_types,)
                )
            else:
                cur.execute("SELECT * FROM tickets WHERE is_delete = FALSE ORDER BY created_at DESC")
            rows = cur.fetchall()
        conn.close()
        return [_row_to_ticket(r) for r in rows]
    except Exception as e:
        print(f"ERROR: get_all_tickets: {e}")
        return []


def update_ticket_details(ticket_id: str, updates: dict) -> dict:
    """
    Supported update keys: status, assignee, description, attachment,
    attachment_bytes, admin_description, approval_request_time.
    """
    COLUMN_MAP = {
        "status":             "status",
        "assignee":           "assignee",
        "description":        "description",
        "attachment":         "attachment_name",
        "admin_description":  "admin_description",
        "approval_request_time": "approval_request_time",
        "resolution_comments": "resolution_comments",
        "pending_comments": "pending_comments",
        "admin_manager_has_mail": "admin_manager_has_mail",
        "expense_amount": "expense_amount",
        "bill_attachment_name": "bill_attachment_name",
        "user_confirmation": "user_confirmation",
    }
    set_clauses = []
    values = []

    for key, col in COLUMN_MAP.items():
        if key in updates:
            set_clauses.append(f"{col} = %s")
            values.append(updates[key])

    # Binary attachment update
    if "attachment_bytes" in updates:
        set_clauses.append("attachment = %s")
        values.append(psycopg2.Binary(updates["attachment_bytes"]))

    if "bill_attachment_bytes" in updates:
        set_clauses.append("bill_attachment = %s")
        values.append(psycopg2.Binary(updates["bill_attachment_bytes"]))

    # Native Status Tracking
    if updates.get("status") == "In Progress":
        set_clauses.append("in_progress_time = NOW()")
    elif updates.get("status") == "Pending":
        set_clauses.append("pending_time = NOW()")
    elif updates.get("status") == "Completed":
        set_clauses.append("completed_time = NOW()")

    if not set_clauses:
        return {"success": False, "error": "No valid fields to update"}

    values.append(ticket_id)
    sql = f"UPDATE tickets SET {', '.join(set_clauses)} WHERE ticket_id = %s"

    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, values)
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


def update_approval_status(ticket_id: str, role: str, status: str, comments: str = "") -> dict:
    """
    role:   "Admin-Manager" | "Management" | "Admin"
    Updates the correct columns based on role.
    """
    ROLE_STATUS_COL   = {
        "Admin-Manager": "admin_manager_status",
        "Management":    "management_status",
    }
    ROLE_COMMENT_COL  = {
        "Admin-Manager": "admin_manager_comments",
        "Management":    "management_comments",
    }
    ROLE_STATUS_TIME_COL = {
        "Admin-Manager": "admin_manager_status_time",
        "Management":    "management_status_time",
    }

    set_clauses = []
    values = []

    col = ROLE_STATUS_COL.get(role)
    comment_col = ROLE_COMMENT_COL.get(role)

    # For Management voting logic, we need to inspect the current comments first
    final_status = status
    if role == "Management" and status in ["Approved", "Rejected"]:
        try:
            conn = _get_conn()
            with conn.cursor() as cur:
                cur.execute(f"SELECT {comment_col} FROM tickets WHERE ticket_id = %s", (ticket_id,))
                row = cur.fetchone()
                existing_comments = row[0] if row else ""
            conn.close()

            approved_count = existing_comments.count("[APPROVED]") if existing_comments else 0
            rejected_count = existing_comments.count("[REJECTED]") if existing_comments else 0
            
            if status == "Approved":
                approved_count += 1
            else:
                rejected_count += 1

            if approved_count > rejected_count:
                final_status = "Approved"
            elif rejected_count > approved_count:
                final_status = "Rejected"
            else:
                final_status = "Hold"
        except Exception as e:
            print(f"Error calculating management voting logic: {e}")

    if col:
        set_clauses.append(f"{col} = %s")
        values.append(final_status)
        # Update matching status timestamp purely natively, ONLY upon final decision (Approved/Rejected/Hold)
        status_time_col = ROLE_STATUS_TIME_COL.get(role)
        if status_time_col and final_status in ["Approved", "Rejected", "Hold"]:
            set_clauses.append(f"{status_time_col} = NOW()")
            
        # Terminal "Rejected" status check
        if final_status.strip().lower() == "rejected":
            set_clauses.append("status = %s")
            values.append("Rejected")

    if comment_col and comments:
        if role == "Management":
             # Append new comments with a special separator containing the timestamp
             # Natively passing NOW() formatted to the string concatenation
             timestamp_expr = "to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM')"
             set_clauses.append(f"{comment_col} = COALESCE({comment_col} || E'\\n' || {timestamp_expr} || '|||' || %s, {timestamp_expr} || '|||' || %s)")
             values.extend([comments, comments])
        else:
             set_clauses.append(f"{comment_col} = %s")
             values.append(comments)

    # "Admin" role — only update admin_description, no status cols
    if role == "Admin" and comments:
        set_clauses.append("admin_description = %s")
        values.append(comments)

    if not set_clauses:
        return {"success": True}  # nothing to do

    values.append(ticket_id)
    sql = f"UPDATE tickets SET {', '.join(set_clauses)} WHERE ticket_id = %s"

    print(f"DEBUG: update_approval_status SQL={sql}, VALUES={values}")

    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, values)
                if cur.rowcount == 0:
                    print(f"WARNING: update_approval_status updated 0 rows for {ticket_id}")
                    return {"success": False, "error": f"No ticket found with ID: {ticket_id}"}
        conn.close()
        return {"success": True}
    except Exception as e:
        print(f"ERROR: update_approval_status: {e}")
        return {"success": False, "error": str(e)}


def update_ticket_mail_time(ticket_id: str, role: str) -> dict:
    """Triggered strictly when mail is sent to log exactly NOW() inside PostgreSQL"""
    ROLE_MAIL_TIME_COL = {
        "Admin-Manager": "admin_manager_mail_time",
        "Management":    "management_mail_time",
    }
    col = ROLE_MAIL_TIME_COL.get(role)
    if not col:
        return {"success": True} # Missing / Not Applicable Role

    sql = f"UPDATE tickets SET {col} = NOW() WHERE ticket_id = %s"

    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, (ticket_id,))
        conn.close()
        return {"success": True}
    except Exception as e:
        print(f"ERROR: update_ticket_mail_time: {e}")
        return {"success": False, "error": str(e)}



# ---------------------------------------------------------------------------
# Assignees CRUD
# ---------------------------------------------------------------------------

def get_assignees(support_type: str = None) -> list:
    """Return all assignees, optionally filtered by support_type."""
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if support_type:
                cur.execute(
                    "SELECT * FROM assignees WHERE is_delete = FALSE AND (support_type ILIKE %s OR support_type ILIKE %s) ORDER BY name ASC",
                    (f"%{support_type}%", support_type)
                )
            else:
                cur.execute("SELECT * FROM assignees WHERE is_delete = FALSE ORDER BY name ASC")
            rows = cur.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"ERROR: get_assignees: {e}")
        return []


def create_assignee(name: str, support_type: str) -> dict:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO assignees (name, support_type) VALUES (%s, %s) RETURNING id;",
                    (name, support_type)
                )
                new_id = cur.fetchone()[0]
        conn.close()
        return {"success": True, "id": new_id}
    except Exception as e:
        return {"success": False, "error": str(e)}


def delete_assignee(assignee_id: int) -> bool:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE assignees SET is_delete = TRUE WHERE id = %s", (assignee_id,))
                deleted = cur.rowcount > 0
        conn.close()
        return deleted
    except Exception as e:
        print(f"ERROR: delete_assignee: {e}")
        return False

def delete_assignee_by_name(name: str) -> bool:
    """Soft delete an assignee by name."""
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE assignees SET is_delete = TRUE WHERE name = %s AND is_delete = FALSE", (name,))
                updated = cur.rowcount > 0
        conn.close()
        return updated
    except Exception as e:
        print(f"ERROR: delete_assignee_by_name: {e}")
        return False


def update_assignee(assignee_id: int, name: str, support_type: str) -> bool:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE assignees SET name = %s, support_type = %s WHERE id = %s",
                    (name, support_type, assignee_id)
                )
                updated = cur.rowcount > 0
        conn.close()
        return updated
    except Exception as e:
        print(f"ERROR: update_assignee: {e}")
        return False
        return False


# ---------------------------------------------------------------------------
# Categories CRUD
# ---------------------------------------------------------------------------

def get_categories(support_type: str = None) -> list:
    """Return all categories, optionally filtered by support_type."""
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if support_type:
                # Same inclusive logic as assignees, assuming categories might be assigned to Both
                cur.execute(
                    "SELECT * FROM categories WHERE is_delete = FALSE AND (support_type ILIKE %s OR support_type ILIKE %s) ORDER BY name ASC",
                    (f"%{support_type}%", support_type)
                )
            else:
                cur.execute("SELECT * FROM categories WHERE is_delete = FALSE ORDER BY name ASC")
            rows = cur.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"ERROR: get_categories: {e}")
        return []

def create_category(name: str, support_type: str) -> dict:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO categories (name, support_type) VALUES (%s, %s) RETURNING id;",
                    (name, support_type)
                )
                new_id = cur.fetchone()[0]
        conn.close()
        return {"success": True, "id": new_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

def update_category(category_id: int, name: str, support_type: str) -> bool:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE categories SET name = %s, support_type = %s WHERE id = %s",
                    (name, support_type, category_id)
                )
                updated = cur.rowcount > 0
        conn.close()
        return updated
    except Exception as e:
        print(f"ERROR: update_category: {e}")
        return False

def delete_category(category_id: int) -> bool:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE categories SET is_delete = TRUE WHERE id = %s", (category_id,))
                deleted = cur.rowcount > 0
        conn.close()
        return deleted
    except Exception as e:
        print(f"ERROR: delete_category: {e}")
        return False


def get_departments(support_type: str = None) -> list:
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if support_type:
                cur.execute(
                    "SELECT * FROM departments WHERE is_delete = FALSE AND (support_type ILIKE %s OR support_type ILIKE %s) ORDER BY name ASC",
                    (f"%{support_type}%", support_type)
                )
            else:
                cur.execute("SELECT * FROM departments WHERE is_delete = FALSE ORDER BY name ASC")
            rows = cur.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"ERROR: get_departments: {e}")
        return []

def create_department(name: str, support_type: str) -> dict:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO departments (name, support_type) VALUES (%s, %s) RETURNING id;",
                    (name, support_type)
                )
                new_id = cur.fetchone()[0]
        conn.close()
        return {"success": True, "id": new_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

def update_department(department_id: int, name: str, support_type: str) -> bool:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE departments SET name = %s, support_type = %s WHERE id = %s",
                    (name, support_type, department_id)
                )
                updated = cur.rowcount > 0
        conn.close()
        return updated
    except Exception as e:
        print(f"ERROR: update_department: {e}")
        return False

def delete_department(department_id: int) -> bool:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE departments SET is_delete = TRUE WHERE id = %s", (department_id,))
                deleted = cur.rowcount > 0
        conn.close()
        return deleted
    except Exception as e:
        print(f"ERROR: delete_department: {e}")
        return False


def delete_ticket(ticket_id: str) -> dict:

    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM tickets WHERE ticket_id = %s", (ticket_id,))
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def soft_delete_ticket(ticket_id: str) -> dict:
    """Mark a ticket as deleted (soft delete)."""
    conn = _get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE tickets SET is_delete = TRUE WHERE ticket_id = %s", (ticket_id,))
        conn.close()
        return {"success": True}
    except Exception as e:
        print(f"ERROR soft deleting ticket {ticket_id}: {e}")
        return {"success": False, "error": str(e)}

def auto_confirm_stale_tickets() -> dict:
    """Find Completed tickets > 1 hr old with user_confirmation='Pending' and auto-confirm them."""
    sql = """
        UPDATE tickets
        SET user_confirmation = 'Yes (System Auto-Confirmed)'
        WHERE status = 'Completed'
          AND user_confirmation = 'Pending'
          AND completed_time IS NOT NULL
          AND completed_time < NOW() - INTERVAL '1 hour';
    """
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                count = cur.rowcount
                if count > 0:
                    print(f"DEBUG: Auto-confirmed {count} stale tickets.")
        conn.close()
        return {"success": True, "count": count}
    except Exception as e:
        print(f"ERROR: Failed to auto-confirm stale tickets: {e}")
        return {"success": False, "error": str(e)}

def delete_expired_attachments() -> dict:
    """
    Clears raw binary attachments older than 7 days to save space.
    - Requester attachments: 7 days after created_at
    - Bill attachments: 7 days after completed_at
    """
    sql_requester = """
        UPDATE tickets
        SET attachment = NULL,
            attachment_name = attachment_name || ' (Deleted after 7 days)'
        WHERE attachment IS NOT NULL
          AND created_at < NOW() - INTERVAL '7 days';
    """
    sql_bills = """
        UPDATE tickets
        SET bill_attachment = NULL,
            bill_attachment_name = bill_attachment_name || ' (Deleted after 7 days)'
        WHERE bill_attachment IS NOT NULL
          AND completed_time IS NOT NULL
          AND completed_time < NOW() - INTERVAL '7 days';
    """
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql_requester)
                req_count = cur.rowcount
                cur.execute(sql_bills)
                bill_count = cur.rowcount
                if req_count > 0 or bill_count > 0:
                    print(f"DEBUG: Cleaned up {req_count} requester attachments and {bill_count} bill attachments.")
        conn.close()
        return {"success": True, "requester_count": req_count, "bill_count": bill_count}
    except Exception as e:
        print(f"ERROR: Failed to delete expired attachments: {e}")
        return {"success": False, "error": str(e)}
