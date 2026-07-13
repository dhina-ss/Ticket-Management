from datetime import date
from flask import render_template, redirect, url_for, flash, request, abort
from flask_login import login_required, current_user
from .. import db
from ..models import User, Branch, Expense, Courier, LookupItem, ROLES
from . import admin


def require_admin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.can_manage_users():
            abort(403)
        return f(*args, **kwargs)
    return decorated


def require_superadmin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_superadmin():
            abort(403)
        return f(*args, **kwargs)
    return decorated


def require_lookup_admin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.can_manage_lookups():
            abort(403)
        return f(*args, **kwargs)
    return decorated


# ─── LOOKUP MANAGEMENT ────────────────────────────────────────────────────────

LOOKUP_LABELS = {
    'department':      'Departments',
    'supplier_type':   'Supplier / Buyer Types',
    'package_type':    'Package Types',
    'courier_name':    'Courier Names',
    'budget_status':   'Budget Status',
    'payment_mode':    'Payment Modes',
    'transaction_type':'Transaction Types',
}


@admin.route('/lookups/<category>')
@login_required
@require_lookup_admin
def lookups(category):
    if category not in LOOKUP_LABELS:
        abort(404)
    items = LookupItem.query.filter_by(category=category).order_by(
        LookupItem.sort_order, LookupItem.value
    ).all()
    return render_template('admin/lookups.html',
        category=category,
        label=LOOKUP_LABELS[category],
        items=items,
        all_labels=LOOKUP_LABELS,
    )


@admin.route('/lookups/<category>/add', methods=['POST'])
@login_required
@require_lookup_admin
def add_lookup(category):
    if category not in LOOKUP_LABELS:
        abort(404)
    value = request.form.get('value', '').strip()
    if not value:
        flash('Value cannot be empty.', 'danger')
    elif LookupItem.query.filter_by(category=category, value=value).first():
        flash(f'"{value}" already exists.', 'warning')
    else:
        max_order = db.session.query(db.func.max(LookupItem.sort_order)).filter_by(
            category=category).scalar() or 0
        db.session.add(LookupItem(category=category, value=value, sort_order=max_order + 1))
        db.session.commit()
        flash(f'"{value}" added.', 'success')
    return redirect(url_for('admin.lookups', category=category))


@admin.route('/lookups/<category>/edit/<int:item_id>', methods=['POST'])
@login_required
@require_lookup_admin
def edit_lookup(category, item_id):
    item = LookupItem.query.get_or_404(item_id)
    value = request.form.get('value', '').strip()
    action = request.form.get('action', 'save')
    if action == 'toggle':
        item.is_active = not item.is_active
        db.session.commit()
        flash(f'"{item.value}" {"enabled" if item.is_active else "disabled"}.', 'success')
    elif value:
        item.value = value
        db.session.commit()
        flash('Updated.', 'success')
    return redirect(url_for('admin.lookups', category=category))


@admin.route('/lookups/<category>/delete/<int:item_id>', methods=['POST'])
@login_required
@require_lookup_admin
def delete_lookup(category, item_id):
    item = LookupItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    flash(f'"{item.value}" removed.', 'success')
    return redirect(url_for('admin.lookups', category=category))


# ─── BRANCH MANAGEMENT ────────────────────────────────────────────────────────

@admin.route('/branches')
@login_required
@require_superadmin
def branches():
    all_branches = Branch.query.order_by(Branch.name).all()
    return render_template('admin/branches.html', branches=all_branches)


@admin.route('/branches/add', methods=['GET', 'POST'])
@login_required
@require_superadmin
def add_branch():
    if request.method == 'POST':
        code = request.form.get('code', '').strip().upper()
        if Branch.query.filter_by(code=code).first():
            flash('Branch code already exists.', 'danger')
        else:
            b = Branch(
                name=request.form.get('name', '').strip(),
                code=code,
                location=request.form.get('location', '').strip(),
                company=request.form.get('company', 'CCCD'),
            )
            db.session.add(b)
            db.session.commit()
            flash(f'Branch "{b.name}" created.', 'success')
            return redirect(url_for('admin.branches'))
    return render_template('admin/branch_form.html', branch=None)


@admin.route('/branches/edit/<int:branch_id>', methods=['GET', 'POST'])
@login_required
@require_superadmin
def edit_branch(branch_id):
    b = Branch.query.get_or_404(branch_id)
    if request.method == 'POST':
        b.name = request.form.get('name', '').strip()
        b.location = request.form.get('location', '').strip()
        b.company = request.form.get('company', 'CCCD')
        b.is_active = 'is_active' in request.form
        db.session.commit()
        flash('Branch updated.', 'success')
        return redirect(url_for('admin.branches'))
    return render_template('admin/branch_form.html', branch=b)


# ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

@admin.route('/users')
@login_required
@require_admin
def users():
    if current_user.is_superadmin():
        all_users = User.query.order_by(User.name).all()
    else:
        all_users = User.query.filter_by(branch_id=current_user.branch_id).order_by(User.name).all()
    return render_template('admin/users.html', users=all_users)


def _apply_perms(u, form):
    u.perm_view_cost    = 'perm_view_cost'    in form
    u.perm_view_reports = 'perm_view_reports' in form
    u.perm_view_entries = 'perm_view_entries' in form
    u.perm_add          = 'perm_add'          in form
    u.perm_edit         = 'perm_edit'         in form
    u.perm_delete       = 'perm_delete'       in form


@admin.route('/users/add', methods=['GET', 'POST'])
@login_required
@require_admin
def add_user():
    branches = Branch.query.filter_by(is_active=True).all()
    if not current_user.is_superadmin():
        branches = [b for b in branches if b.id == current_user.branch_id]

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()

        if User.query.filter_by(username=username).first():
            flash('Username already taken.', 'danger')
        elif User.query.filter_by(email=email).first():
            flash('Email already registered.', 'danger')
        else:
            role = request.form.get('role', 'staff')
            if not current_user.is_superadmin() and role == 'superadmin':
                role = 'staff'
            branch_id = request.form.get('branch_id', type=int) or current_user.branch_id
            u = User(
                name=request.form.get('name', '').strip(),
                email=email,
                username=username,
                role=role,
                branch_id=branch_id,
            )
            u.set_password(request.form.get('password', 'Courier@123'))
            _apply_perms(u, request.form)
            db.session.add(u)
            db.session.commit()
            flash(f'User "{u.name}" created.', 'success')
            return redirect(url_for('admin.users'))

    return render_template('admin/user_form.html', user=None, branches=branches, roles=ROLES)


@admin.route('/users/edit/<int:user_id>', methods=['GET', 'POST'])
@login_required
@require_admin
def edit_user(user_id):
    u = User.query.get_or_404(user_id)
    if not current_user.is_superadmin() and u.branch_id != current_user.branch_id:
        abort(403)

    branches = Branch.query.filter_by(is_active=True).all()
    if not current_user.is_superadmin():
        branches = [b for b in branches if b.id == current_user.branch_id]

    if request.method == 'POST':
        u.name = request.form.get('name', '').strip()
        u.email = request.form.get('email', '').strip().lower()
        role = request.form.get('role', u.role)
        if not current_user.is_superadmin() and role == 'superadmin':
            role = u.role
        u.role = role
        u.branch_id = request.form.get('branch_id', type=int) or u.branch_id
        u.is_active = 'is_active' in request.form
        _apply_perms(u, request.form)

        new_pw = request.form.get('new_password', '').strip()
        if new_pw:
            if len(new_pw) < 6:
                flash('Password must be at least 6 characters.', 'danger')
                return render_template('admin/user_form.html', user=u, branches=branches, roles=ROLES)
            u.set_password(new_pw)

        db.session.commit()
        flash('User updated.', 'success')
        return redirect(url_for('admin.users'))

    return render_template('admin/user_form.html', user=u, branches=branches, roles=ROLES)


@admin.route('/users/delete/<int:user_id>', methods=['POST'])
@login_required
@require_superadmin
def delete_user(user_id):
    u = User.query.get_or_404(user_id)
    if u.id == current_user.id:
        flash('Cannot delete yourself.', 'danger')
    else:
        db.session.delete(u)
        db.session.commit()
        flash('User deleted.', 'success')
    return redirect(url_for('admin.users'))


# ─── EXPENSE MANAGEMENT ──────────────────────────────────────────────────────

@admin.route('/expenses')
@login_required
def expenses():
    if not current_user.can_access_expenses():
        abort(403)
    page = request.args.get('page', 1, type=int)
    q = Expense.query
    if not current_user.is_superadmin() and current_user.branch_id:
        q = q.filter_by(branch_id=current_user.branch_id)
    from_date = request.args.get('from_date', '')
    to_date = request.args.get('to_date', '')
    if from_date:
        q = q.filter(Expense.date >= from_date)
    if to_date:
        q = q.filter(Expense.date <= to_date)
    from sqlalchemy import func
    total_amount = q.with_entities(func.sum(Expense.amount)).scalar() or 0
    filter_args = {k: v for k, v in request.args.items() if k != 'page'}
    pagination = q.order_by(Expense.date.desc()).paginate(page=page, per_page=20, error_out=False)
    branches = Branch.query.filter_by(is_active=True).all() if current_user.is_superadmin() else []
    return render_template('admin/expenses.html',
        expenses=pagination.items,
        pagination=pagination,
        total_amount=total_amount,
        branches=branches,
        filter_args=filter_args,
    )


@admin.route('/expenses/add', methods=['GET', 'POST'])
@login_required
def add_expense():
    if not current_user.can_access_expenses():
        abort(403)
    branches = Branch.query.filter_by(is_active=True).all()
    if not current_user.is_superadmin():
        branches = [b for b in branches if b.id == current_user.branch_id]
    if request.method == 'POST':
        branch_id = request.form.get('branch_id', type=int) or current_user.branch_id
        try:
            e = Expense(
                branch_id=branch_id,
                created_by=current_user.id,
                date=date.fromisoformat(request.form['date']),
                description=request.form.get('description', '').strip(),
                courier_name=request.form.get('courier_name', '').strip(),
                payment_mode=request.form.get('payment_mode', '').strip(),
                amount=request.form.get('amount', 0, type=float),
                remarks=request.form.get('remarks', '').strip(),
            )
            db.session.add(e)
            db.session.commit()
            flash('Expense recorded.', 'success')
            return redirect(url_for('admin.expenses'))
        except Exception as ex:
            db.session.rollback()
            flash(f'Error: {str(ex)}', 'danger')
    return render_template('admin/expense_form.html',
        expense=None, branches=branches, today=date.today().isoformat())


@admin.route('/expenses/edit/<int:expense_id>', methods=['GET', 'POST'])
@login_required
def edit_expense(expense_id):
    if not current_user.can_access_expenses():
        abort(403)
    e = Expense.query.get_or_404(expense_id)
    branches = Branch.query.filter_by(is_active=True).all()
    if request.method == 'POST':
        e.date = date.fromisoformat(request.form['date'])
        e.description = request.form.get('description', '').strip()
        e.courier_name = request.form.get('courier_name', '').strip()
        e.payment_mode = request.form.get('payment_mode', '').strip()
        e.amount = request.form.get('amount', 0, type=float)
        e.remarks = request.form.get('remarks', '').strip()
        db.session.commit()
        flash('Expense updated.', 'success')
        return redirect(url_for('admin.expenses'))
    return render_template('admin/expense_form.html',
        expense=e, branches=branches, today=date.today().isoformat())


@admin.route('/expenses/delete/<int:expense_id>', methods=['POST'])
@login_required
def delete_expense(expense_id):
    if not current_user.can_access_expenses():
        abort(403)
    e = Expense.query.get_or_404(expense_id)
    db.session.delete(e)
    db.session.commit()
    flash('Expense deleted.', 'success')
    return redirect(url_for('admin.expenses'))
