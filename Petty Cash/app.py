from flask import Flask, render_template, redirect, url_for, request, flash, jsonify, make_response, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, date, timedelta
from functools import wraps
from collections import defaultdict
from sqlalchemy import text, inspect as sa_inspect
import os
import csv
import io
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'petty-cash-mgmt-2024-xk9m2p'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///petty_cash.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'instance', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024   # 32 MB
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'warning'

CATEGORIES = [
    'Tea & Refreshments',
    'Food & Meals',
    'Bus Parcel',
    'Courier Charges',
    'Transport Charges',
    'Fuel / Vehicle',
    'Office Maintenance',
    'Stationery & Printing',
    'Welfare Expenses',
    'Miscellaneous',
]

# Sub-categories; keys must match CATEGORIES entries exactly
SUBCATEGORIES = {
    'Bus Parcel':         ['Pickup', 'Drop'],
    'Transport Charges':  ['Four Wheeler', 'Auto', 'Two Wheeler'],
    'Office Maintenance': ['Corporation', 'Other'],
    'Welfare Expenses':   ['Management', 'Buyers', 'Staffs'],
}

CATEGORY_ICONS = {
    'Tea & Refreshments':   'fa-mug-hot',
    'Food & Meals':         'fa-utensils',
    'Bus Parcel':           'fa-bus',
    'Courier Charges':      'fa-box-open',
    'Transport Charges':    'fa-car',
    'Fuel / Vehicle':       'fa-gas-pump',
    'Office Maintenance':   'fa-tools',
    'Stationery & Printing':'fa-print',
    'Welfare Expenses':     'fa-hand-holding-heart',
    'Miscellaneous':        'fa-box',
}

# Old → new name mapping for DB migration
_CATEGORY_RENAMES = {
    'Bus / Parcel Charges': 'Bus Parcel',
    'Travel & Conveyance':  'Transport Charges',
    'Maintenance':          'Office Maintenance',
    'Donations & Welfare':  'Welfare Expenses',
}


# ── Models ──────────────────────────────────────────────────────────────────

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='staff')   # admin | manager | staff
    department = db.Column(db.String(100), default='')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)

    @property
    def is_admin(self):
        return self.role == 'admin'

    @property
    def is_manager(self):
        return self.role in ('admin', 'manager')

    @property
    def initials(self):
        parts = self.full_name.split()
        return (parts[0][0] + parts[-1][0]).upper() if len(parts) > 1 else parts[0][:2].upper()


class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, default=date.today)
    category = db.Column(db.String(100), nullable=False)
    subcategory = db.Column(db.String(100), default='')
    sub_remarks = db.Column(db.String(500), default='')
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(500), nullable=False)
    submitted_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')   # pending | approved | rejected
    approved_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    manager_notes = db.Column(db.String(500), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    submitter = db.relationship('User', foreign_keys=[submitted_by_id])
    approver = db.relationship('User', foreign_keys=[approved_by_id])


class DayLedger(db.Model):
    __tablename__ = 'day_ledger'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, unique=True, nullable=False)
    opening_balance = db.Column(db.Float, default=0.0)
    added_cash = db.Column(db.Float, default=0.0)
    total_expenses = db.Column(db.Float, default=0.0)
    closing_balance = db.Column(db.Float, default=0.0)
    notes = db.Column(db.String(500), default='')
    is_closed = db.Column(db.Boolean, default=False)
    closed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    closed_at = db.Column(db.DateTime, nullable=True)

    closed_by = db.relationship('User', foreign_keys=[closed_by_id])


# ── Auth helpers ─────────────────────────────────────────────────────────────

@login_manager.user_loader
def load_user(uid):
    return User.query.get(int(uid))


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_admin:
            flash('Admin access required.', 'danger')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated


def manager_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_manager:
            flash('Manager access required.', 'danger')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return redirect(url_for('dashboard') if current_user.is_authenticated else url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form.get('username', '').strip().lower()
        password = request.form.get('password', '')
        remember = request.form.get('remember') == 'on'
        user = User.query.filter_by(username=username).first()
        if user and user.is_active and user.check_password(password):
            user.last_login = datetime.utcnow()
            db.session.commit()
            login_user(user, remember=remember)
            flash(f'Welcome back, {user.full_name}!', 'success')
            return redirect(request.args.get('next') or url_for('dashboard'))
        flash('Invalid username or password.', 'danger')
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully.', 'info')
    return redirect(url_for('login'))


# ── Dashboard ────────────────────────────────────────────────────────────────

@app.route('/dashboard')
@login_required
def dashboard():
    today = date.today()
    month_start = today.replace(day=1)

    today_q = Expense.query.filter(Expense.date == today, Expense.status != 'rejected')
    today_expenses = today_q.all()
    today_total = sum(e.amount for e in today_expenses)
    today_count = len(today_expenses)

    month_exps = Expense.query.filter(
        Expense.date >= month_start, Expense.status == 'approved').all()
    month_total = sum(e.amount for e in month_exps)

    pending_count = Expense.query.filter_by(status='pending').count()

    last_ledger = DayLedger.query.filter(
        DayLedger.date <= today, DayLedger.is_closed == True
    ).order_by(DayLedger.date.desc()).first()
    opening = last_ledger.closing_balance if last_ledger else 0.0
    current_balance = opening - today_total

    cat_totals = defaultdict(float)
    for e in today_expenses:
        cat_totals[e.category] += e.amount

    week_data = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        exps = Expense.query.filter(Expense.date == d, Expense.status != 'rejected').all()
        week_data.append({'label': d.strftime('%d %b'), 'total': round(sum(e.amount for e in exps), 2)})

    if current_user.is_manager:
        recent = Expense.query.order_by(Expense.created_at.desc()).limit(10).all()
    else:
        recent = Expense.query.filter_by(submitted_by_id=current_user.id).order_by(
            Expense.created_at.desc()).limit(10).all()

    today_ledger = DayLedger.query.filter_by(date=today).first()

    return render_template('dashboard.html',
        today=today,
        today_total=today_total, today_count=today_count,
        month_total=month_total, pending_count=pending_count,
        current_balance=current_balance,
        cat_totals=dict(cat_totals), week_data=week_data,
        recent=recent, today_ledger=today_ledger,
        CATEGORY_ICONS=CATEGORY_ICONS)


# ── Add Expense ───────────────────────────────────────────────────────────────

@app.route('/expenses/add', methods=['GET', 'POST'])
@login_required
def add_expense():
    if request.method == 'POST':
        try:
            exp_date = datetime.strptime(request.form['date'], '%Y-%m-%d').date()
            category = request.form['category']
            amount = float(request.form['amount'])
            description = request.form.get('description', '').strip()
            subcategory = request.form.get('subcategory', '').strip()
            sub_remarks = request.form.get('sub_remarks', '').strip()

            errors = []
            if not description:
                errors.append('Description is required.')
            if amount <= 0:
                errors.append('Amount must be greater than zero.')
            if category not in CATEGORIES:
                errors.append('Invalid category selected.')
            if category in SUBCATEGORIES and not subcategory:
                errors.append(f'Please select a sub-category for {category}.')
            if category == 'Office Maintenance' and subcategory == 'Other' and not sub_remarks:
                errors.append('Please enter remarks for the Other sub-category.')

            if errors:
                for e in errors:
                    flash(e, 'danger')
                return render_template('add_expense.html', categories=CATEGORIES,
                                       subcategories=SUBCATEGORIES,
                                       today=date.today(), form=request.form)

            auto_approve = current_user.is_manager
            expense = Expense(
                date=exp_date, category=category, amount=round(amount, 2),
                description=description, submitted_by_id=current_user.id,
                subcategory=subcategory,
                sub_remarks=sub_remarks if subcategory == 'Other' else '',
                status='approved' if auto_approve else 'pending',
                approved_by_id=current_user.id if auto_approve else None,
                approved_at=datetime.utcnow() if auto_approve else None,
            )
            db.session.add(expense)
            db.session.commit()
            flash(f'Expense of ₹{amount:.2f} added successfully!', 'success')
            return redirect(url_for('expenses'))
        except (ValueError, KeyError):
            flash('Invalid input. Please check all fields.', 'danger')

    return render_template('add_expense.html', categories=CATEGORIES,
                           subcategories=SUBCATEGORIES,
                           today=date.today(), form={})


# ── Expense List ──────────────────────────────────────────────────────────────

@app.route('/expenses')
@login_required
def expenses():
    page = request.args.get('page', 1, type=int)
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    category = request.args.get('category', '')
    status_f = request.args.get('status', '')

    q = Expense.query
    if not current_user.is_manager:
        q = q.filter_by(submitted_by_id=current_user.id)
    if date_from:
        try:
            q = q.filter(Expense.date >= datetime.strptime(date_from, '%Y-%m-%d').date())
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(Expense.date <= datetime.strptime(date_to, '%Y-%m-%d').date())
        except ValueError:
            pass
    if category and category in CATEGORIES:
        q = q.filter_by(category=category)
    if status_f in ('pending', 'approved', 'rejected'):
        q = q.filter_by(status=status_f)

    paginated = q.order_by(Expense.date.desc(), Expense.created_at.desc()).paginate(
        page=page, per_page=20, error_out=False)

    return render_template('expenses.html', expenses=paginated, categories=CATEGORIES,
        filters={'date_from': date_from, 'date_to': date_to,
                 'category': category, 'status': status_f})


@app.route('/expenses/<int:eid>/approve', methods=['POST'])
@login_required
@manager_required
def approve_expense(eid):
    e = Expense.query.get_or_404(eid)
    e.status = 'approved'
    e.approved_by_id = current_user.id
    e.approved_at = datetime.utcnow()
    e.manager_notes = request.form.get('notes', '')
    db.session.commit()
    flash(f'Expense #{eid} approved.', 'success')
    return redirect(request.referrer or url_for('expenses'))


@app.route('/expenses/<int:eid>/reject', methods=['POST'])
@login_required
@manager_required
def reject_expense(eid):
    e = Expense.query.get_or_404(eid)
    e.status = 'rejected'
    e.approved_by_id = current_user.id
    e.approved_at = datetime.utcnow()
    e.manager_notes = request.form.get('notes', '')
    db.session.commit()
    flash(f'Expense #{eid} rejected.', 'warning')
    return redirect(request.referrer or url_for('expenses'))


@app.route('/expenses/<int:eid>/delete', methods=['POST'])
@login_required
@admin_required
def delete_expense(eid):
    e = Expense.query.get_or_404(eid)
    db.session.delete(e)
    db.session.commit()
    flash(f'Expense #{eid} deleted.', 'info')
    return redirect(request.referrer or url_for('expenses'))


# ── Reports ───────────────────────────────────────────────────────────────────

@app.route('/reports')
@login_required
def reports():
    today = date.today()
    month_start = today.replace(day=1)
    date_from = request.args.get('date_from', month_start.strftime('%Y-%m-%d'))
    date_to = request.args.get('date_to', today.strftime('%Y-%m-%d'))

    try:
        df = datetime.strptime(date_from, '%Y-%m-%d').date()
        dt = datetime.strptime(date_to, '%Y-%m-%d').date()
    except ValueError:
        df, dt = month_start, today

    q = Expense.query.filter(Expense.date >= df, Expense.date <= dt, Expense.status == 'approved')
    if not current_user.is_manager:
        q = q.filter_by(submitted_by_id=current_user.id)
    exps = q.order_by(Expense.date.asc()).all()

    cat_totals = defaultdict(float)
    day_totals = defaultdict(float)
    user_totals = {}
    for e in exps:
        cat_totals[e.category] += e.amount
        day_totals[e.date.strftime('%d %b')] += e.amount
        uid = e.submitted_by_id
        if uid not in user_totals:
            user_totals[uid] = {'name': e.submitter.full_name, 'total': 0.0, 'count': 0}
        user_totals[uid]['total'] += e.amount
        user_totals[uid]['count'] += 1

    grand_total = sum(e.amount for e in exps)
    return render_template('reports.html',
        date_from=date_from, date_to=date_to, expenses=exps,
        cat_totals=dict(cat_totals),
        day_totals=dict(sorted(day_totals.items())),
        user_totals=user_totals, grand_total=grand_total,
        categories=CATEGORIES, CATEGORY_ICONS=CATEGORY_ICONS)


@app.route('/reports/export')
@login_required
def export_expenses():
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')

    q = Expense.query.filter(Expense.status == 'approved')
    if not current_user.is_manager:
        q = q.filter_by(submitted_by_id=current_user.id)
    if date_from:
        try:
            q = q.filter(Expense.date >= datetime.strptime(date_from, '%Y-%m-%d').date())
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(Expense.date <= datetime.strptime(date_to, '%Y-%m-%d').date())
        except ValueError:
            pass

    exps = q.order_by(Expense.date.asc()).all()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['#', 'Date', 'Category', 'Amount (INR)', 'Description',
                'Submitted By', 'Approved By', 'Approved At'])
    for i, e in enumerate(exps, 1):
        w.writerow([
            i, e.date.strftime('%d-%m-%Y'), e.category,
            f'{e.amount:.2f}', e.description,
            e.submitter.full_name,
            e.approver.full_name if e.approver else '',
            e.approved_at.strftime('%d-%m-%Y %H:%M') if e.approved_at else ''
        ])
    w.writerow([])
    w.writerow(['', '', 'TOTAL', f'{sum(e.amount for e in exps):.2f}', '', '', '', ''])

    out.seek(0)
    resp = make_response(out.getvalue())
    fname = f'petty_cash_{date_from or "all"}_{date_to or "all"}.csv'
    resp.headers['Content-Type'] = 'text/csv'
    resp.headers['Content-Disposition'] = f'attachment; filename={fname}'
    return resp


# ── End of Day ───────────────────────────────────────────────────────────────

@app.route('/eod')
@login_required
def eod():
    today = date.today()
    today_ledger = DayLedger.query.filter_by(date=today).first()

    last_ledger = DayLedger.query.filter(
        DayLedger.date < today, DayLedger.is_closed == True
    ).order_by(DayLedger.date.desc()).first()
    opening = last_ledger.closing_balance if last_ledger else 0.0

    approved_exps = Expense.query.filter(
        Expense.date == today, Expense.status == 'approved').all()
    pending_exps = Expense.query.filter(
        Expense.date == today, Expense.status == 'pending').all()
    total_expenses = sum(e.amount for e in approved_exps)

    cat_breakdown = defaultdict(float)
    for e in approved_exps:
        cat_breakdown[e.category] += e.amount

    added_cash = today_ledger.added_cash if today_ledger else 0.0
    closing_balance = opening + added_cash - total_expenses

    past_ledgers = DayLedger.query.filter(
        DayLedger.is_closed == True
    ).order_by(DayLedger.date.desc()).limit(7).all()

    return render_template('eod.html',
        today=today, today_ledger=today_ledger,
        opening=opening, added_cash=added_cash,
        total_expenses=total_expenses, closing_balance=closing_balance,
        cat_breakdown=dict(cat_breakdown),
        approved_exps=approved_exps, pending_exps=pending_exps,
        past_ledgers=past_ledgers, CATEGORY_ICONS=CATEGORY_ICONS)


@app.route('/eod/close', methods=['POST'])
@login_required
@manager_required
def close_day():
    today = date.today()
    try:
        added_cash = float(request.form.get('added_cash', 0) or 0)
    except ValueError:
        added_cash = 0.0
    notes = request.form.get('notes', '')

    last_ledger = DayLedger.query.filter(
        DayLedger.date < today, DayLedger.is_closed == True
    ).order_by(DayLedger.date.desc()).first()
    opening = last_ledger.closing_balance if last_ledger else 0.0

    approved_exps = Expense.query.filter(
        Expense.date == today, Expense.status == 'approved').all()
    total_expenses = sum(e.amount for e in approved_exps)
    closing_balance = opening + added_cash - total_expenses

    ledger = DayLedger.query.filter_by(date=today).first()
    if not ledger:
        ledger = DayLedger(date=today)
        db.session.add(ledger)

    ledger.opening_balance = opening
    ledger.added_cash = added_cash
    ledger.total_expenses = total_expenses
    ledger.closing_balance = closing_balance
    ledger.notes = notes
    ledger.is_closed = True
    ledger.closed_by_id = current_user.id
    ledger.closed_at = datetime.utcnow()
    db.session.commit()
    flash(f'Day closed. Closing balance: ₹{closing_balance:.2f}', 'success')
    return redirect(url_for('eod'))


# ── Admin ─────────────────────────────────────────────────────────────────────

@app.route('/admin/users')
@login_required
@admin_required
def admin_users():
    users = User.query.order_by(User.role, User.full_name).all()
    return render_template('admin_users.html', users=users)


@app.route('/admin/users/add', methods=['POST'])
@login_required
@admin_required
def admin_add_user():
    username = request.form.get('username', '').strip().lower()
    full_name = request.form.get('full_name', '').strip()
    password = request.form.get('password', '')
    role = request.form.get('role', 'staff')
    department = request.form.get('department', '').strip()

    if not username or not full_name or not password:
        flash('All fields are required.', 'danger')
        return redirect(url_for('admin_users'))
    if User.query.filter_by(username=username).first():
        flash(f'Username "{username}" already exists.', 'danger')
        return redirect(url_for('admin_users'))
    if role not in ('admin', 'manager', 'staff'):
        flash('Invalid role.', 'danger')
        return redirect(url_for('admin_users'))

    u = User(username=username, full_name=full_name, role=role, department=department)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    flash(f'User "{full_name}" created successfully.', 'success')
    return redirect(url_for('admin_users'))


@app.route('/admin/users/<int:uid>/toggle', methods=['POST'])
@login_required
@admin_required
def admin_toggle_user(uid):
    u = User.query.get_or_404(uid)
    if u.id == current_user.id:
        flash("You cannot deactivate your own account.", 'warning')
        return redirect(url_for('admin_users'))
    u.is_active = not u.is_active
    db.session.commit()
    flash(f'User "{u.full_name}" {"activated" if u.is_active else "deactivated"}.', 'info')
    return redirect(url_for('admin_users'))


@app.route('/admin/users/<int:uid>/reset', methods=['POST'])
@login_required
@admin_required
def admin_reset_pw(uid):
    u = User.query.get_or_404(uid)
    pw = request.form.get('new_password', '')
    if len(pw) < 4:
        flash('Password must be at least 4 characters.', 'danger')
        return redirect(url_for('admin_users'))
    u.set_password(pw)
    db.session.commit()
    flash(f'Password reset for "{u.full_name}".', 'success')
    return redirect(url_for('admin_users'))


# ── Search ───────────────────────────────────────────────────────────────────

@app.route('/search')
@login_required
def search():
    q = request.args.get('q', '').strip()
    date_from  = request.args.get('date_from', '')
    date_to    = request.args.get('date_to', '')
    cat_filter = request.args.get('category', '')
    sub_filter = request.args.get('subcategory', '')

    results = []
    total_amount = 0.0

    if q or date_from or date_to or cat_filter or sub_filter:
        query = Expense.query
        if not current_user.is_manager:
            query = query.filter_by(submitted_by_id=current_user.id)

        if q:
            query = query.filter(Expense.description.ilike(f'%{q}%'))

        if date_from:
            try:
                query = query.filter(Expense.date >= datetime.strptime(date_from, '%Y-%m-%d').date())
            except ValueError:
                pass
        if date_to:
            try:
                query = query.filter(Expense.date <= datetime.strptime(date_to, '%Y-%m-%d').date())
            except ValueError:
                pass
        if cat_filter and cat_filter in CATEGORIES:
            query = query.filter_by(category=cat_filter)
        if sub_filter:
            query = query.filter_by(subcategory=sub_filter)

        results = query.order_by(Expense.date.desc()).all()

        # Also search by category name if q looks like a category keyword
        if q and not cat_filter and not sub_filter:
            cat_matches = Expense.query
            if not current_user.is_manager:
                cat_matches = cat_matches.filter_by(submitted_by_id=current_user.id)
            cat_matches = cat_matches.filter(Expense.category.ilike(f'%{q}%')).all()
            seen_ids = {e.id for e in results}
            for e in cat_matches:
                if e.id not in seen_ids:
                    results.append(e)

            # Try numeric amount search
            try:
                amt = float(q)
                amt_matches = Expense.query
                if not current_user.is_manager:
                    amt_matches = amt_matches.filter_by(submitted_by_id=current_user.id)
                amt_matches = amt_matches.filter(Expense.amount == amt).all()
                seen_ids2 = {e.id for e in results}
                for e in amt_matches:
                    if e.id not in seen_ids2:
                        results.append(e)
            except ValueError:
                pass

            results.sort(key=lambda e: e.date, reverse=True)

        total_amount = sum(e.amount for e in results if e.status != 'rejected')

    return render_template('search.html',
        q=q, results=results, total_amount=total_amount,
        date_from=date_from, date_to=date_to,
        cat_filter=cat_filter, sub_filter=sub_filter,
        categories=CATEGORIES, CATEGORY_ICONS=CATEGORY_ICONS)


# ── Import Excel UI ───────────────────────────────────────────────────────────

def _map_excel_category(ledger, main, particular):
    l = str(ledger).strip().lower()
    m = str(main).strip().lower()
    p = str(particular).strip().lower()
    if 'courier' in l or 'unloading' in l:
        return 'Courier Charges'
    if 'bus parcel' in l or 'transport charges' in l:
        return 'Bus Parcel'
    if 'travel claim' in l or 'travel claim' in m or 'auto charges' in l or 'cab charges' in l or 'travelling' in m:
        return 'Transport Charges'
    if 'fuel' in l or 'own vehicle' in m or 'office bike' in m:
        return 'Fuel / Vehicle'
    if l in ('maintanance', 'garden maintanance', 'corporation cleaning',
             'creative room', 'stitching charges', 'auto charges', 'printout'):
        return 'Office Maintenance'
    if 'office maintanance' in m and 'stationery' not in l and 'printout' not in l and 'visiting card' not in l:
        return 'Office Maintenance'
    if 'stationery' in l or 'printout' in l or 'visiting card' in l:
        return 'Stationery & Printing'
    if 'donation' in m or 'missionaries' in p or 'charity' in p:
        return 'Welfare Expenses'
    if l == 'welfare expenses' and 'donation' in m:
        return 'Welfare Expenses'
    if 'pantry' in l:
        return 'Tea & Refreshments'
    if any(kw in p for kw in ['tea', 'coconut', 'water can', 'drinking water', 'milk', 'coffee', 'biscuit']):
        return 'Tea & Refreshments'
    if 'welfare' in l or 'pooja' in l or 'birthday' in l or 'buyer snacks' in l or 'buyer visit' in l:
        return 'Food & Meals'
    if 'welfare' in m:
        return 'Food & Meals'
    return 'Miscellaneous'


def _parse_excel_file(filepath):
    """Parse uploaded Excel file. Returns (rows, errors, sheet_summaries)."""
    import pandas as pd

    rows = []
    errors = []
    sheet_summaries = []

    try:
        xl = pd.ExcelFile(filepath)
    except Exception as e:
        return [], [f'Cannot read file: {e}'], []

    for sheet in xl.sheet_names:
        try:
            df = pd.read_excel(xl, sheet_name=sheet, header=None)
            if df.shape[1] < 5:
                errors.append(f'Sheet "{sheet}": too few columns, skipped.')
                continue

            # Detect header row (contains DATE / Particular / Debit keywords)
            header_row = 0
            for i in range(min(5, len(df))):
                row_vals = [str(v).strip().lower() for v in df.iloc[i]]
                if any(k in row_vals for k in ('date', 'particular', 'debit')):
                    header_row = i
                    break

            # Set column names
            df.columns = range(df.shape[1])
            # Map by position: col0=sno, col1=date, col2=particular, col3=credit, col4=debit
            # col5=ledger, col6=main, col7=category (if present)
            col_date    = 1
            col_part    = 2
            col_credit  = 3
            col_debit   = 4
            col_ledger  = 5 if df.shape[1] > 5 else None
            col_main    = 6 if df.shape[1] > 6 else None

            sheet_count = 0
            sheet_total = 0.0

            for idx, row in df.iloc[header_row + 1:].iterrows():
                particular = str(row.get(col_part, '')).strip()
                if not particular or particular in ('nan', 'Opening Balance', 'cash withdraw', ''):
                    continue

                # Skip summary/total rows
                if any(kw in particular.lower() for kw in ('closing balance', 'month closing', 'total')):
                    continue

                try:
                    debit = row.get(col_debit)
                    if debit is None or str(debit).strip() in ('', 'nan') or float(debit) <= 0:
                        continue
                    amount = round(float(debit), 2)
                except (ValueError, TypeError):
                    continue

                # Parse date
                raw_date = row.get(col_date)
                exp_date = None
                if not (raw_date is None or str(raw_date).strip() in ('', 'nan')):
                    try:
                        if isinstance(raw_date, (datetime,)):
                            exp_date = raw_date.date()
                        else:
                            import pandas as pd
                            exp_date = pd.to_datetime(raw_date).date()
                    except Exception:
                        pass

                if exp_date is None:
                    errors.append(f'Sheet "{sheet}" row {idx}: no valid date, skipped.')
                    continue

                ledger = str(row.get(col_ledger, '') if col_ledger is not None else '').strip()
                main   = str(row.get(col_main, '') if col_main is not None else '').strip()
                description = particular.replace('\n', ' | ').replace('\r', '')[:500]
                category = _map_excel_category(ledger, main, description)

                rows.append({
                    'date': exp_date.strftime('%Y-%m-%d'),
                    'category': category,
                    'amount': amount,
                    'description': description,
                    'sheet': sheet,
                })
                sheet_count += 1
                sheet_total += amount

            sheet_summaries.append({
                'name': sheet,
                'count': sheet_count,
                'total': sheet_total,
            })

        except Exception as e:
            errors.append(f'Sheet "{sheet}": error — {e}')

    return rows, errors, sheet_summaries


@app.route('/import-excel', methods=['GET', 'POST'])
@login_required
@manager_required
def import_excel_ui():
    if request.method == 'GET':
        return render_template('import_excel.html', categories=CATEGORIES)

    # ── Step 1: File uploaded — parse and show preview ────────────────────────
    if 'preview' in request.form or 'file' in request.files:
        f = request.files.get('file')
        if not f or f.filename == '':
            flash('Please select an Excel file.', 'danger')
            return redirect(url_for('import_excel_ui'))

        ext = f.filename.rsplit('.', 1)[-1].lower()
        if ext not in ('xlsx', 'xls'):
            flash('Only .xlsx and .xls files are supported.', 'danger')
            return redirect(url_for('import_excel_ui'))

        # Save temp file
        tmp_name = f'import_{uuid.uuid4().hex}.{ext}'
        tmp_path = os.path.join(app.config['UPLOAD_FOLDER'], tmp_name)
        f.save(tmp_path)
        session['import_tmp'] = tmp_path

        rows, errors, sheet_summaries = _parse_excel_file(tmp_path)

        # Category breakdown for preview
        cat_preview = defaultdict(lambda: {'count': 0, 'total': 0.0})
        for r in rows:
            cat_preview[r['category']]['count'] += 1
            cat_preview[r['category']]['total'] += r['amount']

        return render_template('import_excel.html',
            categories=CATEGORIES, CATEGORY_ICONS=CATEGORY_ICONS,
            preview_rows=rows[:50],  # show first 50 in preview table
            all_rows_count=len(rows),
            sheet_summaries=sheet_summaries,
            cat_preview=dict(cat_preview),
            grand_total=sum(r['amount'] for r in rows),
            parse_errors=errors,
            tmp_name=tmp_name)

    # ── Step 2: Confirm import ────────────────────────────────────────────────
    if 'confirm_import' in request.form:
        tmp_name = request.form.get('tmp_name', '')
        tmp_path = os.path.join(app.config['UPLOAD_FOLDER'], tmp_name)
        mode = request.form.get('import_mode', 'append')   # append | replace

        if not os.path.exists(tmp_path):
            flash('Upload session expired. Please re-upload the file.', 'danger')
            return redirect(url_for('import_excel_ui'))

        rows, errors, _ = _parse_excel_file(tmp_path)

        if not rows:
            flash('No valid rows found to import.', 'warning')
            return redirect(url_for('import_excel_ui'))

        admin = User.query.filter_by(username='admin').first() or current_user

        if mode == 'replace':
            deleted = Expense.query.delete()
            db.session.commit()
        else:
            deleted = 0

        imported = 0
        for r in rows:
            try:
                exp_date = datetime.strptime(r['date'], '%Y-%m-%d').date()
                expense = Expense(
                    date=exp_date,
                    category=r['category'],
                    amount=r['amount'],
                    description=r['description'],
                    submitted_by_id=admin.id,
                    status='approved',
                    approved_by_id=current_user.id,
                    approved_at=datetime.utcnow(),
                    manager_notes='Imported from Excel',
                    created_at=datetime.utcnow(),
                )
                db.session.add(expense)
                imported += 1
            except Exception:
                pass

        db.session.commit()

        # Clean up temp file
        try:
            os.remove(tmp_path)
        except Exception:
            pass

        flash(f'Successfully imported {imported} expense records'
              + (f' (replaced {deleted} existing records)' if mode == 'replace' else ' (appended).')
              , 'success')
        return redirect(url_for('reports'))

    return redirect(url_for('import_excel_ui'))


# ── Template context ──────────────────────────────────────────────────────────

@app.context_processor
def inject_globals():
    pending = 0
    total_exp_count = 0
    if current_user.is_authenticated:
        if current_user.is_manager:
            pending = Expense.query.filter_by(status='pending').count()
            total_exp_count = Expense.query.count()
        else:
            total_exp_count = Expense.query.filter_by(submitted_by_id=current_user.id).count()
    return dict(
        pending_badge=pending,
        CATEGORIES=CATEGORIES,
        SUBCATEGORIES=SUBCATEGORIES,
        CATEGORY_ICONS=CATEGORY_ICONS,
        today=date.today(),
        total_exp_count=total_exp_count,
    )


# ── DB Init ───────────────────────────────────────────────────────────────────

def init_db():
    with app.app_context():
        db.create_all()

        # Add new columns if they don't exist (SQLite migration)
        inspector = sa_inspect(db.engine)
        existing_cols = [c['name'] for c in inspector.get_columns('expenses')]
        with db.engine.connect() as conn:
            if 'subcategory' not in existing_cols:
                conn.execute(text("ALTER TABLE expenses ADD COLUMN subcategory VARCHAR(100) DEFAULT ''"))
                conn.commit()
            if 'sub_remarks' not in existing_cols:
                conn.execute(text("ALTER TABLE expenses ADD COLUMN sub_remarks VARCHAR(500) DEFAULT ''"))
                conn.commit()

        # Rename old category values to new names
        with db.engine.connect() as conn:
            for old_name, new_name in _CATEGORY_RENAMES.items():
                conn.execute(
                    text("UPDATE expenses SET category = :new WHERE category = :old"),
                    {'new': new_name, 'old': old_name}
                )
            conn.commit()

        if not User.query.first():
            defaults = [
                ('admin', 'System Administrator', 'admin', 'Administration', 'admin123'),
                ('manager', 'Accounts Manager', 'manager', 'Accounts', 'manager123'),
                ('cashier', 'Petty Cashier', 'staff', 'Operations', 'cash123'),
            ]
            for username, full_name, role, dept, pw in defaults:
                u = User(username=username, full_name=full_name,
                         role=role, department=dept)
                u.set_password(pw)
                db.session.add(u)
            db.session.commit()
            print("\n[OK] Default accounts created:")
            print("  admin / admin123  (Administrator)")
            print("  manager / manager123  (Manager)")
            print("  cashier / cash123  (Staff)\n")


if __name__ == '__main__':
    init_db()
    print("[OK] Petty Cash Manager running at http://127.0.0.1:5000")
    app.run(debug=False, host='127.0.0.1', port=5000)
