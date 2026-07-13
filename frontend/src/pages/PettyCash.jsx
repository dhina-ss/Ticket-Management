import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const SelectDropdown = ({ label, options, value, onChange, direction = 'down', maxHeight = 'max-h-40', error, variant = 'default', icon, widthClass = 'w-full' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setIsOpen(o => !o)}
        className={variant === 'filter'
          ? `flex items-center justify-between gap-2 px-3 py-2 bg-[#eceef0] dark:bg-slate-800 border border-transparent rounded-lg text-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700 outline-none focus:outline-none focus:ring-0 cursor-pointer ${widthClass} ${isOpen ? 'bg-white dark:bg-slate-900 shadow-sm' : ''}`
          : `flex items-center justify-between ${widthClass} px-3 py-2 text-sm rounded-xl border-none cursor-pointer transition-all bg-slate-50 dark:bg-slate-800 font-medium outline-none focus:outline-none focus:ring-0 ${error ? 'ring-2 ring-red-500/20' : ''}`
        }
      >
        <div className="flex items-center gap-2 truncate">
          {icon && variant === 'filter' && <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>}
          <span className={variant === 'filter'
            ? `truncate max-w-[120px] font-medium ${!value ? 'text-slate-500 dark:text-slate-400' : 'text-primary'}`
            : "text-slate-800 dark:text-slate-350 truncate"
          }>
            {(options.find(o => (o.value ?? o) === value) || {}).label || value || label}
          </span>
        </div>
        <span className={`material-symbols-outlined text-slate-400 ${variant === 'filter' ? 'text-base' : 'text-[18px] shrink-0 ml-1'} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </div>
      {isOpen && (
        <div className={`absolute left-0 w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border-none z-[200] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${direction === 'up'
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

const PettyCash = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? saved === 'true' : false;
  });

  // User profile popup state
  const [showUserPopup, setShowUserPopup] = useState(false);
  const userPopupRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userPopupRef.current && !userPopupRef.current.contains(e.target)) {
        setShowUserPopup(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine roles
  const isManager = user?.email === 'admin@support.com' || user?.role === 'Manager' || user?.receiver_position === 'Manager' || user?.access === 'Edit' || true; // For local testing, default to manager permissions
  const isAdmin = user?.email === 'admin@support.com' || true;
  const hasEditPermission = user?.email === 'admin@support.com' || user?.access === 'Edit';

  // States
  const [dashboard, setDashboard] = useState({
    today_total: 0,
    today_count: 0,
    month_total: 0,
    pending_count: 0,
    current_balance: 0,
    cat_totals: {},
    week_data: [],
    ledger: {
      opening_balance: 0,
      added_cash: 0,
      closing_balance: 0,
      is_closed: false,
      notes: ''
    },
    categories: [],
    subcategories: {}
  });
  const [expenses, setExpenses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    category: '',
    status: ''
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setExpenseForm({
      date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      sub_remarks: '',
      amount: '',
      description: ''
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (exp) => {
    setEditingExpense(exp);
    setExpenseForm({
      date: exp.date || new Date().toISOString().split('T')[0],
      category: exp.category || '',
      subcategory: exp.subcategory || '',
      sub_remarks: exp.sub_remarks || '',
      amount: exp.amount || '',
      description: exp.description || ''
    });
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setEditingExpense(null);
    setExpenseForm({
      date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      sub_remarks: '',
      amount: '',
      description: ''
    });
    setShowAddModal(false);
  };

  // Prevent background scrolling when details modal is open
  useEffect(() => {
    if (isDetailsModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isDetailsModalOpen]);

  // Date Picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  const [dateRange, setDateRange] = useState([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, dateRange]);
  const datePickerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Form States
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    subcategory: '',
    sub_remarks: '',
    amount: '',
    description: ''
  });

  const [closeForm, setCloseForm] = useState({
    added_cash: '',
    notes: ''
  });

  // Load Dashboard Data
  const fetchDashboard = async () => {
    try {
      const res = await api.get('/api/petty-cash/dashboard');
      if (res.status === 200) {
        setDashboard(res.data);
      }
    } catch (err) {
      console.error('Error loading petty cash dashboard:', err);
    }
  };

  // Load Expenses List
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      const res = await api.get(`/api/petty-cash/expenses?${params.toString()}`);
      if (res.status === 200) {
        setExpenses(res.data);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  // Handle Category Change
  const handleCategoryChange = (cat) => {
    const subs = dashboard.subcategories[cat] || [];
    setExpenseForm(prev => ({
      ...prev,
      category: cat,
      subcategory: subs[0] || '',
      sub_remarks: ''
    }));
  };

  // Submit Expense
  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...expenseForm,
        submitted_by: editingExpense ? editingExpense.submitted_by : (user?.name || user?.email || 'admin'),
        is_manager: isManager
      };
      
      let res;
      if (editingExpense) {
        res = await api.put(`/api/petty-cash/expenses/${editingExpense.id}`, payload);
      } else {
        res = await api.post('/api/petty-cash/expenses', payload);
      }

      if (res.status === 200 || res.status === 201) {
        fetchDashboard();
        fetchExpenses();
        handleCloseAddModal();
      }
    } catch (err) {
      console.error('Error saving expense:', err);
      alert('Error saving expense entry.');
    }
  };

  // Submit EOD Close
  const handleCloseLedger = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        added_cash: parseFloat(closeForm.added_cash || 0),
        notes: closeForm.notes,
        user_name: user?.name || user?.email || 'admin'
      };
      const res = await api.post('/api/petty-cash/ledger/close', payload);
      if (res.status === 200) {
        fetchDashboard();
        fetchExpenses();
        setShowCloseModal(false);
        setCloseForm({ added_cash: '', notes: '' });
      }
    } catch (err) {
      console.error('Error closing EOD ledger:', err);
      alert('Error closing ledger.');
    }
  };

  // Approve Expense
  const handleApprove = async (id) => {
    try {
      const res = await api.post(`/api/petty-cash/expenses/${id}/approve`, {
        user_name: user?.name || user?.email || 'admin'
      });
      if (res.status === 200) {
        fetchDashboard();
        fetchExpenses();
      }
    } catch (err) {
      console.error('Error approving expense:', err);
    }
  };

  // Reject Expense
  const handleReject = async (id) => {
    const notes = window.prompt('Enter rejection reason / notes:');
    if (notes === null) return;
    try {
      const res = await api.post(`/api/petty-cash/expenses/${id}/reject`, {
        notes,
        user_name: user?.name || user?.email || 'admin'
      });
      if (res.status === 200) {
        fetchDashboard();
        fetchExpenses();
      }
    } catch (err) {
      console.error('Error rejecting expense:', err);
    }
  };

  // Delete Expense
  const handleRowClick = (expense) => {
    setSelectedExpense(expense);
    setIsDetailsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await api.delete(`/api/petty-cash/expenses/${id}`);
      if (res.status === 200) {
        fetchDashboard();
        fetchExpenses();
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert('No data to export for the selected filters.');
      return;
    }
    const dataToExport = filteredExpenses.map((exp, index) => ({
      'S.No': index + 1,
      'Date': exp.date ? exp.date.split('-').reverse().join('-') : '',
      'Category': exp.category,
      'Subcategory': exp.subcategory || '',
      'Remarks': exp.sub_remarks || '',
      'Submitted By': exp.submitted_by,
      'Amount (INR)': exp.amount,
      'Description': exp.description,
      'Status': exp.status ? exp.status.toUpperCase() : ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Petty Cash");
    XLSX.writeFile(workbook, `Petty_Cash_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const filteredExpenses = expenses.filter(exp =>
    !searchQuery ||
    (exp.description && exp.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (exp.category && exp.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (exp.subcategory && exp.subcategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (exp.submitted_by && exp.submitted_by.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (exp.amount && exp.amount.toString().includes(searchQuery))
  );

  const pagedExpenses = filteredExpenses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="font-display bg-background-light dark:bg-[#181D27] text-slate-900 dark:text-[#f0f0f2] min-h-screen flex flex-col">
      {/* Header Bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-5 px-20 py-4 bg-white dark:bg-[#1C212B] border-b border-amber-500/20 dark:border-opacity-30 shrink-0">
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border-none shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">Petty Cash</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage, approve and track daily company cash transactions</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isManager && !dashboard.ledger.is_closed && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-600 dark:text-amber-400 font-bold rounded-xl transition-all border border-amber-500/20 cursor-pointer text-sm"
            >
              <span className="material-symbols-outlined text-lg">lock</span>
              Close Day (EOD)
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer border-0 text-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add Expense
          </button>

          <div className="relative flex items-center" ref={userPopupRef}>
            {/* User Avatar Button */}
            <button
              onClick={() => setShowUserPopup(prev => !prev)}
              aria-label="User profile"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#ec1d22] to-[#780003] text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer select-none shrink-0"
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : (
                <span className="material-symbols-outlined text-[18px]">person</span>
              )}
            </button>

            {/* Profile Popup */}
            {showUserPopup && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[300] overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                {/* User info header */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-[#0080FF] to-[#6366F1] text-white font-bold text-base shrink-0">
                    {user?.name ? user.name.charAt(0).toUpperCase() : (
                      <span className="material-symbols-outlined text-[18px]">person</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">{user?.role || 'Staff'}</p>
                  </div>
                </div>

                {/* Dark / Light mode row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">
                      {darkMode ? 'dark_mode' : 'light_mode'}
                    </span>
                    {darkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                  <button
                    onClick={toggleDarkMode}
                    aria-label="Toggle dark mode"
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none ${darkMode ? 'bg-[#6366F1]' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-transform duration-200 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`}>
                      <span className="material-symbols-outlined text-[11px] text-slate-500">
                        {darkMode ? 'dark_mode' : 'light_mode'}
                      </span>
                    </span>
                  </button>
                </div>

                {/* Logout */}
                <div className="px-3 py-2">
                  <button
                    onClick={() => { setShowUserPopup(false); handleLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer border-none"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col px-20 py-6 space-y-6">
        {dashboard.ledger.is_closed && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-400 flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl">lock</span>
            <div>
              <span className="font-bold">Day Ledger Closed:</span> Today's petty cash ledger has been finalized and closed. No new expenses can be submitted or approved until the next daily opening.
            </div>
          </div>
        )}

        {/* Statistics section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Balance</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">₹{dashboard.current_balance.toFixed(2)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center text-violet-650">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Expenses</p>
              <h3 className="text-3xl font-extrabold text-[#ec1d22] mt-2">₹{dashboard.today_total.toFixed(2)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-[#ec1d22]">
              <span className="material-symbols-outlined text-2xl">trending_down</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly Expenses</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">₹{dashboard.month_total.toFixed(2)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-2xl">calendar_month</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Approvals</p>
              <h3 className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">{dashboard.pending_count}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-2xl">hourglass_empty</span>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="flex items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#eceef0] dark:bg-slate-800 border-none rounded-lg text-sm outline-none focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2 mx-4">
            {/* Category */}
            <SelectDropdown
              variant="filter"
              icon="category"
              widthClass="w-50"
              label="All Categories"
              value={filters.category}
              onChange={val => setFilters(prev => ({ ...prev, category: val }))}
              options={[
                { label: 'All Categories', value: '' },
                ...dashboard.categories.map(c => ({ label: c, value: c }))
              ]}
            />

            {/* Status */}
            <SelectDropdown
              variant="filter"
              icon="checklist"
              widthClass="w-50"
              label="All Statuses"
              value={filters.status}
              onChange={val => setFilters(prev => ({ ...prev, status: val }))}
              options={[
                { label: 'All Statuses', value: '' },
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' }
              ]}
            />

            {/* Date Range */}
            <div className="relative" ref={datePickerRef}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                aria-label="Toggle date filter"
                title="Date Range Filter"
                className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors shadow-sm relative ${isDateFilterActive || showDatePicker
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
              >
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                {isDateFilterActive && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"></span>
                  </span>
                )}
              </button>

              {showDatePicker && (
                <div className="absolute top-12 right-0 z-[200] shadow-2xl rounded-xl overflow-hidden border-none bg-white dark:bg-slate-800 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                  <DateRangePicker
                    onChange={(item) => {
                      setDateRange([item.selection]);
                      setIsDateFilterActive(true);
                      setFilters(prev => ({
                        ...prev,
                        date_from: format(item.selection.startDate, 'yyyy-MM-dd'),
                        date_to: format(item.selection.endDate, 'yyyy-MM-dd')
                      }));
                    }}
                    moveRangeOnFirstSelection={false}
                    months={2}
                    ranges={dateRange}
                    direction="horizontal"
                    rangeColors={['#137fec']}
                    staticRanges={[]}
                    inputRanges={[]}
                  />
                  <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsDateFilterActive(false);
                        setDateRange([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
                        setFilters(prev => ({ ...prev, date_from: '', date_to: '' }));
                        setShowDatePicker(false);
                      }}
                      className="px-4 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="px-4 py-1.5 text-sm font-medium bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExportExcel}
              title="Export to Excel"
              className="flex items-center justify-center w-9 h-9 rounded-lg border-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
            </button>

            {/* Clear Filters */}
            {(searchQuery !== '' || filters.category !== '' || filters.status !== '' || isDateFilterActive) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ category: '', status: '', date_from: '', date_to: '' });
                  setIsDateFilterActive(false);
                  setDateRange([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
                }}
                aria-label="Clear all filters"
                title="Clear all filters"
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm animate-in fade-in zoom-in duration-200"
              >
                <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
              </button>
            )}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white dark:bg-[#1C212B] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[calc(100vh-10px)] max-h-[calc(100vh-10px)]">
          {loading ? (
            <div className="p-20 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl animate-spin text-amber-500 mb-2">progress_activity</span>
              <p>Loading transactions...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-20 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">payments</span>
              <p>{expenses.length === 0 ? 'No transactions logged.' : 'No transactions found matching your search.'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[#eceef0] dark:bg-slate-800 shadow-sm">
                    <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <th className="p-4 w-16 text-center">#</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Username</th>
                      <th className="p-4">Description</th>
                      <th className="p-4 font-semibold">Amount (INR)</th>
                      <th className="p-4 font-semibold">Status</th>
                      {hasEditPermission && <th className="p-4 text-right font-semibold">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pagedExpenses.map((exp, index) => (
                      <tr key={exp.id} onClick={() => handleRowClick(exp)} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors cursor-pointer">
                        <td className="px-4 py-2 text-center text-slate-500 font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                        <td className="px-4 py-2 font-medium">{exp.date ? exp.date.split('-').reverse().join('-') : ''}</td>
                        <td className="px-4 py-2">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{exp.category}</div>
                            <div className="text-[11px] text-slate-400">
                              {exp.subcategory}{exp.sub_remarks ? ` (${exp.sub_remarks})` : ''}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{exp.submitted_by}</td>
                        <td className="px-4 py-2 max-w-[200px] truncate" title={exp.description}>{exp.description}</td>
                        <td className="px-4 py-2 font-bold text-[#ec1d22]">₹{exp.amount.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${exp.status === 'approved'
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                              : exp.status === 'rejected'
                                ? 'bg-red-50 dark:bg-red-950/20 text-red-600'
                                : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600'
                            }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${exp.status === 'approved'
                                ? 'bg-emerald-500'
                                : exp.status === 'rejected'
                                  ? 'bg-red-500'
                                  : 'bg-amber-500'
                              }`}></span>
                            {exp.status.toUpperCase()}
                          </span>
                        </td>
                        {hasEditPermission && (
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isManager && exp.status === 'pending' && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleApprove(exp.id); }}
                                    className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer border-0 shadow-sm"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleReject(exp.id); }}
                                    className="px-2.5 py-1 text-xs font-bold bg-red-650 hover:bg-red-700 text-white rounded-lg cursor-pointer border-0 shadow-sm"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(exp); }}
                                className="h-9 w-9 flex items-center justify-center p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
                                title="Edit Expense"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }}
                                  className="h-9 w-9 flex items-center justify-center p-1 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
                                >
                                  <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {filteredExpenses.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400 min-w-[240px]">
                    Showing <span className="font-medium">{filteredExpenses.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredExpenses.length)}</span> of <span className="font-medium">{filteredExpenses.length}</span> records
                  </p>
                  <div className="flex justify-center flex-1"></div>
                  <div className="flex items-center gap-2 min-w-[240px] justify-end">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-1 py-1 border border-1 border-solid border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center text-slate-600 dark:text-slate-400"
                      title="Previous Page"
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>
                    {Array.from({ length: Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE) || Math.abs(p - currentPage) <= 1)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === '...' ? (
                          <span key={`ellipsis-${idx}`} className="px-2 py-1 text-sm text-slate-400">…</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setCurrentPage(item)}
                            className={`px-3 py-1 text-sm rounded transition-colors cursor-pointer ${currentPage === item
                              ? 'bg-primary text-white font-semibold'
                              : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                          >{item}</button>
                        )
                      )
                    }
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE)}
                      className="px-1 py-1 border border-1 border-solid border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center text-slate-600 dark:text-slate-400"
                      title="Next Page"
                    >
                      <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              <button
                onClick={handleCloseAddModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-0 bg-transparent cursor-pointer flex"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 font-bold text-[#ec1d22]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category *</label>
                  <SelectDropdown
                    label="Select Category"
                    options={dashboard.categories}
                    value={expenseForm.category}
                    onChange={handleCategoryChange}
                  />
                </div>
                {expenseForm.category && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subcategory *</label>
                    <SelectDropdown
                      label="Select Subcategory"
                      options={dashboard.subcategories[expenseForm.category] || []}
                      value={expenseForm.subcategory}
                      onChange={val => setExpenseForm(prev => ({ ...prev, subcategory: val }))}
                    />
                    {(dashboard.subcategories[expenseForm.category] || []).filter(s => s !== 'Other').length > 0 && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex flex-wrap gap-1 items-center">
                      </div>
                    )}
                  </div>
                )}
              </div>

              {expenseForm.subcategory === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subcategory Remarks *</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.sub_remarks}
                    onChange={e => setExpenseForm(prev => ({ ...prev, sub_remarks: e.target.value }))}
                    placeholder="E.g. Stationery purchase detail"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description / Purpose *</label>
                <textarea
                  required
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Purpose of transaction..."
                  rows="3"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl cursor-pointer border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md cursor-pointer border-0"
                >
                  {editingExpense ? 'Save Changes' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EOD Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Close EOD Ledger</h3>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-0 bg-transparent cursor-pointer flex"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCloseLedger} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Opening Balance:</span>
                  <span className="font-semibold">₹{dashboard.ledger.opening_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Today's Expenses:</span>
                  <span className="font-semibold text-[#ec1d22]">- ₹{dashboard.today_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">
                  <span>Net Ledger Balance:</span>
                  <span>₹{dashboard.current_balance.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Added Cash (Refill amount)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closeForm.added_cash}
                  onChange={e => setCloseForm(prev => ({ ...prev, added_cash: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Closing Notes / Remarks</label>
                <textarea
                  value={closeForm.notes}
                  onChange={e => setCloseForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="E.g. Ledger matches cash in drawer"
                  rows="3"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl cursor-pointer border-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md cursor-pointer border-0 bg-amber-600"
                >
                  Close Ledger
                </button>
              </div>
            </form>
          </div>
        </div>)}
      {/* Details Modal */}
      {isDetailsModalOpen && selectedExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">receipt_long</span>
                Expense Details
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsDetailsModalOpen(false)} className="px-2 pt-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer border-0 bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedExpense.date ? selectedExpense.date.split('-').reverse().join('-') : '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  <p className="font-medium text-sm">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${selectedExpense.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600' : selectedExpense.status === 'rejected' ? 'bg-red-50 dark:bg-red-950/20 text-red-600' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600'}`}>
                      {selectedExpense.status.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Submitted By</label>
                  <p className="text-sm flex items-start gap-2"><span className="font-medium text-slate-800 dark:text-slate-200">{selectedExpense.submitted_by}</span></p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Amount</label>
                  <p className="font-bold text-[#ec1d22] text-xl">₹{selectedExpense.amount.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedExpense.category}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sub Category</label>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedExpense.subcategory||'-'}</p>
                  {selectedExpense.sub_remarks && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Note: {selectedExpense.sub_remarks}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <p className="font-medium text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{selectedExpense.description || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PettyCash;
