import React, { useState, useEffect, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const formatBranch = (val) => {
	if (!val) return '';
	return String(val).replace(/_\s*/g, ', ');
};

const SelectDropdown = ({ label, options, value, onChange, direction = 'down', maxHeight = 'max-h-60', error, variant = 'default', icon, widthClass = 'w-full', menuWidthClass, disabled = false }) => {
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
				<div className={`absolute left-0 ${menuWidthClass || 'min-w-full w-max'} bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-[200] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${direction === 'up'
					? 'bottom-full mb-1.5 origin-bottom'
					: 'top-full mt-1.5 origin-top'
					}`}>
					<div className={`${maxHeight} overflow-y-auto custom-scrollbar px-1.5 py-0.5 space-y-0.5`}>
						{options.map(opt => (
							<div
								key={opt.value ?? opt}
								onClick={() => { onChange(opt.value ?? opt); setIsOpen(false); }}
								className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors font-medium whitespace-nowrap ${(opt.value ?? opt) === value
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

// Branch + flyout dropdown: shows first 5 branches directly, "Others" on hover reveals all locations in a flyout
// Branch + flyout dropdown: shows first 5 branches directly, "Others" on hover reveals all locations in a flyout
const BranchWithFlyoutDropdown = ({ label, branches = [], locations = [], value, onChange, direction = 'down', error, disabled = false, flyoutPosition, disabledValue }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [showFlyout, setShowFlyout] = useState(false);
	const [flyoutSide, setFlyoutSide] = useState(flyoutPosition || 'right'); // 'left' or 'right'
	const ref = useRef(null);
	const othersRef = useRef(null);
	const flyoutTimer = useRef(null);

	useEffect(() => {
		const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setIsOpen(false); setShowFlyout(false); } };
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, []);

	// Decide flyout side based on prop or available screen space
	const handleOthersEnter = () => {
		clearTimeout(flyoutTimer.current);
		if (flyoutPosition) {
			setFlyoutSide(flyoutPosition);
		} else if (othersRef.current) {
			const rect = othersRef.current.getBoundingClientRect();
			const spaceRight = window.innerWidth - rect.right;
			setFlyoutSide(spaceRight < 220 ? 'left' : 'right');
		}
		setShowFlyout(true);
	};
	const handleOthersLeave = () => {
		flyoutTimer.current = setTimeout(() => setShowFlyout(false), 120);
	};
	const handleFlyoutEnter = () => clearTimeout(flyoutTimer.current);
	const handleFlyoutLeave = () => {
		flyoutTimer.current = setTimeout(() => setShowFlyout(false), 120);
	};

	const visibleBranches = branches.slice(0, 5);
	const displayLabel = value ? formatBranch(value) : label;

	return (
		<div className="relative" ref={ref}>
			<div
				onClick={() => !disabled && setIsOpen(o => !o)}
				className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-xl border-none transition-all bg-slate-50 dark:bg-slate-800 font-medium outline-none focus:outline-none focus:ring-0 ${error ? 'ring-2 ring-red-500/50 bg-red-50/20 dark:bg-red-900/10' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
			>
				<span className={!value ? "text-slate-400 dark:text-slate-500 truncate font-normal" : "text-slate-800 dark:text-slate-200 truncate"}>{displayLabel}</span>
				<span className={`material-symbols-outlined text-slate-400 text-[18px] shrink-0 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
			</div>
			{isOpen && (
				<div className={`absolute left-0 min-w-full w-max bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-[200] py-1.5 overflow-visible animate-in fade-in zoom-in-95 duration-150 ${direction === 'up' ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'}`}>
					<div className="px-1.5 py-0.5 space-y-0.5">
						{/* First 5 branches */}
						{visibleBranches.map(b => {
							const formattedName = formatBranch(b.name);
							const isDisabled = disabledValue && (b.name === disabledValue || formattedName === disabledValue);
							return (
								<div
									key={b.id ?? b.name}
									onClick={() => { if (!isDisabled) { onChange(formattedName); setIsOpen(false); setShowFlyout(false); } }}
									title={isDisabled ? 'Already selected in the other field' : ''}
									className={`px-3 py-2 rounded-lg text-sm transition-colors font-medium whitespace-nowrap flex items-center justify-between ${
										isDisabled
											? 'opacity-40 cursor-not-allowed text-slate-500 dark:text-slate-500'
											: (b.name === value || formattedName === value)
												? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 cursor-pointer'
												: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
									}`}
								>
									<span>{formattedName}</span>
									{isDisabled && <span className="material-symbols-outlined text-[14px] opacity-50">block</span>}
								</div>
							);
						})}

						{/* Others — hover to show flyout with all locations */}
						{locations.length > 0 && (
							<div className="relative" ref={othersRef} onMouseEnter={handleOthersEnter} onMouseLeave={handleOthersLeave}>
								<div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors font-medium whitespace-nowrap ${locations.some(l => l.name === value || formatBranch(l.name) === value) ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
									{flyoutSide === 'left' && <span className="material-symbols-outlined text-[14px] mr-2 opacity-60">chevron_left</span>}
									<span className="flex-1">Others</span>
									{flyoutSide !== 'left' && <span className="material-symbols-outlined text-[14px] ml-2 opacity-60">chevron_right</span>}
								</div>

								{/* Flyout panel */}
								{showFlyout && (
									<div
										onMouseEnter={handleFlyoutEnter}
										onMouseLeave={handleFlyoutLeave}
										style={{ top: 0, ...(flyoutSide === 'right' ? { left: '100%', marginLeft: '4px' } : { right: '100%', marginRight: '4px' }) }}
										className={`absolute min-w-56 w-max bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[300] py-1.5 animate-in fade-in ${flyoutSide === 'left' ? 'slide-in-from-right-2' : 'slide-in-from-left-2'} duration-150`}
									>
										<div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Locations</div>
										<div className="max-h-52 overflow-y-auto custom-scrollbar px-1.5 space-y-0.5 pb-1">
											{locations.map(loc => {
												const formattedLocName = formatBranch(loc.name);
												const isLocDisabled = disabledValue && (loc.name === disabledValue || formattedLocName === disabledValue);
												return (
													<div
														key={loc.name}
														onClick={() => { if (!isLocDisabled) { onChange(formattedLocName); setIsOpen(false); setShowFlyout(false); } }}
														title={isLocDisabled ? 'Already selected in the other field' : ''}
														className={`px-3 py-2 rounded-lg text-sm transition-colors font-medium whitespace-nowrap flex items-center justify-between ${
															isLocDisabled
																? 'opacity-40 cursor-not-allowed text-slate-500 dark:text-slate-500'
																: (loc.name === value || formattedLocName === value)
																	? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 cursor-pointer'
																	: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
														}`}
													>
														<span>{formattedLocName}</span>
														{isLocDisabled && <span className="material-symbols-outlined text-[14px] opacity-50">block</span>}
													</div>
												);
											})}
										</div>
									</div>
								)}
							</div>
						)}

						{visibleBranches.length === 0 && locations.length === 0 && (
							<div className="px-3 py-4 text-sm text-slate-400 text-center">No options available</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

const Courier = () => {
	const navigate = useNavigate();
	const { user, isAuthenticated, logout } = useAuth();
	const isSuperAdmin = user?.email === 'admin@support.com' || user?.role === 'Super admin';
	const isAdmin = isSuperAdmin || user?.role === 'admin';
	const hasAddPermission = isAdmin || (typeof user?.access === 'string' ? (user.access.includes('View') || user.access.includes('Edit') || user.access.includes('Add')) : Array.isArray(user?.access) ? (user.access.includes('View') || user.access.includes('Edit') || user.access.includes('Add')) : true);
	const hasEditPermission = isAdmin || (typeof user?.access === 'string' ? user.access.includes('Edit') : Array.isArray(user?.access) ? user.access.includes('Edit') : user?.access === 'Edit');
	const hasDeletePermission = isAdmin || (typeof user?.access === 'string' ? user.access.includes('Delete') : Array.isArray(user?.access) ? user.access.includes('Delete') : user?.access === 'Delete');

	const canEditEntry = (entry) => {
		return hasEditPermission;
	};

	const canDeleteEntry = (entry) => {
		return hasDeletePermission;
	};

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
		branches: [],
		locations: [],
		from_locations: [],
		to_locations: []
	});

	const allowedBranches = React.useMemo(() => {
		const allBranches = lookups.branches || [];
		if (isSuperAdmin || !user?.branch || user.branch === 'All') {
			return allBranches;
		}
		const rawBranchStr = user.branch || '';
		const userBranches = rawBranchStr.includes('|')
			? rawBranchStr.split('|').map(b => formatBranch(b.trim())).filter(Boolean)
			: [formatBranch(rawBranchStr.trim())].filter(Boolean);

		const matched = allBranches.filter(b => {
			const bName = formatBranch(b?.name || b).toLowerCase().trim();
			return userBranches.some(ub => {
				const ubName = formatBranch(ub).toLowerCase().trim();
				return bName === ubName || bName.includes(ubName) || ubName.includes(bName);
			});
		});

		return matched.length > 0 ? matched : userBranches.map(ub => ({ id: ub, name: ub }));
	}, [user?.branch, isSuperAdmin, lookups.branches]);

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
	const [deleteModal, setDeleteModal] = useState({ show: false, entry: null });

	// Handle Delete Click (Open Modal)
	const handleDeleteClick = (entry) => {
		setDeleteModal({ show: true, entry });
	};

	// Confirm Delete Handler
	const confirmDelete = async () => {
		if (!deleteModal.entry) return;
		try {
			const res = await api.delete(`/api/courier/entries/${deleteModal.entry.id}`);
			if (res.status === 200) {
				fetchEntries();
				setDeleteModal({ show: false, entry: null });
				setSuccessModal({ show: true, type: 'Delete', id: 'Courier Entry' });
			}
		} catch (err) {
			console.error('Error deleting courier entry:', err);
			alert('Error deleting entry');
		}
	};

	// Form State
	const [formErrors, setFormErrors] = useState({});
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
		branch_name: '',
		item: '',
		ref_type: 'PI'
	});

	const branchOptions = React.useMemo(() => {
		const list = allowedBranches.map(b => ({ label: formatBranch(b.name), value: formatBranch(b.name) }));
		if (formData.branch_name && !list.some(o => o.value === formatBranch(formData.branch_name))) {
			list.unshift({ label: formatBranch(formData.branch_name), value: formatBranch(formData.branch_name) });
		}
		return list;
	}, [allowedBranches, formData.branch_name]);

	// Load Lookup Data
	useEffect(() => {
		const fetchLookups = async () => {
			try {
				const res = await api.get('/api/courier/lookups');
				if (res.status === 200) {
					const cleanedBranches = (res.data.branches || []).map(b => ({ ...b, name: formatBranch(b.name) }));
					const cleanedLocations = (res.data.locations || []).map(l => ({ ...l, name: formatBranch(l.name) }));
					setLookups({
						...res.data,
						branches: cleanedBranches,
						locations: cleanedLocations
					});
					const firstBranchName = cleanedBranches[0]?.name || cleanedLocations[0]?.name || '';
					setFormData(prev => ({
						...prev,
						branch_id: firstBranchName,
						branch_name: prev.branch_name || firstBranchName
					}));
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
				const allowedCourierAccess = (user?.courier_users || '')
					.split(',')
					.map(s => s.trim().toLowerCase())
					.filter(Boolean);

				const filtered = isAdmin
					? res.data
					: res.data.filter(e => {
						if (!e) return false;
						const creator = (e.creator_email || '').toLowerCase().trim();
						const sender = (e.sender || '').toLowerCase().trim();
						const userEmail = (user?.email || '').toLowerCase().trim();
						const userName = (user?.name || '').toLowerCase().trim();

						if (creator === userEmail || (userName && sender === userName)) return true;
						if (allowedCourierAccess.includes('all')) return true;

						return allowedCourierAccess.some(acc => acc && (acc === creator || acc === sender));
					});
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
		const errors = {};
		if (!formData.sending_from || !formData.sending_from.trim()) {
			errors.sending_from = true;
		}
		if (!formData.destination || !formData.destination.trim()) {
			errors.destination = true;
		}
		if (Object.keys(errors).length > 0) {
			setFormErrors(errors);
			return;
		}
		setFormErrors({});
		try {
			const payload = {
				...formData,
				courier_cost: Math.max(0, parseFloat(formData.courier_cost) || 0),
				creator_email: editingEntry ? (editingEntry.creator_email || user?.email || '') : (user?.email || '')
			};
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



	// Open Modal for Add
	const handleOpenAdd = () => {
		setEditingEntry(null);
		setFormErrors({});
		const defaultBranchName = allowedBranches[0]?.name ? formatBranch(allowedBranches[0].name) : (lookups.branches[0]?.name ? formatBranch(lookups.branches[0].name) : '');
		setFormData({
			date: new Date().toISOString().split('T')[0],
			transaction_type: 'Dispatch',
			sender: user?.name || user?.email || '',
			department: user?.department || '',
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
			branch_id: defaultBranchName,
			branch_name: defaultBranchName,
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
		setFormErrors({});
		const formattedEntryBranch = formatBranch(entry.branch_name || entry.branch_id);
		const defaultBranchName = formattedEntryBranch || (allowedBranches[0]?.name ? formatBranch(allowedBranches[0].name) : (lookups.branches[0]?.name ? formatBranch(lookups.branches[0].name) : ''));
		setFormData({
			date: entry.date,
			transaction_type: entry.transaction_type,
			sender: entry.sender || '',
			department: entry.department || user?.department || '',
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
			weight_kg: entry.weight_kg !== null && entry.weight_kg !== undefined ? entry.weight_kg : '',
			box_measurement: entry.box_measurement || '',
			chargeable_weight: entry.chargeable_weight !== null && entry.chargeable_weight !== undefined ? entry.chargeable_weight : '',
			courier_cost: entry.courier_cost || 0,
			payment_mode: entry.payment_mode || '',
			remarks: entry.remarks || '',
			branch_id: defaultBranchName,
			branch_name: defaultBranchName,
			item: entry.item || '',
			ref_type: entry.ref_type || 'PI'
		});
		setShowModal(true);
	};

	// Export to XLSX handler
	const handleExportXLSX = () => {
		if (!entries || entries.length === 0) {
			alert('No courier data available to export.');
			return;
		}

		const dataToExport = entries.map((entry, index) => {
			const branchName = formatBranch(entry.branch_name);
			return {
				'S.No': index + 1,
				'Date': entry.date || '-',
				'Branch': branchName || '-',
				'Transaction Type': entry.transaction_type || '-',
				'Department': entry.department || '-',
				'From Name': entry.sender || '-',
				'From Location': formatBranch(entry.sending_from) || '-',
				'To Name': entry.receiver || '-',
				'To Location': formatBranch(entry.destination) || '-',
				'Item': entry.item || '-',
				'Ref Type': entry.ref_type || '-',
				'Ref Value': entry.order_reference || '-',
				'Supplier/Buyer Type': entry.supplier_buyer_type || '-',
				'Supplier/Buyer Name': entry.supplier_buyer_name || '-',
				'Budget Status': entry.budgeted || '-',
				'Package Type': entry.package_type || '-',
				'No. of Packages': entry.num_packages ?? '-',
				'Weight (Kg)': entry.weight_kg ?? '-',
				'Courier Operator': entry.courier_name || '-',
				'AWB / Tracking No': entry.awb_no || '-',
				'To Office': entry.receiver_office || '-',
				'Product Description': entry.product_description || '-',
				'Box Measurement': entry.box_measurement || '-',
				'Chargeable Weight': entry.chargeable_weight ?? '-',
				'Cost (INR)': entry.courier_cost || 0,
				'Payment Mode': entry.payment_mode || '-',
				'Remarks': entry.remarks || '-'
			};
		});

		const worksheet = XLSX.utils.json_to_sheet(dataToExport);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, "Courier Report");
		const today = format(new Date(), 'yyyy-MM-dd');
		XLSX.writeFile(workbook, `Courier_Report_${today}.xlsx`);
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
					{hasAddPermission && (
						<button
							onClick={handleOpenAdd}
							className="flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer border-0 text-sm"
						>
							<span className="material-symbols-outlined text-lg">add</span>
							Add Courier
						</button>
					)}

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
				<div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
					<div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Shipments</p>
						<h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{entries.length}</h3>
					</div>
					{isAdmin && (
						<div className="bg-white dark:bg-[#1C212B] rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
							<p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cost</p>
							<h3 className="text-3xl font-extrabold text-pink-600 dark:text-pink-400 mt-2">₹{totalCost.toFixed(2)}</h3>
						</div>
					)}
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
						{allowedBranches.length > 1 ? (
							<SelectDropdown
								variant="filter"
								icon="domain"
								widthClass="w-50"
								label="All Branches"
								value={filters.branch_name || filters.branch_id}
								onChange={val => setFilters(prev => ({ ...prev, branch_name: val, branch_id: val }))}
								options={[
									{ label: 'All Branches', value: '' },
									...allowedBranches.map(b => ({ label: formatBranch(b.name || b), value: formatBranch(b.name || b) }))
								]}
							/>
						) : allowedBranches.length === 1 ? (
							<SelectDropdown
								variant="filter"
								icon="domain"
								widthClass="w-50"
								label={formatBranch(allowedBranches[0].name || allowedBranches[0])}
								value={formatBranch(allowedBranches[0].name || allowedBranches[0])}
								onChange={() => {}}
								options={[
									{ label: formatBranch(allowedBranches[0].name || allowedBranches[0]), value: formatBranch(allowedBranches[0].name || allowedBranches[0]) }
								]}
								disabled={true}
							/>
						) : null}

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
							label="All Departments"
							value={filters.dept}
							onChange={val => setFilters(prev => ({ ...prev, dept: val }))}
							options={[
								{ label: 'All Departments', value: '' },
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

						{/* Download XLSX Report */}
						<button
							onClick={handleExportXLSX}
							aria-label="Download Courier Report as XLSX"
							title="Download Courier Report (XLSX)"
							className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors shadow-sm cursor-pointer"
						>
							<span className="material-symbols-outlined text-[20px]">download</span>
						</button>

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
						<div className="flex flex-col items-center justify-center py-16">
							<div className="h-10 w-10 rounded-full border-4 border-pink-500/20 border-t-pink-500 animate-spin mb-2"></div>
							<p className="text-slate-500 text-sm font-medium">Loading shipments...</p>
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
											<th className="p-4">Budget Status</th>
											<th className="p-4">Package Type</th>
											<th className="p-4">No. of Pkgs</th>
											<th className="p-4">Weight (Kg)</th>
											<th className="p-4">Courier Operator</th>
											<th className="p-4">Tracking Number</th>
											{isAdmin && (
												<>
													<th className="p-4">To Office</th>
													<th className="p-4">Product Desc</th>
													<th className="p-4">Order Ref</th>
													<th className="p-4">Box Measurement</th>
													<th className="p-4">Chargeable Wt</th>
													<th className="p-4">Cost (INR)</th>
													<th className="p-4">Payment Mode</th>
													<th className="p-4">Remarks</th>
												</>
											)}
											<th className="p-4 text-right font-semibold">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{entries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((entry, index) => (
											<tr key={entry.id} onClick={() => handleRowClick(entry)} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors cursor-pointer whitespace-nowrap">
												<td className="px-4 py-2 font-medium text-slate-500">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
												<td className="px-4 py-2 font-medium">{entry.date}</td>
												<td className="px-4 py-2">
													<div className="font-semibold text-slate-700 dark:text-slate-300">
														{formatBranch(entry.branch_name) || '-'}
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
												<td className="px-4 py-2">{formatBranch(entry.sending_from) || '-'}</td>
												<td className="px-4 py-2 font-semibold text-slate-900 dark:text-white">{entry.receiver || '-'}</td>
												<td className="px-4 py-2">{formatBranch(entry.destination) || '-'}</td>
												<td className="px-4 py-2">{entry.item || '-'}</td>
												<td className="px-4 py-2">{entry.ref_type || '-'}</td>
												<td className="px-4 py-2">
									{entry.supplier_buyer_name ? (
										<span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide ${
											entry.supplier_buyer_type === 'Buyer'
												? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
												: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
										}`}>
											{entry.supplier_buyer_name}
										</span>
									) : (
										<span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">-</span>
									)}
								</td>
												<td className="px-4 py-2">{entry.budgeted || '-'}</td>
												<td className="px-4 py-2">{entry.package_type || '-'}</td>
												<td className="px-4 py-2">{entry.num_packages || '-'}</td>
												<td className="px-4 py-2">{entry.weight_kg || '-'}</td>
												<td className="px-4 py-2 font-semibold text-slate-900 dark:text-white">{entry.courier_name || '-'}</td>
												<td className="px-4 py-2 font-mono">{entry.awb_no || '-'}</td>
												{isAdmin && (
													<>
														<td className="px-4 py-2">{entry.receiver_office || '-'}</td>
														<td className="px-4 py-2">{entry.product_description || '-'}</td>
														<td className="px-4 py-2">{entry.order_reference || '-'}</td>
														<td className="px-4 py-2">{entry.box_measurement || '-'}</td>
														<td className="px-4 py-2">{entry.chargeable_weight || '-'}</td>
														<td className="px-4 py-2 font-bold text-pink-600 dark:text-pink-400">₹{(entry.courier_cost || 0).toFixed(2)}</td>
														<td className="px-4 py-2">{entry.payment_mode || '-'}</td>
														<td className="px-4 py-2 max-w-[200px] truncate" title={entry.remarks}>{entry.remarks || '-'}</td>
													</>
												)}
												<td className="px-4 py-2 text-right">
													<div className="flex items-center justify-end gap-1">
														{hasEditPermission && (
															<button
																onClick={(e) => { e.stopPropagation(); handleOpenEdit(entry); }}
																title="Edit entry"
																className="h-9 w-9 flex items-center justify-center p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
															>
																<span className="material-symbols-outlined text-lg">edit</span>
															</button>
														)}
														{hasDeletePermission && (
															<button
																onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry); }}
																title="Delete entry"
																className="h-9 w-9 flex items-center justify-center p-1 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
															>
																<span className="material-symbols-outlined text-lg">delete</span>
															</button>
														)}
													</div>
												</td>
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
								<span className="material-symbols-outlined text-xl" style={{fontSize: '20px'}}>close</span>
							</button>
						</div>

						<form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Date */}
								<div>
						<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
							Date <span className="text-red-500">*</span>
							{!isAdmin && <span className="ml-1 text-slate-400 text-[10px] normal-case font-normal">(locked)</span>}
						</label>
						<div className="relative">
							<input
								type="date"
								required
								value={formData.date}
								onChange={e => isAdmin && setFormData(prev => ({ ...prev, date: e.target.value }))}
								readOnly={!isAdmin}
								className={`w-full px-3 py-2.5 border-none rounded-xl outline-none focus:outline-none focus:ring-0 ${
									isAdmin
										? 'bg-slate-50 dark:bg-slate-800 cursor-pointer'
										: 'bg-slate-100 dark:bg-slate-800/60 opacity-70 cursor-not-allowed select-none pointer-events-none'
								}`}
							/>
							{!isAdmin && (
								<span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[16px]">lock</span>
							)}
						</div>
					</div>

								{/* Branch */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Branch <span className="text-red-500">*</span></label>
									<SelectDropdown
										label="Select Branch"
										options={branchOptions}
										value={formatBranch(formData.branch_name)}
										onChange={val => {
											const match = (lookups.branches || []).find(b => formatBranch(b.name) === val || b.name === val);
											setFormData(prev => ({ ...prev, branch_name: val, branch_id: match?.id || prev.branch_id }));
										}}
										disabled={allowedBranches.length === 1}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Transaction Type */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transaction Type<span className="text-red-500"> *</span></label>
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

								{/* Department (Disabled) */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
									<input
										type="text"
										disabled
										value={formData.department || user?.department || ''}
										placeholder="No Department"
										className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800/60 border-none rounded-xl text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed outline-none focus:outline-none"
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
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
										From Location <span className="text-red-500">*</span>
									</label>
									<BranchWithFlyoutDropdown
										label="Select From Location"
										branches={lookups.branches || []}
										locations={lookups.locations || []}
										value={formData.sending_from}
										onChange={val => {
											setFormData(prev => ({ ...prev, sending_from: val }));
											if (val) setFormErrors(prev => ({ ...prev, sending_from: false }));
										}}
										disabledValue={formData.destination}
										error={formErrors.sending_from}
									/>
									{formErrors.sending_from && (
										<p className="text-xs text-red-500 mt-1 font-medium">From Location is required</p>
									)}
								</div>

								{/* Destination */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
										To Location <span className="text-red-500">*</span>
									</label>
									<BranchWithFlyoutDropdown
										label="Select To Location"
										branches={lookups.branches || []}
										locations={lookups.locations || []}
										value={formData.destination}
										onChange={val => {
											setFormData(prev => ({ ...prev, destination: val }));
											if (val) setFormErrors(prev => ({ ...prev, destination: false }));
										}}
										flyoutPosition="left"
										disabledValue={formData.sending_from}
										error={formErrors.destination}
									/>
									{formErrors.destination && (
										<p className="text-xs text-red-500 mt-1 font-medium">To Location is required</p>
									)}
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
													{ label: 'Supplier', value: 'Supplier' },
													{ label: 'Others', value: 'Others' }
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
								{/* Budget status */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Budgeted status</label>
									<SelectDropdown
										label="Budgeted status"
										options={(lookups.budget_statuses?.length > 0 ? lookups.budget_statuses : ['Non Budgeted', 'Budgeted']).map(b => ({ label: b, value: b }))}
										value={formData.budgeted}
										onChange={val => setFormData(prev => ({ ...prev, budgeted: val }))}
									/>
								</div>

								{/* Package Type */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Package Type</label>
									<SelectDropdown
										label="Package Type"
										options={(lookups.package_types?.length > 0 ? lookups.package_types : ['Cover', 'Box']).map(p => ({ label: p, value: p }))}
										value={formData.package_type}
										onChange={val => setFormData(prev => ({ ...prev, package_type: val }))}
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Courier Name */}
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Courier Operator</label>
									<SelectDropdown
										label="Courier Operator"
										options={lookups.courier_names?.length > 0
											? lookups.courier_names.map(c => ({ label: c, value: c }))
											: [
												{ label: 'DTDC Courier', value: 'DTDC Courier' },
												{ label: 'RK Courier', value: 'RK Courier' },
												{ label: 'NEW Logistics', value: 'NEW Logistics' },
												{ label: 'Air Cargo', value: 'Air Cargo' }
											]
										}
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
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										{/* Cost */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cost (INR)</label>
											<input
												type="number"
												min="0"
												step="0.01"
												value={formData.courier_cost}
												onWheel={e => e.target.blur()}
												onKeyDown={e => {
													if (e.key === '-' || e.key === 'e' || e.key === 'E') {
														e.preventDefault();
													}
												}}
												onChange={e => {
													const val = e.target.value;
													if (val === '' || parseFloat(val) >= 0) {
														setFormData(prev => ({ ...prev, courier_cost: val }));
													}
												}}
												className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:outline-none focus:ring-0 font-bold text-pink-600"
											/>
										</div>

										{/* Payment Mode */}
										<div>
											<label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment Mode</label>
											<SelectDropdown
												label="Payment Mode"
												options={(lookups.payment_modes?.length > 0 ? lookups.payment_modes : ['Net Banking', 'Cash']).map(p => ({ label: p, value: p }))}
												value={formData.payment_mode}
												onChange={val => setFormData(prev => ({ ...prev, payment_mode: val }))}
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
									className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl cursor-pointer border-0"
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
								{hasEditPermission && (
									<button
										onClick={() => {
											setIsDetailsModalOpen(false);
											handleOpenEdit(selectedCourier);
										}}
										title="Edit Courier"
										className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer border-0 bg-transparent text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center"
									>
										<span className="material-symbols-outlined text-xl">edit</span>
									</button>
								)}
								<button onClick={() => setIsDetailsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer border-0 bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center">
									<span className="material-symbols-outlined text-xl">close</span>
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
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.department || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">From Location</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{formatBranch(selectedCourier.sending_from) || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">To Name</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.receiver || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">To Location</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{formatBranch(selectedCourier.destination) || '-'}</p>
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
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{formatBranch(selectedCourier.branch_name) || '-'}</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Wt(Kg)</label>
									<p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedCourier.weight_kg || '-'}</p>
								</div>
								{isAdmin && (
									<div>
										<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cost(₹)</label>
										<p className="font-bold text-pink-600 text-sm">₹{(selectedCourier.courier_cost || 0).toFixed(2)}</p>
									</div>
								)}
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
			{/* DELETE CONFIRMATION MODAL CARD */}
			{deleteModal.show && (
				<div
					className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200"
					onClick={() => setDeleteModal({ show: false, entry: null })}
				>
					<div
						className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 flex flex-col items-center"
						onClick={e => e.stopPropagation()}
					>
						<div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-500 flex items-center justify-center mb-4 border border-red-200 dark:border-red-900/30 shadow-md">
							<span className="material-symbols-outlined text-[34px]">delete_forever</span>
						</div>
						<h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">Confirm Deletion</h3>
						<p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
							Are you sure you want to delete courier record <strong className="text-slate-700 dark:text-slate-300 font-semibold">{deleteModal.entry?.awb_no ? `(AWB: ${deleteModal.entry.awb_no})` : ''}</strong>? This action cannot be undone.
						</p>
						<div className="mt-6 flex items-center gap-3 w-full">
							<button
								type="button"
								onClick={() => setDeleteModal({ show: false, entry: null })}
								className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer text-sm border-0"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={confirmDelete}
								className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 active:scale-[0.98] cursor-pointer text-sm border-0"
							>
								Delete
							</button>
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
						<h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">
							{successModal.type === 'Add' ? 'Added Successfully' : successModal.type === 'Delete' ? 'Deleted Successfully' : 'Update Successful'}
						</h3>
						<p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
							<strong className="text-slate-700 dark:text-slate-300 font-semibold">{successModal.id}</strong> has been {successModal.type === 'Add' ? 'added' : successModal.type === 'Delete' ? 'deleted' : 'updated'} successfully.
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
