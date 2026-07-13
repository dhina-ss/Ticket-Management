from datetime import date, timedelta
from calendar import monthrange
import io, csv
from flask import render_template, request, jsonify, Response, abort
from flask_login import login_required, current_user
from sqlalchemy import func, extract
from .. import db
from ..models import Courier, Expense, Branch
from . import reports


def _base_q():
    q = db.session.query(Courier)
    if not current_user.is_superadmin() and current_user.branch_id:
        q = q.filter(Courier.branch_id == current_user.branch_id)
    return q


def _expense_total(start, end):
    if not current_user.can_access_expenses():
        return 0
    q = db.session.query(func.sum(Expense.amount)).filter(
        Expense.date >= start, Expense.date <= end)
    if not current_user.is_superadmin() and current_user.branch_id:
        q = q.filter(Expense.branch_id == current_user.branch_id)
    return q.scalar() or 0


def _breakdown(couriers):
    by_courier, by_dept, by_type, by_budgeted = {}, {}, {}, {}
    for c in couriers:
        cn = (c.courier_name or 'Unknown').strip()
        by_courier[cn] = by_courier.get(cn, 0) + 1
        by_dept[c.department or 'Unknown'] = by_dept.get(c.department or 'Unknown', 0) + 1
        by_type[c.transaction_type or 'Dispatch'] = by_type.get(c.transaction_type or 'Dispatch', 0) + 1
        bud = c.budgeted or 'Non Budgeted'
        by_budgeted[bud] = by_budgeted.get(bud, 0) + 1
    return by_courier, by_dept, by_type, by_budgeted


# ── helpers for period date ranges ──────────────────────────────────────────

def _year_range(year):
    return date(year, 1, 1), date(year, 12, 31)

def _quarter_range(year, q):
    start_month = (q - 1) * 3 + 1
    end_month = start_month + 2
    _, last = monthrange(year, end_month)
    return date(year, start_month, 1), date(year, end_month, last)

def _half_range(year, h):
    if h == 1:
        return date(year, 1, 1), date(year, 6, 30)
    return date(year, 7, 1), date(year, 12, 31)

def _monthly_labels_counts(couriers, start, end):
    """Return month-by-month label/count/cost arrays between start and end."""
    months = []
    d = start.replace(day=1)
    while d <= end:
        months.append(d)
        if d.month == 12:
            d = d.replace(year=d.year + 1, month=1)
        else:
            d = d.replace(month=d.month + 1)
    labels, counts, costs = [], [], []
    for m in months:
        mc = [c for c in couriers if c.date.year == m.year and c.date.month == m.month]
        labels.append(m.strftime('%b %Y'))
        counts.append(len(mc))
        costs.append(sum(c.courier_cost or 0 for c in mc))
    return labels, counts, costs


# ── DAILY ────────────────────────────────────────────────────────────────────

@reports.route('/daily')
@login_required
def daily():
    report_date = request.args.get('date', date.today().isoformat())
    try:
        d = date.fromisoformat(report_date)
    except ValueError:
        d = date.today()
    couriers = _base_q().filter(Courier.date == d).order_by(Courier.id).all()
    total_cost = sum(c.courier_cost or 0 for c in couriers)
    by_courier = {}
    for c in couriers:
        name = (c.courier_name or 'Unknown').strip()
        by_courier[name] = by_courier.get(name, 0) + 1
    return render_template('reports/daily.html',
        couriers=couriers, report_date=d, total_cost=total_cost, by_courier=by_courier)


# ── WEEKLY ───────────────────────────────────────────────────────────────────

@reports.route('/weekly')
@login_required
def weekly():
    today = date.today()
    week_str = request.args.get('week', today.strftime('%Y-W%W'))
    try:
        year, week = int(week_str.split('-W')[0]), int(week_str.split('-W')[1])
        week_start = date.fromisocalendar(year, week, 1)
    except Exception:
        week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    couriers = _base_q().filter(
        Courier.date >= week_start, Courier.date <= week_end
    ).order_by(Courier.date, Courier.id).all()
    total_cost = sum(c.courier_cost or 0 for c in couriers)
    daily_labels, daily_counts, daily_costs = [], [], []
    for i in range(7):
        d = week_start + timedelta(days=i)
        dc = [c for c in couriers if c.date == d]
        daily_labels.append(d.strftime('%a %d'))
        daily_counts.append(len(dc))
        daily_costs.append(sum(c.courier_cost or 0 for c in dc))
    by_courier, by_dept = {}, {}
    for c in couriers:
        by_courier[(c.courier_name or 'Unknown').strip()] = by_courier.get((c.courier_name or 'Unknown').strip(), 0) + 1
        by_dept[c.department or 'Unknown'] = by_dept.get(c.department or 'Unknown', 0) + 1
    return render_template('reports/weekly.html',
        couriers=couriers, week_start=week_start, week_end=week_end,
        total_cost=total_cost, by_courier=by_courier, by_dept=by_dept,
        daily_labels=daily_labels, daily_counts=daily_counts, daily_costs=daily_costs,
        week_str=week_str)


# ── MONTHLY ──────────────────────────────────────────────────────────────────

@reports.route('/monthly')
@login_required
def monthly():
    today = date.today()
    month_str = request.args.get('month', today.strftime('%Y-%m'))
    try:
        year, month = int(month_str.split('-')[0]), int(month_str.split('-')[1])
    except Exception:
        year, month = today.year, today.month
    _, last_day = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)
    couriers = _base_q().filter(
        Courier.date >= month_start, Courier.date <= month_end
    ).order_by(Courier.date, Courier.id).all()
    total_cost = sum(c.courier_cost or 0 for c in couriers)
    daily_labels = [str(d) for d in range(1, last_day + 1)]
    daily_counts = [0] * last_day
    daily_costs = [0.0] * last_day
    for c in couriers:
        idx = c.date.day - 1
        daily_counts[idx] += 1
        daily_costs[idx] += c.courier_cost or 0
    by_courier, by_dept, by_type, by_budgeted = _breakdown(couriers)
    month_expense = _expense_total(month_start, month_end)
    return render_template('reports/monthly.html',
        couriers=couriers, month_start=month_start, month_end=month_end,
        total_cost=total_cost, month_expense=month_expense,
        by_courier=by_courier, by_dept=by_dept, by_type=by_type, by_budgeted=by_budgeted,
        daily_labels=daily_labels, daily_counts=daily_counts, daily_costs=daily_costs,
        month_str=month_str, year=year, month=month)


# ── PERIOD REPORT (Yearly / Quarterly / Half-Yearly / Date Range) ────────────

@reports.route('/period')
@login_required
def period():
    today = date.today()
    mode = request.args.get('mode', 'yearly')   # yearly | quarterly | halfyearly | range

    # ── resolve date range from mode params ──────────────────────────────────
    if mode == 'yearly':
        year = request.args.get('year', today.year, type=int)
        start, end = _year_range(year)
        period_label = f'Year {year}'
        nav_prev = url_for_period(mode, year=year - 1)
        nav_next = url_for_period(mode, year=year + 1)

    elif mode == 'quarterly':
        year = request.args.get('year', today.year, type=int)
        q    = request.args.get('q', (today.month - 1) // 3 + 1, type=int)
        q    = max(1, min(4, q))
        start, end = _quarter_range(year, q)
        period_label = f'Q{q} {year}  ({start.strftime("%b")} – {end.strftime("%b %Y")})'
        pq, py = (q - 2, year) if q > 1 else (4, year - 1)
        nq, ny = (q % 4 + 1, year + (1 if q == 4 else 0))
        nav_prev = url_for_period(mode, year=py, q=pq)
        nav_next = url_for_period(mode, year=ny, q=nq)

    elif mode == 'halfyearly':
        year = request.args.get('year', today.year, type=int)
        h    = request.args.get('h', 1 if today.month <= 6 else 2, type=int)
        h    = max(1, min(2, h))
        start, end = _half_range(year, h)
        period_label = f'H{h} {year}  ({start.strftime("%b")} – {end.strftime("%b %Y")})'
        ph, py = (2, year - 1) if h == 1 else (1, year)
        nh, ny = (2, year) if h == 1 else (1, year + 1)
        nav_prev = url_for_period(mode, year=py, h=ph)
        nav_next = url_for_period(mode, year=ny, h=nh)

    else:  # range
        from_date = request.args.get('from_date', today.replace(day=1).isoformat())
        to_date   = request.args.get('to_date',   today.isoformat())
        try:
            start = date.fromisoformat(from_date)
            end   = date.fromisoformat(to_date)
        except Exception:
            start, end = today.replace(day=1), today
        period_label = f'{start.strftime("%d %b %Y")} – {end.strftime("%d %b %Y")}'
        nav_prev = nav_next = None

    # ── fetch data ───────────────────────────────────────────────────────────
    couriers = _base_q().filter(
        Courier.date >= start, Courier.date <= end
    ).order_by(Courier.date, Courier.id).all()

    total_count = len(couriers)
    total_cost  = sum(c.courier_cost or 0 for c in couriers)
    expense_total = _expense_total(start, end)
    by_courier, by_dept, by_type, by_budgeted = _breakdown(couriers)
    month_labels, month_counts, month_costs = _monthly_labels_counts(couriers, start, end)

    return render_template('reports/period.html',
        mode=mode, period_label=period_label,
        start=start, end=end,
        couriers=couriers,
        total_count=total_count, total_cost=total_cost, expense_total=expense_total,
        by_courier=by_courier, by_dept=by_dept, by_type=by_type, by_budgeted=by_budgeted,
        month_labels=month_labels, month_counts=month_counts, month_costs=month_costs,
        nav_prev=nav_prev, nav_next=nav_next,
        today=today,
        # pass through query params for form pre-fill
        sel_year=request.args.get('year', today.year, type=int),
        sel_q=request.args.get('q', (today.month - 1) // 3 + 1, type=int),
        sel_h=request.args.get('h', 1 if today.month <= 6 else 2, type=int),
        sel_from=request.args.get('from_date', today.replace(day=1).isoformat()),
        sel_to=request.args.get('to_date', today.isoformat()),
    )


def url_for_period(mode, **kwargs):
    from flask import url_for
    return url_for('reports.period', mode=mode, **kwargs)


# ── EXPORT CSV ───────────────────────────────────────────────────────────────

@reports.route('/export/csv')
@login_required
def export_csv():
    from_date = request.args.get('from_date', '')
    to_date   = request.args.get('to_date', '')
    q = _base_q()
    if from_date:
        q = q.filter(Courier.date >= from_date)
    if to_date:
        q = q.filter(Courier.date <= to_date)
    couriers = q.order_by(Courier.date).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Date', 'Type', 'Branch', 'Sender', 'Department', 'Sending From',
        'Receiver', 'Receiver Office', 'Supplier/Buyer Type', 'Supplier/Buyer Name',
        'Destination', 'Product', 'Package Type', 'Num Packages',
        'Order Related', 'Order Reference', 'Budgeted', 'Courier Name',
        'AWB No', 'Weight (Kg)', 'Box Measurement', 'Chargeable Weight',
        'Courier Cost', 'Payment Mode', 'Remarks'
    ])
    for c in couriers:
        writer.writerow([
            c.date, c.transaction_type, c.branch.name if c.branch else '',
            c.sender, c.department, c.sending_from, c.receiver, c.receiver_office,
            c.supplier_buyer_type, c.supplier_buyer_name, c.destination,
            c.product_description, c.package_type, c.num_packages,
            c.order_related, c.order_reference, c.budgeted, c.courier_name,
            c.awb_no, c.weight_kg, c.box_measurement, c.chargeable_weight,
            c.courier_cost, c.payment_mode, c.remarks
        ])
    output.seek(0)
    filename = f'courier_report_{from_date or "all"}_{to_date or "all"}.csv'
    return Response(output.getvalue(), mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'})
