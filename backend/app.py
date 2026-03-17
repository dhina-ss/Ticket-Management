from flask import Flask, request, jsonify, send_file, send_from_directory
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
    delete_expired_attachments, # Added this line
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
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
CORS(app)

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
        print(f"DEBUG: No email address for {receiver_name}. Skipping.")
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

        manager_comments = ticket_data.get('adminManagerComments', '')
        manager_status   = ticket_data.get('adminManagerStatus', '')
        manager_section  = ""

        # Show manager approval details only to non-Manager receivers (Vanjinathan, Annie, Jesline)
        if receiver_name != "Manager" and (manager_status or manager_comments):
            display_status = manager_status if manager_status else "Approved"
            manager_section = f"""
            <h3 style="color:#2563eb;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Manager Approval</h3>
            <table border="1" cellpadding="8" cellspacing="0"
                   style="border-collapse:collapse;width:100%;max-width:600px;margin-bottom:24px;font-size:14px;">
              <tr style="background:#f8fafc;">
                <td style="width:35%;"><strong>Status</strong></td>
                <td>{display_status}</td>
              </tr>
              <tr>
                <td><strong>Comments</strong></td>
                <td style="white-space:pre-wrap;font-style:italic;">{manager_comments or "No comments provided."}</td>
              </tr>
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
                <td><strong>Material Description</strong></td>
                <td style="white-space:pre-wrap;">{admin_desc}</td>
              </tr>
            </table>

            {manager_section}

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

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, to_email, msg.as_string())
        server.quit()

    except Exception as e:
        print(f"ERROR: Failed to send email to {to_email}: {e}")


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

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_SENDER, recipient_email, msg.as_string())
        server.quit()

    except Exception as e:
        print(f"ERROR: Failed to send notification to {recipient_email}: {e}")


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    try:
        support_type_arg = request.args.get("support_type")
        support_types = None
        if support_type_arg:
            support_types = [s.strip() for s in support_type_arg.split(',') if s.strip()]
        return jsonify(get_all_tickets(support_types)), 200
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
        receiver_position = data.get("receiver_position", "").strip() or None

        if not name or not email or not password:
            return jsonify({"error": "Name, email and password are required."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long."}), 400
        result = create_admin_user(name, email, password, access, support_type, can_receive_mail, receiver_position)
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
        receiver_position = data.get("receiver_position", "").strip() or None

        if not name or not email:
            return jsonify({"error": "Name and email are required."}), 400
        if password and len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long."}), 400
        
        updated = update_admin_user(user_id, name, email, password, access, support_type, can_receive_mail, receiver_position)
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
        if not name or not support_type:
            return jsonify({"error": "Category name and support type are required."}), 400
        result = create_category(name, support_type)
        if result.get("success"):
            logging.info(f"Admin Action: Created category - Name: {name}, Support: {support_type}")
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
        if not name or not support_type:
            return jsonify({"error": "Category name and support type are required."}), 400
        
        updated = update_category(category_id, name, support_type)
        if updated:
            logging.info(f"Admin Action: Edited category {category_id} - Name: {name}, Support: {support_type}")
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
                
        if not updates:
            return jsonify({"error": "No fields to update"}), 400
            
        result = update_ticket_details(ticket_id, updates)
        if result['success']:
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
        return jsonify([_row_to_ticket(r) for r in rows]), 200
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
            "Cotton Concepts HO, Coimbatore": ("CCCD", "HO"),
            "Doctor Towels HO":               ("DST", "HO"),
            "Cotton Concepts, Vengamedu":     ("VMCC", ""),
            "Cotton Concepts, Karur":         ("KRFCC", ""),
            "Doctor Towels, Karur":           ("KRDST", ""),
        }
        
        branch_name = data.get("branch", "")
        prefix, suffix = BRANCH_MAP.get(branch_name, ("TKT", "")) # Default to TKT if unknown
        
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
        import datetime
        now = datetime.datetime.now()

        # Persist admin description + attachment + approval request time
        ticket_updates = {
            'approval_request_time': now
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
        sent_to = []
        for receiver_name in ordered:
            to_email = RECEIVER_EMAIL_MAP.get(receiver_name, "")
            # Role determined by DB receiver_position
            db_pos = RECEIVER_POSITION_MAP.get(receiver_name, "Management")
            role = "Admin-Manager" if db_pos == "Manager" else "Management"
            send_approval_email(ticket_data, to_email=to_email, receiver_name=receiver_name, role=role)
            
            # Log exact timestamp of mail sent into PostgreSQL natively
            update_ticket_mail_time(ticket_id, role)
            
            sent_to.append(receiver_name)

        # Determine which status columns to update based on selected receivers' positions
        update_admin_mgr = any(RECEIVER_POSITION_MAP.get(r) == "Manager" for r in ordered)
        update_mgmt = any(RECEIVER_POSITION_MAP.get(r) == "Management" for r in ordered)

        # Mark approval statuses as Pending
        if update_admin_mgr:
            update_approval_status(ticket_id, "Admin-Manager", "Pending")
            update_ticket_details(ticket_id, {"admin_manager_has_mail": True})

        if update_mgmt:
            update_approval_status(ticket_id, "Management", "Pending")

        msg = f"Approval request sent to: {', '.join(sent_to)}."
        return jsonify({"message": msg}), 200
    except Exception as e:
        print(f"ERROR in initiate_approval_flow: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/approval/action/<ticket_id>/<role>', methods=['GET'])
def approval_action_page(ticket_id, role):
    try:
        from flask import request
        receiver_name = request.args.get('name', 'Unknown')
        ticket = get_ticket_by_id(ticket_id)
        if not ticket:
            return "Ticket not found", 404

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
                    <span class="value">{ticket.get('adminDescription', '') or '—'}</span></div>
                <hr>
                {"".join([f'''
                <div class="field"><span class="label">Manager Status:</span>
                    <span class="value" style="font-weight:bold; color:{'#16a34a' if ticket.get('adminManagerStatus') == 'Approved' else '#dc2626'}">
                        {ticket.get('adminManagerStatus', 'Pending')}
                    </span>
                </div>
                <div class="field"><span class="label">Manager Comments:</span>
                    <span class="value" style="font-style:italic;">{ticket.get('adminManagerComments', '') or 'No comments provided.'}</span>
                </div>
                <hr>
                ''' if role == "Management" else ""])}

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
        action   = request.form.get('action')
        comments = request.form.get('comments', '').strip()
        receiver = request.form.get('receiver_name', 'Unknown')
        status   = "Approved" if action == "Approve" else "Rejected"
        
        # Prepend the name to the comments if the role is Management
        if role == "Management" and receiver != 'Unknown':
            if comments:
                comments = f"{receiver} [{status.upper()}]: {comments}"
            else:
                comments = f"{receiver} [{status.upper()}]: No comments provided."

        print(f"DEBUG: process_approval: ticket_id={ticket_id}, role={role}, status={status}")
        result = update_approval_status(ticket_id, role, status, comments)
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


@app.route('/api/tickets/<ticket_id>', methods=['DELETE'])
def delete_ticket_route(ticket_id):
    try:
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
        print(f"ERROR downloading attachment: {e}")
        return jsonify({"error": str(e)}), 500

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

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Run the Ticket Raise API Server")
    parser.add_argument('-e', '--env', choices=['local', 'prod'], default='local', help="Environment (local or prod)")
    args = parser.parse_args()
    os.environ['APP_ENV'] = args.env

    host = "122.165.253.167" if args.env == "prod" else "localhost"
    app.run(host=host, port=443)
