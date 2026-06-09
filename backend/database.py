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


_MANAGER_NAME_CACHE = None

def get_cached_manager_name():
    global _MANAGER_NAME_CACHE
    if _MANAGER_NAME_CACHE is not None:
        return _MANAGER_NAME_CACHE
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM admin_users WHERE receiver_position = 'Manager' LIMIT 1")
            row = cur.fetchone()
        conn.close()
        if row:
            _MANAGER_NAME_CACHE = row[0]
        else:
            _MANAGER_NAME_CACHE = "Manager"
    except Exception as e:
        _MANAGER_NAME_CACHE = "Manager"
    return _MANAGER_NAME_CACHE

def _row_to_ticket(row: dict) -> dict:
    """Convert a DB row (RealDictRow) to the API-facing dict."""
    attachment_name = row.get("attachment_name") or ""
    
    # Try to extract manager name from comments, else use cached name
    manager_comments = row.get("admin_manager_comments") or ""
    manager_status = row.get("admin_manager_status") or ""
    manager_name = "Manager"
    import re
    match = re.match(r'^([^:]+)\s*:\s*(APPROVED|REJECTED|HOLD)', manager_status.strip(), re.I)
    if match:
        manager_name = match.group(1).strip()

    # Overall status calculation: if any tier rejected, overall is Rejected
    mgr_status = row.get("admin_manager_status") or ""
    mgmt_status = row.get("management_status") or ""
    overall_status = row.get("status", "Not Started")
    if "Rejected" in mgr_status or "Rejected" in mgmt_status:
        overall_status = "Rejected"

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
        "status":                 overall_status,
        "subCategory":            row.get("sub_category") or "",
        "adminDescription":       row.get("admin_description") or "",
        "admin_description":      row.get("admin_description") or "",
        "adminManagerStatus":     mgr_status,
        "managerName":            manager_name,
        "managementStatus":       mgmt_status,
        "adminManagerComments":   manager_comments,
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
        "email":                  row.get("email") or "",
        "managementApprovals":    row.get("management_approvals") or [],
        "adminComments":          row.get("admin_comments") or [],
        "admin_comments":         row.get("admin_comments") or [],
        "adminManagerAdminDesc":  row.get("admin_manager_admin_desc") or "",
        "adminManagerApprovals":  row.get("admin_manager_approvals") or [],
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

        # List of ALL columns to ensure they exist (for schema evolution)
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
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS branch TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS department TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS support_type TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS user_confirmation TEXT DEFAULT 'Pending';",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS management_approvals JSONB DEFAULT '[]'::JSONB;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_comments JSONB DEFAULT '[]'::JSONB;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_manager_admin_desc TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sub_category TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_description TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_manager_status TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS management_status TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_manager_comments TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS management_comments TEXT;",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS approval_request_time TIMESTAMPTZ;"
        ]
        try:
            conn = _get_conn()
            with conn:
                with conn.cursor() as cur:
                    for stmt in alter_statements:
                        cur.execute(stmt)
            conn.close()
        except Exception:
            pass

        print("DEBUG: DB initialised.")
    except Exception as e:
        pass

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
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS can_send_mail BOOLEAN DEFAULT FALSE;")
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS receiver_position TEXT;")
                # Add branch field for user filtering
                cur.execute("ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS branch TEXT;")
                # Add per-manager approvals tracking (like management_approvals)
                cur.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_manager_approvals JSONB DEFAULT '[]'::jsonb;")
                # Seed default admin if table is empty
                cur.execute("SELECT COUNT(*) FROM admin_users;")
                if cur.fetchone()[0] == 0:
                    cur.execute(
                        "INSERT INTO admin_users (name, email, password, access, support_type, branch) VALUES (%s, %s, %s, %s, %s, %s)",
                        ("Admin User", "admin@support.com", "Admin@123", "View,Edit,Export", "IT Support,Admin Support", "All")
                    )

                # Migration: Replace ', ' in branch names with '_ '
                cur.execute("UPDATE tickets SET branch = REPLACE(branch, ', ', '_ ') WHERE branch LIKE '%, %';")
                cur.execute("UPDATE admin_users SET branch = REPLACE(branch, ', ', '_ ') WHERE branch LIKE '%, %';")
        conn.close()
        
        # Run auto-cleanup once per restart
        delete_expired_attachments()
        
        print("DEBUG: admin_users table ready.")
    except Exception as e:
        print(f"DEBUG: init_db error: {e}")
        pass


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
        pass

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
        pass

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
        pass

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
        pass


    # ---- asset_types table ----
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS asset_types (
                        id           SERIAL PRIMARY KEY,
                        name         TEXT NOT NULL,
                        is_delete    BOOLEAN DEFAULT FALSE,
                        created_at   TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                cur.execute("ALTER TABLE asset_types ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT FALSE;")
        conn.close()
        print("DEBUG: asset_types table ready.")
    except Exception as e:
        pass

    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                default_asset_types = [
                    ("CPU",), ("Laptop",), ("Access point",), ("Monitor",), 
                    ("NAS",), ("Printer",), ("Server",), ("Switch",), 
                    ("UPS",), ("Mobile",), ("Firewall",)
                ]
                for at in default_asset_types:
                    cur.execute("SELECT COUNT(*) FROM asset_types WHERE name = %s;", at)
                    if cur.fetchone()[0] == 0:
                        cur.execute("INSERT INTO asset_types (name) VALUES (%s)", at)
        conn.close()
        print("DEBUG: asset_types seeded.")
    except Exception as e:
        pass

    # ---- assets table ----
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS assets (
                        id            SERIAL PRIMARY KEY,
                        asset_id      TEXT UNIQUE NOT NULL,
                        category      TEXT,
                        brand         TEXT,
                        model         TEXT,
                        configuration TEXT,
                        serial        TEXT,
                        assignee      TEXT DEFAULT 'Unassigned',
                        emp_code      TEXT,
                        cug           TEXT,
                        email         TEXT,
                        department    TEXT,
                        branch        TEXT,
                        purchase_date DATE,
                        warranty      TEXT,
                        condition     TEXT DEFAULT 'Excellent',
                        remarks       TEXT,
                        images        TEXT,
                        qr_code       TEXT,
                        "group"       TEXT DEFAULT 'IT',
                        created_at    TIMESTAMPTZ DEFAULT NOW(),
                        updated_at    TIMESTAMPTZ DEFAULT NOW()
                    );
                    
                    ALTER TABLE assets ADD COLUMN IF NOT EXISTS images TEXT;
                    ALTER TABLE assets ADD COLUMN IF NOT EXISTS "group" TEXT DEFAULT 'IT';
                    ALTER TABLE assets ALTER COLUMN warranty TYPE TEXT USING warranty::text;
                """)
                
                # Migration: rename tag to asset_id
                try:
                    cur.execute("ALTER TABLE assets RENAME COLUMN tag TO asset_id;")
                except Exception:
                    pass
                
                # Migration: drop status and date column
                try:
                    cur.execute("ALTER TABLE assets DROP COLUMN IF EXISTS status;")
                    cur.execute("ALTER TABLE assets DROP COLUMN IF EXISTS date;")
                except Exception:
                    pass
                
                # Migration: add updated_at column
                try:
                    cur.execute("ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();")
                except Exception:
                    pass
                
                pass
        conn.close()
        print("DEBUG: assets table ready.")
    except Exception as e:
        print(f"DEBUG: assets table error: {e}")

    # Migration: add warranty columns using autocommit (isolated from main transaction)
    try:
        conn_ddl = _get_conn()
        conn_ddl.autocommit = True
        with conn_ddl.cursor() as cur_ddl:
            cur_ddl.execute("ALTER TABLE assets ADD COLUMN IF NOT EXISTS qr_code TEXT;")
            cur_ddl.execute("ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_date DATE;")
            cur_ddl.execute("ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_label TEXT;")
        conn_ddl.close()
        print("DEBUG: warranty columns ensured.")
    except Exception as ddl_e:
        print(f"DEBUG: warranty DDL error: {ddl_e}")

    # Backfill warranty_date and warranty_label in a fresh connection (separate from DDL)

    try:
        conn2 = _get_conn()
        with conn2:
            with conn2.cursor() as cur2:
                cur2.execute("""
                    SELECT id, purchase_date, warranty
                    FROM assets
                    WHERE purchase_date IS NOT NULL
                      AND warranty IS NOT NULL
                      AND (warranty_date IS NULL OR warranty_label IS NULL)
                """)
                rows_to_fix = cur2.fetchall()
                for r in rows_to_fix:
                    rid, pd_val, wr = r[0], r[1], r[2]
                    wdate, wlabel = _compute_warranty_fields(str(pd_val) if pd_val else None, wr)
                    cur2.execute(
                        "UPDATE assets SET warranty_date = %s, warranty_label = %s WHERE id = %s",
                        (wdate, wlabel, rid)
                    )
                if rows_to_fix:
                    print(f"DEBUG: warranty backfill updated {len(rows_to_fix)} rows.")
        conn2.close()
    except Exception as be:
        print(f"DEBUG: warranty backfill error: {be}")




# ---------------------------------------------------------------------------
# Warranty helpers
# ---------------------------------------------------------------------------

def _compute_warranty_fields(purchase_date_str, warranty_text):
    """Given a purchase_date string (YYYY-MM-DD) and a warranty duration string
    like '1 Year', '2 Years', '6 Months', returns (warranty_date, warranty_label).
    warranty_date is a datetime.date object (or None).
    warranty_label is a human-readable string like '1 Year', '6 Months' (or None).
    """
    import datetime
    import re
    import calendar
    if not purchase_date_str or not warranty_text:
        return None, None
    try:
        pd = datetime.date.fromisoformat(str(purchase_date_str)[:10])
    except Exception:
        return None, None

    # 1. Try parsing warranty_text as a direct date string (e.g. '2027-04-12 00:00:00' or '2027-04-12')
    parsed_warranty_date = None
    try:
        parsed_warranty_date = datetime.date.fromisoformat(str(warranty_text)[:10])
    except Exception:
        pass

    if parsed_warranty_date:
        warranty_date = parsed_warranty_date
        total_months = (warranty_date.year - pd.year) * 12 + (warranty_date.month - pd.month)
        if total_months <= 0:
            label = warranty_text
        elif total_months % 12 == 0:
            yrs = total_months // 12
            label = f"{yrs} Year" if yrs == 1 else f"{yrs} Years"
        else:
            label = f"{total_months} Months"
        return warranty_date, label

    # 2. Otherwise, treat as duration string
    wt = warranty_text.strip().lower()
    months = 0
    m = re.match(r'^(\d+(?:\.\d+)?)\s*(year|years|month|months)$', wt)
    if m:
        num = float(m.group(1))
        unit = m.group(2)
        if 'year' in unit:
            months = int(num * 12)
        else:
            months = int(num)
    else:
        # Unrecognised format — keep text as label but no computed date
        return None, warranty_text

    # Compute expiry date
    exp_year  = pd.year + (pd.month - 1 + months) // 12
    exp_month = (pd.month - 1 + months) % 12 + 1
    max_day   = calendar.monthrange(exp_year, exp_month)[1]
    exp_day   = min(pd.day, max_day)
    warranty_date = datetime.date(exp_year, exp_month, exp_day)

    # Build label from actual month difference
    total_months = (warranty_date.year - pd.year) * 12 + (warranty_date.month - pd.month)
    if total_months <= 0:
        label = warranty_text
    elif total_months % 12 == 0:
        yrs = total_months // 12
        label = f"{yrs} Year" if yrs == 1 else f"{yrs} Years"
    else:
        label = f"{total_months} Months"

    return warranty_date, label


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
                u.id, u.name, u.email, u.access, u.support_type, u.is_first_login, u.created_at, u.can_receive_mail, u.receiver_position, u.branch, u.can_send_mail,
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


def create_admin_user(name: str, email: str, password: str, access: str = "View", support_type: str = "IT Support,Admin Support", can_receive_mail: bool = False, can_send_mail: bool = False, receiver_position: str = None, branch: str = "") -> dict:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO admin_users (name, email, password, access, support_type, can_receive_mail, can_send_mail, receiver_position, branch) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;",
                (name, email, password, access, support_type, can_receive_mail, can_send_mail, receiver_position, branch)
            )
            new_id = cur.fetchone()[0]
    conn.close()
    return {"id": new_id}


def update_admin_user(user_id: int, name: str, email: str, password: str, access: str, support_type: str, can_receive_mail: bool = False, can_send_mail: bool = False, receiver_position: str = None, branch: str = "") -> bool:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            if password:
                cur.execute(
                    "UPDATE admin_users SET name = %s, email = %s, password = %s, access = %s, support_type = %s, can_receive_mail = %s, can_send_mail = %s, receiver_position = %s, branch = %s WHERE id = %s;",
                    (name, email, password, access, support_type, can_receive_mail, can_send_mail, receiver_position, branch, user_id)
                )
            else:
                cur.execute(
                    "UPDATE admin_users SET name = %s, email = %s, access = %s, support_type = %s, can_receive_mail = %s, can_send_mail = %s, receiver_position = %s, branch = %s WHERE id = %s;",
                    (name, email, access, support_type, can_receive_mail, can_send_mail, receiver_position, branch, user_id)
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
            "SELECT id, name, email, access, support_type, is_first_login, receiver_position, branch, can_receive_mail, can_send_mail FROM admin_users WHERE email = %s AND password = %s;",
            (email, password)
        )
        row = cur.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0], 
            "name": row[1], 
            "email": row[2], 
            "access": row[3], 
            "support_type": row[4], 
            "is_first_login": row[5] if len(row) > 5 else True,
            "receiver_position": row[6] if len(row) > 6 else None,
            "branch": row[7] if len(row) > 7 else "",
            "can_receive_mail": row[8] if len(row) > 8 else False,
            "can_send_mail": row[9] if len(row) > 9 else False
        }
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
                         status, sub_category, branch, department, support_type, email)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
                        data.get("email", ""),
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
        return None


def get_all_tickets(support_types: list = None, branches: list = None) -> list:
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = "SELECT * FROM tickets WHERE is_delete = FALSE"
            params = []

            if support_types:
                query += " AND (support_type = ANY(%s::text[]) OR support_type IS NULL OR support_type = '')"
                params.append(support_types)
            
            if branches and 'All' not in branches:
                query += " AND (branch = ANY(%s::text[]))"
                params.append(branches)

            query += " ORDER BY created_at DESC"
            cur.execute(query, params)
            rows = cur.fetchall()
        conn.close()
        return [_row_to_ticket(r) for r in rows]
    except Exception as e:
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
        "admin_comments": "admin_comments",
    }
    # If user rejects the resolution, move back to Pending
    if updates.get("user_confirmation") == "No" and "status" not in updates:
        updates["status"] = "Pending"

    set_clauses = []
    values = []

    for key, col in COLUMN_MAP.items():
        if key in updates:
            val = updates[key]
            # Wrap JSON types in psycopg2.extras.Json for correct adaptation
            if isinstance(val, (list, dict)):
                val = psycopg2.extras.Json(val)
            set_clauses.append(f"{col} = %s")
            values.append(val)

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



def update_approval_status(ticket_id: str, role: str, status: str, comments: str = "", responder_name: str = "Unknown", admin_description: str = None) -> dict:
    """
    role:   "Admin-Manager" | "Management" | "Admin"
    Updates the correct columns based on role.
    For Management, all data is persisted as a structured JSON array in management_approvals.
    """

    import json as _json
    from datetime import datetime as _dt

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
    ist_now = _dt.now().strftime("%d-%m-%Y %I:%M %p")

    # ── Management: JSON-array approach ──────────────────────────────────────
    if role == "Management":
        try:
            conn = _get_conn()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT management_approvals, management_status FROM tickets WHERE ticket_id = %s",
                    (ticket_id,)
                )
                row = cur.fetchone()
            conn.close()

            approvals = row[0] if (row and row[0]) else []
            if isinstance(approvals, str):
                try:
                    approvals = _json.loads(approvals)
                except Exception:
                    approvals = []
            existing_statuses = row[1] if row else ""

            # Find or create the entry for this responder
            entry = next((e for e in approvals if e.get("name") == responder_name), None)
            if entry is None:
                entry = {"name": responder_name, "mail_receive": None, "decision_made": None, "comments": None, "admin_description": admin_description}
                approvals.append(entry)

            if admin_description:
                entry["admin_description"] = admin_description
                # Backward compatibility for 'admin_desc' as requested in JSON example
                entry["admin_desc"] = admin_description

            if status == "Pending":
                entry["mail_receive"] = ist_now
                entry["decision_made"] = None
                entry["comments"] = None
                entry["status"] = "Pending"
            else:
                entry["decision_made"] = ist_now
                entry["comments"] = (comments or status).strip()
                entry["status"] = status

            set_clauses.append("management_approvals = %s")
            values.append(_json.dumps(approvals))

            # Keep legacy management_status text in sync for backward compat
            # Rebuild: "Name: Status, Name2: Status2"
            status_parts = []
            for e in approvals:
                s = "Pending"
                if e.get("decision_made"):
                    c = (e.get("comments") or "").strip().lower()
                    if "approved" in c:
                        s = "Approved"
                    elif "rejected" in c:
                        s = "Rejected"
                    elif "hold" in c:
                        s = "Hold"
                    else:
                        s = "Approved"  # default when decision_made is set
                status_parts.append(f"{e['name']}: {s}")
            set_clauses.append("management_status = %s")
            values.append(", ".join(status_parts))

            # Update status time when a final decision lands
            if status in ["Approved", "Rejected", "Hold"]:
                set_clauses.append("management_status_time = NOW()")



        except Exception as e:
            return {"success": False, "error": str(e)}

    else:
        # ── Admin-Manager: append logic (supports multiple managers) ───────────
        # Read existing status, comments, and per-manager approvals JSON
        try:
            _conn = _get_conn()
            with _conn.cursor() as _cur:
                _cur.execute(
                    "SELECT admin_manager_status, admin_manager_comments, admin_manager_approvals FROM tickets WHERE ticket_id = %s",
                    (ticket_id,)
                )
                _existing = _cur.fetchone()
            _conn.close()
        except Exception:
            _existing = None

        existing_status_str   = (_existing[0] if _existing and _existing[0] else "").strip()
        existing_comments_str = (_existing[1] if _existing and _existing[1] else "").strip()
        existing_approvals    = _existing[2] if (_existing and _existing[2]) else []
        if isinstance(existing_approvals, str):
            try:
                existing_approvals = _json.loads(existing_approvals)
            except Exception:
                existing_approvals = []

        # Merge: update existing entry for this manager or append new one
        status_parts = {}
        for s in existing_status_str.split(','):
            s = s.strip()
            if ':' in s:
                k, v = s.split(':', 1)
                status_parts[k.strip()] = v.strip()
        status_parts[responder_name] = status
        new_status_str = ", ".join(f"{k}: {v}" for k, v in status_parts.items())

        # Per-manager approvals JSON — find or create entry
        mgr_entry = next((e for e in existing_approvals if e.get('name') == responder_name), None)
        if mgr_entry is None:
            mgr_entry = {'name': responder_name, 'mail_receive': None, 'decision_made': None, 'status': 'Pending', 'admin_description': admin_description}
            existing_approvals.append(mgr_entry)

        if status == 'Pending':
            mgr_entry['mail_receive'] = ist_now
            mgr_entry['admin_description'] = admin_description or ''
            mgr_entry['status'] = 'Pending'
        else:
            mgr_entry['decision_made'] = ist_now
            mgr_entry['status'] = status

        set_clauses.append("admin_manager_approvals = %s")
        values.append(_json.dumps(existing_approvals))

        if col:
            set_clauses.append(f"{col} = %s")
            values.append(new_status_str)

            status_time_col = ROLE_STATUS_TIME_COL.get(role)
            if status_time_col and status in ["Approved", "Rejected", "Hold"]:
                set_clauses.append(f"{status_time_col} = NOW()")

        if comment_col and comments:
            # Append new comment for this manager, preserving previous comments
            new_comment_line = f"{responder_name}: {comments}"
            new_comments_str = (existing_comments_str + "\n" + new_comment_line).strip() if existing_comments_str else new_comment_line
            set_clauses.append(f"{comment_col} = %s")
            values.append(new_comments_str)

        if role == "Admin-Manager" and admin_description:
            set_clauses.append("admin_manager_admin_desc = %s")
            values.append(admin_description)

    # "Admin" role — only update admin_description, no status cols
    if role == "Admin" and comments:
        set_clauses.append("admin_description = %s")
        values.append(comments)

    if not set_clauses:
        return {"success": True}  # nothing to do

    values.append(ticket_id)
    sql = f"UPDATE tickets SET {', '.join(set_clauses)} WHERE ticket_id = %s"



    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql, values)
                if cur.rowcount == 0:
                    pass
                    return {"success": False, "error": f"No ticket found with ID: {ticket_id}"}
        conn.close()
        return {"success": True}
    except Exception as e:
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
        return {"success": False, "error": str(e)}

def auto_confirm_stale_tickets() -> dict:
    """Find Completed tickets > 24 hrs old with user_confirmation='Pending' and auto-confirm them."""
    sql = """
        UPDATE tickets
        SET user_confirmation = 'Yes (System Auto-Confirmed)'
        WHERE status = 'Completed'
          AND user_confirmation = 'Pending'
          AND completed_time IS NOT NULL
          AND completed_time < NOW() - INTERVAL '24 hours';
    """
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                count = cur.rowcount
                if count > 0:
                    pass
        conn.close()
        return {"success": True, "count": count}
    except Exception as e:
        return {"success": False, "error": str(e)}

def delete_expired_attachments() -> dict:
    """
    Clears raw binary attachments older than 30 days to save space.
    - Requester attachments: 30 days after created_at
    - Bill attachments: 30 days after created_at (or completed_at if available)
    """
    sql_requester = """
        UPDATE tickets
        SET attachment = NULL,
            attachment_name = attachment_name || ' (Deleted after 30 days)'
        WHERE attachment IS NOT NULL
          AND created_at < NOW() - INTERVAL '30 days';
    """
    sql_bills = """
        UPDATE tickets
        SET bill_attachment = NULL,
            bill_attachment_name = bill_attachment_name || ' (Deleted after 30 days)'
        WHERE bill_attachment IS NOT NULL
          AND created_at < NOW() - INTERVAL '30 days';
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
                    pass
        conn.close()
        return {"success": True, "requester_count": req_count, "bill_count": bill_count}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Assets CRUD
# ---------------------------------------------------------------------------

def _row_to_asset(row: dict) -> dict:
    import json
    try:
        images_list = json.loads(row.get("images")) if row.get("images") else []
    except Exception:
        images_list = []
    return {
        "id":            row.get("id"),
        "assetId":       row.get("asset_id", ""),
        "category":      row.get("category", ""),
        "brand":         row.get("brand", ""),
        "model":         row.get("model", ""),
        "configuration": row.get("configuration", ""),
        "serial":        row.get("serial", ""),
        "assignee":      row.get("assignee", "Unassigned"),
        "empCode":       row.get("emp_code", ""),
        "cug":           row.get("cug", ""),
        "email":         row.get("email", ""),
        "department":    row.get("department", ""),
        "branch":        row.get("branch", ""),
        "group":         row.get("group", "IT"),
        "purchaseDate":  str(row["purchase_date"]) if row.get("purchase_date") else "",
        "warranty":      str(row["warranty"]) if row.get("warranty") else "",
        "warrantyDate":  str(row["warranty_date"]) if row.get("warranty_date") else "",
        "warrantyLabel": str(row["warranty_label"]) if row.get("warranty_label") else "",
        "condition":     row.get("condition", "Excellent"),
        "remarks":       row.get("remarks", ""),
        "images":        images_list,
        "qrCode":        f"/api/assets/{row.get('asset_id')}/qr" if row.get('asset_id') else "",
        "updatedAt":     row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
    }


def get_all_assets() -> list:
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM assets ORDER BY created_at DESC")
            rows = cur.fetchall()
        conn.close()
        return [_row_to_asset(r) for r in rows]
    except Exception as e:
        return []


def create_asset(data: dict) -> dict:
    import json
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                w_date, w_label = _compute_warranty_fields(
                    data.get("purchaseDate"), data.get("warranty")
                )
                cur.execute("""
                    INSERT INTO assets
                        (asset_id, category, brand, model, configuration, serial,
                         assignee, emp_code, cug, email, department, branch,
                         purchase_date, warranty, warranty_date, warranty_label,
                         condition, remarks, images, qr_code, "group")
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING id, asset_id
                """, (
                    data.get("assetId"),
                    data.get("category", ""),
                    data.get("brand", ""),
                    data.get("model", ""),
                    data.get("configuration", ""),
                    data.get("serial", ""),
                    data.get("assignee", "Unassigned"),
                    data.get("empCode", ""),
                    data.get("cug", ""),
                    data.get("email", ""),
                    data.get("department", ""),
                    data.get("branch", ""),
                    data.get("purchaseDate") or None,
                    data.get("warranty") or None,
                    w_date,
                    w_label,
                    data.get("condition", "Excellent"),
                    data.get("remarks", ""),
                    json.dumps(data.get("images") or []),
                    data.get("qrCode", ""),
                    data.get("group", "IT"),
                ))
                row = cur.fetchone()
        conn.close()
        return {"success": True, "id": row[0], "assetId": row[1]}
    except Exception as e:
        return {"success": False, "error": str(e)}


def update_asset(asset_id: int, data: dict) -> dict:
    import json
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                w_date, w_label = _compute_warranty_fields(
                    data.get("purchaseDate"), data.get("warranty")
                )
                cur.execute("""
                    UPDATE assets SET
                        category = %s, brand = %s, model = %s,
                        configuration = %s, serial = %s, assignee = %s,
                        emp_code = %s, cug = %s, email = %s,
                        department = %s, branch = %s,
                        purchase_date = %s, warranty = %s,
                        warranty_date = %s, warranty_label = %s,
                        condition = %s, remarks = %s, images = %s,
                        qr_code = %s, "group" = %s, updated_at = NOW()
                    WHERE id = %s
                """, (
                    data.get("category", ""),
                    data.get("brand", ""),
                    data.get("model", ""),
                    data.get("configuration", ""),
                    data.get("serial", ""),
                    data.get("assignee", "Unassigned"),
                    data.get("empCode", ""),
                    data.get("cug", ""),
                    data.get("email", ""),
                    data.get("department", ""),
                    data.get("branch", ""),
                    data.get("purchaseDate") or None,
                    data.get("warranty") or None,
                    w_date,
                    w_label,
                    data.get("condition", "Excellent"),
                    data.get("remarks", ""),
                    json.dumps(data.get("images") or []),
                    data.get("qrCode", ""),
                    data.get("group", "IT"),
                    asset_id,
                ))
                updated = cur.rowcount > 0
        conn.close()
        return {"success": updated}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"DEBUG: update_asset error: {e}")
        return {"success": False, "error": str(e)}


def delete_asset(asset_id: int) -> dict:
    try:
        conn = _get_conn()
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM assets WHERE id = %s", (asset_id,))
                deleted = cur.rowcount > 0
        conn.close()
        return {"success": deleted}
    except Exception as e:
        return {"success": False, "error": str(e)}



# ---------------------------------------------------------------------------
# Asset Types CRUD
# ---------------------------------------------------------------------------

def get_asset_types() -> list:
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, created_at FROM asset_types WHERE is_delete = FALSE ORDER BY created_at ASC;")
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].strftime("%d-%m-%Y %I:%M %p")
    return rows

def create_asset_type(name: str) -> dict:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO asset_types (name) VALUES (%s) RETURNING id;",
                (name,)
            )
            new_id = cur.fetchone()[0]
    conn.close()
    return {"id": new_id}

def update_asset_type(type_id: int, name: str) -> bool:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE asset_types SET name = %s WHERE id = %s;",
                (name, type_id)
            )
            updated = cur.rowcount > 0
    conn.close()
    return updated

def delete_asset_type(type_id: int) -> bool:
    conn = _get_conn()
    with conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE asset_types SET is_delete = TRUE WHERE id = %s;", (type_id,))
            deleted = cur.rowcount > 0
    conn.close()
    return deleted
