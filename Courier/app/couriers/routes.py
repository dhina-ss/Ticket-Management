from datetime import date
from flask import render_template, redirect, url_for, flash, request, jsonify, abort
from flask_login import login_required, current_user
from .. import db
from ..models import Courier, Branch, LookupItem
from . import couriers

def _lookup(category):
    return [i.value for i in LookupItem.query.filter_by(
        category=category, is_active=True
    ).order_by(LookupItem.sort_order, LookupItem.value).all()]


def _form_lookups():
    return dict(
        departments=_lookup('department'),
        supplier_types=_lookup('supplier_type'),
        package_types=_lookup('package_type'),
        courier_names=_lookup('courier_name'),
        budget_statuses=_lookup('budget_status'),
        payment_modes=_lookup('payment_mode'),
        transaction_types=_lookup('transaction_type'),
    )


def _get_branch_choices():
    if current_user.is_superadmin():
        return Branch.query.filter_by(is_active=True).all()
    elif current_user.branch_id:
        return Branch.query.filter_by(id=current_user.branch_id, is_active=True).all()
    return []


@couriers.route('/')
@login_required
def list_couriers():
    page = request.args.get('page', 1, type=int)
    per_page = 20

    q = Courier.query
    if not current_user.is_superadmin() and current_user.branch_id:
        q = q.filter_by(branch_id=current_user.branch_id)

    # Filters
    search = request.args.get('search', '').strip()
    dept = request.args.get('dept', '')
    courier_name = request.args.get('courier_name', '')
    from_date = request.args.get('from_date', '')
    to_date = request.args.get('to_date', '')
    budgeted = request.args.get('budgeted', '')
    branch_id = request.args.get('branch_id', '', type=str)
    trans_type = request.args.get('trans_type', '')

    if search:
        q = q.filter(
            db.or_(
                Courier.sender.ilike(f'%{search}%'),
                Courier.receiver.ilike(f'%{search}%'),
                Courier.awb_no.ilike(f'%{search}%'),
                Courier.destination.ilike(f'%{search}%'),
                Courier.supplier_buyer_name.ilike(f'%{search}%'),
                Courier.order_reference.ilike(f'%{search}%'),
            )
        )
    if dept:
        q = q.filter(Courier.department == dept)
    if courier_name:
        q = q.filter(Courier.courier_name.ilike(f'%{courier_name}%'))
    if from_date:
        q = q.filter(Courier.date >= from_date)
    if to_date:
        q = q.filter(Courier.date <= to_date)
    if budgeted:
        q = q.filter(Courier.budgeted.ilike(f'%{budgeted}%'))
    if branch_id and current_user.is_superadmin():
        q = q.filter(Courier.branch_id == int(branch_id))
    if trans_type:
        q = q.filter(Courier.transaction_type == trans_type)

    pagination = q.order_by(Courier.date.desc(), Courier.id.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    branches = Branch.query.filter_by(is_active=True).all() if current_user.is_superadmin() else []
    filter_args = {k: v for k, v in request.args.items() if k != 'page'}

    return render_template('couriers/list.html',
        couriers=pagination.items,
        pagination=pagination,
        departments=_lookup('department'),
        courier_names=_lookup('courier_name'),
        transaction_types=_lookup('transaction_type'),
        branches=branches,
        filter_args=filter_args,
    )


@couriers.route('/add', methods=['GET', 'POST'])
@login_required
def add_courier():
    if current_user.role == 'staff' or current_user.role in ('staff', 'manager', 'admin', 'superadmin'):
        pass  # all roles can add

    branch_list = _get_branch_choices()

    if request.method == 'POST':
        branch_id = request.form.get('branch_id', type=int)
        if not branch_id:
            if current_user.branch_id:
                branch_id = current_user.branch_id
            elif branch_list:
                branch_id = branch_list[0].id

        try:
            c = Courier(
                branch_id=branch_id,
                created_by=current_user.id,
                date=date.fromisoformat(request.form['date']) if request.form.get('date') else date.today(),
                transaction_type=request.form.get('transaction_type', 'Dispatch'),
                sender=request.form.get('sender', '').strip(),
                department=request.form.get('department', '').strip(),
                sending_from=request.form.get('sending_from', '').strip(),
                receiver=request.form.get('receiver', '').strip(),
                receiver_office=request.form.get('receiver_office', '').strip(),
                supplier_buyer_type=request.form.get('supplier_buyer_type', '').strip(),
                supplier_buyer_name=request.form.get('supplier_buyer_name', '').strip(),
                destination=request.form.get('destination', '').strip(),
                product_description=request.form.get('product_description', '').strip(),
                package_type=request.form.get('package_type', '').strip(),
                num_packages=request.form.get('num_packages', 1, type=int),
                order_related=request.form.get('order_related', 'NO'),
                order_reference=request.form.get('order_reference', '').strip(),
                budgeted=request.form.get('budgeted', 'Non Budgeted'),
                courier_name=request.form.get('courier_name', '').strip(),
                awb_no=request.form.get('awb_no', '').strip(),
                weight_kg=request.form.get('weight_kg', None, type=float),
                box_measurement=request.form.get('box_measurement', '').strip(),
                chargeable_weight=request.form.get('chargeable_weight', None, type=float),
                courier_cost=request.form.get('courier_cost', 0, type=float),
                payment_mode=request.form.get('payment_mode', '').strip(),
                remarks=request.form.get('remarks', '').strip(),
            )
            db.session.add(c)
            db.session.commit()
            flash('Courier entry added successfully!', 'success')
            return redirect(url_for('couriers.list_couriers'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error saving entry: {str(e)}', 'danger')

    return render_template('couriers/form.html',
        courier=None, branch_list=branch_list,
        today=date.today().isoformat(), **_form_lookups()
    )


@couriers.route('/edit/<int:courier_id>', methods=['GET', 'POST'])
@login_required
def edit_courier(courier_id):
    c = Courier.query.get_or_404(courier_id)
    if not current_user.is_superadmin() and current_user.branch_id != c.branch_id:
        abort(403)
    if current_user.role == 'staff' and c.created_by != current_user.id:
        abort(403)

    branch_list = _get_branch_choices()

    if request.method == 'POST':
        try:
            c.date = date.fromisoformat(request.form['date']) if request.form.get('date') else c.date
            c.transaction_type = request.form.get('transaction_type', c.transaction_type)
            c.sender = request.form.get('sender', '').strip()
            c.department = request.form.get('department', '').strip()
            c.sending_from = request.form.get('sending_from', '').strip()
            c.receiver = request.form.get('receiver', '').strip()
            c.receiver_office = request.form.get('receiver_office', '').strip()
            c.supplier_buyer_type = request.form.get('supplier_buyer_type', '').strip()
            c.supplier_buyer_name = request.form.get('supplier_buyer_name', '').strip()
            c.destination = request.form.get('destination', '').strip()
            c.product_description = request.form.get('product_description', '').strip()
            c.package_type = request.form.get('package_type', '').strip()
            c.num_packages = request.form.get('num_packages', 1, type=int)
            c.order_related = request.form.get('order_related', 'NO')
            c.order_reference = request.form.get('order_reference', '').strip()
            c.budgeted = request.form.get('budgeted', 'Non Budgeted')
            c.courier_name = request.form.get('courier_name', '').strip()
            c.awb_no = request.form.get('awb_no', '').strip()
            c.weight_kg = request.form.get('weight_kg', None, type=float)
            c.box_measurement = request.form.get('box_measurement', '').strip()
            c.chargeable_weight = request.form.get('chargeable_weight', None, type=float)
            c.courier_cost = request.form.get('courier_cost', 0, type=float)
            c.payment_mode = request.form.get('payment_mode', '').strip()
            c.remarks = request.form.get('remarks', '').strip()
            db.session.commit()
            flash('Courier entry updated successfully!', 'success')
            return redirect(url_for('couriers.list_couriers'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating entry: {str(e)}', 'danger')

    return render_template('couriers/form.html',
        courier=c, branch_list=branch_list,
        today=date.today().isoformat(), **_form_lookups()
    )


@couriers.route('/delete/<int:courier_id>', methods=['POST'])
@login_required
def delete_courier(courier_id):
    if current_user.role not in ('superadmin', 'admin'):
        abort(403)
    c = Courier.query.get_or_404(courier_id)
    db.session.delete(c)
    db.session.commit()
    flash('Courier entry deleted.', 'success')
    return redirect(url_for('couriers.list_couriers'))


@couriers.route('/view/<int:courier_id>')
@login_required
def view_courier(courier_id):
    c = Courier.query.get_or_404(courier_id)
    if not current_user.is_superadmin() and current_user.branch_id != c.branch_id:
        abort(403)
    return render_template('couriers/view.html', courier=c)
