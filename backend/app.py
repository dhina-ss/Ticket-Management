from flask import Flask, request, jsonify, send_file, send_from_directory, redirect
from flask_cors import CORS
import psycopg2

from database import (
    init_db,
    append_to_sheet,
    get_existing_ids,
    get_ticket_by_id,
    get_all_tickets,
    update_ticket_details,
    update_approval_status,
    delete_ticket,
    soft_delete_ticket,
    get_attachment,
    update_ticket_mail_time,
    auto_confirm_stale_tickets,
    delete_expired_attachments,
    get_asset_types,
    create_asset_type,
    update_asset_type,
    delete_asset_type,
)

import os
import io
import random
import string
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'dist'))
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
CORS(app)

@app.before_request
def limit_hosts():
    if app.config.get('TESTING'):
        return

    env = os.environ.get('APP_ENV', 'local')
    req_host = request.host

    if env == 'local':
        allowed = {'localhost', 'localhost:443', 'localhost:5000', '127.0.0.1', '127.0.0.1:443', '127.0.0.1:5000', '[::1]', '[::1]:443', '[::1]:5000'}
    else:
        allowed = {'122.165.253.167', '122.165.253.167:443'}

    if req_host not in allowed:
        return jsonify({"error": "Forbidden: Access denied for this host."}), 403

LAST_SENT_EMAIL = None # Store the last sent email for E2E testing

logging.basicConfig(
    filename='ticket_log.txt',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# ---------------------------------------------------------------------------
# Email Setup
# ---------------------------------------------------------------------------
SMTP_SERVER   = "smtp.gmail.com"
SMTP_PORT     = 587
EMAIL_SENDER  = "ticketmanagement066@gmail.com"
EMAIL_PASSWORD = "rudfjqwrxbcwauin"
# Initialise DB on startup
init_db()


# ---------------------------------------------------------------------------
# Email helper
# ---------------------------------------------------------------------------
def send_approval_email(ticket_data, to_email, receiver_name, role="Management"):
    """
    Sends a styled approval email.
    role: "Admin-Manager" or "Management"
    ticket_data must include: ticket_id, fullName, category, subCategory,
                              subject, description, adminDescription, admin_name,
                              mobile, status, timestamp
    """
    if not all([EMAIL_SENDER, EMAIL_PASSWORD]):
        return
    if not to_email:
        return

    try:
        ticket_id    = ticket_data.get('ticket_id', '')
        admin_name   = ticket_data.get('admin_name', 'Admin')
        admin_desc   = ticket_data.get('admin_description', ticket_data.get('adminDescription', ''))

        # Environment-based host selection
        env = os.environ.get('APP_ENV', 'local')
        if env == 'prod':
            host = "http://122.165.253.167:443"
        else:
            host = "http://localhost:443"

        import urllib.parse
        encoded_name  = urllib.parse.quote(receiver_name)
        approval_link = f"{host}/approval/action/{ticket_id}/{role}?name={encoded_name}"

        subject = f"Approval Request: New Asset Request \u2013 {ticket_id}"

        # Gather approval history
        history_html = ""
        history_rows = []
        admin_comments_history = ticket_data.get('admin_comments') or []

        # 1. Manager Approval
        mgr_status = ticket_data.get('adminManagerStatus', '')
        actual_name = ""
        actual_status = mgr_status or "Approved"
        if ":" in mgr_status:
            parts = mgr_status.split(":", 1)
            actual_name = parts[0].strip()
            actual_status = parts[1].strip()

        mgr_comments = ticket_data.get('adminManagerComments', '')
        actual_comments = mgr_comments
        # Remove name prefix from comments if it exists
        if actual_name and actual_comments.startswith(actual_name + ":"):
            actual_comments = actual_comments[len(actual_name)+1:].strip()

        # Find Admin Description sent to Manager
        mgr_admin_desc = ticket_data.get('adminManagerAdminDesc') or next((c['comment'] for c in reversed(admin_comments_history) if c.get('target_role') == 'Manager'), ticket_data.get('admin_description', ''))

        mgr_time = ticket_data.get('adminManagerStatusTime', '')
        if mgr_status or mgr_comments:
            history_rows.append({
                "user_label": "Manager",
                "name": actual_name,
                "status": actual_status,
                "comments": actual_comments or "No comments provided.",
                "admin_description": mgr_admin_desc,
                "time": mgr_time
            })

        # 2. Management Approvals
        mgmt_approvals = ticket_data.get('managementApprovals')
        if mgmt_approvals and isinstance(mgmt_approvals, list) and len(mgmt_approvals) > 0:
            for entry in mgmt_approvals:
                if entry.get("decision_made"):
                    raw_comments = entry.get("comments") or ""
                    status = "Approved"
                    if "rejected" in raw_comments.lower():
                        status = "Rejected"
                    elif "hold" in raw_comments.lower():
                        status = "Hold"
                    
                    # Find Admin Description sent to this specific Management person
                    approver_name = entry.get("name", "Unknown")
                    mgmt_admin_desc = entry.get("admin_description") or entry.get("admin_desc") or \
                                      next((c['comment'] for c in reversed(admin_comments_history) if c.get('target_role') == 'Management' and c.get('recipients') and approver_name in c.get('recipients', [])), 
                                           next((c['comment'] for c in reversed(admin_comments_history) if c.get('target_role') == 'Management' and not c.get('recipients')), 
                                                ticket_data.get('admin_description', '')))

                    history_rows.append({
                        "user_label": "Management",
                        "name": approver_name,
                        "status": status,
                        "comments": raw_comments or "No comments provided.",
                        "admin_description": mgmt_admin_desc,
                        "time": entry.get("decision_made")
                    })
        else:
            # Legacy fallback
            mgmt_raw = ticket_data.get('managementComments', '')
            if mgmt_raw:
                import re
                lines = [l.strip() for l in mgmt_raw.split('\n') if l.strip()]
                for line in lines:
                    parts = line.split('|||')
                    time_str = parts[0].strip() if len(parts) > 0 else ""
                    content = parts[1].strip() if len(parts) > 1 else line
                    
                    match = re.match(r"^([^[]+)\s*\[(APPROVED|REJECTED|HOLD)\]:\s*(.*)$", content, re.IGNORECASE)
                    if match:
                        f_name = match.group(1).strip()
                        # Fallback admin desc for legacy
                        f_admin_desc = next((c['comment'] for c in admin_comments_history if c.get('target_role') == 'Management'), ticket_data.get('admin_description', ''))
                        history_rows.append({
                            "user_label": "Management",
                            "name": f_name,
                            "status": match.group(2).strip().capitalize(),
                            "comments": match.group(3).strip(),
                            "admin_description": f_admin_desc,
                            "time": time_str
                        })
                    else:
                        fallback_name = ""
                        fallback_comments = content
                        if ":" in content:
                            fparts = content.split(":", 1)
                            fallback_name = fparts[0].strip()
                            fallback_comments = fparts[1].strip()

                        mgmt_status = ticket_data.get('managementStatus', '')
                        actual_stat = "Recorded"
                        if fallback_name and mgmt_status:
                            if f"{fallback_name}: Approved" in mgmt_status:
                                actual_stat = "Approved"
                            elif f"{fallback_name}: Rejected" in mgmt_status:
                                actual_stat = "Rejected"
                            elif f"{fallback_name}: Hold" in mgmt_status:
                                actual_stat = "Hold"
                            elif f"{fallback_name}: Pending" in mgmt_status:
                                actual_stat = "Pending"
                        
                        f_admin_desc = next((c['comment'] for c in admin_comments_history if c.get('target_role') == 'Management'), ticket_data.get('admin_description', ''))
                        history_rows.append({
                            "user_label": "Management",
                            "name": fallback_name,
                            "status": actual_stat,
                            "comments": fallback_comments,
                            "admin_description": f_admin_desc,
                            "time": time_str
                        })

        has_history = any(row['status'].lower() not in ['pending', 'recorded', ''] for row in history_rows)
        if history_rows and has_history:
            rows_html = ""
            for row in history_rows:
                status_color = "#16a34a" if row['status'].lower() == "approved" else "#dc2626" if row['status'].lower() == "rejected" else "#333"
                rows_html += f"""
                <tr>
                  <td style="border: 1px solid #e2e8f0; padding: 8px;"><strong>{row['user_label']}</strong><br><small style="color:#64748b;">{row['time']}</small></td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px; font-weight: 500;">{row['name']}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px; color: {status_color}; font-weight: bold;">{row['status']}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px; font-style: italic; color: #475569;">{row['comments']}</td>
                  <td style="border: 1px solid #e2e8f0; padding: 8px; background-color: #f8fafc; font-size: 12px; color: #64748b;">{row['admin_description']}</td>
                </tr>
                """

            history_html = f"""
            <h3 style="color:#2563eb;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-top:24px;">Approval History</h3>
            <table border="0" cellpadding="0" cellspacing="0" 
                   style="border-collapse:collapse;width:100%;max-width:700px;margin-bottom:24px;font-size:13px;border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; width: 20%;">User</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; width: 15%;">Name</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; width: 10%;">Status</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; width: 25%;">Comments</th>
                  <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left; width: 30%;">Admin Justification</th>
                </tr>
              </thead>
              <tbody>
                {rows_html}
              </tbody>
            </table>
            """

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
          <div style="background:#2563eb;padding:24px 32px;">
            <h2 style="color:#fff;margin:0;">Asset Request Approval Required</h2>
            <p style="color:#bfdbfe;margin:4px 0 0;">Ticket #{ticket_id}</p>
          </div>
          <div style="padding:24px 32px;">
            <p style="font-size:16px;font-weight:600;color:#1e293b;margin-bottom:4px;">Dear {receiver_name},</p>
            <p>
              An asset request has been submitted by <strong>{ticket_data.get('fullName', '')}</strong>
              and has been escalated by <strong>{admin_name}</strong> for your approval.
            </p>

            <h3 style="color:#2563eb;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Ticket Information</h3>
            <table border="1" cellpadding="8" cellspacing="0"
                   style="border-collapse:collapse;width:100%;max-width:600px;margin-bottom:20px;font-size:14px;">
              <tr style="background:#f8fafc;">
                <td style="width:35%;"><strong>Ticket ID</strong></td>
                <td>{ticket_id}</td>
              </tr>
              <tr>
                <td><strong>Submitted On</strong></td>
                <td>{ticket_data.get('timestamp', '')}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td><strong>Requester Name</strong></td>
                <td>{ticket_data.get('fullName', '')}</td>
              </tr>
              <tr>
                <td><strong>Mobile</strong></td>
                <td>{ticket_data.get('mobile', '')}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td><strong>Category</strong></td>
                <td>{ticket_data.get('category', '')} – {ticket_data.get('subCategory', '')}</td>
              </tr>

              <tr style="background:#f8fafc;">
                <td><strong>Requester Description</strong></td>
                <td style="white-space:pre-wrap;">{ticket_data.get('description', '')}</td>
              </tr>
              <tr>
                <td><strong>Current Status</strong></td>
                <td>{ticket_data.get('status', '')}</td>
              </tr>
            </table>

            <h3 style="color:#2563eb;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Admin Details</h3>
            <table border="1" cellpadding="8" cellspacing="0"
                   style="border-collapse:collapse;width:100%;max-width:600px;margin-bottom:24px;font-size:14px;">
              <tr style="background:#f8fafc;">
                <td style="width:35%;"><strong>Handled By (Admin)</strong></td>
                <td>{admin_name}</td>
              </tr>
              <tr>
                <td><strong>Admin Justification</strong></td>
                <td style="white-space:pre-wrap;">{admin_desc}</td>
              </tr>
            </table>

            {history_html}

            <div style="margin:30px 0;">
              <a href="{approval_link}"
                 style="background-color:#2563eb;color:white;padding:12px 28px;
                        text-decoration:none;border-radius:6px;font-weight:bold;
                        display:inline-block;">
                Review &amp; Approve Request
              </a>
            </div>
            <p style="font-size:0.85em;color:#666;">
              If the button doesn\'t work, copy this link into your browser:<br>
              <a href="{approval_link}">{approval_link}</a>
            </p>
          </div>
          <div style="background:#f1f5f9;padding:16px 32px;font-size:0.8em;color:#94a3b8;">
            This is an automated message from the Ticket Raise system.
          </div>
        </body>
        </html>
        """
        msg = MIMEMultipart()
        msg['From']    = EMAIL_SENDER
        msg['To']      = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        # Helper function to attach files safely
        def attach_file(file_bytes, filename):
            if file_bytes and filename:
                from email.mime.base import MIMEBase
                from email import encoders
                part = MIMEBase("application", "octet-stream")
                part.set_payload(file_bytes)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename={filename}")
                msg.attach(part)

        # Attach original user file if present
        user_bytes = ticket_data.get('user_attachment_bytes')
        user_name  = ticket_data.get('user_attachment_name')
        attach_file(user_bytes, user_name)

        # Attach admin file if present
        admin_bytes = ticket_data.get('admin_attachment_bytes')
        admin_name  = ticket_data.get('admin_attachment_name')
        attach_file(admin_bytes, admin_name)

        # Capture for E2E testing
        global LAST_SENT_EMAIL
        LAST_SENT_EMAIL = {
            "to": to_email,
            "subject": subject,
            "body": body
        }

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, to_email, msg.as_string())
        server.quit()

    except Exception:
        pass


def send_new_ticket_notification(ticket_data, recipient_email):
    """
    Sends notification email to a specified recipient when a new ticket is created.
    """
    if not all([EMAIL_SENDER, EMAIL_PASSWORD]):
        return

    try:
        ticket_id = ticket_data.get('ticket_id', '')
        name = ticket_data.get('fullName', 'Unknown')
        category = ticket_data.get('category', '')
        sub_category = ticket_data.get('subCategory', '')
        branch = ticket_data.get('branch', '')
        department = ticket_data.get('department', '')
        description = ticket_data.get('description', '')

        subject = f"New Ticket {ticket_id} from {name}"
        
        category_display = f"{category} ({sub_category})" if sub_category else category
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2563eb;">New Ticket Received</h2>
          <p>A new ticket has been created with the following details:</p>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
            <tr><td style="width: 30%;"><strong>Ticket ID</strong></td><td>{ticket_id}</td></tr>
            <tr><td><strong>From (Name)</strong></td><td>{name}</td></tr>
            <tr><td><strong>Branch</strong></td><td>{branch}</td></tr>
            <tr><td><strong>Department</strong></td><td>{department}</td></tr>
            <tr><td><strong>Category</strong></td><td>{category_display}</td></tr>
            <tr><td><strong>Description</strong></td><td style="white-space: pre-wrap;">{description}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
            This is an automated notification from the Ticket Raise system.
          </p>
        </body>
        </html>
        """

        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['To'] = recipient_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        # Capture for E2E testing
        global LAST_SENT_EMAIL
        LAST_SENT_EMAIL = {
            "to": recipient_email,
            "subject": subject,
            "body": body
        }

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, recipient_email, msg.as_string())
        server.quit()

    except Exception:
        pass


def send_completion_email(ticket_data):
    """
    Sends an email to the requester when a ticket is marked as Completed.
    Includes details and a link to confirm the resolution.
    """
    to_email = ticket_data.get('email')
    if not all([EMAIL_SENDER, EMAIL_PASSWORD, to_email]):
        return

    try:
        ticket_id = ticket_data.get('ticket_id', '')
        
        # Environment-based host selection
        env = os.environ.get('APP_ENV', 'local')
        if env == 'prod':
            host = "http://122.165.253.167:443"
        else:
            host = "http://localhost:443"

        status_link = f"{host}/status?ticketId={ticket_id}"

        subject = f"Ticket Resolved: {ticket_id}"
        
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
          <div style="background:#10b981;padding:24px 32px;">
            <h2 style="color:#fff;margin:0;">Ticket Resolved</h2>
            <p style="color:#d1fae5;margin:4px 0 0;">Ticket #{ticket_id}</p>
          </div>
          <div style="padding:24px 32px;">
            <p style="font-size:16px;font-weight:600;color:#1e293b;margin-bottom:4px;">Dear {ticket_data.get('fullName', '')},</p>
            <p>
              Your ticket has been marked as <strong>Completed</strong> by our team. 
              Please review the details below and confirm if the issue has been resolved to your satisfaction.
            </p>

            <h3 style="color:#10b981;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Ticket Summary</h3>
            <table border="0" cellpadding="8" cellspacing="0" style="width:100%;max-width:600px;margin-bottom:20px;font-size:14px;border: 1px solid #e2e8f0; border-collapse: collapse;">
              <tr style="background:#f8fafc;">
                <td style="width:35%; border: 1px solid #e2e8f0;"><strong>Ticket ID</strong></td>
                <td style="border: 1px solid #e2e8f0;">{ticket_id}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e2e8f0;"><strong>Category</strong></td>
                <td style="border: 1px solid #e2e8f0;">{ticket_data.get('category', '')}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="border: 1px solid #e2e8f0;"><strong>Description</strong></td>
                <td style="border: 1px solid #e2e8f0; white-space:pre-wrap;">{ticket_data.get('description', '')}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e2e8f0;"><strong>Resolved By</strong></td>
                <td style="border: 1px solid #e2e8f0;">{ticket_data.get('assignee', 'Support Team')}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #e2e8f0;"><strong>Resolution Comments</strong></td>
                <td style="border: 1px solid #e2e8f0; font-style: italic;">{ticket_data.get('resolutionComments', 'No comments provided.')}</td>
              </tr>
            </table>

            <div style="margin:30px 0;">
              <a href="{status_link}"
                 style="background-color:#10b981;color:white;padding:12px 28px;
                        text-decoration:none;border-radius:6px;font-weight:bold;
                        display:inline-block;">
                Confirm Resolution
              </a>
            </div>
            <p style="font-size:0.85em;color:#666;">
              If you believe the issue is not fixed, you can also report it via the link above.
            </p>
          </div>
          <div style="background:#f1f5f9;padding:16px 32px;font-size:0.8em;color:#94a3b8;">
            This is an automated message from the Ticket Raise system.
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        # Capture for E2E testing
        global LAST_SENT_EMAIL
        LAST_SENT_EMAIL = {
            "to": to_email,
            "subject": subject,
            "body": body
        }

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, to_email, msg.as_string())
        server.quit()

    except Exception:
        pass


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    try:
        support_type_arg = request.args.get("support_type")
        branch_arg = request.args.get("branch")
        support_types = None
        branches = None
        if support_type_arg:
            support_types = [s.strip() for s in support_type_arg.split(',') if s.strip()]
        if branch_arg:
            branches = [b.strip() for b in branch_arg.split(',') if b.strip()]
        return jsonify(get_all_tickets(support_types, branches)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users', methods=['GET'])
def get_users():
    """Return all admin dashboard users."""
    try:
        from database import get_admin_users
        return jsonify(get_admin_users()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new admin dashboard user."""
    try:
        from database import create_admin_user
        data = request.json or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()
        access = data.get("access", "View").strip()
        support_type = data.get("support_type", "IT Support,Admin Support").strip()
        can_receive_mail = data.get("can_receive_mail", False)
        can_send_mail = data.get("can_send_mail", False)
        receiver_position = data.get("receiver_position", "").strip() or None
        branch = data.get("branch", "All").strip()
        allowed_menus = data.get("allowed_menus", "").strip()
        role = data.get("role", "user").strip()

        if not name or not email or not password:
            return jsonify({"error": "Name, email and password are required."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long."}), 400
        result = create_admin_user(name, email, password, access, support_type, can_receive_mail, can_send_mail, receiver_position, branch, allowed_menus, role)
        logging.info(f"Admin Action: Created new user - Name: {name}, Email: {email}, Access: {access}, Support: {support_type}")
        
        # Optionally add as assignee
        if data.get("add_as_assignee"):
            from database import create_assignee
            create_assignee(name, support_type)
            logging.info(f"Admin Action: Automatically added user {name} as assignee.")

        return jsonify(result), 201
    except Exception as e:
        if "unique" in str(e).lower():
            return jsonify({"error": "A user with this email already exists."}), 409
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['PUT'])
def edit_user(user_id):
    """Edit an existing admin user."""
    try:
        from database import update_admin_user
        data = request.json or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()
        access = data.get("access", "View").strip()
        support_type = data.get("support_type", "IT Support,Admin Support").strip()
        can_receive_mail = data.get("can_receive_mail", False)
        can_send_mail = data.get("can_send_mail", False)
        receiver_position = data.get("receiver_position", "").strip() or None
        branch = data.get("branch", "All").strip()
        allowed_menus = data.get("allowed_menus", "").strip()
        role = data.get("role", "user").strip()

        if not name or not email:
            return jsonify({"error": "Name and email are required."}), 400
        if password and len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long."}), 400
        
        updated = update_admin_user(user_id, name, email, password, access, support_type, can_receive_mail, can_send_mail, receiver_position, branch, allowed_menus, role)
        if updated:
            logging.info(f"Admin Action: Edited user {user_id} - Name: {name}, Email: {email}, Access: {access}, Support: {support_type}")
            
            # Sync assignee status
            add_as_assignee = data.get("add_as_assignee")
            if add_as_assignee is not None:
                from database import get_assignees, create_assignee, delete_assignee_by_name
                existing = get_assignees()
                is_currently_assignee = any(a['name'] == name for a in existing)
                
                if add_as_assignee and not is_currently_assignee:
                    create_assignee(name, support_type)
                    logging.info(f"Admin Action: Added user {name} as assignee during edit.")
                elif not add_as_assignee and is_currently_assignee:
                    delete_assignee_by_name(name)
                    logging.info(f"Admin Action: Removed user {name} as assignee during edit.")

            return jsonify({"message": "User updated successfully."}), 200
        return jsonify({"error": "User not found."}), 404
    except Exception as e:
        if "unique" in str(e).lower():
            return jsonify({"error": "A user with this email already exists."}), 409
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete an admin dashboard user."""
    try:
        from database import delete_admin_user
        deleted = delete_admin_user(user_id)
        if deleted:
            logging.info(f"Admin Action: Deleted user {user_id}")
            return jsonify({"message": "User deleted."}), 200
        return jsonify({"error": "User not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ---------------------------------------------------------------------------
# Assets API Routes
# ---------------------------------------------------------------------------

@app.route('/api/assets', methods=['GET', 'POST'])
def assets_route():
    """GET/POST endpoint for assets."""
    if request.method == 'POST':
        try:
            from database import create_asset, get_all_assets
            data = request.json or {}
            # Auto-generate assetId if not provided
            if not data.get("assetId"):
                import datetime
                
                # 1. Get prefix code based on category
                category = data.get("category", "")
                category_lower = category.lower().strip()
                prefix = None
                try:
                    from database import _get_conn
                    conn = _get_conn()
                    with conn.cursor() as cur:
                        cur.execute("SELECT prefix FROM asset_types WHERE LOWER(name) = %s AND is_delete = FALSE LIMIT 1;", (category_lower,))
                        row = cur.fetchone()
                        if row and row[0]:
                            prefix = row[0].upper()
                    conn.close()
                except Exception:
                    pass

                if not prefix:
                    category_mapping = {
                        "cpu": "CPU",
                        "laptop": "LAP",
                        "mobile": "MOB",
                        "monitor": "MON",
                        "printer": "PRN",
                        "server": "SRV",
                    }
                    prefix = category_mapping.get(category_lower)
                    if not prefix:
                        prefix = (category.replace(" ", "")[:3].upper()) if len(category) >= 3 else "AST"
                
                # 2. Extract year_short from purchaseDate (format: "YYYY-MM-DD")
                purchase_date_str = data.get("purchaseDate")
                if purchase_date_str and len(purchase_date_str) >= 4:
                    try:
                        purchase_year = int(purchase_date_str[:4])
                    except ValueError:
                        purchase_year = datetime.datetime.now().year
                else:
                    purchase_year = datetime.datetime.now().year
                year_short = str(purchase_year)[-2:]
                
                # 3. Calculate unique increment per category and year
                existing = get_all_assets()
                same_category_assets = [a for a in existing if a.get("category", "").lower().strip() == category_lower]
                increment = len(same_category_assets) + 1
                existing_tags = {a.get("assetId") for a in existing}
                
                while True:
                    tag = f"{prefix}{year_short}{str(increment).zfill(4)}"
                    if tag not in existing_tags:
                        break
                    increment += 1
                
                data["assetId"] = tag
            result = create_asset(data)
            if result.get("success"):
                logging.info(f"Admin Action: Created asset - Asset ID: {result.get('assetId')}")
                return jsonify(result), 201
            return jsonify(result), 500
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            from database import get_all_assets
            return jsonify(get_all_assets()), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Admin Assets API Routes
# ---------------------------------------------------------------------------

@app.route('/api/admin-assets', methods=['GET', 'POST'])
def admin_assets_route():
    """GET/POST endpoint for admin assets."""
    if request.method == 'POST':
        try:
            from database import create_admin_asset, get_all_admin_assets
            data = request.json or {}
            # Auto-generate assetId if not provided
            if not data.get("assetId"):
                import datetime
                
                # 1. Get prefix code based on category or default
                category = data.get("category", "")
                prefix = None
                try:
                    from database import _get_conn
                    conn = _get_conn()
                    with conn.cursor() as cur:
                        cur.execute("SELECT prefix FROM asset_types WHERE LOWER(name) = %s AND is_delete = FALSE LIMIT 1;", (category.lower().strip(),))
                        row = cur.fetchone()
                        if row and row[0]:
                            prefix = row[0].upper()
                    conn.close()
                except Exception:
                    pass

                if not prefix:
                    prefix = "ADM"
                
                # 2. Extract year_short
                purchase_date_str = data.get("purchaseDate") or datetime.datetime.now().strftime("%Y-%m-%d")
                if purchase_date_str and len(purchase_date_str) >= 4:
                    try:
                        purchase_year = int(purchase_date_str[:4])
                    except ValueError:
                        purchase_year = datetime.datetime.now().year
                else:
                    purchase_year = datetime.datetime.now().year
                year_short = str(purchase_year)[-2:]
                
                # 3. Calculate increment
                existing = get_all_admin_assets()
                same_category_assets = [a for a in existing if a.get("category", "").lower().strip() == category.lower().strip()]
                increment = len(same_category_assets) + 1
                existing_tags = {a.get("assetId") for a in existing}
                
                while True:
                    tag = f"{prefix}{year_short}{str(increment).zfill(4)}"
                    if tag not in existing_tags:
                        break
                    increment += 1
                
                data["assetId"] = tag
            
            result = create_admin_asset(data)
            if result.get("success"):
                logging.info(f"Admin Action: Created admin asset - Asset ID: {result.get('assetId')}")
                return jsonify(result), 201
            return jsonify(result), 500
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            from database import get_all_admin_assets
            return jsonify(get_all_admin_assets()), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route('/api/admin-assets/<int:asset_id>', methods=['PUT'])
def update_admin_asset_route(asset_id):
    """Update an existing admin asset."""
    try:
        from database import update_admin_asset
        data = request.json or {}
        result = update_admin_asset(asset_id, data)
        if result.get("success"):
            logging.info(f"Admin Action: Updated admin asset {asset_id}")
            return jsonify({"message": "Admin asset updated."}), 200
        return jsonify({"error": result.get("error", "Admin asset not found.")}), 404
    except Exception as e:
        logging.exception(f"Exception in update_admin_asset_route for asset_id {asset_id}:")
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin-assets/<int:asset_id>', methods=['DELETE'])
def delete_admin_asset_route(asset_id):
    """Delete an admin asset by id."""
    try:
        from database import delete_admin_asset
        result = delete_admin_asset(asset_id)
        if result.get("success"):
            logging.info(f"Admin Action: Deleted admin asset {asset_id}")
            return jsonify({"message": "Admin asset deleted."}), 200
        return jsonify({"error": "Admin asset not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/bulk-delete-admin-assets', methods=['POST'])
def bulk_delete_admin_assets_route():
    """Bulk delete admin assets by a list of ids. Only accessible by super admin."""
    try:
        from database import delete_admin_asset
        data = request.get_json() or {}
        admin_email = data.get('admin_email', '')
        if not admin_email or admin_email.strip().lower() != 'admin@support.com':
            return jsonify({"error": "Unauthorized. Only super-admin can delete admin assets."}), 403
            
        asset_ids = data.get('asset_ids', [])
        if not asset_ids:
            return jsonify({"error": "No asset IDs provided"}), 400
            
        success_count = 0
        errors = []
        for aid in asset_ids:
            res = delete_admin_asset(aid)
            if res.get('success'):
                success_count += 1
            else:
                errors.append({"asset_id": aid, "error": res.get('error')})
                
        return jsonify({
            "message": f"Successfully deleted {success_count} admin assets",
            "success_count": success_count,
            "errors": errors
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/assets/<string:asset_id>', methods=['GET'])
def get_single_asset_route(asset_id):
    """Retrieve details for a single asset by alphanumeric ID."""
    try:
        from database import get_all_assets
        all_ast = get_all_assets()
        asset = next((a for a in all_ast if a.get("assetId") == asset_id), None)
        if not asset:
            from database import get_all_admin_assets
            all_admin_ast = get_all_admin_assets()
            asset = next((a for a in all_admin_ast if a.get("assetId") == asset_id), None)
        
        # If not found directly, check if it's a suffixed admin asset (e.g., FUR260001-1)
        if not asset and '-' in asset_id:
            base_id = asset_id.rsplit('-', 1)[0]
            asset = next((a for a in all_admin_ast if a.get("assetId") == base_id), None)
            if not asset:
                asset = next((a for a in all_ast if a.get("assetId") == base_id), None)
        if asset:
            return jsonify(asset), 200
        return jsonify({"error": "Asset not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/assets/<int:asset_id>', methods=['PUT'])
def update_asset_route(asset_id):
    """Update an existing asset."""
    try:
        from database import update_asset
        data = request.json or {}
        result = update_asset(asset_id, data)
        if result.get("success"):
            logging.info(f"Admin Action: Updated asset {asset_id}")
            return jsonify({"message": "Asset updated."}), 200
        return jsonify({"error": result.get("error", "Asset not found.")}), 404
    except Exception as e:
        logging.exception(f"Exception in update_asset_route for asset_id {asset_id}:")
        return jsonify({"error": str(e)}), 500


@app.route('/api/assets/<asset_id>/history', methods=['GET'])
def get_asset_history_route(asset_id):
    """Fetch history logs for a given asset ID."""
    try:
        from database import get_asset_history
        history = get_asset_history(asset_id)
        return jsonify(history), 200
    except Exception as e:
        logging.exception(f"Exception in get_asset_history_route for asset_id {asset_id}:")
        return jsonify({"error": str(e)}), 500


@app.route('/api/assets/<int:asset_id>', methods=['DELETE'])
def delete_asset_route(asset_id):
    """Delete an asset by id."""
    try:
        from database import delete_asset
        result = delete_asset(asset_id)
        if result.get("success"):
            logging.info(f"Admin Action: Deleted asset {asset_id}")
            return jsonify({"message": "Asset deleted."}), 200
        return jsonify({"error": "Asset not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/bulk-delete-assets', methods=['POST'])
def bulk_delete_assets_route():
    """Bulk delete assets by a list of ids. Only accessible by super admin."""
    try:
        from database import delete_asset
        data = request.get_json() or {}
        admin_email = data.get('admin_email', '')
        if not admin_email or admin_email.strip().lower() != 'admin@support.com':
            return jsonify({"error": "Unauthorized. Only super-admin can delete assets."}), 403
            
        asset_ids = data.get('asset_ids', [])
        if not asset_ids:
            return jsonify({"error": "No asset IDs provided"}), 400
            
        success_count = 0
        errors = []
        for aid in asset_ids:
            res = delete_asset(aid)
            if res.get('success'):
                success_count += 1
            else:
                errors.append({"asset_id": aid, "error": res.get('error')})
                
        return jsonify({
            "message": f"Successfully deleted {success_count} assets",
            "success_count": success_count,
            "errors": errors
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/assets/<string:asset_id>/qr', methods=['GET'])
def get_asset_qr_endpoint(asset_id):
    """Dynamically compile and serve a beautiful 52.5mm x 29.7mm QR code label for an asset."""
    import io
    import qrcode
    from PIL import Image, ImageDraw, ImageFont
    from database import get_all_assets
    from database import get_all_admin_assets

    try:
        # 1. Lookup asset by asset_id to find its branch
        assets_list = get_all_assets()
        asset = next((a for a in assets_list if a.get("assetId") == asset_id), None)
        if not asset:
            admin_assets_list = get_all_admin_assets()
            asset = next((a for a in admin_assets_list if a.get("assetId") == asset_id), None)
            
        # If not found directly, check if it's a suffixed admin asset (e.g., FUR260001-1)
        if not asset and '-' in asset_id:
            base_id = asset_id.rsplit('-', 1)[0]
            asset = next((a for a in admin_assets_list if a.get("assetId") == base_id), None)
            if not asset:
                asset = next((a for a in assets_list if a.get("assetId") == base_id), None)

        branch = asset.get("branch", "") if asset else ""

        # 2. Compile QR Code (standard high quality)
        # Use request.host_url for dynamic host (remove trailing slash)
        # Determine base URL for QR data: use env QR_BASE_URL if defined, else request.host_url
        base_url = os.getenv('QR_BASE_URL') or request.host_url.rstrip('/')
        qr_data = f"{base_url}/asset/{asset_id}?edit=true"

        qr = qrcode.QRCode(version=1, box_size=10, border=1)
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")

        # 3. Create canvas: 52.5mm x 29.7mm at 300 DPI is 620 x 350 pixels
        width, height = 620, 350
        label_img = Image.new("RGBA", (width, height), "white")
        draw = ImageDraw.Draw(label_img)

        # Clean, solid black border inset inside the image with a 5px gap from the edges, width=2px
        draw.rectangle([7, 7, width - 6, height - 6], outline="black", width=2)
        # Center QR code vertically on the left side
        qr_size = 210
        try:
            resample_filter = Image.Resampling.LANCZOS
        except AttributeError:
            resample_filter = Image.LANCZOS if hasattr(Image, "LANCZOS") else Image.ANTIALIAS
        qr_img_resized = qr_img.resize((qr_size, qr_size), resample_filter)
        label_img.paste(qr_img_resized, (45, (height - qr_size) // 2), qr_img_resized)

        # 4. Brand-based logo select
        logo_filename = "dt.png" if "doctor towels" in branch.lower() else "cc.png"
        
        # Determine project root (parent of backend directory)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(base_dir, ".."))
        logo_path = os.path.join(project_root, "frontend", "src", "assets", logo_filename)
        
        # Load logo if it exists
        logo = None
        if os.path.exists(logo_path):
            logo = Image.open(logo_path).convert("RGBA")
            # Use appropriate resampling filter depending on Pillow version
            try:
                resample_filter = Image.Resampling.LANCZOS
            except AttributeError:
                resample_filter = Image.LANCZOS if hasattr(Image, "LANCZOS") else Image.ANTIALIAS
            logo.thumbnail((280, 185), resample_filter)
        
        # 5. Load fonts with robust system-agnostic fallbacks
        font_id = None
        font_warn = None
        for font_name in ["arial.ttf", "arial", "Helvetica", "DejaVuSans", "LiberationSans", "FreeSans"]:
            try:
                if font_name == "arial.ttf":
                    font_id = ImageFont.truetype("arialbd.ttf", 26)
                else:
                    font_id = ImageFont.truetype(font_name, 26)
                font_warn = ImageFont.truetype(font_name, 16)
                break
            except IOError:
                continue

        if font_id is None or font_warn is None:
            try:
                font_id = ImageFont.load_default(size=26)
                font_warn = ImageFont.load_default(size=16)
            except TypeError:
                font_id = ImageFont.load_default()
                font_warn = ImageFont.load_default()

        # 6. Get element dimensions for dynamic block vertical centering
        text_id = f"Asset ID: {asset_id}"
        bbox_id = draw.textbbox((0, 0), text_id, font=font_id)
        text_id_w = bbox_id[2] - bbox_id[0]
        text_id_h = bbox_id[3] - bbox_id[1]

        text_warn = "(Please do not remove this tag)"
        bbox_warn = draw.textbbox((0, 0), text_warn, font=font_warn)
        text_warn_w = bbox_warn[2] - bbox_warn[0]
        text_warn_h = bbox_warn[3] - bbox_warn[1]

        # Define right column layout
        right_col_x = 290
        right_col_w = 300

        # Combined height calculations (logo + 20px gap + Asset ID + 15px gap + Warning text)
        logo_h = logo.height if logo else 120
        gap1 = 20
        gap2 = 15
        total_height = logo_h + gap1 + text_id_h + gap2 + text_warn_h
        
        # Starting Y coordinate for perfect vertical centering of the entire right column block
        start_y = (height - total_height) // 2

        # 7. Render logo
        if logo:
            logo_x = right_col_x + (right_col_w - logo.width) // 2
            logo_y = start_y
            label_img.paste(logo, (logo_x, logo_y), logo)
            next_y = logo_y + logo_h
        else:
            # Fallback if logo file not found
            draw.rectangle([right_col_x + 10, start_y, right_col_x + right_col_w - 10, start_y + 120], fill="#F1F5F9", outline="#CBD5E1")
            bbox_no_logo = draw.textbbox((0, 0), "No Logo Found", font=font_warn)
            no_logo_w = bbox_no_logo[2] - bbox_no_logo[0]
            draw.text((right_col_x + (right_col_w - no_logo_w) // 2, start_y + 50), "No Logo Found", fill="#64748B", font=font_warn)
            next_y = start_y + 120

        # 8. Render Asset ID text
        text_id_x = right_col_x + (right_col_w - text_id_w) // 2
        text_id_y = next_y + gap1
        draw.text((text_id_x, text_id_y), text_id, fill="black", font=font_id)

        # 9. Render Warning text
        text_warn_x = right_col_x + (right_col_w - text_warn_w) // 2
        text_warn_y = text_id_y + text_id_h + gap2
        draw.text((text_warn_x, text_warn_y), text_warn, fill="#475569", font=font_warn)

        # 6. Stream file as response
        img_io = io.BytesIO()
        label_img.save(img_io, 'PNG')
        img_io.seek(0)
        response = send_file(img_io, mimetype='image/png')
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Content-Disposition"] = f"inline; filename=\"{asset_id}_qr.png\""
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            with open("qr_error.log", "a") as f:
                f.write(f"\n--- Error for asset {asset_id} ---\n")
                traceback.print_exc(file=f)
        except Exception:
            pass
        return jsonify({"error": str(e)}), 500


@app.route('/api/assignees', methods=['GET'])
def get_assignees_route():
    """Return assignees, optionally filtered by support_type query param."""
    try:
        from database import get_assignees
        support_type = request.args.get('support_type', None)
        return jsonify(get_assignees(support_type)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/assignees', methods=['POST'])
def create_assignee_route():
    """Create a new assignee."""
    try:
        from database import create_assignee
        data = request.json or {}
        name = data.get("name", "").strip()
        support_type = data.get("support_type", "").strip()
        if not name or not support_type:
            return jsonify({"error": "Name and support type are required."}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM assignees WHERE LOWER(name) = %s AND is_delete = FALSE;", (name.lower(),))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Assignee name already exists"}), 400
        conn.close()
        result = create_assignee(name, support_type)
        if result.get("success"):
            logging.info(f"Admin Action: Created assignee - Name: {name}, Support: {support_type}")
            return jsonify(result), 201
        return jsonify(result), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/assignees/<int:assignee_id>', methods=['DELETE'])
def delete_assignee_route(assignee_id):
    """Delete an assignee by id."""
    try:
        from database import delete_assignee
        deleted = delete_assignee(assignee_id)
        if deleted:
            logging.info(f"Admin Action: Deleted assignee {assignee_id}")
            return jsonify({"message": "Assignee deleted."}), 200
        return jsonify({"error": "Assignee not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/assignees/<int:assignee_id>', methods=['PUT'])
def edit_assignee_route(assignee_id):
    """Edit an existing assignee."""
    try:
        from database import update_assignee
        data = request.json or {}
        name = data.get("name", "").strip()
        support_type = data.get("support_type", "").strip()
        if not name or not support_type:
            return jsonify({"error": "Name and support type are required."}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM assignees WHERE LOWER(name) = %s AND id != %s AND is_delete = FALSE;", (name.lower(), assignee_id))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Assignee name already exists"}), 400
        conn.close()
        
        updated = update_assignee(assignee_id, name, support_type)
        if updated:
            logging.info(f"Admin Action: Edited assignee {assignee_id} - Name: {name}, Support: {support_type}")
            return jsonify({"message": "Assignee updated successfully."}), 200
        return jsonify({"error": "Assignee not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories', methods=['GET'])
def get_categories_route():
    """Return categories, optionally filtered by support_type query param."""
    try:
        from database import get_categories
        support_type = request.args.get('support_type', None)
        return jsonify(get_categories(support_type)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories', methods=['POST'])
def create_category_route():
    """Create a new category."""
    try:
        from database import create_category
        data = request.json or {}
        name = data.get("name", "").strip()
        support_type = data.get("support_type", "").strip()
        subcategories = data.get("subcategories", "").strip()
        if not name or not support_type:
            return jsonify({"error": "Category name and support type are required."}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM categories WHERE LOWER(name) = %s AND is_delete = FALSE;", (name.lower(),))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Category name already exists"}), 400
        conn.close()
        result = create_category(name, support_type, subcategories)
        if result.get("success"):
            logging.info(f"Admin Action: Created category - Name: {name}, Support: {support_type}, Subcategories: {subcategories}")
            return jsonify(result), 201
        return jsonify(result), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories/<int:category_id>', methods=['PUT'])
def edit_category_route(category_id):
    """Edit an existing category."""
    try:
        from database import update_category
        data = request.json or {}
        name = data.get("name", "").strip()
        support_type = data.get("support_type", "").strip()
        subcategories = data.get("subcategories", "").strip()
        if not name or not support_type:
            return jsonify({"error": "Category name and support type are required."}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM categories WHERE LOWER(name) = %s AND id != %s AND is_delete = FALSE;", (name.lower(), category_id))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Category name already exists"}), 400
        conn.close()
        
        updated = update_category(category_id, name, support_type, subcategories)
        if updated:
            logging.info(f"Admin Action: Edited category {category_id} - Name: {name}, Support: {support_type}, Subcategories: {subcategories}")
            return jsonify({"message": "Category updated successfully."}), 200
        return jsonify({"error": "Category not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category_route(category_id):
    """Delete a category by id."""
    try:
        from database import delete_category
        deleted = delete_category(category_id)
        if deleted:
            logging.info(f"Admin Action: Deleted category {category_id}")
            return jsonify({"message": "Category deleted."}), 200
        return jsonify({"error": "Category not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/departments', methods=['GET'])
def get_departments_route():
    """Return departments, optionally filtered by support_type query param."""
    try:
        from database import get_departments
        support_type = request.args.get('support_type', None)
        return jsonify(get_departments(support_type)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/departments', methods=['POST'])
def create_department_route():
    """Create a new department."""
    try:
        from database import create_department
        data = request.json or {}
        name = data.get("name", "").strip()
        support_type = data.get("support_type", "").strip()
        if not name or not support_type:
            return jsonify({"error": "Department name and support type are required."}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM departments WHERE LOWER(name) = %s AND is_delete = FALSE;", (name.lower(),))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Department name already exists"}), 400
        conn.close()
        result = create_department(name, support_type)
        if result.get("success"):
            logging.info(f"Admin Action: Created department - Name: {name}, Support: {support_type}")
            return jsonify(result), 201
        return jsonify(result), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/departments/<int:department_id>', methods=['PUT'])
def edit_department_route(department_id):
    """Edit an existing department."""
    try:
        from database import update_department
        data = request.json or {}
        name = data.get("name", "").strip()
        support_type = data.get("support_type", "").strip()
        if not name or not support_type:
            return jsonify({"error": "Department name and support type are required."}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM departments WHERE LOWER(name) = %s AND id != %s AND is_delete = FALSE;", (name.lower(), department_id))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Department name already exists"}), 400
        conn.close()
        
        updated = update_department(department_id, name, support_type)
        if updated:
            logging.info(f"Admin Action: Edited department {department_id} - Name: {name}, Support: {support_type}")
            return jsonify({"message": "Department updated successfully."}), 200
        return jsonify({"error": "Department not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/departments/<int:department_id>', methods=['DELETE'])
def delete_department_route(department_id):
    """Delete a department by id."""
    try:
        from database import delete_department
        deleted = delete_department(department_id)
        if deleted:
            logging.info(f"Admin Action: Deleted department {department_id}")
            return jsonify({"message": "Department deleted."}), 200
        return jsonify({"error": "Department not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    """Verify admin credentials against the database."""
    try:
        from database import verify_admin_login
        data = request.json or {}
        user = verify_admin_login(data.get("email", ""), data.get("password", ""))
        if user:
            return jsonify({"success": True, "user": user}), 200
        return jsonify({"success": False, "error": "Invalid email or password."}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/me', methods=['GET'])
def get_current_user():
    """Return fresh user data for the currently logged-in user (identified by email)."""
    try:
        from database import get_admin_users
        email = request.args.get('email', '').strip()
        if not email:
            return jsonify({"error": "Email is required."}), 400
        users = get_admin_users()
        user = next((u for u in users if u.get('email', '').lower() == email.lower()), None)
        if not user:
            return jsonify({"error": "User not found."}), 404
        return jsonify(user), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/change_password', methods=['POST'])
def change_password():
    """Update a user's password, security questions, and clear their is_first_login flag."""
    try:
        from database import update_admin_password
        data = request.json or {}
        user_id = data.get("user_id")
        new_password = data.get("new_password")
        security_question = data.get("security_question")
        security_answer = data.get("security_answer")
        
        if not user_id or not new_password or not security_question or not security_answer:
            return jsonify({"error": "User ID, new password, security question, and answer are required."}), 400
        if len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long."}), 400
            
        updated = update_admin_password(user_id, new_password, security_question, security_answer)
        if updated:
            logging.info(f"Admin Action: User {user_id} changed permanent password and set security questions.")
            return jsonify({"message": "Password and security settings updated successfully.", "success": True}), 200
        return jsonify({"error": "User not found or update failed.", "success": False}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/verify_security_answer', methods=['POST'])
def verify_security_answer_route():
    """Verify security question and answer for password reset."""
    try:
        from database import verify_security_answer
        data = request.json or {}
        email = data.get("email")
        question = data.get("security_question")
        answer = data.get("security_answer")
        
        if not email or not question or not answer:
            return jsonify({"error": "Email, security question, and answer are required."}), 400
            
        user_id = verify_security_answer(email, question, answer.strip())
        if user_id is not None:
            return jsonify({"success": True, "user_id": user_id}), 200
        return jsonify({"error": "Invalid email, security question, or answer.", "success": False}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/test/last-email', methods=['GET'])
def get_last_email():
    """Internal endpoint for E2E testing to verify email content."""
    if os.environ.get('APP_ENV') != 'local':
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify(LAST_SENT_EMAIL or {}), 200

@app.route('/api/test/clear-last-email', methods=['POST'])
def clear_last_email():
    """Internal endpoint for E2E testing to clear email state."""
    if os.environ.get('APP_ENV') != 'local':
        return jsonify({"error": "Unauthorized"}), 403
    global LAST_SENT_EMAIL
    LAST_SENT_EMAIL = None
    return jsonify({"success": True}), 200


@app.route('/api/reset_password', methods=['POST'])
def reset_password_route():
    """Reset the password from the forgot password flow."""
    try:
        from database import reset_admin_password
        data = request.json or {}
        user_id = data.get("user_id")
        new_password = data.get("new_password")
        
        if not user_id or not new_password:
            return jsonify({"error": "User ID and new password are required."}), 400
        if len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long."}), 400
            
        if reset_admin_password(user_id, new_password):
            logging.info(f"Admin Action: User {user_id} reset their password via security questions.")
            return jsonify({"success": True, "message": "Password reset successfully."}), 200
        return jsonify({"error": "Failed to reset password. User not found.", "success": False}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/tickets/<ticket_id>', methods=['PUT'])
def update_ticket(ticket_id):
    try:
        ticket_id = str(ticket_id).upper()
        # Check if request has form data (multipart)
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            data = request.form
            files = request.files
        else:
            data = request.json or {}
            files = {}

        updates = {}
        if 'status' in data: updates['status'] = data['status']
        if 'assignee' in data: updates['assignee'] = data['assignee']
        if 'resolution_comments' in data: updates['resolution_comments'] = data['resolution_comments']
        if 'pending_comments' in data: updates['pending_comments'] = data['pending_comments']
        if 'expense_amount' in data: updates['expense_amount'] = data['expense_amount']
        if 'user_confirmation' in data: updates['user_confirmation'] = data['user_confirmation']

        if 'bill_attachment' in files:
            bill_file = files['bill_attachment']
            if bill_file.filename != '':
                updates['bill_attachment_bytes'] = bill_file.read()

        # Capture Status Update Comments in Admin History
        if 'status' in updates:
            current_ticket = get_ticket_by_id(ticket_id)
            if current_ticket:
                existing_comments = current_ticket.get('admin_comments') or current_ticket.get('adminComments') or []
                new_status = updates['status']
                status_comment = ""
                if new_status == 'Pending':
                    status_comment = data.get('pending_comments', '')
                elif new_status == 'Completed':
                    status_comment = data.get('resolution_comments', '')
                
                if status_comment:
                    admin_name = data.get('admin_name', 'Admin')
                    import datetime
                    existing_comments.append({
                        "name": admin_name,
                        "comment": status_comment,
                        "timestamp": datetime.datetime.now().strftime("%d-%m-%Y %I:%M %p"),
                        "target_role": "StatusUpdate",
                        "status": new_status
                    })
                    updates['admin_comments'] = existing_comments

        if not updates:
            return jsonify({"error": "No fields to update"}), 400
            
        result = update_ticket_details(ticket_id, updates)
        if result['success']:
            # If status changed to Completed, send email to requester
            if updates.get('status') == 'Completed':
                full_ticket = get_ticket_by_id(ticket_id)
                if full_ticket and full_ticket.get('email'):
                    threading.Thread(target=send_completion_email, args=(full_ticket,), daemon=True).start()
                    
            return jsonify({"message": "Ticket updated successfully"}), 200
        return jsonify({"error": result['error']}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status/<ticket_id>', methods=['GET'])
def check_status(ticket_id):
    try:
        ticket_id = str(ticket_id).upper()
        ticket = get_ticket_by_id(ticket_id)
        if ticket:
            return jsonify(ticket), 200
        return jsonify({"error": "Ticket not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status/mobile/<path:mobile>', methods=['GET'])
def check_status_by_mobile(mobile):
    """Return all tickets matching a mobile number."""
    try:
        from database import _get_conn, _row_to_ticket, normalize_mobile
        normalised = normalize_mobile(mobile.strip())
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM tickets WHERE mobile = %s AND is_delete = FALSE ORDER BY created_at DESC",
                (normalised,)
            )
            rows = cur.fetchall()
        conn.close()
        if not rows:
            return jsonify({"error": "No tickets found for this mobile number"}), 404
        tickets = [_row_to_ticket(r) for r in rows]
        return jsonify(tickets), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/submit', methods=['POST'])
def submit_ticket():
    try:
        data = request.form.to_dict()
        file = request.files.get('attachment')

        attachment_bytes = None
        filename = ""
        if file and file.filename:
            filename        = file.filename
            attachment_bytes = file.read()

        # ── Custom ID Generation based on Branch ──────────────────────────
        # Mapping: branch name -> (prefix, suffix)
        BRANCH_MAP = {
            "Cotton Concepts HO_ Coimbatore": ("CCCD", "HO"),
            "Doctor Towels HO":               ("DST", "HO"),
            "Cotton Concepts_ Vengamedu":     ("VMCC", ""),
            "Cotton Concepts_ Karur":         ("KRFCC", ""),
            "Doctor Towels_ Karur":           ("KRDST", ""),
        }
        
        branch_name = data.get("branch", "").strip()
        # Normalize: if someone sends "HO, Coimbatore" instead of "HO_ Coimbatore"
        normalized_branch = branch_name.replace(", ", "_ ")
        prefix, suffix = BRANCH_MAP.get(normalized_branch, BRANCH_MAP.get(branch_name, ("TKT", "")))
        
        from database import get_max_sequential_id
        max_num = get_max_sequential_id(prefix, suffix)
        next_num = max_num + 1
        ticket_id = f"{prefix}{next_num:03d}{suffix}"
        # ─────────────────────────────────────────────────────────────────

        data['attachment']       = filename
        data['attachment_bytes'] = attachment_bytes
        data['ticket_id']        = ticket_id
        data.setdefault('description', '')

        result = append_to_sheet(data)
        if result['success']:
            # 1. Always send notification to itcottonconcepts@gmail.com in background
            threading.Thread(target=send_new_ticket_notification, args=(data, "itcottonconcepts@gmail.com"), daemon=True).start()
            
            # 2. Additionally send to admin@cottonconcepts.co.in if support type is Admin Support in background
            if data.get('supportType') == 'Admin Support':
                threading.Thread(target=send_new_ticket_notification, args=(data, "admin@cottonconcepts.co.in"), daemon=True).start()
                
            return jsonify({"message": "Ticket submitted successfully", "ticket_id": ticket_id}), 200
        return jsonify({"error": "Failed to save ticket", "details": result['error']}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/tickets/<ticket_id>/attachment', methods=['GET'])
def serve_attachment(ticket_id):
    """Serve the ticket image stored as BYTEA in the DB."""
    import psycopg2
    import psycopg2.extras
    from database import _get_conn
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT attachment, attachment_name FROM tickets WHERE ticket_id = %s", (ticket_id,))
            row = cur.fetchone()
        conn.close()
        if not row or not row['attachment']:
            return jsonify({"error": "No attachment found"}), 404
        img_bytes = bytes(row['attachment'])
        name = row['attachment_name'] or 'attachment'
        return send_file(io.BytesIO(img_bytes), download_name=name, as_attachment=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/tickets/<ticket_id>/bill', methods=['GET'])
def serve_bill_attachment(ticket_id):
    """Serve the bill attachment stored as BYTEA in the DB."""
    import psycopg2
    import psycopg2.extras
    from database import _get_conn
    try:
        conn = _get_conn()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT bill_attachment, bill_attachment_name FROM tickets WHERE ticket_id = %s", (ticket_id,))
            row = cur.fetchone()
        conn.close()
        if not row or not row['bill_attachment']:
            return jsonify({"error": "No bill attachment found"}), 404
        img_bytes = bytes(row['bill_attachment'])
        name = row['bill_attachment_name'] or 'bill_attachment'
        return send_file(io.BytesIO(img_bytes), download_name=name, as_attachment=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Approval Flow
# ---------------------------------------------------------------------------

@app.route('/api/tickets/<ticket_id>/notify-manager', methods=['POST'])
def initiate_approval_flow(ticket_id):
    """
    Sends approval-request emails to all selected receivers.
    - Manager is always emailed first if in the list.
    - Every email contains full ticket info + admin name + admin's material description.
    """
    # Fetch receivers from DB who have can_receive_mail = True
    from database import get_admin_users
    receivers_from_db = [u for u in get_admin_users() if u.get('can_receive_mail')]
    
    # Receiver name -> email address map & position mapping
    RECEIVER_EMAIL_MAP = {u['name']: u['email'] for u in receivers_from_db}
    RECEIVER_POSITION_MAP = {u['name']: u.get('receiver_position', 'Management') for u in receivers_from_db}

    try:
        import datetime
        now = datetime.datetime.now()
        current_ticket = get_ticket_by_id(ticket_id)
        if not current_ticket:
            return jsonify({"error": "Ticket not found"}), 404

        description   = request.form.get('description', '')
        receiver_raw  = request.form.get('receiver', '')   # comma-separated names
        admin_name    = request.form.get('admin_name', 'Admin')  # passed from frontend

        # Parse receivers, preserve original order then put Manager first
        receivers_list = [r.strip() for r in receiver_raw.split(',') if r.strip()]
        ordered = (["Manager"] if "Manager" in receivers_list else []) + \
                  [r for r in receivers_list if r != "Manager"]

        # Read optional attachment
        file = request.files.get('attachment')
        attachment_bytes, filename = None, ""
        if file and file.filename:
            filename         = file.filename
            attachment_bytes = file.read()

        # Get current time for approval_request_time
        # Determine the target role for this request
        is_manager_request = any(RECEIVER_POSITION_MAP.get(r) == "Manager" for r in receivers_list)
        target_role = "Manager" if is_manager_request else "Management"

        # Persist admin comments history
        existing_admin_comments = current_ticket.get('admin_comments') or []
        if description:
            new_admin_entry = {
                "name": admin_name,
                "comment": description,
                "timestamp": now.strftime("%d-%m-%Y %I:%M %p"),
                "target_role": target_role,
                "recipients": receivers_list
            }
            existing_admin_comments.append(new_admin_entry)

        # Persist admin description + attachment + approval request time
        ticket_updates = {
            'approval_request_time': now,
            'admin_comments': existing_admin_comments
        }
        if description:
            ticket_updates['admin_description'] = description
        if attachment_bytes:
            ticket_updates['attachment_bytes'] = attachment_bytes
            ticket_updates['attachment']        = filename
        if ticket_updates:
            update_ticket_details(ticket_id, ticket_updates)

        # Read user's original attachment from DB if present
        user_attachment_bytes = current_ticket.get('attachment')
        user_attachment_name = current_ticket.get('attachment_name', f"user_attachment_{ticket_id}")

        # Build enriched ticket data for the email
        final_admin_desc = description if description else current_ticket.get('admin_description', current_ticket.get('adminDescription', ''))
        ticket_data = {
            **current_ticket,
            'admin_description': final_admin_desc,
            'adminDescription':  final_admin_desc,
            'admin_name':        admin_name,
            'admin_attachment_bytes': attachment_bytes,
            'admin_attachment_name':  filename,
            'user_attachment_bytes': user_attachment_bytes,
            'user_attachment_name': user_attachment_name,
        }

        # Send one personalised email per receiver (Manager goes first)
        # --- Perform DB-side updates synchronously (must finish before we respond) ---
        sent_to = []
        for receiver_name in ordered:
            to_email = RECEIVER_EMAIL_MAP.get(receiver_name, "")
            db_pos = RECEIVER_POSITION_MAP.get(receiver_name, "Management")
            role = "Admin-Manager" if db_pos == "Manager" else "Management"

            # Log exact timestamp of mail sent into PostgreSQL
            update_ticket_mail_time(ticket_id, role)

            # Update approval status individually per receiver
            update_approval_status(ticket_id, role, "Pending", responder_name=receiver_name, admin_description=final_admin_desc)

            if role == "Admin-Manager":
                update_ticket_details(ticket_id, {"admin_manager_has_mail": True})

            sent_to.append((receiver_name, to_email, role))

        # --- Fire SMTP sends asynchronously so the response is immediate ---
        def _send_emails_bg(items, td):
            for r_name, r_email, r_role in items:
                try:
                    send_approval_email(td, to_email=r_email, receiver_name=r_name, role=r_role)
                except Exception as mail_err:
                    pass

        t = threading.Thread(target=_send_emails_bg, args=(sent_to, ticket_data), daemon=True)
        t.start()

        msg = f"Approval request sent to: {', '.join(n for n, _, _ in sent_to)}."
        return jsonify({"message": msg}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/approval/action/<ticket_id>/<role>', methods=['GET'])
def approval_action_page(ticket_id, role):
    try:
        from flask import request
        receiver_name = request.args.get('name', 'Unknown')
        ticket = get_ticket_by_id(ticket_id)
        if not ticket:
            return "Ticket not found", 404

        # --- Link Expiry Check ---
        already_decided = False
        if role == "Admin-Manager":
            # Check only THIS manager's decision, not any other manager (case-insensitive name match)
            mgr_approvals = ticket.get('adminManagerApprovals') or []
            if isinstance(mgr_approvals, list) and mgr_approvals:
                this_entry = next((e for e in mgr_approvals if e.get('name', '').lower() == receiver_name.lower()), None)
                if this_entry and this_entry.get('decision_made'):
                    already_decided = True
            else:
                # Fallback for old tickets without JSON: check per-name in status string
                mgr_status = ticket.get('adminManagerStatus') or ""
                for part in mgr_status.split(','):
                    if ':' in part:
                        name_part, stat_part = part.split(':', 1)
                        if name_part.strip().lower() == receiver_name.lower() and stat_part.strip() in ('Approved', 'Rejected', 'Hold'):
                            already_decided = True
                            break
        elif role == "Management":
            approvals = ticket.get('managementApprovals') or []
            if isinstance(approvals, list):
                responder_entry = next((e for e in approvals if e.get('name') == receiver_name), None)
                if responder_entry and responder_entry.get('decision_made'):
                    already_decided = True

        if already_decided:
            return f"""
            <html><body style="font-family:sans-serif; background:#f4f6f8; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                <div style="background:white; padding:40px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.12); text-align:center;">
                    <h2 style="color:#64748b; margin-top:0;">Link Expired</h2>
                    <p style="color:#333; font-size:16px;">You have already submitted a decision for this request.</p>
                    <p style="color:#666; font-size:14px; margin-top:20px;">You can close this window now.</p>
                </div>
            </body></html>
            """
        # -------------------------

        # Attachment links
        requester_attachment_html = ""
        if ticket.get('attachment'):
            requester_attachment_html = f'''
            <div class="field">
                <span class="label">Requester Attachment:</span>
                <span class="value">
                    <a href="/api/tickets/{ticket_id}/attachment" target="_blank">View Image</a>
                </span>
            </div>'''
            
        # Construct Management History Block
        history_table_html = ""
        history_rows = []
        admin_comments_history = ticket.get('admin_comments') or []

        # 1. Manager Approvals — one row per manager who has decided (use JSON array)
        mgr_approvals_json = ticket.get('adminManagerApprovals') or []
        if mgr_approvals_json:
            # Parse per-manager comments from "Name: comment\nName2: comment2"
            comments_by_manager = {}
            for line in (ticket.get('adminManagerComments') or '').split('\n'):
                if ':' in line:
                    c_name, c_text = line.split(':', 1)
                    comments_by_manager[c_name.strip().lower()] = c_text.strip()
            # Use per-manager JSON (new approach)
            for mgr_entry in mgr_approvals_json:
                if mgr_entry.get('decision_made'):  # only show managers who have responded
                    m_name = mgr_entry.get('name', 'Manager')
                    history_rows.append({
                        "role": "Manager",
                        "name": m_name,
                        "status": mgr_entry.get('status', ''),
                        "comments": comments_by_manager.get(m_name.lower()) or mgr_entry.get('comments') or "-",
                        "admin_desc": mgr_entry.get('admin_description', ''),
                        "time": mgr_entry.get('decision_made', '')
                    })
        else:
            # Fallback for old tickets: parse from text field (single-manager)
            mgr_status = ticket.get('adminManagerStatus', '')
            if mgr_status:
                mgr_actual_name = ""
                mgr_actual_status = mgr_status
                if ":" in mgr_status:
                    mgr_parts = mgr_status.split(":", 1)
                    mgr_actual_name = mgr_parts[0].strip()
                    mgr_actual_status = mgr_parts[1].strip()
                mgr_comments = ticket.get('adminManagerComments', '')
                mgr_admin_desc = ticket.get('admin_manager_admin_desc') or next(
                    (c['comment'] for c in reversed(admin_comments_history) if c.get('target_role') == 'Manager'),
                    ticket.get('admin_description', ''))
                if mgr_actual_status.lower() not in ('pending', ''):
                    history_rows.append({
                        "role": "Manager",
                        "name": mgr_actual_name or "Manager",
                        "status": mgr_actual_status,
                        "comments": mgr_comments or "-",
                        "admin_desc": mgr_admin_desc,
                        "time": ticket.get('adminManagerStatusTime', '')
                    })

        # 2. Management Approvals
        mgmt_approvals = ticket.get('managementApprovals') or []
        for entry in mgmt_approvals:
            if entry.get('decision_made'):
                m_name = entry.get('name', 'Unknown')
                m_status = entry.get('status') or "Approved"
                m_comments = entry.get('comments') or "-"
                m_admin_desc = entry.get('admin_desc') or entry.get('admin_description') or \
                               next((c['comment'] for c in reversed(admin_comments_history) if c.get('target_role') == 'Management' and c.get('recipients') and m_name in c.get('recipients', [])), 
                                    next((c['comment'] for c in reversed(admin_comments_history) if c.get('target_role') == 'Management' and not c.get('recipients')), 
                                         ticket.get('admin_description', '')))
                history_rows.append({
                    "role": "Management",
                    "name": m_name,
                    "status": m_status,
                    "comments": m_comments,
                    "admin_desc": m_admin_desc,
                    "time": entry.get('decision_made')
                })

        has_history = any(r['status'].lower() not in ['pending', 'recorded', ''] for r in history_rows)
        history_table_html = ""
        if history_rows and has_history:
            rows_html = ""
            for r in history_rows:
                s_color = "#16a34a" if r['status'].lower() == "approved" else "#dc2626" if r['status'].lower() == "rejected" else "#333"
                rows_html += f"""
                <tr>
                    <td style='border:1px solid #e2e8f0;padding:8px;'><strong>{r['role']}</strong><br><small style='color:#64748b;'>{r['time']}</small></td>
                    <td style='border:1px solid #e2e8f0;padding:8px;'>{r['name']}</td>
                    <td style='border:1px solid #e2e8f0;padding:8px;color:{s_color};font-weight:bold;'>{r['status']}</td>
                    <td style='border:1px solid #e2e8f0;padding:8px;font-style:italic;'>{r['comments']}</td>
                    <td style='border:1px solid #e2e8f0;padding:8px;background:#f8fafc;font-size:12px;'>{r['admin_desc']}</td>
                </tr>
                """
            history_table_html = f"""
            <div class='field'>
                <span class='label'>Approval History:</span>
                <table style='width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;border:1px solid #e2e8f0;'>
                    <tr style='background:#f8fafc;'>
                        <th style='border:1px solid #e2e8f0;padding:8px;text-align:left;'>User</th>
                        <th style='border:1px solid #e2e8f0;padding:8px;text-align:left;'>Name</th>
                        <th style='border:1px solid #e2e8f0;padding:8px;text-align:left;'>Status</th>
                        <th style='border:1px solid #e2e8f0;padding:8px;text-align:left;'>Comments</th>
                        <th style='border:1px solid #e2e8f0;padding:8px;text-align:left;'>Admin Description</th>
                    </tr>
                    {rows_html}
                </table>
            </div>
            <hr>
            """

        return f"""
        <html>
        <head>
            <title>Approval Request</title>
            <style>
                body {{ font-family: sans-serif; padding: 20px; background: #f4f6f8; }}
                .card {{ background: white; padding: 24px; border-radius: 8px;
                         box-shadow: 0 2px 8px rgba(0,0,0,0.12); max-width: 640px; margin: 0 auto; }}
                h2 {{ margin-top: 0; color: #1e3a5f; }}
                hr {{ border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0; }}
                .field {{ margin-bottom: 10px; }}
                .label {{ font-weight: 600; color: #374151; display: inline-block; min-width: 200px; }}
                .value {{ color: #111827; }}
                textarea {{ width: 100%; height: 100px; padding: 10px; margin-top: 10px;
                            border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }}
                .actions {{ margin-top: 20px; display: flex; gap: 12px; }}
                button {{ padding: 10px 24px; border: none; border-radius: 6px;
                          cursor: pointer; font-weight: 600; font-size: 15px; }}
                .approve {{ background: #16a34a; color: white; }}
                .reject  {{ background: #dc2626; color: white; }}
                a {{ color: #2563eb; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Approval Request &mdash; {role}</h2>

                <div class="field"><span class="label">Ticket ID:</span>
                    <span class="value">{ticket['ticket_id']}</span></div>
                <div class="field"><span class="label">Requester:</span>
                    <span class="value">{ticket['fullName']}</span></div>
                <div class="field"><span class="label">Mobile:</span>
                    <span class="value">{ticket.get('mobile', '')}</span></div>
                <div class="field"><span class="label">Category:</span>
                    <span class="value">{ticket.get('category', '')} &rarr; {ticket.get('subCategory', '')}</span></div>

                <div class="field"><span class="label">Requester Description:</span>
                    <span class="value">{ticket.get('description', '') or '—'}</span></div>
                {requester_attachment_html}

                <hr>
                <div class="field"><span class="label">Admin Justification:</span>
                    <span class="value">{ticket.get('adminDescription') or ticket.get('admin_description') or ticket.get('adminManagerAdminDesc') or '—'}</span></div>
                <hr>
                {history_table_html}

                <form method="POST" action="/api/approval/action/{ticket_id}/{role}">
                    <input type="hidden" name="receiver_name" value="{receiver_name}" />
                    <textarea name="comments" placeholder="Add your comments (optional)..."></textarea>
                    <div class="actions">
                        <button type="submit" name="action" value="Approve" class="approve">&#10003; Approve</button>
                        <button type="submit" name="action" value="Reject"  class="reject">&#10007; Reject</button>
                    </div>
                </form>
            </div>
        </body>
        </html>
        """
    except Exception as e:
        return f"Error: {str(e)}", 500


@app.route('/api/approval/action/<ticket_id>/<role>', methods=['POST'])
def process_approval(ticket_id, role):
    try:
        from database import get_ticket_by_id
        action   = request.form.get('action')
        comments = request.form.get('comments', '').strip()
        receiver = request.form.get('receiver_name', 'Unknown')
        status   = "Approved" if action == "Approve" else "Rejected"
        
        ticket = get_ticket_by_id(ticket_id)
        if not ticket:
            return "Ticket not found", 404

        # --- Link Expiry Check ---
        already_decided = False
        if role == "Admin-Manager":
            # Check only THIS manager's decision, not any other manager (case-insensitive name match)
            mgr_approvals = ticket.get('adminManagerApprovals') or []
            if isinstance(mgr_approvals, list) and mgr_approvals:
                this_entry = next((e for e in mgr_approvals if e.get('name', '').lower() == receiver.lower()), None)
                if this_entry and this_entry.get('decision_made'):
                    already_decided = True
            else:
                # Fallback for old tickets without JSON: check per-name in status string
                mgr_status = ticket.get('adminManagerStatus') or ""
                for part in mgr_status.split(','):
                    if ':' in part:
                        name_part, stat_part = part.split(':', 1)
                        if name_part.strip().lower() == receiver.lower() and stat_part.strip() in ('Approved', 'Rejected', 'Hold'):
                            already_decided = True
                            break
        elif role == "Management":
            approvals = ticket.get('managementApprovals') or []
            if isinstance(approvals, list):
                responder_entry = next((e for e in approvals if e.get('name') == receiver), None)
                if responder_entry and responder_entry.get('decision_made'):
                    already_decided = True

        if already_decided:
            return f"""
            <html><body style="font-family:sans-serif; background:#f4f6f8; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
                <div style="background:white; padding:40px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.12); text-align:center;">
                    <h2 style="color:#64748b; margin-top:0;">Link Expired</h2>
                    <p style="color:#333; font-size:16px;">You have already submitted a decision for this request.</p>
                    <p style="color:#666; font-size:14px; margin-top:20px;">You can close this window now.</p>
                </div>
            </body></html>
            """
        # -------------------------

        # The name is stored as a separate key in the JSON, so we just save raw comments.
        if not comments:
            comments = "No comments provided."

    
        result = update_approval_status(ticket_id, role, status, comments, responder_name=receiver)
        if not result.get('success'):
            raise Exception(f"Database update failed: {result.get('error')}")

        msg = f"Request {status} by {role}."

        if role == "Admin-Manager":
            if status == "Approved":
                msg += " Approved by Manager."
            else:
                msg += " Rejected by Manager."
        elif role == "Management":
            msg += f" Management decision ({status}) recorded."

        return f"""
        <html><body>
            <div style="text-align:center; margin-top:80px; font-family:sans-serif;">
                <h1 style="color:{'#16a34a' if status == 'Approved' else '#dc2626'};">{msg}</h1>
                <p>You can close this window.</p>
            </div>
        </body></html>
        """
    except Exception as e:
        return f"Error: {str(e)}", 500


@app.route('/api/bulk-delete-tickets', methods=['POST'])
def bulk_delete_tickets():
    try:
        data = request.get_json()
        admin_email = data.get('admin_email', '')
        if not admin_email or admin_email.strip().lower() != 'admin@support.com':
            return jsonify({"error": "Unauthorized. Only super-admin can delete tickets."}), 403
            
        ticket_ids = data.get('ticket_ids', [])
        if not ticket_ids:
            return jsonify({"error": "No ticket IDs provided"}), 400
        
        success_count = 0
        errors = []
        for tid in ticket_ids:
            res = soft_delete_ticket(tid)
            if res.get('success'):
                success_count = success_count + 1
            else:
                errors.append({"ticket_id": tid, "error": res.get('error')})
        
        return jsonify({
            "message": f"Successfully deleted {success_count} tickets",
            "success_count": success_count,
            "errors": errors
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tickets/<ticket_id>', methods=['POST']) # Changed from DELETE to POST for consistency and body support
def delete_ticket_route(ticket_id):
    try:
        data = request.get_json() or {}
        admin_email = data.get('admin_email', '')
        if not admin_email or admin_email.strip().lower() != 'admin@support.com':
            return jsonify({"error": "Unauthorized. Only super-admin can delete tickets."}), 403
            
        result = soft_delete_ticket(ticket_id)
        if result['success']:
            return jsonify({"message": "Ticket deleted successfully"}), 200
        return jsonify({"error": result.get('error', 'Unknown error')}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/tickets/<ticket_id>/attachment')
def download_attachment(ticket_id):
    try:
        attachment_data = get_attachment(ticket_id)
        if attachment_data:
            return send_file(
                io.BytesIO(attachment_data['blob']),
                download_name=attachment_data['name'],
                as_attachment=False
            )
        return jsonify({"error": "Attachment not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/assets/<path:filename>')
def serve_logo_assets(filename):
    prod_path = os.path.join(DIST_DIR, 'assets', filename)
    if os.path.exists(prod_path):
        return send_from_directory(os.path.join(DIST_DIR, 'assets'), filename)
    assets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'assets'))
    return send_from_directory(assets_dir, filename)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, 'index.html')

@app.errorhandler(404)
def not_found(e):
    # This catches React Router paths like /admin, returning the SPA index.html
    return send_from_directory(DIST_DIR, 'index.html')
# ---------------------------------------------------------------------------
# Asset Types Management
# ---------------------------------------------------------------------------
@app.route('/api/asset_types', methods=['GET', 'POST'])
def manage_asset_types():
    if request.method == 'GET':
        return jsonify(get_asset_types())
    if request.method == 'POST':
        data = request.json
        name = data.get('name')
        asset_group = data.get('asset_group', 'IT')
        prefix = data.get('prefix')
        if not name:
            return jsonify({"error": "Name is required"}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM asset_types WHERE LOWER(name) = %s AND is_delete = FALSE;", (name.lower().strip(),))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Asset type name already exists"}), 400
        conn.close()
        res = create_asset_type(name, asset_group, prefix)
        return jsonify(res)

@app.route('/api/asset_types/<int:type_id>', methods=['PUT', 'DELETE'])
def manage_single_asset_type(type_id):
    if request.method == 'PUT':
        data = request.json
        name = data.get('name')
        asset_group = data.get('asset_group', 'IT')
        prefix = data.get('prefix')
        if not name:
            return jsonify({"error": "Name is required"}), 400
        # Check duplicate
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM asset_types WHERE LOWER(name) = %s AND id != %s AND is_delete = FALSE;", (name.lower().strip(), type_id))
            if cur.fetchone()[0] > 0:
                conn.close()
                return jsonify({"error": "Asset type name already exists"}), 400
        conn.close()
        updated = update_asset_type(type_id, name, asset_group, prefix)
        if updated:
            return jsonify({"success": True})
        return jsonify({"error": "Failed to update asset type"}), 400
    if request.method == 'DELETE':
        deleted = delete_asset_type(type_id)
        if deleted:
            return jsonify({"success": True})
        return jsonify({"error": "Failed to delete asset type"}), 400

# ---------------------------------------------------------------------------
# Background Scheduler (Applies to both WSGI & Development)
# ---------------------------------------------------------------------------
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

scheduler = BackgroundScheduler()
# Runs the auto-confirm sweep every 15 minutes
scheduler.add_job(func=auto_confirm_stale_tickets, trigger="interval", minutes=15)
# Runs the attachment cleanup every 24 hours
scheduler.add_job(func=delete_expired_attachments, trigger="interval", hours=24)
scheduler.start()

# Shut down the scheduler when exiting the app
atexit.register(lambda: scheduler.shutdown())

# ---------------------------------------------------------------------------
# Consolidation of Courier and Petty Cash Sub-applications
# ---------------------------------------------------------------------------
from werkzeug.middleware.dispatcher import DispatcherMiddleware
import sys
import importlib.util

def load_module_from_path(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

# ---------------------------------------------------------------------------
# Consolidation of Courier and Petty Cash Sub-applications
# ---------------------------------------------------------------------------
import sys
import importlib.util

def load_module_from_path(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

# 1. Load Courier app package under 'courier_app_pkg' namespace to avoid app.py collisions
courier_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Courier'))
init_path = os.path.join(courier_dir, 'app', '__init__.py')
spec = importlib.util.spec_from_file_location('courier_app_pkg', init_path)
courier_app_pkg = importlib.util.module_from_spec(spec)
courier_app_pkg.__package__ = 'courier_app_pkg'
sys.modules['courier_app_pkg'] = courier_app_pkg

sys.path.insert(0, courier_dir)
try:
    spec.loader.exec_module(courier_app_pkg)
    create_courier_app = courier_app_pkg.create_app
    courier_app = create_courier_app('development')
    # Initialize database tables
    with courier_app.app_context():
        courier_app_pkg.db.create_all()
        
        # Run user table column migrations (SQLite-safe)
        try:
            from sqlalchemy import text, inspect as sqla_inspect
            db_obj = courier_app_pkg.db
            inspector = sqla_inspect(db_obj.engine)

            if 'couriers' in inspector.get_table_names():
                courier_existing = {c['name'] for c in inspector.get_columns('couriers')}
                if 'creator_email' not in courier_existing:
                    db_obj.session.execute(text("ALTER TABLE couriers ADD COLUMN creator_email VARCHAR(150);"))
                    db_obj.session.commit()

            if 'users' in inspector.get_table_names():
                existing = {c['name'] for c in inspector.get_columns('users')}
                new_cols = [
                    ("perm_view_cost",    "BOOLEAN DEFAULT 0"),
                    ("perm_view_reports", "BOOLEAN DEFAULT 1"),
                    ("perm_view_entries", "BOOLEAN DEFAULT 1"),
                    ("perm_add",          "BOOLEAN DEFAULT 1"),
                    ("perm_edit",         "BOOLEAN DEFAULT 0"),
                    ("perm_delete",       "BOOLEAN DEFAULT 0"),
                ]
                with db_obj.engine.connect() as conn:
                    for col, typedef in new_cols:
                        if col not in existing:
                            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
                    conn.commit()
            if 'couriers' in inspector.get_table_names():
                existing_couriers = {c['name'] for c in inspector.get_columns('couriers')}
                new_couriers_cols = [
                    ("item",     "VARCHAR(100)"),
                    ("ref_type", "VARCHAR(50)"),
                ]
                with db_obj.engine.connect() as conn:
                    for col, typedef in new_couriers_cols:
                        if col not in existing_couriers:
                            conn.execute(text(f"ALTER TABLE couriers ADD COLUMN {col} {typedef}"))
                    conn.commit()
        except Exception as ex_mig:
            print(f"DEBUG: Courier schema migration error: {ex_mig}")
            
        # Seed lookups (skip if already exist)
        try:
            LookupItem = courier_app_pkg.models.LookupItem
            DEPARTMENTS = ['Merch', 'Marketing', 'PD', 'Factory Merch', 'Docs',
                           'Accounts', 'Admin', 'DST', 'IT', 'Design', 'BIU']
            SUPPLIER_TYPES = ['Buyer', 'HO', 'Testing Lab', 'Vendor', 'Factory', 'Agent', 'Other']
            PACKAGE_TYPES = ['Cover', 'Box', 'Carton', 'Samples', '1 Box', '2 Box', 'Other']
            
            seeds = (
                [('department', v) for v in DEPARTMENTS] +
                [('supplier_type', v) for v in SUPPLIER_TYPES] +
                [('package_type', v) for v in PACKAGE_TYPES]
            )
            added = 0
            for i, (cat, val) in enumerate(seeds):
                if not LookupItem.query.filter_by(category=cat, value=val).first():
                    db_obj.session.add(LookupItem(category=cat, value=val, sort_order=i))
                    added += 1
            if added > 0:
                db_obj.session.commit()
                print(f"DEBUG: Courier seeded {added} lookup items")
        except Exception as ex_seed:
            print(f"DEBUG: Courier seeding error: {ex_seed}")
finally:
    sys.path.pop(0)

# 2. Load Petty Cash app
petty_cash_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Petty Cash'))
sys.path.insert(0, petty_cash_dir)
try:
    petty_cash_app_path = os.path.join(petty_cash_dir, 'app.py')
    petty_cash_app_module = load_module_from_path('petty_cash_app_module', petty_cash_app_path)
    petty_cash_app = petty_cash_app_module.app
    # Initialize database and tables
    if hasattr(petty_cash_app_module, 'init_db'):
        petty_cash_app_module.init_db()
finally:
    sys.path.pop(0)

# ---------------------------------------------------------------------------
# Courier API Endpoints
# ---------------------------------------------------------------------------
@app.route('/api/courier/lookups', methods=['GET'])
def api_courier_lookups():
    try:
        with courier_app.app_context():
            def _lookup(cat):
                return [i.value for i in courier_app_pkg.models.LookupItem.query.filter_by(
                    category=cat, is_active=True
                ).order_by(courier_app_pkg.models.LookupItem.sort_order, courier_app_pkg.models.LookupItem.value).all()]
            
            branches = [{"id": b.id, "name": b.name, "code": b.code} for b in courier_app_pkg.models.Branch.query.filter_by(is_active=True).all()]
            
            from database import get_departments
            # Fetch departments that have "Courier" support type (or all if you prefer, but Courier is what they map it to)
            courier_departments = [d['name'] for d in get_departments("Courier")]
            # Fallback to all departments if none have Courier support type yet, so the dropdown isn't empty
            if not courier_departments:
                courier_departments = [d['name'] for d in get_departments()]
            
            return jsonify({
                "departments": courier_departments,
                "supplier_types": _lookup('supplier_type'),
                "package_types": _lookup('package_type'),
                "courier_names": _lookup('courier_name'),
                "budget_statuses": _lookup('budget_status') or ['Non Budgeted', 'Budgeted'],
                "payment_modes": _lookup('payment_mode'),
                "transaction_types": _lookup('transaction_type'),
                "branches": branches
            }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courier/entries', methods=['GET'])
def api_courier_entries():
    try:
        with courier_app.app_context():
            q = courier_app_pkg.models.Courier.query
            
            # Filters
            search = request.args.get('search', '').strip()
            dept = request.args.get('dept', '')
            courier_name = request.args.get('courier_name', '')
            from_date = request.args.get('from_date', '')
            to_date = request.args.get('to_date', '')
            budgeted = request.args.get('budgeted', '')
            branch_id = request.args.get('branch_id', '')
            trans_type = request.args.get('trans_type', '')
            
            if search:
                q = q.filter(
                    courier_app_pkg.db.or_(
                        courier_app_pkg.models.Courier.sender.ilike(f'%{search}%'),
                        courier_app_pkg.models.Courier.receiver.ilike(f'%{search}%'),
                        courier_app_pkg.models.Courier.awb_no.ilike(f'%{search}%'),
                        courier_app_pkg.models.Courier.destination.ilike(f'%{search}%'),
                        courier_app_pkg.models.Courier.supplier_buyer_name.ilike(f'%{search}%'),
                        courier_app_pkg.models.Courier.order_reference.ilike(f'%{search}%'),
                    )
                )
            if dept:
                q = q.filter(courier_app_pkg.models.Courier.department == dept)
            if courier_name:
                q = q.filter(courier_app_pkg.models.Courier.courier_name.ilike(f'%{courier_name}%'))
            if from_date:
                q = q.filter(courier_app_pkg.models.Courier.date >= from_date)
            if to_date:
                q = q.filter(courier_app_pkg.models.Courier.date <= to_date)
            if budgeted:
                q = q.filter(courier_app_pkg.models.Courier.budgeted.ilike(f'%{budgeted}%'))
            if branch_id:
                q = q.filter(courier_app_pkg.models.Courier.branch_id == int(branch_id))
            if trans_type:
                q = q.filter(courier_app_pkg.models.Courier.transaction_type == trans_type)
            
            entries = q.order_by(courier_app_pkg.models.Courier.date.desc(), courier_app_pkg.models.Courier.id.desc()).all()
            
            # Format list
            result = []
            for c in entries:
                result.append({
                    "id": c.id,
                    "branch_id": c.branch_id,
                    "branch_name": c.branch.name if c.branch else "",
                    "date": c.date.isoformat() if c.date else "",
                    "transaction_type": c.transaction_type,
                    "sender": c.sender,
                    "department": c.department,
                    "sending_from": c.sending_from,
                    "receiver": c.receiver,
                    "receiver_office": c.receiver_office,
                    "supplier_buyer_type": c.supplier_buyer_type,
                    "supplier_buyer_name": c.supplier_buyer_name,
                    "destination": c.destination,
                    "product_description": c.product_description,
                    "package_type": c.package_type,
                    "num_packages": c.num_packages,
                    "order_related": c.order_related,
                    "order_reference": c.order_reference,
                    "budgeted": c.budgeted,
                    "courier_name": c.courier_name,
                    "awb_no": c.awb_no,
                    "weight_kg": c.weight_kg,
                    "box_measurement": c.box_measurement,
                    "chargeable_weight": c.chargeable_weight,
                    "courier_cost": c.courier_cost,
                    "payment_mode": c.payment_mode,
                    "remarks": c.remarks,
                    "item": c.item,
                    "ref_type": c.ref_type,
                    "creator_email": getattr(c, 'creator_email', None)
                })
            return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courier/entries', methods=['POST'])
def api_courier_create():
    try:
        from datetime import date
        data = request.json or {}
        with courier_app.app_context():
            c = courier_app_pkg.models.Courier(
                branch_id=data.get('branch_id') or 1,
                date=date.fromisoformat(data['date']) if data.get('date') else date.today(),
                transaction_type=data.get('transaction_type', 'Dispatch'),
                sender=data.get('sender', '').strip(),
                department=data.get('department', '').strip(),
                sending_from=data.get('sending_from', '').strip(),
                receiver=data.get('receiver', '').strip(),
                receiver_office=data.get('receiver_office', '').strip(),
                supplier_buyer_type=data.get('supplier_buyer_type', '').strip(),
                supplier_buyer_name=data.get('supplier_buyer_name', '').strip(),
                destination=data.get('destination', '').strip(),
                product_description=data.get('product_description', '').strip(),
                package_type=data.get('package_type', '').strip(),
                num_packages=int(data.get('num_packages', 1) or 1),
                order_related=data.get('order_related', 'NO'),
                order_reference=data.get('order_reference', '').strip(),
                budgeted=data.get('budgeted', 'Non Budgeted'),
                courier_name=data.get('courier_name', '').strip(),
                awb_no=data.get('awb_no', '').strip(),
                weight_kg=float(data['weight_kg']) if data.get('weight_kg') else None,
                box_measurement=data.get('box_measurement', '').strip(),
                chargeable_weight=float(data['chargeable_weight']) if data.get('chargeable_weight') else None,
                courier_cost=float(data.get('courier_cost', 0) or 0),
                payment_mode=data.get('payment_mode', '').strip(),
                remarks=data.get('remarks', '').strip(),
                item=data.get('item', '').strip(),
                ref_type=data.get('ref_type', '').strip(),
                creator_email=data.get('creator_email', '').strip()
            )
            courier_app_pkg.db.session.add(c)
            courier_app_pkg.db.session.commit()
            return jsonify({"success": True, "id": c.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courier/entries/<int:entry_id>', methods=['PUT'])
def api_courier_update(entry_id):
    try:
        from datetime import date
        data = request.json or {}
        with courier_app.app_context():
            c = courier_app_pkg.models.Courier.query.get_or_404(entry_id)
            c.branch_id = data.get('branch_id', c.branch_id)
            if data.get('date'):
                c.date = date.fromisoformat(data['date'])
            c.transaction_type = data.get('transaction_type', c.transaction_type)
            c.sender = data.get('sender', c.sender).strip()
            c.department = data.get('department', c.department).strip()
            c.sending_from = data.get('sending_from', c.sending_from).strip()
            c.receiver = data.get('receiver', c.receiver).strip()
            c.receiver_office = data.get('receiver_office', c.receiver_office).strip()
            c.supplier_buyer_type = data.get('supplier_buyer_type', c.supplier_buyer_type).strip()
            c.supplier_buyer_name = data.get('supplier_buyer_name', c.supplier_buyer_name).strip()
            c.destination = data.get('destination', c.destination).strip()
            c.product_description = data.get('product_description', c.product_description).strip()
            c.package_type = data.get('package_type', c.package_type).strip()
            c.num_packages = int(data.get('num_packages', c.num_packages) or 1)
            c.order_related = data.get('order_related', c.order_related)
            c.order_reference = data.get('order_reference', c.order_reference).strip()
            c.budgeted = data.get('budgeted', c.budgeted)
            c.courier_name = data.get('courier_name', c.courier_name).strip()
            c.awb_no = data.get('awb_no', c.awb_no).strip()
            c.weight_kg = float(data['weight_kg']) if data.get('weight_kg') is not None else c.weight_kg
            c.box_measurement = data.get('box_measurement', c.box_measurement).strip()
            c.chargeable_weight = float(data['chargeable_weight']) if data.get('chargeable_weight') is not None else c.chargeable_weight
            c.courier_cost = float(data.get('courier_cost', c.courier_cost) or 0)
            c.payment_mode = data.get('payment_mode', c.payment_mode).strip()
            c.remarks = data.get('remarks', c.remarks).strip()
            c.item = data.get('item', c.item).strip()
            c.ref_type = data.get('ref_type', c.ref_type).strip()
            c.creator_email = data.get('creator_email', getattr(c, 'creator_email', '')).strip()
            courier_app_pkg.db.session.commit()
            return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/courier/entries/<int:entry_id>', methods=['DELETE'])
def api_courier_delete(entry_id):
    try:
        with courier_app.app_context():
            c = courier_app_pkg.models.Courier.query.get_or_404(entry_id)
            courier_app_pkg.db.session.delete(c)
            courier_app_pkg.db.session.commit()
            return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# Petty Cash API Endpoints
# ---------------------------------------------------------------------------

def rebuild_ledger_balances(conn):
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, date, added_cash, total_expenses FROM day_ledger ORDER BY date ASC")
            ledgers = cur.fetchall()
            
            if not ledgers:
                return
                
            cur.execute("SELECT opening_balance FROM day_ledger ORDER BY date ASC LIMIT 1")
            first_ledger = cur.fetchone()
            current_open = float(first_ledger[0]) if first_ledger else 0.0
            
            for row in ledgers:
                lid = row[0]
                ldate = row[1]
                
                cur.execute("SELECT SUM(expense_amount) FROM pettycash WHERE date=%s AND status != 'rejected'", (ldate,))
                exp_sum = cur.fetchone()[0]
                texp = float(exp_sum) if exp_sum else 0.0
                
                cur.execute("SELECT SUM(amount) FROM cash_add_history WHERE date=%s", (ldate,))
                cash_sum = cur.fetchone()[0]
                tadd = float(cash_sum) if cash_sum else 0.0
                
                closing = current_open + tadd - texp
                
                cur.execute("UPDATE day_ledger SET opening_balance=%s, added_cash=%s, total_expenses=%s, closing_balance=%s WHERE id=%s",
                            (current_open, tadd, texp, closing, lid))
                
                current_open = closing
    except Exception as e:
        import traceback
        traceback.print_exc()


@app.route('/api/petty-cash/dashboard', methods=['GET'])
def api_petty_cash_dashboard():
    try:
        from datetime import date, timedelta
        from collections import defaultdict
        
        today = date.today()
        month_start = today.replace(day=1)
        
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            # today expenses
            cur.execute("SELECT expense_amount, category FROM pettycash WHERE date = %s AND status != 'rejected'", (today,))
            today_expenses = cur.fetchall()
            today_total = sum(e[0] for e in today_expenses if e[0])
            today_count = len(today_expenses)
            
            # month expenses
            cur.execute("SELECT expense_amount FROM pettycash WHERE date >= %s AND status = 'approved'", (month_start,))
            month_exps = cur.fetchall()
            month_total = sum(e[0] for e in month_exps if e[0])
            
            # month credit
            cur.execute("SELECT SUM(added_cash) FROM day_ledger WHERE date >= %s", (month_start,))
            month_credit_result = cur.fetchone()[0]
            month_credit = float(month_credit_result) if month_credit_result else 0.0
            
            days_since_sunday = today.isoweekday() % 7
            last_sunday = today - timedelta(days=days_since_sunday)
            next_saturday = last_sunday + timedelta(days=6)
            cur.execute("SELECT SUM(expense_amount) FROM pettycash WHERE date >= %s AND date <= %s AND status = 'approved'", (last_sunday, next_saturday))
            this_week_sum = cur.fetchone()[0]
            this_week_total = float(this_week_sum) if this_week_sum else 0.0
            
            # pending count
            cur.execute("SELECT COUNT(*) FROM pettycash WHERE status = 'pending'")
            pending_count = cur.fetchone()[0]
            
            # last ledger
            cur.execute("SELECT closing_balance FROM day_ledger WHERE date < %s AND is_closed = TRUE ORDER BY date DESC LIMIT 1", (today,))
            last_ledger = cur.fetchone()
            opening = float(last_ledger[0]) if last_ledger else 0.0
            
            
            cat_totals = defaultdict(float)
            for e in today_expenses:
                if e[0]:
                    cat_totals[e[1]] += float(e[0])
            
            # week data
            week_data = []
            for i in range(6, -1, -1):
                d = today - timedelta(days=i)
                cur.execute("SELECT SUM(expense_amount) FROM pettycash WHERE date = %s AND status != 'rejected'", (d,))
                s = cur.fetchone()[0]
                total = float(s) if s else 0.0
                week_data.append({
                    'label': d.strftime('%d %b'),
                    'total': round(total, 2)
                })
                
            # today ledger
            cur.execute("SELECT added_cash, closing_balance, is_closed, notes FROM day_ledger WHERE date = %s", (today,))
            today_ledger = cur.fetchone()
            
            today_added = float(today_ledger[0]) if today_ledger else 0.0
            today_closed = bool(today_ledger[2]) if today_ledger else False
            
            if today_closed:
                current_balance = float(today_ledger[1])
            else:
                current_balance = opening + today_added - float(today_total)
                
            ledger_info = {
                "opening_balance": opening,
                "added_cash": float(today_ledger[0]) if today_ledger else 0.0,
                "closing_balance": float(today_ledger[1]) if today_ledger else current_balance,
                "is_closed": bool(today_ledger[2]) if today_ledger else False,
                "notes": today_ledger[3] if today_ledger and today_ledger[3] else ""
            }
            
            # categories
            from database import get_categories
            db_cats = get_categories('Petty Cash')
            categories_list = []
            subcategories_map = {}
            for cat in db_cats:
                cat_name = cat['name']
                categories_list.append(cat_name)
                subs = [s.strip() for s in cat.get('subcategories', '').split(',') if s.strip()]
                if 'Other' not in subs:
                    subs.append('Other')
                subcategories_map[cat_name] = subs
        conn.close()
        
        return jsonify({
            "today_total": float(today_total),
            "today_count": today_count,
            "month_total": float(month_total),
            "month_credit": month_credit,
            "this_week_total": this_week_total,
            "pending_count": pending_count,
            "current_balance": float(current_balance),
            "cat_totals": dict(cat_totals),
            "week_data": week_data,
            "ledger": ledger_info,
            "categories": categories_list,
            "subcategories": subcategories_map
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/expenses', methods=['GET'])
def api_petty_cash_expenses():
    try:
        from datetime import datetime
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        category = request.args.get('category', '')
        subcategory = request.args.get('subcategory', '')
        purpose = request.args.get('purpose', '')
        status_f = request.args.get('status', '')
        
        query_expenses = "SELECT 'expense' as type, id, date, category, sub_category, sub_remarks, expense_amount, description, status, user_name, approved_by, approved_at, manager_notes, created_at, receiver_name, verified_by FROM pettycash WHERE 1=1"
        query_credit = "SELECT 'credit' as type, id, date, 'Added Cash' as category, '' as sub_category, '' as sub_remarks, amount as expense_amount, description, 'approved' as status, user_name, user_name as approved_by, created_at as approved_at, '' as manager_notes, created_at, '' as receiver_name, '' as verified_by FROM cash_add_history WHERE 1=1"
        
        params_expenses = []
        params_credit = []
        
        if date_from and date_from not in ('null', 'undefined'):
            query_expenses += " AND date >= %s"
            params_expenses.append(date_from)
            query_credit += " AND date >= %s"
            params_credit.append(date_from)
        if date_to and date_to not in ('null', 'undefined'):
            query_expenses += " AND date <= %s"
            params_expenses.append(date_to)
            query_credit += " AND date <= %s"
            params_credit.append(date_to)
        if category and category not in ('null', 'undefined'):
            if category == 'Added Cash':
                query_expenses += " AND 1=0"
            else:
                query_expenses += " AND category = %s"
                params_expenses.append(category)
                query_credit += " AND 1=0"
        if subcategory and subcategory not in ('null', 'undefined'):
            query_expenses += " AND LOWER(sub_category) = LOWER(%s)"
            params_expenses.append(subcategory)
            query_credit += " AND 1=0"
        if purpose and purpose not in ('null', 'undefined'):
            query_expenses += " AND LOWER(user_name) = LOWER(%s)"
            params_expenses.append(purpose)
            query_credit += " AND LOWER(user_name) = LOWER(%s)"
            params_credit.append(purpose)
        if status_f and status_f not in ('null', 'undefined'):
            query_expenses += " AND status = %s"
            params_expenses.append(status_f)
            if status_f != 'approved':
                query_credit += " AND 1=0"
            
        final_query = f"SELECT * FROM ({query_expenses} UNION ALL {query_credit}) as combined ORDER BY date DESC, created_at DESC"
        final_params = params_expenses + params_credit
        
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(final_query, final_params)
            rows = cur.fetchall()
            
            result = []
            for r in rows:
                result.append({
                    "type": r[0],
                    "id": r[1],
                    "date": r[2].isoformat() if r[2] else "",
                    "category": r[3] or "",
                    "subcategory": r[4] or "",
                    "sub_remarks": r[5] or "",
                    "amount": float(r[6]) if r[6] else 0.0,
                    "description": r[7] or "",
                    "status": r[8] or "approved",
                    "submitted_by": r[9] or "Unknown",
                    "approved_by": r[10] or "",
                    "approved_at": r[11].isoformat() if hasattr(r[11], 'isoformat') else str(r[11]) if r[11] else "",
                    "manager_notes": r[12] or "",
                    "receiver_name": r[14] or "",
                    "verified_by": r[15] or ""
                })
        conn.close()
        return jsonify(result), 200
    except Exception as e:
        import traceback
        with open('expenses_error.log', 'w') as f:
            f.write(traceback.format_exc())
            f.write(f"\ndate_from={request.args.get('date_from', '')}")
            f.write(f"\ndate_to={request.args.get('date_to', '')}")
            f.write(f"\ncategory={request.args.get('category', '')}")
            f.write(f"\nsubcategory={request.args.get('subcategory', '')}")
            f.write(f"\npurpose={request.args.get('purpose', '')}")
            f.write(f"\nstatus={request.args.get('status', '')}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/expenses', methods=['POST'])
def api_petty_cash_add():
    try:
        data = request.json
        user_name = data.get('submitted_by', 'admin')
        is_manager = data.get('is_manager', False)
        
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            status = 'approved' if is_manager else 'pending'
            approved_by = user_name if is_manager else None
            
            amount_val = data.get('amount')
            if amount_val == '' or amount_val is None:
                amount_val = 0
            
            cur.execute("""
                INSERT INTO pettycash (date, category, sub_category, sub_remarks, expense_amount, description, user_name, status, approved_by, approved_at, receiver_name, verified_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s, %s)
            """, (
                data.get('date'),
                data.get('category'),
                data.get('subcategory'),
                data.get('sub_remarks'),
                amount_val,
                data.get('description'),
                user_name,
                status,
                approved_by,
                data.get('receiver_name'),
                data.get('verified_by')
            ))
            conn.commit()
        conn.close()
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/expenses/<int:eid>/approve', methods=['POST'])
def api_petty_cash_approve(eid):
    try:
        data = request.json
        user_name = data.get('user_name', 'admin')
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("UPDATE pettycash SET status='approved', approved_by=%s, approved_at=NOW() WHERE id=%s", (user_name, eid))
            conn.commit()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/expenses/<int:eid>/reject', methods=['POST'])
def api_petty_cash_reject(eid):
    try:
        data = request.json
        user_name = data.get('user_name', 'admin')
        notes = data.get('notes', '')
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("UPDATE pettycash SET status='rejected', manager_notes=%s, approved_by=%s, approved_at=NOW() WHERE id=%s", (notes, user_name, eid))
            conn.commit()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/expenses/<int:eid>', methods=['PUT'])
def api_petty_cash_update(eid):
    try:
        data = request.json
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            amount_val = data.get('amount')
            if amount_val == '' or amount_val is None:
                amount_val = 0
                
            cur.execute("""
                UPDATE pettycash 
                SET date=%s, category=%s, sub_category=%s, sub_remarks=%s, expense_amount=%s, description=%s, user_name=%s, approved_by=%s, receiver_name=%s, verified_by=%s
                WHERE id=%s
            """, (
                data.get('date'), data.get('category'), data.get('subcategory'),
                data.get('sub_remarks'), amount_val, data.get('description'),
                data.get('submitted_by'), data.get('approved_by'), data.get('receiver_name'), data.get('verified_by'), eid
            ))
            conn.commit()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/expenses/<int:eid>', methods=['DELETE'])
def api_petty_cash_delete(eid):
    try:
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM pettycash WHERE id=%s", (eid,))
            conn.commit()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/ledger/close', methods=['POST'])
def api_petty_cash_close_ledger():
    try:
        from datetime import date
        data = request.json
        today = date.today()
        user_name = data.get('user_name', 'admin')
        notes = data.get('notes', '')
        
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            # check if exists
            cur.execute("SELECT id, added_cash FROM day_ledger WHERE date=%s", (today,))
            exists = cur.fetchone()
            current_added_cash = float(exists[1]) if exists and exists[1] else 0.0
            
            # calculate closing
            cur.execute("SELECT SUM(expense_amount) FROM pettycash WHERE date=%s AND status != 'rejected'", (today,))
            exp_sum = cur.fetchone()[0]
            total_exp = float(exp_sum) if exp_sum else 0.0
            
            cur.execute("SELECT closing_balance FROM day_ledger WHERE date < %s AND is_closed=TRUE ORDER BY date DESC LIMIT 1", (today,))
            prev = cur.fetchone()
            opening = float(prev[0]) if prev else 0.0
            
            closing = opening + current_added_cash - total_exp
            
            if exists:
                cur.execute("UPDATE day_ledger SET total_expenses=%s, closing_balance=%s, is_closed=TRUE, notes=%s, closed_at=NOW() WHERE date=%s", 
                            (total_exp, closing, notes, today))
            else:
                cur.execute("INSERT INTO day_ledger (date, opening_balance, added_cash, total_expenses, closing_balance, is_closed, notes, closed_at) VALUES (%s, %s, %s, %s, %s, TRUE, %s, NOW())",
                            (today, opening, 0.0, total_exp, closing, notes))
            conn.commit()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/ledger/add-cash', methods=['POST'])
def api_petty_cash_add_cash():
    try:
        from datetime import date as dt_date
        data = request.json
        # Use provided date if available, else today
        today = data.get('date') or dt_date.today().isoformat()
        new_cash = float(data.get('amount', 0))
        user_name = data.get('user_name', 'admin')
        description = data.get('description', '')
        
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM day_ledger WHERE date=%s", (today,))
            exists = cur.fetchone()
            
            cur.execute("SELECT closing_balance FROM day_ledger WHERE date < %s AND is_closed=TRUE ORDER BY date DESC LIMIT 1", (today,))
            prev = cur.fetchone()
            opening = float(prev[0]) if prev else 0.0
            
            if exists:
                cur.execute("UPDATE day_ledger SET added_cash = COALESCE(added_cash, 0) + %s, closing_balance = CASE WHEN is_closed=TRUE THEN COALESCE(closing_balance, 0) + %s ELSE closing_balance END WHERE date=%s", (new_cash, new_cash, today))
            else:
                cur.execute("INSERT INTO day_ledger (date, opening_balance, added_cash, is_closed) VALUES (%s, %s, %s, FALSE)",
                            (today, opening, new_cash))
            
            cur.execute("INSERT INTO cash_add_history (date, amount, user_name, description) VALUES (%s, %s, %s, %s)",
                        (today, new_cash, user_name, description))
            
            conn.commit()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/ledger/add-cash/<int:eid>', methods=['PUT', 'DELETE'])
def api_petty_cash_modify_add_cash(eid):
    try:
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            if request.method == 'PUT':
                from datetime import date as dt_date
                data = request.json
                new_cash = float(data.get('amount', 0))
                description = data.get('description', '')
                date_str = data.get('date') or dt_date.today().isoformat()
                
                cur.execute("SELECT amount, date FROM cash_add_history WHERE id=%s", (eid,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Not found"}), 404
                
                old_amount = float(row[0])
                old_date = row[1].isoformat() if hasattr(row[1], 'isoformat') else str(row[1])
                diff = new_cash - old_amount
                
                # Update the history record
                cur.execute("UPDATE cash_add_history SET amount=%s, description=%s, date=%s WHERE id=%s", (new_cash, description, date_str, eid))
                
                # Update the day_ledger
                if old_date == date_str:
                    cur.execute("UPDATE day_ledger SET added_cash = COALESCE(added_cash, 0) + %s, closing_balance = CASE WHEN is_closed=TRUE THEN COALESCE(closing_balance, 0) + %s ELSE closing_balance END WHERE date=%s", (diff, diff, date_str))
                else:
                    cur.execute("UPDATE day_ledger SET added_cash = COALESCE(added_cash, 0) - %s, closing_balance = CASE WHEN is_closed=TRUE THEN COALESCE(closing_balance, 0) - %s ELSE closing_balance END WHERE date=%s", (old_amount, old_amount, old_date))
                    
                    cur.execute("SELECT id FROM day_ledger WHERE date=%s", (date_str,))
                    if cur.fetchone():
                        cur.execute("UPDATE day_ledger SET added_cash = COALESCE(added_cash, 0) + %s, closing_balance = CASE WHEN is_closed=TRUE THEN COALESCE(closing_balance, 0) + %s ELSE closing_balance END WHERE date=%s", (new_cash, new_cash, date_str))
                    else:
                        cur.execute("SELECT closing_balance FROM day_ledger WHERE date < %s AND is_closed=TRUE ORDER BY date DESC LIMIT 1", (date_str,))
                        prev = cur.fetchone()
                        opening = float(prev[0]) if prev else 0.0
                        cur.execute("INSERT INTO day_ledger (date, opening_balance, added_cash, is_closed) VALUES (%s, %s, %s, FALSE)", (date_str, opening, new_cash))

            elif request.method == 'DELETE':
                cur.execute("SELECT amount, date FROM cash_add_history WHERE id=%s", (eid,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Not found"}), 404
                
                old_amount = float(row[0])
                old_date = row[1].isoformat() if hasattr(row[1], 'isoformat') else str(row[1])
                
                # Delete from history record
                cur.execute("DELETE FROM cash_add_history WHERE id=%s", (eid,))
                
                # Update the day_ledger
                cur.execute("UPDATE day_ledger SET added_cash = COALESCE(added_cash, 0) - %s, closing_balance = CASE WHEN is_closed=TRUE THEN COALESCE(closing_balance, 0) - %s ELSE closing_balance END WHERE date=%s", (old_amount, old_amount, old_date))

            conn.commit()
        conn.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/credit-history', methods=['GET'])
def api_petty_cash_credit_history():
    try:
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, date, amount, user_name, created_at
                FROM cash_add_history
                WHERE EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
                  AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
                ORDER BY created_at DESC
            """)
            rows = cur.fetchall()
            history = []
            for r in rows:
                history.append({
                    "id": r[0],
                    "date": r[1].isoformat(),
                    "amount": float(r[2]),
                    "user_name": r[3],
                    "created_at": r[4].strftime("%Y-%m-%d %I:%M %p") if r[4] else ""
                })
        conn.close()
        return jsonify(history), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/ledger/all', methods=['GET'])
def api_petty_cash_ledger_all():
    try:
        from database import _get_conn
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, date, opening_balance, added_cash, total_expenses, closing_balance, is_closed
                FROM day_ledger
                ORDER BY date ASC
            """)
            rows = cur.fetchall()
            ledger_data = []
            for r in rows:
                ledger_data.append({
                    "id": r[0],
                    "date": r[1].isoformat() if hasattr(r[1], 'isoformat') else str(r[1]),
                    "opening_balance": float(r[2] or 0),
                    "added_cash": float(r[3] or 0),
                    "total_expenses": float(r[4] or 0),
                    "closing_balance": float(r[5] or 0),
                    "is_closed": bool(r[6])
                })
        conn.close()
        return jsonify(ledger_data), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/petty-cash/reports/export', methods=['GET'])
def api_petty_cash_export():
    try:
        return jsonify({"message": "Use frontend export for now"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Run the Ticket Raise API Server")
    parser.add_argument('-e', '--env', choices=['local', 'prod'], default='local', help="Environment (local or prod)")
    args = parser.parse_args()
    os.environ['APP_ENV'] = args.env

    host = "122.165.253.167" if args.env == "prod" else "localhost"
    is_debug = (args.env == "local")
    app.run(host=host, port=443, debug=is_debug)
