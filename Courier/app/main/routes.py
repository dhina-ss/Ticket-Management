from datetime import date, timedelta
from flask import render_template, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func, extract
from .. import db
from ..models import Courier, Expense, Branch, User
from . import main


def _branch_filter(query, model):
    if not current_user.is_superadmin() and current_user.branch_id:
        return query.filter(model.branch_id == current_user.branch_id)
    return query


@main.route('/')
@main.route('/dashboard')
@login_required
def dashboard():
    today = date.today()
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())
    year_start  = date(today.year, 1, 1)
    q1_start, q1_end = date(today.year,1,1),  date(today.year,3,31)
    q2_start, q2_end = date(today.year,4,1),  date(today.year,6,30)
    q3_start, q3_end = date(today.year,7,1),  date(today.year,9,30)
    q4_start, q4_end = date(today.year,10,1), date(today.year,12,31)

    base = _branch_filter(db.session.query(Courier), Courier)

    total       = base.count()
    today_count = base.filter(Courier.date == today).count()
    week_count  = base.filter(Courier.date >= week_start).count()
    month_count = base.filter(Courier.date >= month_start).count()
    year_count  = base.filter(Courier.date >= year_start).count()

    # Quarterly counts for current year
    q_counts = []
    for qs, qe in [(q1_start,q1_end),(q2_start,q2_end),(q3_start,q3_end),(q4_start,q4_end)]:
        q_counts.append(base.filter(Courier.date >= qs, Courier.date <= qe).count())

    # Monthly courier cost
    month_cost = db.session.query(func.sum(Courier.courier_cost)).filter(
        Courier.date >= month_start
    )
    if not current_user.is_superadmin() and current_user.branch_id:
        month_cost = month_cost.filter(Courier.branch_id == current_user.branch_id)
    month_cost = month_cost.scalar() or 0

    # Expense total (admin+ only)
    month_expense = 0
    if current_user.can_access_expenses():
        exp_q = db.session.query(func.sum(Expense.amount)).filter(
            Expense.date >= month_start
        )
        if not current_user.is_superadmin() and current_user.branch_id:
            exp_q = exp_q.filter(Expense.branch_id == current_user.branch_id)
        month_expense = exp_q.scalar() or 0

    # Recent couriers
    recent = base.order_by(Courier.date.desc(), Courier.id.desc()).limit(8).all()

    # Courier name breakdown (pie)
    courier_breakdown = db.session.query(
        Courier.courier_name, func.count(Courier.id)
    )
    if not current_user.is_superadmin() and current_user.branch_id:
        courier_breakdown = courier_breakdown.filter(
            Courier.branch_id == current_user.branch_id
        )
    courier_breakdown = courier_breakdown.filter(
        Courier.date >= month_start,
        Courier.courier_name.isnot(None)
    ).group_by(Courier.courier_name).all()

    # Branch list for superadmin
    branches = Branch.query.filter_by(is_active=True).all() if current_user.is_superadmin() else []

    # Year cost
    year_cost_q = db.session.query(func.sum(Courier.courier_cost)).filter(
        Courier.date >= year_start)
    if not current_user.is_superadmin() and current_user.branch_id:
        year_cost_q = year_cost_q.filter(Courier.branch_id == current_user.branch_id)
    year_cost = year_cost_q.scalar() or 0

    return render_template('dashboard.html',
        total=total,
        today_count=today_count,
        week_count=week_count,
        month_count=month_count,
        year_count=year_count,
        q_counts=q_counts,
        year_cost=year_cost,
        month_cost=month_cost,
        month_expense=month_expense,
        recent=recent,
        courier_breakdown=courier_breakdown,
        branches=branches,
        today=today,
    )


@main.route('/api/chart/daily')
@login_required
def chart_daily():
    today = date.today()
    days = []
    counts = []
    costs = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        q = db.session.query(
            func.count(Courier.id), func.coalesce(func.sum(Courier.courier_cost), 0)
        ).filter(Courier.date == d)
        if not current_user.is_superadmin() and current_user.branch_id:
            q = q.filter(Courier.branch_id == current_user.branch_id)
        cnt, cost = q.one()
        days.append(d.strftime('%d %b'))
        counts.append(cnt)
        costs.append(float(cost))
    return jsonify({'labels': days, 'counts': counts, 'costs': costs})


@main.route('/api/chart/monthly')
@login_required
def chart_monthly():
    today = date.today()
    labels, counts, costs = [], [], []
    for i in range(11, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        q = db.session.query(
            func.count(Courier.id), func.coalesce(func.sum(Courier.courier_cost), 0)
        ).filter(
            extract('year', Courier.date) == y,
            extract('month', Courier.date) == m
        )
        if not current_user.is_superadmin() and current_user.branch_id:
            q = q.filter(Courier.branch_id == current_user.branch_id)
        cnt, cost = q.one()
        labels.append(date(y, m, 1).strftime('%b %Y'))
        counts.append(cnt)
        costs.append(float(cost))
    return jsonify({'labels': labels, 'counts': counts, 'costs': costs})


@main.route('/api/chart/department')
@login_required
def chart_department():
    today = date.today()
    month_start = today.replace(day=1)
    q = db.session.query(
        Courier.department, func.count(Courier.id)
    ).filter(
        Courier.date >= month_start,
        Courier.department.isnot(None)
    )
    if not current_user.is_superadmin() and current_user.branch_id:
        q = q.filter(Courier.branch_id == current_user.branch_id)
    rows = q.group_by(Courier.department).all()
    return jsonify({'labels': [r[0] for r in rows], 'values': [r[1] for r in rows]})


@main.route('/api/chart/branch-comparison')
@login_required
def chart_branch_comparison():
    if not current_user.is_superadmin():
        return jsonify({'labels': [], 'counts': []})
    today = date.today()
    month_start = today.replace(day=1)
    rows = db.session.query(
        Branch.name, func.count(Courier.id)
    ).join(Courier, Courier.branch_id == Branch.id).filter(
        Courier.date >= month_start
    ).group_by(Branch.name).all()
    return jsonify({'labels': [r[0] for r in rows], 'counts': [r[1] for r in rows]})
