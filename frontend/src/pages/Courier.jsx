import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { format } from 'date-fns';

const SelectDropdown = ({ label, options, value, onChange, direction = 'down', maxHeight = 'max-h-40', error, variant = 'default', icon, widthClass = 'w-full', menuWidthClass = 'w-full', disabled = false }) => {
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
				onClick={() => !disabled && setIsOpen(o => !o)}
				className={variant === 'filter'
					? `flex items-center justify-between gap-2 px-3 py-2 bg-[#eceef0] dark:bg-slate-800 border border-transparent rounded-lg text-sm transition-all outline-none focus:outline-none focus:ring-0 ${widthClass} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'} ${isOpen ? 'bg-white dark:bg-slate-900 shadow-sm' : ''}`
					: `flex items-center justify-between ${widthClass} px-3 py-2 text-sm rounded-xl border-none transition-all bg-slate-50 dark:bg-slate-800 font-medium outline-none focus:outline-none focus:ring-0 ${error ? 'ring-2 ring-red-500/20' : ''} ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60' : 'cursor-pointer'}`
				}
			>
				<div className="flex items-center gap-2 truncate">
					{icon && variant === 'filter' && <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>}
					<span className={variant === 'filter'
						? `truncate max-w-[120px] font-medium ${!value ? 'text-slate-500 dark:text-slate-400' : 'text-pink-600 dark:text-pink-400'}`
						: "text-slate-800 dark:text-slate-200 truncate"
					}>
						{(options.find(o => (o.value ?? o) === value) || {}).label || value || label}
					</span>
				</div>
				<span className={`material-symbols-outlined text-slate-400 ${variant === 'filter' ? 'text-base' : 'text-[18px] shrink-0 ml-1'} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
			</div>
			{isOpen && (
				<div className={`absolute left-0 ${menuWidthClass} bg-white dark:bg-slate-900 rounded-xl shadow-xl border-none z-[200] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${direction === 'up'
					? 'bottom-full mb-1.5 origin-bottom'
					: 'top-full mt-1.5 origin-top'
					}`}>
					<div className={`${maxHeight} overflow-y-auto custom-scrollbar px-1.5 py-0.5 space-y-0.5`}>
						{options.map(opt => (
							<div
								key={opt.value ?? opt}
								onClick={() => { onChange(opt.value ?? opt); setIsOpen(false); }}
								className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors font-medium ${(opt.value ?? opt) === value
									? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400'
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

const Courier = () => {
	const navigate = useNavigate();
	const { user, isAuthenticated, logout } = useAuth();
	const hasEditPermission = user?.email === 'admin@support.com' || user?.access === 'Edit';
	const isAdmin = user?.email === 'admin@support.com' || user?.role === 'Super admin' || user?.role === 'admin';

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

	// State
	const ITEMS_PER_PAGE = 20;
	const [currentPage, setCurrentPage] = useState(1);
	const [entries, setEntries] = useState([]);
	const [loading, setLoading] = useState(true);
	const [lookups, setLookups] = useState({
		departments: [],
		supplier_types: [],
		package_types: [],
		courier_names: [],
		budget_statuses: [],
		payment_modes: [],
		transaction_types: [],
		branches: []
	});

	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
	const [selectedCourier, setSelectedCourier] = useState(null);

	// Prevent background scrolling when details modal is open
	useEffect(() => {
		if (isDetailsModalOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'unset';
		}
		return () => { document.body.style.overflow = 'unset'; };
	}, [isDetailsModalOpen]);

	// Filters State
	const [filters, setFilters] = useState({
		search: '',
		dept: '',
		courier_name: '',
		from_date: '',
		to_date: '',
		budgeted: '',
		branch_id: '',
		trans_type: ''
	});

	// Date Picker
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [isDateFilterActive, setIsDateFilterActive] = useState(false);
	const [dateRange, setDateRange] = useState([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
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

	// Modal State
	const [showModal, setShowModal] = useState(false);
	const [editingEntry, setEditingEntry] = useState(null);
	const [successModal, setSuccessModal] = useState({ show: false, type: '', id: '' });

	// Form State
	const [formData, setFormData] = useState({
		date: new Date().toISOString().split('T')[0],
		transaction_type: 'Dispatch',
		sender: '',
		department: '',
		sending_from: '',
		receiver: '',
		receiver_office: '',
		supplier_buyer_type: 'Buyer',
		supplier_buyer_name: '',
		destination: '',
		product_description: '',
		package_type: '',
		num_packages: 1,
		order_related: 'NO',
		order_reference: '',
		budgeted: 'Non Budgeted',
		courier_name: '',
		awb_no: '',
		weight_kg: '',
		box_measurement: '',
		chargeable_weight: '',
		courier_cost: 0,
		payment_mode: '',
		remarks: '',
		branch_id: '',
		item: '',
		ref_type: 'PI'
	});

	// Load Lookup Data
	useEffect(() => {
		const fetchLookups = async () => {
			try {
				const res = await api.get('/api/courier/lookups');
				if (res.status === 200) {
					setLookups(res.data);
					if (res.data.branches && res.data.branches.length > 0) {
						setFormData(prev => ({ ...prev, branch_id: res.data.branches[0].id }));
					}
				}
			} catch (err) {
				console.error('Error fetching courier lookups:', err);
			}
		};
		fetchLookups();
	}, []);

	// Load Courier Entries
	const fetchEntries = async () => {
		setLoading(true);
		setCurrentPage(1);
		try {
			const params = new URLSearchParams();
			Object.keys(filters).forEach(key => {
				if (filters[key]) params.append(key, filters[key]);
			});
			const res = await api.get(`/api/courier/entries?${params.toString()}`);
			if (res.status === 200) {
				const filtered = isAdmin ? res.data : res.data.filter(e => e.creator_email === user?.email);
				setEntries(filtered);
			}
		} catch (err) {
			console.error('Error fetching courier entries:', err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchEntries();
	}, [filters]);

	// Handle Submit (Create/Update)
	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			const payload = { ...formData, creator_email: user?.email || '' };
			if (editingEntry) {
				const res = await api.put(`/api/courier/entries/${editingEntry.id}`, payload);
				if (res.status === 200) {
					fetchEntries();
					setShowModal(false);
					setEditingEntry(null);
					setSuccessModal({ show: true, type: 'Update', id: 'Courier Entry' });
				}
			} else {
				const res = await api.post('/api/courier/entries', payload);
				if (res.status === 201) {
					fetchEntries();
					setShowModal(false);
					setSuccessModal({ show: true, type: 'Add', id: 'Courier Entry' });
				}
			}
		} catch (err) {
			console.error('Error saving courier entry:', err);
			alert('Error saving entry, please check inputs');
		}
	};

	// Handle Delete
	const handleDelete = async (id) => {
		if (!window.confirm('Are you sure you want to delete this entry?')) return;
		try {
			const res = await api.delete(`/api/courier/entries/${id}`);
			if (res.status === 200) {
				fetchEntries();
			}
		} catch (err) {
			console.error('Error deleting courier entry:', err);
		}
	};

	// Open Modal for Add
	const handleOpenAdd = () => {
		setEditingEntry(null);
		setFormData({
			date: new Date().toISOString().split('T')[0],
			transaction_type: 'Dispatch',
			sender: '',
			department: lookups.departments[0] || '',
			sending_from: '',
			receiver: '',
			receiver_office: '',
			supplier_buyer_type: 'Buyer',
			supplier_buyer_name: '',
			destination: '',
			product_description: '',
			package_type: lookups.package_types[0] || '',
			num_packages: 1,
			order_related: 'NO',
			order_reference: '',
			budgeted: 'Non Budgeted',
			courier_name: lookups.courier_names[0] || '',
			awb_no: '',
			weight_kg: '',
			box_measurement: '',
			chargeable_weight: '',
			courier_cost: 0,
			payment_mode: '',
			remarks: '',
			branch_id: '',
			item: '',
			ref_type: 'PI'
		});
		setShowModal(true);
	};

	// Open Modal for Edit
	const handleRowClick = (entry) => {
		setSelectedCourier(entry);
		setIsDetailsModalOpen(true);
	};

	const handleOpenEdit = (entry) => {
		setEditingEntry(entry);
		setFormData({
			date: entry.date,
			transaction_type: entry.transaction_type,
			sender: entry.sender || '',
			department: entry.department || '',
			sending_from: entry.sending_from || '',
			receiver: entry.receiver || '',
			receiver_office: entry.receiver_office || '',
			supplier_buyer_type: entry.supplier_buyer_type || '',
			supplier_buyer_name: entry.supplier_buyer_name || '',
			destination: entry.destination || '',
			product_description: entry.product_description || '',
			package_type: entry.package_type || '',
			num_packages: entry.num_packages || 1,
			order_related: entry.order_related || 'NO',
			order_reference: entry.order_reference || '',
			budgeted: entry.budgeted || 'Non Budgeted',
			courier_name: entry.courier_name || '',
			awb_no: entry.awb_no || '',
			weight_kg: entry.weight_kg !== null ? entry.weight_kg : '',
			box_measurement: entry.box_measurement || '',
			chargeable_weight: entry.chargeable_weight !== null ? entry.chargeable_weight : '',
			courier_cost: entry.courier_cost || 0,
			payment_mode: entry.payment_mode || '',
			remarks: entry.remarks || '',
			branch_id: entry.branch_id || '',
			item: entry.item || '',
			ref_type: entry.ref_type || 'PI'
		});
		setShowModal(true);
	};

	// Quick stats
	const totalCost = entries.reduce((acc, c) => acc + (c.courier_cost || 0), 0);
	const dispatches = entries.filter(c => c.transaction_type === 'Dispatch').length;
	const pickups = entries.filter(c => c.transaction_type === 'Pickup' || c.transaction_type === 'Drop').length;

	return (
		<div className="font-display bg-background-light dark:bg-[#181D27] text-slate-900 dark:text-[#f0f0f2] min-h-screen flex flex-col">
			{/* Header bar */}
			<div className="sticky top-0 z-40 flex items-center justify-between gap-5 px-20 py-4 bg-white dark:bg-[#1C212B] border-b border-pink-500/20 dark:border-opacity-30 shrink-0">
				<div className="flex items-center gap-5">
					<button
						onClick={() => navigate('/')}
						className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border-none shadow-sm"
					>
						<span className="material-symbols-outlined text-sm">arrow_back</span>
					</button>
					<div>
						<div className="flex items-center gap-2.5">
							<div className="h-10 w-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
								<span className="material-symbols-outlined text-2xl">local_shipping</span>
							</div>
							<div>
								<h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">Courier Register</h1>
								<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Track incoming and outgoing shipments and costs</p>
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<button
						onClick={handleOpenAdd}
						className="flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer border-0 text-sm"
					>
						<span className="material-symbols-outlined text-lg">add</span>
						Add Courier
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
			<div className="flex-1 overflow-y-auto px-20 py-6 space-y-6">

				{/* Statistics section */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
					<div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Shipments</p>
						<h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{entries.length}</h3>
					</div>
					<div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cost</p>
						<h3 className="text-3xl font-extrabold text-pink-600 dark:text-pink-400 mt-2">₹{totalCost.toFixed(2)}</h3>
					</div>
					<div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dispatches</p>
						<h3 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-2">{dispatches}</h3>
					</div>
					<div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pickups & Drops</p>
						<h3 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">{pickups}</h3>
					</div>
				</div>

				{/* Filters Section */}
				<div className="flex items-center justify-between">
					{/* Search */}
					<div className="relative flex-1 max-w-md">
						<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
						<input
							type="text"
							placeholder="Search awb, sender, receiver..."
							value={filters.search}
							onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
							className="w-full pl-10 pr-4 py-2.5 bg-[#eceef0] dark:bg-slate-800 border-none rounded-lg text-sm outline-none focus:outline-none focus:ring-0"
						/>
					</div>

					<div className="flex items-center gap-2 mx-4 flex-wrap justify-end">
						{/* Branch */}
						<SelectDropdown
							variant="filter"
							icon="domain"
							widthClass="w-50"
							label="All Branches"
							value={filters.branch_id}
							onChange={val => setFilters(prev => ({ ...prev, branch_id: val }))}
							options={[
								{ label: 'All Branches', value: '' },
								...lookups.branches.map(b => ({ label: b.name, value: b.id }))
							]}
						/>

						{/* Transaction Type */}
						<SelectDropdown
							variant="filter"
							icon="swap_horiz"
							widthClass="w-40"
							label="All Types"
							value={filters.trans_type}
							onChange={val => setFilters(prev => ({ ...prev, trans_type: val }))}
							options={[
								{ label: 'All Types', value: '' },
								{ label: 'Dispatch', value: 'Dispatch' },
								{ label: 'Pickup', value: 'Pickup' },
								{ label: 'Drop', value: 'Drop' }
							]}
						/>

						{/* Department */}
						<SelectDropdown
							variant="filter"
							icon="business"
							widthClass="w-40"
							label="All Depts"
							value={filters.dept}
							onChange={val => setFilters(prev => ({ ...prev, dept: val }))}
							options={[
								{ label: 'All Depts', value: '' },
								...lookups.departments.map(d => ({ label: d, value: d }))
							]}
						/>

						{/* Budgeted */}
						<SelectDropdown
							variant="filter"
							icon="account_balance_wallet"
							widthClass="w-40"
							label="All Budgets"
							value={filters.budgeted}
							onChange={val => setFilters(prev => ({ ...prev, budgeted: val }))}
							options={[
								{ label: 'All Budgets', value: '' },
								{ label: 'Budgeted', value: 'Budgeted' },
								{ label: 'Non Budgeted', value: 'Non Budgeted' }
							]}
						/>

						{/* Date Range */}
						<div className="relative" ref={datePickerRef}>
							<button
								onClick={() => setShowDatePicker(!showDatePicker)}
								aria-label="Toggle date filter"
								title="Date Range Filter"
								className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors shadow-sm relative ${isDateFilterActive || showDatePicker
										? 'bg-pink-600 text-white border-pink-600'
										: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
									}`}
							>
								<span className="material-symbols-outlined text-[20px]">calendar_today</span>
								{isDateFilterActive && (
									<span className="absolute -top-1 -right-1 flex h-3 w-3">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
										<span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500 border-2 border-white dark:border-slate-900"></span>
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
												from_date: format(item.selection.startDate, 'yyyy-MM-dd'),
												to_date: format(item.selection.endDate, 'yyyy-MM-dd')
											}));
										}}
										moveRangeOnFirstSelection={false}
										months={2}
										ranges={dateRange}
										direction="horizontal"
										rangeColors={['#db2777']}
										staticRanges={[]}
										inputRanges={[]}
									/>
									<div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
										<button
											onClick={() => {
												setIsDateFilterActive(false);
												setDateRange([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
												setFilters(prev => ({ ...prev, from_date: '', to_date: '' }));
												setShowDatePicker(false);
											}}
											className="px-4 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
										>
											Clear
										</button>
										<button
											onClick={() => setShowDatePicker(false)}
											className="px-4 py-1.5 text-sm font-medium bg-pink-600 text-white hover:bg-pink-700 rounded-lg transition-colors"
										>
											Apply
										</button>
									</div>
								</div>
							)}
						</div>

						{/* Clear Filters */}
						{(filters.search !== '' || filters.dept !== '' || filters.trans_type !== '' || filters.branch_id !== '' || filters.budgeted !== '' || isDateFilterActive) && (
							<button
								onClick={() => {
									setFilters({
										search: '',
										dept: '',
										courier_name: '',
										from_date: '',
										to_date: '',
										budgeted: '',
										branch_id: '',
										trans_type: ''
									});
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

				{/* Table list of entries */}
				<div className="bg-white dark:bg-[#1C212B] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[calc(100vh-10px)] max-h-[calc(100vh-10px)]">
					{loading ? (
						<div className="p-20 text-center text-slate-500">
							<span className="material-symbols-outlined text-4xl animate-spin text-pink-500 mb-2">progress_activity</span>
							<p>Loading shipments...</p>
						</div>
					) : entries.length === 0 ? (
						<div className="p-20 text-center text-slate-500">
							<span className="material-symbols-outlined text-4xl text-slate-300 mb-2">local_shipping</span>
							<p>No shipments matched your filters.</p>
						</div>
					) : (
						<>
							<div className="overflow-auto flex-1 custom-scrollbar">
								<table className="w-full text-left border-collapse text-sm">
									<thead className="sticky top-0 z-10 bg-[#eceef0] dark:bg-slate-800 shadow-sm">
										<tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold whitespace-nowrap">
											<th className="p-4 w-16">#</th>
											<th className="p-4">Date</th>
											<th className="p-4">Branch</th>
											<th className="p-4">Type</th>
											<th className="p-4">Department</th>
											<th className="p-4">From Name</th>
											<th className="p-4">From Loc</th>
											<th className="p-4">To Name</th>
											<th className="p-4">To Loc</th>
											<th className="p-4">Item</th>
											<th className="p-4">Ref Type</th>
											<th className="p-4">Supplier / Buyer</th>
											<th className="p-4">Courier Operator</th>
											<th className="p-4">Tracking Number</th>
											{isAdmin && (
												<>
													<th className="p-4">To Office</th>
													<th className="p-4">Product Desc</th>
													<th className="p-4">Package Type</th>
													<th className="p-4">No. of Pkgs</th>
													<th className="p-4">Order Ref</th>
													<th className="p-4">Budgeted</th>
													<th className="p-4">Weight (Kg)</th>
													<th className="p-4">Box Measurement</th>
													<th className="p-4">Chargeable Wt</th>
													<th className="p-4">Cost (INR)</th>
													<th className="p-4">Payment Mode</th>
													<th className="p-4">Remarks</th>
												</>
											)}
											{hasEditPermission && <th className="p-4 text-right font-semibold">Actions</th>}
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{entries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((entry, index) => (
											<tr key={entry.id} onClick={() => handleRowClick(entry)} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors cursor-pointer whitespace-nowrap">
												<td className="px-4 py-2 font-medium text-slate-500">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
												<td className="px-4 py-2 font-medium">{entry.date}</td>
												<td className="px-4 py-2">
													<div className="font-semibold text-slate-700 dark:text-slate-300">
														{lookups.branches?.find(b => b.id === entry.branch_id)?.name || entry.branch_name || '-'}
													</div>
												</td>
												<td className="px-4 py-2">
													<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${entry.transaction_type === 'Dispatch'
															? 'bg-blue-550/10 text-blue-600'
															: 'bg-emerald-550/10 text-emerald-600'
														}`}>
														{entry.transaction_type}
													</span>
												</td>
												<td className="px-4 py-2">{entry.department || '-'}</td>
												<td className="px-4 py-2 font-semibold text-slate-900 dark:text-white">{entry.sender || '-'}</td>
												<td className="px-4 py-2">{entry.sending_from || '-'}</td>
												<td className="px-4 py-2 font-semibold text-slate-900 dark:text-white">{entry.receiver || '-'}</td>
												<td className="px-4 py-2">{entry.destination || '-'}</td>
												<td className="px-4 py-2">{entry.item || '-'}</td>
												<td className="px-4 py-2">{entry.ref_type || '-'}</td>
												<td className="px-4 py-2">{entry.supplier_buyer_type ? `${entry.supplier_buyer_type}: ${entry.supplier_buyer_name || ''}` : '-'}</td>
												<td className="px-4 py-2 font-semibold text-slate-900 dark:text-white">{entry.courier_name || '-'}</td>
												<td className="px-4 py-2 font-mono">{entry.awb_no || '-'}</td>
												{isAdmin && (
													<>
														<td className="px-4 py-2">{entry.receiver_office || '-'}</td>
														<td className="px-4 py-2">{entry.product_description || '-'}</td>
														<td className="px-4 py-2">{entry.package_type || '-'}</td>
														<td className="px-4 py-2">{entry.num_packages || '-'}</td>
														<td className="px-4 py-2">{entry.order_reference || '-'}</td>
														<td className="px-4 py-2">{entry.budgeted || '-'}</td>
														<td className="px-4 py-2">{entry.weight_kg || '-'}</td>
														<td className="px-4 py-2">{entry.box_measurement || '-'}</td>
														<td className="px-4 py-2">{entry.chargeable_weight || '-'}</td>
														<td className="px-4 py-2 font-bold text-pink-600 dark:text-pink-400">₹{(entry.courier_cost || 0).toFixed(2)}</td>
														<td className="px-4 py-2">{entry.payment_mode || '-'}</td>
														<td className="px-4 py-2 max-w-[200px] truncate" title={entry.remarks}>{entry.remarks || '-'}</td>
													</>
												)}
												{hasEditPermission && (
													<td className="px-4 py-2 text-right">
														<div className="flex items-center justify-end gap-2">
															<button
																onClick={(e) => { e.stopPropagation(); handleOpenEdit(entry); }}
																className="h-9 w-9 flex items-center justify-center p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
															>
																<span className="material-symbols-outlined text-lg">edit</span>
															</button>
															<button
																onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
																className="h-9 w-9 flex items-center justify-center p-1 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
															>
																<span className="material-symbols-outlined text-lg">delete</span>
															</button>
														</div>
													</td>
												)}
											</tr>
										))}
									</tbody>
								</table>
							</div>
							{/* Pagination Controls */}
							{entries.length > 0 && (
								<div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
									<p className="text-sm text-slate-500 dark:text-slate-400 min-w-[240px]">
										Showing <span className="font-medium">{entries.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, entries.length)}</span> of <span className="font-medium">{entries.length}</span> records
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
										{Array.from({ length: Math.ceil(entries.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
											.filter(p => p === 1 || p === Math.ceil(entries.length / ITEMS_PER_PAGE) || Math.abs(p - currentPage) <= 1)
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
											onClick={() => setCurrentPage(p => Math.min(Math.ceil(entries.length / ITEMS_PER_PAGE), p + 1))}
											disabled={currentPage >= Math.ceil(entries.length / ITEMS_PER_PAGE)}
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

			{/* Add / Edit Form Modal */}
			{showModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
					<div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-6 flex flex-col max-h-[90vh]">
						<div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
							<h3 className="text-xl font-bold text-slate-900 dark:text-white">
								{editingEntry ? 'Edit Courier' : 'Add Courier'}
							</h3>
							<button
								onClick={() => setShowModal(false)}
								className=" w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-0 bg-slate-100 dark:bg-slate-800 cursor-pointer flex items-center justify-center"
							>
								<span className="material-symbols-outlined text-xl">close</span>
							</button>
						</div>

						<form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Date */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date *</label>
									<input
										type="date"
										required
										value={formData.date}
										onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
										className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
									/>
								</div>

								{/* Branch */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Branch *</label>
									<SelectDropdown
										label="Select Branch"
										options={[
											{ label: 'Cotton Concepts HO_ Coimbatore', value: 'Cotton Concepts HO_ Coimbatore' },
											{ label: 'Doctor Towels HO', value: 'Doctor Towels HO' },
											{ label: 'Cotton Concepts_ Vengamedu', value: 'Cotton Concepts_ Vengamedu' },
											{ label: 'Cotton Concepts_ Karur', value: 'Cotton Concepts_ Karur' },
											{ label: 'Doctor Towels_ Karur', value: 'Doctor Towels_ Karur' }
										]}
										value={formData.branch_id}
										onChange={val => setFormData(prev => ({ ...prev, branch_id: val }))}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Transaction Type */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transaction Type</label>
									<SelectDropdown
										label="Transaction Type"
										options={[
											{ label: 'Dispatch', value: 'Dispatch' },
											{ label: 'Pickup', value: 'Pickup' },
											{ label: 'Drop', value: 'Drop' }
										]}
										value={formData.transaction_type}
										onChange={val => setFormData(prev => ({ ...prev, transaction_type: val }))}
									/>
								</div>

								{/* Department */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
									<SelectDropdown
										label="Select Department"
										options={lookups.departments.map(d => ({ label: d, value: d }))}
										value={formData.department}
										onChange={val => setFormData(prev => ({ ...prev, department: val }))}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Sender */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From Name</label>
									<input
										type="text"
										value={formData.sender}
										onChange={e => setFormData(prev => ({ ...prev, sender: e.target.value }))}
										placeholder="E.g. Ram Kumar"
										className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
									/>
								</div>

								{/* Receiver */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To Name</label>
									<input
										type="text"
										value={formData.receiver}
										onChange={e => setFormData(prev => ({ ...prev, receiver: e.target.value }))}
										placeholder="E.g. Gopal"
										className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Sending From */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From Location</label>
									<input
										type="text"
										value={formData.sending_from}
										onChange={e => setFormData(prev => ({ ...prev, sending_from: e.target.value }))}
										placeholder="Office / Location"
										className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
									/>
								</div>

								{/* Destination */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To Location</label>
									<input
										type="text"
										value={formData.destination}
										onChange={e => setFormData(prev => ({ ...prev, destination: e.target.value }))}
										placeholder="City / Country"
										className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Item */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Item</label>
									<input
										type="text"
										value={formData.item}
										onChange={e => setFormData(prev => ({ ...prev, item: e.target.value }))}
										placeholder="Item description"
										className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
									/>
								</div>

								{/* Ref Type */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ref Type</label>
									<div className="flex gap-2">
										<div className="w-[80px] shrink-0">
											<SelectDropdown
												label="Ref Type"
												options={[
													{ label: 'PI', value: 'PI' },
													{ label: 'SO', value: 'SO' },
													{ label: 'ENQ', value: 'ENQ' },
													{ label: 'SAMPLE REF', value: 'SAMPLE REF' },
													{ label: 'OTHERS', value: 'OTHERS' }
												]}
												value={formData.ref_type}
												onChange={val => setFormData(prev => ({ ...prev, ref_type: val }))}
												menuWidthClass="w-[150px]"
											/>
										</div>
										<div className="flex-1">
											<input
												type="text"
												value={formData.order_reference}
												onChange={e => setFormData(prev => ({ ...prev, order_reference: e.target.value }))}
												placeholder={formData.ref_type || 'Reference'}
												className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 font-medium"
											/>
										</div>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Supplier/Buyer */}
								<div className="md:col-span-2">
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Supplier / Buyer</label>
									<div className="flex gap-2">
										<div className="w-[120px] shrink-0">
											<SelectDropdown
												label="Type"
												options={[
													{ label: 'Buyer', value: 'Buyer' },
													{ label: 'Supplier', value: 'Supplier' }
												]}
												value={formData.supplier_buyer_type}
												onChange={val => setFormData(prev => ({ ...prev, supplier_buyer_type: val }))}
												menuWidthClass="w-[150px]"
											/>
										</div>
										<div className="flex-1">
											<input
												type="text"
												value={formData.supplier_buyer_name}
												onChange={e => setFormData(prev => ({ ...prev, supplier_buyer_name: e.target.value }))}
												placeholder={formData.supplier_buyer_type || 'Name'}
												className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 font-medium"
											/>
										</div>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Courier Name */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Courier Operator</label>
									<SelectDropdown
										label="Courier Operator"
										options={[
											{ label: 'DTDC Courier', value: 'DTDC Courier' },
											{ label: 'RK Courier', value: 'RK Courier' },
											{ label: 'NEW Logistics', value: 'NEW Logistics' },
											{ label: 'Air Cargo', value: 'Air Cargo' }
										]}
										value={formData.courier_name}
										onChange={val => setFormData(prev => ({ ...prev, courier_name: val }))}
										disabled={!isAdmin}
									/>
								</div>

								{/* AWB No */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">AWB / Tracking Number</label>
									<input
										type="text"
										value={formData.awb_no}
										onChange={e => setFormData(prev => ({ ...prev, awb_no: e.target.value }))}
										placeholder="Tracking tag code"
										disabled={!isAdmin}
										className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
									/>
								</div>
							</div>

							{isAdmin && (
								<>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{/* Cost */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cost (INR)</label>
											<input
												type="number"
												step="0.01"
												value={formData.courier_cost}
												onChange={e => setFormData(prev => ({ ...prev, courier_cost: e.target.value }))}
												className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 font-bold text-pink-600"
											/>
										</div>

										{/* Budget status */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Budgeted status</label>
											<SelectDropdown
												label="Budgeted status"
												options={[
													{ label: 'Non Budgeted', value: 'Non Budgeted' },
													{ label: 'Budgeted', value: 'Budgeted' }
												]}
												value={formData.budgeted}
												onChange={val => setFormData(prev => ({ ...prev, budgeted: val }))}
											/>
										</div>

										{/* Payment Mode */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Mode</label>
											<SelectDropdown
												label="Payment Mode"
												options={[
													{ label: 'Net Banking', value: 'Net Banking' },
													{ label: 'Cash', value: 'Cash' }
												]}
												value={formData.payment_mode}
												onChange={val => setFormData(prev => ({ ...prev, payment_mode: val }))}
											/>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
										{/* Package Type */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Package Type</label>
											<SelectDropdown
												label="Package Type"
												options={[
													{ label: 'Cover', value: 'Cover' },
													{ label: 'Box', value: 'Box' }
												]}
												value={formData.package_type}
												onChange={val => setFormData(prev => ({ ...prev, package_type: val }))}
											/>
										</div>

										{/* Number of packages */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Number of Packages</label>
											<input
												type="text"
												value={formData.num_packages}
												onChange={e => setFormData(prev => ({ ...prev, num_packages: e.target.value }))}
												placeholder="E.g. 5"
												className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
											/>
										</div>

										{/* Weight */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Weight (Kg)</label>
											<input
												type="text"
												value={formData.weight_kg}
												onChange={e => setFormData(prev => ({ ...prev, weight_kg: e.target.value }))}
												placeholder="E.g. 10.5"
												className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
											/>
										</div>
									</div>

									{/* Product description */}
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product Description</label>
										<input
											type="text"
											value={formData.product_description}
											onChange={e => setFormData(prev => ({ ...prev, product_description: e.target.value }))}
											placeholder="E.g. Cotton Fabrics Sample Box"
											className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0"
										/>
									</div>

									{/* Remarks */}
									<div>
										<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks</label>
										<textarea
											value={formData.remarks}
											onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
											placeholder="Additional shipment logs or notes"
											rows="2"
											className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 resize-none"
										></textarea>
									</div>
								</>
							)}

							{/* Footer buttons */}
							<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
								<button
									type="button"
									onClick={() => setShowModal(false)}
									className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold rounded-xl cursor-pointer border-0"
								>
									Cancel
								</button>
								<button
									type="submit"
									className="px-6 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-md cursor-pointer border-0"
								>
									Save
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{/* Details Modal */}
			{isDetailsModalOpen && selectedCourier && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsDetailsModalOpen(false)}>
					<div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
						<div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
							<h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
								<span className="material-symbols-outlined text-pink-600">local_shipping</span>
								Courier Details
							</h2>
							<div className="flex items-center gap-2">
								<button onClick={() => setIsDetailsModalOpen(false)} className="px-2 pt-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer border-0 bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white">
									<span className="material-symbols-outlined">close</span>
								</button>
							</div>
						</div>
						<div className="p-8 space-y-6">
							<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Date</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.date}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Type</label>
									<p className="font-medium text-sm">
										<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${selectedCourier.transaction_type === 'Dispatch' ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'}`}>
											{selectedCourier.transaction_type}
										</span>
									</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">From Name</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.sender || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dept</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.department || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">From Location</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.sending_from || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">To Name</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.receiver || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">To Location</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.destination || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Product</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.product_description || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Courier</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.courier_name || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">AWB No</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.awb_no || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Branch</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{lookups.branches?.find(b => b.id === selectedCourier.branch_id)?.name || selectedCourier.branch_name || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Wt(Kg)</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.weight_kg || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cost(₹)</label>
									<p className="font-bold text-pink-600 text-sm">₹{(selectedCourier.courier_cost || 0).toFixed(2)}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Budget</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.budgeted || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Item</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.item || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ref Type</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.ref_type || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{selectedCourier.ref_type || 'Reference'} Value</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.order_reference || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Package Type</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.package_type || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Supplier/Buyer</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.supplier_buyer_type ? `${selectedCourier.supplier_buyer_type}: ${selectedCourier.supplier_buyer_name || '-'}` : '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">No. of Packages</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.num_packages || '-'}</p>
								</div>
								
								<div className="col-span-2 md:col-span-3 lg:col-span-3">
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Remarks</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">{selectedCourier.remarks || 'None'}</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
			{/* SUCCESS MODAL CARD */}
			{successModal.show && (
				<div className="fixed inset-0 bg-slate-955/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSuccessModal({ ...successModal, show: false })}>
					<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 flex flex-col items-center" onClick={e => e.stopPropagation()}>
						<div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mb-4 border border-emerald-200 shadow-md">
							<span className="material-symbols-outlined text-[36px]">check_circle</span>
						</div>
						<h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{successModal.type === 'Add' ? 'Added Successfully' : 'Update Successful'}</h3>
						<p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
							<strong className="text-slate-700 dark:text-slate-300 font-semibold">{successModal.id}</strong> has been {successModal.type === 'Add' ? 'added' : 'updated'} successfully.
						</p>
						<button
							onClick={() => setSuccessModal({ ...successModal, show: false })}
							className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] cursor-pointer text-sm"
						>
							Okay, Got it
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default Courier;
