from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from . import db

ROLES = ['superadmin', 'admin', 'manager', 'staff']
COMPANIES = ['CCCD', 'DST', 'Both']


class Branch(db.Model):
    __tablename__ = 'branches'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    location = db.Column(db.String(100))
    company = db.Column(db.String(10), default='CCCD')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    users = db.relationship('User', backref='branch', lazy='dynamic')
    couriers = db.relationship('Courier', backref='branch', lazy='dynamic')
    expenses = db.relationship('Expense', backref='branch', lazy='dynamic')

    def __repr__(self):
        return f'<Branch {self.code}>'


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='staff')
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Granular permissions (superadmin/admin always override to True)
    perm_view_cost    = db.Column(db.Boolean, default=False)
    perm_view_reports = db.Column(db.Boolean, default=True)
    perm_view_entries = db.Column(db.Boolean, default=True)
    perm_add          = db.Column(db.Boolean, default=True)
    perm_edit         = db.Column(db.Boolean, default=False)
    perm_delete       = db.Column(db.Boolean, default=False)

    couriers_created = db.relationship('Courier', backref='created_by_user', lazy='dynamic')
    expenses_created = db.relationship('Expense', backref='created_by_user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    # ── role helpers (unchanged contract) ────────────────────────────────────
    def is_superadmin(self):
        return self.role == 'superadmin'

    def can_manage_users(self):
        return self.role in ('superadmin', 'admin')

    def can_manage_branches(self):
        return self.role == 'superadmin'

    def can_manage_lookups(self):
        return self.role in ('superadmin', 'admin')

    def can_access_expenses(self):
        return self.role in ('superadmin', 'admin')

    # ── granular permission helpers ───────────────────────────────────────────
    def _is_admin_plus(self):
        return self.role in ('superadmin', 'admin')

    def has_perm_view_cost(self):
        return self._is_admin_plus() or bool(self.perm_view_cost)

    def has_perm_view_reports(self):
        return self._is_admin_plus() or self.role == 'manager' or bool(self.perm_view_reports)

    def has_perm_view_entries(self):
        return self._is_admin_plus() or bool(self.perm_view_entries)

    def has_perm_add(self):
        return self._is_admin_plus() or bool(self.perm_add)

    def has_perm_edit(self):
        return self._is_admin_plus() or bool(self.perm_edit)

    def has_perm_delete(self):
        return self._is_admin_plus() or bool(self.perm_delete)

    def __repr__(self):
        return f'<User {self.username}>'


class LookupItem(db.Model):
    """Admin-managed lists: departments, supplier/buyer types, package types."""
    __tablename__ = 'lookup_items'
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False)   # 'department' | 'supplier_type' | 'package_type'
    value = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('category', 'value', name='uq_lookup_cat_val'),
    )

    def __repr__(self):
        return f'<LookupItem {self.category}:{self.value}>'


class Courier(db.Model):
    __tablename__ = 'couriers'
    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    creator_email = db.Column(db.String(150))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    date = db.Column(db.Date, nullable=False)
    transaction_type = db.Column(db.String(20), default='Dispatch')
    sender = db.Column(db.String(100))
    department = db.Column(db.String(50))
    purpose = db.Column(db.String(100))
    sending_from = db.Column(db.String(100))
    receiver = db.Column(db.String(100))
    receiver_office = db.Column(db.String(100))
    supplier_buyer_type = db.Column(db.String(50))
    supplier_buyer_name = db.Column(db.String(150))
    destination = db.Column(db.String(100))
    product_description = db.Column(db.String(200))
    package_type = db.Column(db.String(50))
    num_packages = db.Column(db.Integer, default=1)
    order_related = db.Column(db.String(5), default='NO')
    order_reference = db.Column(db.String(200))
    budgeted = db.Column(db.String(20), default='Non Budgeted')
    courier_name = db.Column(db.String(50))
    awb_no = db.Column(db.String(100))
    weight_kg = db.Column(db.Float)
    box_measurement = db.Column(db.String(100))
    chargeable_weight = db.Column(db.Float)
    courier_cost = db.Column(db.Float, default=0)
    payment_mode = db.Column(db.String(50))
    remarks = db.Column(db.Text)
    item = db.Column(db.String(100))
    ref_type = db.Column(db.String(50))

    def __repr__(self):
        return f'<Courier {self.awb_no}>'


class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(300), nullable=False)
    courier_name = db.Column(db.String(50))
    payment_mode = db.Column(db.String(50))
    amount = db.Column(db.Float, nullable=False)
    remarks = db.Column(db.Text)

    def __repr__(self):
        return f'<Expense {self.id} ₹{self.amount}>'
