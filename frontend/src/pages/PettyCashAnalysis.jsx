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

const PettyCashAnalysis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (curr.status === 'rejected') return acc;
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
    if (curr.status === 'rejected') return acc;
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
    if (curr.status === 'rejected') return acc;
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
        timestamp: dateObj.getTime(),
        'Opening Balance': curr.opening_balance,
        'Added Cash': 0,
        'Total Expense': 0,
        'Closing Balance': curr.closing_balance
      });
    }

    const monthData = monthlySummaryMap.get(monthKey);
    monthData['Added Cash'] += curr.added_cash;
    monthData['Total Expense'] += curr.total_expenses;
    monthData['Closing Balance'] = curr.closing_balance;
  });

  const monthlySummaryData = Array.from(monthlySummaryMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6);

  // Process Top 5 Categories Current Month
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const currentMonthExpenses = expenses.filter(curr => curr.status !== 'rejected' && curr.date && curr.date.startsWith(currentMonthStr));
  
  const top5CatMap = currentMonthExpenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});
  
  const top5CategoriesData = Object.keys(top5CatMap)
    .map(name => ({ name, value: top5CatMap[name] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const formatCurrency = (value) => `₹${value.toFixed(2)}`;

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Monthly Financial Summary */}
            <div className="lg:col-span-2 bg-white dark:bg-[#1C212B] rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">account_balance</span>
                Monthly Financial Summary
              </h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySummaryData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `₹${value}`} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(value) => formatCurrency(value)} />
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
        )}
      </div>
    </div>
  );
};

export default PettyCashAnalysis;
