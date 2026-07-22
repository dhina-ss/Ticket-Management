import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { format, subDays } from 'date-fns';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'];

const SelectDropdown = ({ label, options, value, onChange, direction = 'down', maxHeight = 'max-h-40', error, variant = 'default', icon, widthClass = 'w-full', disabled = false }) => {
	const [isOpen, setIsOpen] = React.useState(false);
	const ref = React.useRef(null);
	React.useEffect(() => {
		const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);
	return (
		<div className="relative" ref={ref}>
			<div
				onClick={() => !disabled && setIsOpen(o => !o)}
				className={variant === 'filter'
					? `flex items-center justify-between gap-2 px-3 py-2 bg-[#eceef0] dark:bg-slate-800 border border-transparent rounded-lg text-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700 outline-none focus:outline-none focus:ring-0 cursor-pointer ${widthClass} ${isOpen ? 'bg-white dark:bg-slate-900 shadow-sm' : ''} ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-[#eceef0] dark:hover:bg-slate-800' : ''}`
					: `flex items-center justify-between ${widthClass} px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-all bg-white dark:bg-[#1C212B] font-medium outline-none focus:outline-none focus:ring-0 ${error ? 'ring-2 ring-red-500/20' : ''} ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`
				}
			>
				<div className="flex items-center gap-2 truncate">
					{icon && variant === 'filter' && <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>}
					<span className={variant === 'filter'
						? `truncate max-w-[120px] font-medium ${!value ? 'text-slate-500 dark:text-slate-400' : 'text-primary'}`
						: "text-slate-800 dark:text-slate-300 truncate"
					}>
						{(options.find(o => (o.value ?? o) === value) || {}).label || value || label}
					</span>
				</div>
				<span className={`material-symbols-outlined text-slate-400 ${variant === 'filter' ? 'text-base' : 'text-[18px] shrink-0 ml-1'} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
			</div>
			{isOpen && (
				<div className={`absolute left-0 w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-[200] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${direction === 'up'
					? 'bottom-full mb-1.5 origin-bottom'
					: 'top-full mt-1.5 origin-top'
					}`}>
					<div className={`${maxHeight} overflow-y-auto custom-scrollbar px-1.5 py-0.5 space-y-0.5`}>
						{options.map(opt => (
							<div
								key={opt.value ?? opt}
								onClick={() => { onChange(opt.value ?? opt); setIsOpen(false); }}
								className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors font-medium ${(opt.value ?? opt) === value
									? 'bg-primary/10 text-primary'
									: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
									}`}
							>
								{opt.label ?? opt}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

const PettyCashAnalysis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resExp, resLedger] = await Promise.all([
        api.get('/api/petty-cash/expenses'),
        api.get('/api/petty-cash/ledger/all').catch(err => { console.error(err); return { data: [] }; })
      ]);
      setExpenses(resExp.data || []);
      setLedgerData(resLedger.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Process Category Data
  const categoryData = expenses.reduce((acc, curr) => {
    if (curr.status === 'rejected' || curr.category === 'Added Cash') return acc;
    const existing = acc.find(c => c.name === curr.category);
    if (existing) {
      existing.value += curr.amount;
    } else {
      acc.push({ name: curr.category, value: curr.amount });
    }
    return acc;
  }, []);

  // Process Monthly Data
  const monthlyData = expenses.reduce((acc, curr) => {
    if (curr.status === 'rejected' || curr.category === 'Added Cash') return acc;
    const dateObj = new Date(curr.date);
    const month = format(dateObj, 'MMM yyyy');
    const existing = acc.find(m => m.name === month);
    if (existing) {
      existing.value += curr.amount;
    } else {
      acc.push({ name: month, value: curr.amount, timestamp: dateObj.getTime() });
    }
    return acc;
  }, []).sort((a, b) => a.timestamp - b.timestamp);

  // Process Last 7 Days Data
  const base7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { name: format(d, 'dd MMM'), dateStr: format(d, 'yyyy-MM-dd'), value: 0 };
  });

  const last7DaysData = expenses.reduce((acc, curr) => {
    if (curr.status === 'rejected' || curr.category === 'Added Cash') return acc;
    // curr.date is 'YYYY-MM-DD'
    const target = acc.find(day => day.dateStr === curr.date.substring(0, 10));
    if (target) {
      target.value += curr.amount;
    }
    return acc;
  }, base7Days);

  // Get Last 12 Months to keep charts readable
  const recentMonthlyData = monthlyData.slice(-12);

  // Process Monthly Summary Data (Opening Balance, Added Cash, Total Expense, Closing Balance)
  const monthlySummaryMap = new Map();
  
  // 1. Initialize from Ledger Data for Opening Balance & Added Cash
  const sortedLedger = [...ledgerData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  sortedLedger.forEach(curr => {
    if (!curr.date) return;
    const dateObj = new Date(curr.date);
    const monthKey = format(dateObj, 'yyyy-MM');
    const monthLabel = format(dateObj, 'MMM yyyy');

    if (!monthlySummaryMap.has(monthKey)) {
      monthlySummaryMap.set(monthKey, {
        monthKey,
        name: monthLabel,
        timestamp: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime(),
        'Opening Balance': curr.opening_balance || 0,
        'Added Cash': 0,
        'Total Expense': 0,
        'Closing Balance': 0
      });
    }

    const monthData = monthlySummaryMap.get(monthKey);
    monthData['Added Cash'] += curr.added_cash || 0;
  });

  // 2. Add Expenses for accurate real-time Total Expense
  expenses.forEach(curr => {
    if (curr.status === 'rejected' || curr.category === 'Added Cash' || curr.type === 'credit') return;
    if (!curr.date) return;
    const dateObj = new Date(curr.date);
    const monthKey = format(dateObj, 'yyyy-MM');
    const monthLabel = format(dateObj, 'MMM yyyy');

    if (!monthlySummaryMap.has(monthKey)) {
      monthlySummaryMap.set(monthKey, {
        monthKey,
        name: monthLabel,
        timestamp: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime(),
        'Opening Balance': 0,
        'Added Cash': 0,
        'Total Expense': 0,
        'Closing Balance': 0
      });
    }

    const monthData = monthlySummaryMap.get(monthKey);
    monthData['Total Expense'] += curr.amount || 0;
  });

  // 3. Sort and calculate Closing Balances dynamically
  const monthlySummaryDataAll = Array.from(monthlySummaryMap.values())
    .sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < monthlySummaryDataAll.length; i++) {
    monthlySummaryDataAll[i]['Closing Balance'] = monthlySummaryDataAll[i]['Opening Balance'] + monthlySummaryDataAll[i]['Added Cash'] - monthlySummaryDataAll[i]['Total Expense'];
  }

  let monthlySummaryData = monthlySummaryDataAll.slice(-4);
  if (selectedYear && selectedMonth) {
    const startTimestamp = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).getTime();
    const endTimestamp = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 3, 1).getTime();
    monthlySummaryData = monthlySummaryDataAll.filter(d => d.timestamp >= startTimestamp && d.timestamp < endTimestamp);
  }

  // Process Top 5 Categories Current Month
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const currentMonthExpenses = expenses.filter(curr => curr.status !== 'rejected' && curr.category !== 'Added Cash' && curr.date && curr.date.startsWith(currentMonthStr));
  
  const top5CatMap = currentMonthExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});
  
  const top5CategoriesData = Object.keys(top5CatMap)
    .map(name => ({ name, value: top5CatMap[name] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const formatCurrency = (value) => `₹${value.toFixed(2)}`;

  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();

  const yearOptions = [
    { value: '', label: 'Select Year' },
    ...Array.from(new Set(monthlySummaryDataAll.map(d => new Date(d.timestamp).getFullYear())))
      .sort((a,b) => b-a)
      .map(y => ({ value: y.toString(), label: y.toString() }))
  ];

  const monthOptions = [
    { value: '', label: 'Select Month' },
    ...Array.from({length: 12}).map((_, i) => ({
      value: (i+1).toString().padStart(2, '0'),
      label: format(new Date(2000, i, 1), 'MMMM')
    })).filter((opt, i) => {
      if (selectedYear === currentYear.toString()) {
        return i <= currentMonthIndex;
      }
      return true;
    })
  ];

  return (
    <div className="font-display bg-background-light dark:bg-[#181D27] text-slate-900 dark:text-[#f0f0f2] min-h-screen flex flex-col">
      {/* Header Bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-5 px-8 md:px-20 py-4 bg-white dark:bg-[#1C212B] border-b border-amber-500/20 shrink-0 shadow-sm">
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/petty-cash')}
            className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border-none shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined text-2xl">analytics</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">Petty Cash Analysis</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Visualize category, weekly, and monthly expense trends</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 md:px-20 py-8 space-y-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-white dark:bg-[#1C212B] rounded-2xl p-8 border border-slate-100 dark:border-slate-800 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">inbox</span>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No Expenses Found</h3>
            <p className="text-sm text-slate-500">There are no approved or pending expenses to analyze.</p>
          </div>
        ) : (
          <>
            {/* Monthly Financial Filters */}
            <div className="flex items-center gap-4 mb-2">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Year</label>
                <SelectDropdown
                  value={selectedYear}
                  onChange={setSelectedYear}
                  options={yearOptions}
                  widthClass="w-32"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Month</label>
                <SelectDropdown
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={monthOptions}
                  disabled={!selectedYear}
                  widthClass="w-36"
                />
              </div>
              {(selectedYear || selectedMonth) && (
                <button
                  onClick={() => { setSelectedYear(''); setSelectedMonth(''); }}
                  className="mt-5 px-3 py-2 text-sm font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Monthly Financial Summary Table */}
              <div className="bg-white dark:bg-[#1C212B] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">table_view</span>
                Monthly Financial Summary
              </h2>
              <div className="flex-1 overflow-x-auto flex items-center">
                <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300 border-collapse border border-slate-200 dark:border-slate-700 shadow-sm">
                  <thead className="bg-[#D9E1F2] dark:bg-blue-900/30">
                    <tr>
                      <th className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">Particulars</th>
                      {monthlySummaryData.map((data, idx) => (
                        <th key={idx} className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">{data.name.split(' ')[0]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 dark:border-slate-700 p-3 text-center text-black dark:text-slate-200">Opening balance</td>
                      {monthlySummaryData.map((data, idx) => (
                        <td key={idx} className="border border-slate-300 dark:border-slate-700 p-3 text-center text-black dark:text-slate-200">{data['Opening Balance'].toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">Cash withdraw</td>
                      {monthlySummaryData.map((data, idx) => (
                        <td key={idx} className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">{data['Added Cash'].toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="border border-slate-300 dark:border-slate-700 p-3 text-center text-black dark:text-slate-200">Total</td>
                      {monthlySummaryData.map((data, idx) => (
                        <td key={idx} className="border border-slate-300 dark:border-slate-700 p-3 text-center text-black dark:text-slate-200">{(data['Opening Balance'] + data['Added Cash']).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">Expenses amount</td>
                      {monthlySummaryData.map((data, idx) => (
                        <td key={idx} className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">{data['Total Expense'].toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      ))}
                    </tr>
                    <tr className="bg-[#FFE699] dark:bg-amber-900/40">
                      <td className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">Balance</td>
                      {monthlySummaryData.map((data, idx) => (
                        <td key={idx} className="border border-slate-300 dark:border-slate-700 p-3 font-bold text-black dark:text-white text-center">{data['Closing Balance'].toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Financial Summary Chart */}
            <div className="bg-white dark:bg-[#1C212B] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">account_balance</span>
                Monthly Financial Chart
              </h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySummaryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `₹${value}`} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(value) => formatCurrency(value)} contentStyle={{ fontSize: '12px', padding: '8px' }} itemStyle={{ fontSize: '12px' }} labelStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Opening Balance" fill="#8884d8" radius={[4, 4, 0, 0]} name="Opening Balance" />
                    <Bar dataKey="Added Cash" fill="#82ca9d" radius={[4, 4, 0, 0]} name="Added Cash" />
                    <Bar dataKey="Total Expense" fill="#ffc658" radius={[4, 4, 0, 0]} name="Total Expense" />
                    <Bar dataKey="Closing Balance" fill="#ff7300" radius={[4, 4, 0, 0]} name="Closing Balance" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Pie Chart */}
            <div className="bg-white dark:bg-[#1C212B] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">pie_chart</span>
                Expenses by Category
              </h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={150}
                      fill="#8884d8"
                      label={(props) => {
                        const { x, y, name, percent, cx, fill } = props;
                        return (
                          <text x={x} y={y} fill={fill} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
                            {`${name} ${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      }}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatCurrency(value)} fontSize={12} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Bar Chart */}
            <div className="bg-white dark:bg-[#1C212B] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">bar_chart</span>
                Monthly Expense Trend
              </h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recentMonthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `₹${value}`} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#00C49F" radius={[4, 4, 0, 0]} name="Expense Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Last 7 Days Bar Chart */}
            <div className="bg-white dark:bg-[#1C212B] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">bar_chart</span>
                Last 7 Days Expense
              </h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7DaysData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `₹${value}`} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#ec1d22" radius={[4, 4, 0, 0]} name="Expense Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 5 Categories Bar Chart */}
            <div className="bg-white dark:bg-[#1C212B] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-500">leaderboard</span>
                Top 5 Categories (This Month)
              </h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top5CategoriesData} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `₹${value}`} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} name="Expense Amount" barSize={32}>
                      {top5CategoriesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PettyCashAnalysis;
