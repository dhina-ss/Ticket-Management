import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import api from '../api';
import logoImage from '../assets/logo.png';
import logoDarkImage from '../assets/logo1.png';
import ccLogo from '../assets/cc.png';
import dtLogo from '../assets/dt.png';
import { Scanner } from '@yudiel/react-qr-scanner';

const EXPORT_COLUMNS = [
    { id: 'sno', label: 'S.No' },
    { id: 'ticket_id', label: 'Ticket ID' },
    { id: 'date', label: 'Submited Date' },
    { id: 'month', label: 'Month' },
    { id: 'branch', label: 'Branch' },
    { id: 'name', label: 'Name' },
    { id: 'mobile', label: 'Mobile' },
    { id: 'department', label: 'Department' },
    { id: 'category', label: 'Category' },
    { id: 'subCategory', label: 'Sub Category' },
    { id: 'supportType', label: 'Support Type' },
    { id: 'description', label: 'Description' },
    { id: 'mode', label: 'Mode' },
    { id: 'assignee', label: 'Assignee' },
    { id: 'status', label: 'Status' },
    { id: 'expense', label: 'Expense' },
    { id: 'adminComments', label: 'Admin Comments' },
    { id: 'managerComments', label: 'Manager Comments' },
    { id: 'managementComments', label: 'Management Comments' },
    { id: 'resolutionComments', label: 'Resolution Comments' },
    { id: 'userConfirmation', label: 'User Confirmation' }
];

const ACCESS_OPTIONS = ['View', 'Edit', 'Export'];

const accessBadgeColor = (perm) => {
    if (perm === 'View') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (perm === 'Edit') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (perm === 'Export') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    return 'bg-slate-100 text-slate-600';
};

const supportBadgeColor = (type) => {
    if (type === 'IT Support') return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300';
    if (type === 'Admin Support') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
};

const SUPPORT_TYPE_OPTIONS = ['IT Support', 'Admin Support'];

const MENU_OPTIONS = ['Tickets', 'IT Assets', 'Admin Assets', 'Courier', 'Petty Cash', 'Users', 'Settings'];

const formatCreatedAt = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr === 'Just now') return 'Just now';
    const regex = /^(\d{2})-(\d{2})-(\d{4})/;
    const match = dateStr.match(regex);
    if (match) {
        const day = match[1];
        const month = match[2];
        const year = match[3];
        const compatibleStr = `${year}-${month}-${day}${dateStr.slice(10)}`;
        const dateObj = new Date(compatibleStr);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.toLocaleDateString();
        }
    }
    const standardDate = new Date(dateStr);
    return isNaN(standardDate.getTime()) ? dateStr : standardDate.toLocaleDateString();
};

const normalizeCategory = (cat) => {
    const trimmed = (cat || '').trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower === 'ups' || lower === 'cpu' || lower === 'nas' || lower === 'it' || lower === 'dvr') {
        return trimmed.toUpperCase();
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

// BRANCH_OPTIONS is now dynamic - loaded from Settings page branches

const MultiSelectFormDropdown = ({ label, icon, options = [], selected = [], onChange, menuWidthClass }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option) => {
        if (option === 'All') {
            onChange('All'); // For the toggleBranch logic in UsersView, it expects the branch name string
        } else {
            onChange(option);
        }
    };

    const getSelectedArray = () => {
        if (!selected) return [];
        if (Array.isArray(selected)) return selected;
        return String(selected).split(',').map(s => s.trim()).filter(Boolean);
    };

    const selectedArray = getSelectedArray();
    const isSelected = (option) => selectedArray.includes(option);

    const getDisplayValue = () => {
        if (selectedArray.includes('All')) return `All ${label}`;
        if (selectedArray.length === 1) return selectedArray[0];
        return `${selectedArray.length} Selected`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border cursor-pointer transition-all bg-slate-50 dark:bg-slate-800 ${isOpen ? 'ring-2 ring-primary border-primary bg-white dark:bg-slate-900 shadow-sm' : 'border-slate-200 dark:border-slate-700'}`}
            >
                {icon && <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>}
                <span className={`truncate font-medium ${selectedArray.includes('All') ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                    {getDisplayValue()}
                </span>
                <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </div>

            {isOpen && (
                <div className={`absolute top-full left-0 mt-2 ${menuWidthClass || 'min-w-full w-max max-w-[360px]'} bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[60] overflow-hidden animate-in fade-in zoom-in duration-150`}>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                        {options.map((option) => (
                            <label
                                key={option}
                                className={`relative flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group ${isSelected(option) ? 'bg-primary/5' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isSelected(option)}
                                    onChange={() => toggleOption(option)}
                                />
                                <div className={`h-4.5 w-4.5 rounded flex items-center justify-center border-2 transition-all shrink-0 ${isSelected(option) ? 'bg-primary border-primary shadow-sm shadow-primary/20' : 'border-slate-300 dark:border-slate-600 group-hover:border-primary/50'}`}>
                                    {isSelected(option) && <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>}
                                </div>
                                <span className={`text-[13px] font-medium whitespace-nowrap transition-colors ${isSelected(option) ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {option === 'All' ? `All` : option}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SelectDropdown = ({ label, options, value, onChange, direction = 'down', maxHeight = 'max-h-40', error, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    return (
        <div className="relative w-full" ref={ref}>
            <div
                onClick={() => !disabled && setIsOpen(o => !o)}
                className={`flex items-center justify-between w-full px-4 py-3 text-sm rounded-xl border transition-all bg-slate-50 dark:bg-slate-800 font-medium ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        : 'cursor-pointer'
                } ${error
                    ? 'border-red-500 ring-2 ring-red-500/20'
                    : isOpen
                        ? 'ring-2 ring-primary border-primary'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
            >
                <span className="text-slate-800 dark:text-white truncate">{value || label}</span>
                <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform duration-200 shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            {isOpen && !disabled && (
                <div className={`absolute left-0 min-w-full w-max max-w-[360px] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[200] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${direction === 'up'
                    ? 'bottom-full mb-1.5 origin-bottom'
                    : 'top-full mt-1.5 origin-top'
                    }`}>
                    <div className={`${maxHeight} overflow-y-auto custom-scrollbar px-1.5 py-0.5 space-y-0.5`}>
                        {options.map(opt => (
                            <div
                                key={opt.value ?? opt}
                                onClick={() => { onChange(opt.value ?? opt); setIsOpen(false); }}
                                className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors font-medium whitespace-nowrap ${(opt.value ?? opt) === value
                                    ? 'bg-primary/10 text-primary font-semibold'
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

const parseUserBranches = (rawBranch, availableBranchOptions = []) => {
    if (!rawBranch || rawBranch === 'All') return ['All'];
    const str = String(rawBranch).trim();
    if (str.includes('|')) {
        const parts = str.split('|').map(s => s.trim()).filter(Boolean);
        return parts.length > 0 ? parts : ['All'];
    }

    const knownBranches = availableBranchOptions
        .filter(b => b && b !== 'All')
        .sort((a, b) => b.length - a.length);

    let remaining = str;
    const found = [];

    for (const kb of knownBranches) {
        if (remaining.includes(kb)) {
            found.push(kb);
            remaining = remaining.replace(kb, '').trim();
        }
    }

    if (found.length > 0) {
        return found;
    }

    const fallback = str.split(',').map(s => s.trim()).filter(Boolean);
    return fallback.length > 0 ? fallback : ['All'];
};

const UsersView = ({ allUsers = [], users, setUsers, usersLoading, showAddUser, setShowAddUser, searchQuery, hasEditPermission, currentUser, refreshUser, fetchUsers, departments = [], branchOptions = ['All'] }) => {
    const [newUser, setNewUser] = useState({
        name: '', email: '', password: '',
        access: ['View'],
        support_type: ['IT Support', 'Admin Support'],
        allowed_menus: [],
        branch: ['All'],
        courier_users: [],
        department: '',
        add_as_assignee: false,
        can_receive_mail: false,
        can_send_mail: false,
        receiver_position: '',
        role: 'user'
    });
    const [addError, setAddError] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [editingUser, setEditingUser] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        if (fetchUsers) fetchUsers();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const totalPages = Math.max(1, Math.ceil(users.length / ITEMS_PER_PAGE));
    const paginatedUsers = users.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const toggleAccess = (perm) => {
        setNewUser(p => ({
            ...p,
            access: p.access.includes(perm)
                ? p.access.filter(a => a !== perm)
                : [...p.access, perm]
        }));
    };

    const toggleSupportType = (st) => {
        setNewUser(p => ({
            ...p,
            support_type: p.support_type.includes(st)
                ? p.support_type.filter(s => s !== st)
                : [...p.support_type, st]
        }));
    };

    const toggleAllowedMenu = (menu) => {
        if (menu === 'All') {
            setNewUser(p => ({
                ...p,
                allowed_menus: p.allowed_menus.length === MENU_OPTIONS.length ? [] : [...MENU_OPTIONS]
            }));
            return;
        }
        setNewUser(p => ({
            ...p,
            allowed_menus: p.allowed_menus.includes(menu)
                ? p.allowed_menus.filter(m => m !== menu)
                : [...p.allowed_menus, menu]
        }));
    };

    const toggleCourierUser = (userName) => {
        const userList = allUsers.length > 0 ? allUsers : users;
        const userRoleNames = userList
            .filter(u => (!u.role || u.role.toLowerCase() === 'user') && u.name !== newUser.name && u.email !== newUser.email)
            .map(u => u.name);
        if (userName === 'All') {
            setNewUser(p => ({
                ...p,
                courier_users: p.courier_users.length === userRoleNames.length ? [] : [...userRoleNames]
            }));
            return;
        }
        setNewUser(p => ({
            ...p,
            courier_users: p.courier_users.includes(userName)
                ? p.courier_users.filter(u => u !== userName)
                : [...p.courier_users, userName]
        }));
    };

    const toggleBranch = (branch) => {
        setNewUser(p => {
            if (branch === 'All') {
                return { ...p, branch: ['All'] };
            }
            let updated = p.branch.filter(b => b !== 'All');
            if (updated.includes(branch)) {
                updated = updated.filter(b => b !== branch);
            } else {
                updated.push(branch);
            }
            if (updated.length === 0) updated = ['All'];
            return { ...p, branch: updated };
        });
    };

    const closeModal = () => {
        setShowAddUser(false);
        setEditingUser(null);
        setAddError('');
        setNewUser({
            name: '', email: '', password: '',
            access: ['View'],
            support_type: ['IT Support', 'Admin Support'],
            allowed_menus: [],
            branch: ['All'],
            courier_users: [],
            department: '',
            add_as_assignee: false,
            can_receive_mail: false,
            can_send_mail: false,
            receiver_position: '',
            role: 'user'
        });
    };

    const handleOpenEdit = (user) => {
        setEditingUser(user);
        const userList = allUsers.length > 0 ? allUsers : users;
        const rawCourierUsers = (user.courier_users || '').split(',').map(s => s.trim()).filter(Boolean);
        const mappedCourierUsers = Array.from(new Set(rawCourierUsers.map(item => {
            if (item === 'All') return 'All';
            const found = userList.find(u => u.email?.toLowerCase() === item.toLowerCase() || u.name?.toLowerCase() === item.toLowerCase());
            return found ? found.name : item;
        })));

        setNewUser({
            name: user.name,
            email: user.email,
            password: '', // Leave blank to not change
            access: (user.access || 'View').split(',').map(s => s.trim()),
            support_type: (user.support_type || 'IT Support,Admin Support').split(',').map(s => s.trim()),
            allowed_menus: (user.allowed_menus || '').split(',').map(s => s.trim()).filter(Boolean),
            courier_users: mappedCourierUsers,
            department: user.department || '',
            add_as_assignee: !!user.is_assignee,
            can_receive_mail: !!user.can_receive_mail,
            can_send_mail: !!user.can_send_mail,
            receiver_position: user.receiver_position || '',
            branch: parseUserBranches(user.branch || 'All', branchOptions),
            role: user.role || 'user'
        });
        setAddError('');
        setShowAddUser(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        if (newUser.access.length === 0) { setAddError('Please select at least one access permission.'); return; }
        if (newUser.support_type.length === 0 && newUser.allowed_menus.includes('Tickets')) { setAddError('Please select at least one support type.'); return; }
        if (!editingUser && !newUser.password) { setAddError('Password is required for new users.'); return; }
        if (newUser.password && newUser.password.length < 6) { setAddError('Password must be at least 6 characters long.'); return; }
        setAddError('');
        setAddLoading(true);
        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
            const method = editingUser ? 'PUT' : 'POST';

            const userList = allUsers.length > 0 ? allUsers : users;
            const expandedCourierUsers = [];
            newUser.courier_users.forEach(item => {
                if (!expandedCourierUsers.includes(item)) expandedCourierUsers.push(item);
                const found = userList.find(u => u.name === item || u.email === item);
                if (found) {
                    if (found.email && !expandedCourierUsers.includes(found.email)) expandedCourierUsers.push(found.email);
                    if (found.name && !expandedCourierUsers.includes(found.name)) expandedCourierUsers.push(found.name);
                }
            });
            const courierUsersString = expandedCourierUsers.join(',');

            const deptList = (departments && departments.length > 0)
                ? departments.map(d => typeof d === 'string' ? d : d.name)
                : ['Admin', 'HR', 'Finance', 'Sales', 'Production', 'Logistics', 'Courier', 'IT'];
            const userDept = newUser.department || ((newUser.allowed_menus.includes('Courier') || newUser.allowed_menus.includes('All')) ? deptList[0] || '' : '');

            const payload = {
                ...newUser,
                department: userDept,
                access: newUser.access.join(','),
                support_type: newUser.support_type.join(','),
                allowed_menus: newUser.allowed_menus.join(','),
                branch: newUser.branch.join('|'),
                courier_users: courierUsersString
            };

            const res = await (method === 'PUT' ? api.put(url, payload) : api.post(url, payload));
            const data = await res.data;
            if (res.status !== 200 && res.status !== 201) { setAddError(data.error || `Failed to ${editingUser ? 'update' : 'create'} user.`); return; }

            if (editingUser) {
                setUsers(prev => prev.map(u => u.id === editingUser.id ? {
                    ...u,
                    name: newUser.name,
                    email: newUser.email,
                    department: userDept,
                    access: newUser.access.join(','),
                    support_type: newUser.support_type.join(','),
                    allowed_menus: newUser.allowed_menus.join(','),
                    courier_users: courierUsersString,
                    can_receive_mail: newUser.can_receive_mail,
                    can_send_mail: newUser.can_send_mail,
                    receiver_position: newUser.receiver_position,
                    is_assignee: newUser.add_as_assignee,
                    branch: newUser.branch.join('|'),
                    role: newUser.role
                } : u));
                if (currentUser && currentUser.id === editingUser.id) {
                    if (refreshUser) refreshUser();
                }
            } else {
                setUsers(prev => [...prev, {
                    name: newUser.name,
                    email: newUser.email,
                    department: userDept,
                    access: newUser.access.join(','),
                    support_type: newUser.support_type.join(','),
                    allowed_menus: newUser.allowed_menus.join(','),
                    courier_users: courierUsersString,
                    id: data.id,
                    created_at: 'Just now',
                    can_receive_mail: newUser.can_receive_mail,
                    can_send_mail: newUser.can_send_mail,
                    receiver_position: newUser.receiver_position,
                    is_assignee: newUser.add_as_assignee,
                    branch: newUser.branch.join('|'),
                    role: newUser.role
                }]);
            }
            closeModal();
        } catch { setAddError('Server error.'); }
        finally { setAddLoading(false); }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await api.delete(`/api/users/${userToDelete.id}`);
            setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
            setUserToDelete(null);
        } catch { alert('Failed to delete user.'); }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden px-20 pb-8 pt-0">
            {/* ── Add User Modal ── */}
            {showAddUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
                    {/* Panel */}
                    <form onSubmit={handleSaveUser}
                        className="relative z-10 w-full max-w-[60%] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${editingUser ? 'bg-blue-600/10' : 'bg-primary/10'}`}>
                                    <span className={`material-symbols-outlined text-lg ${editingUser ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`}>
                                        {editingUser ? 'edit' : 'person_add'}
                                    </span>
                                </div>
                                <h2 className="text-base font-bold text-slate-800 dark:text-white">
                                    {editingUser ? 'Edit User' : 'Add User'}
                                </h2>
                            </div>
                            <button type="button" onClick={closeModal}
                                className="w-9 h-9 flex justify-center items-center text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        {addError && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium">
                                {addError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Username */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Username <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">person</span>
                                        <input required value={newUser.name}
                                            onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                                            placeholder="e.g. John Doe" />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Mail ID <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">mail</span>
                                        <input required type="email" value={newUser.email}
                                            onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                                            placeholder="e.g. john@support.com" />
                                    </div>
                                </div>
                            </div>

                            {/* Branch Selection, Role and Password in same row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Branch <span className="text-red-400">*</span>
                                    </label>
                                    <MultiSelectFormDropdown
                                        label="Branches"
                                        icon="location_on"
                                        options={['All', ...branchOptions.filter(b => b !== 'All')]}
                                        selected={newUser.branch}
                                        onChange={toggleBranch}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Role <span className="text-red-400">*</span>
                                    </label>
                                    <SelectDropdown
                                        value={newUser.role}
                                        onChange={val => setNewUser(p => ({ ...p, role: val }))}
                                        options={['Super admin', 'admin', 'user']}
                                        label="Select Role"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Password {editingUser ? <span className="text-slate-400 font-normal">(Leave blank to keep current)</span> : <span className="text-red-400">*</span>}
                                    </label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">lock</span>
                                        <input required={!editingUser} type={showPwd ? 'text' : 'password'} value={newUser.password}
                                            onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                                            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white"
                                            placeholder="••••••••" />
                                        <button type="button" onClick={() => setShowPwd(p => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <span className="material-symbols-outlined text-base">{showPwd ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Allowed Menus */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Allowed Menus <span className="text-red-400">*</span>
                                    </label>
                                    <MultiSelectFormDropdown
                                        label="Allowed Menus"
                                        icon="menu"
                                        options={['All', ...MENU_OPTIONS]}
                                        selected={newUser.allowed_menus.length === MENU_OPTIONS.length ? ['All', ...newUser.allowed_menus] : newUser.allowed_menus}
                                        onChange={toggleAllowedMenu}
                                    />
                                </div>

                                {/* Access */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Access <span className="text-red-400">*</span>
                                    </label>
                                    <MultiSelectFormDropdown
                                        label="Access"
                                        icon="admin_panel_settings"
                                        options={['All', ...((newUser.allowed_menus.includes('Petty Cash') || newUser.allowed_menus.includes('Courier')) ? [...ACCESS_OPTIONS, 'Delete'] : ACCESS_OPTIONS)]}
                                        selected={newUser.access.length === ((newUser.allowed_menus.includes('Petty Cash') || newUser.allowed_menus.includes('Courier')) ? ACCESS_OPTIONS.length + 1 : ACCESS_OPTIONS.length) ? ['All', ...newUser.access] : newUser.access}
                                        onChange={toggleAccess}
                                    />
                                </div>

                                {/* Support Type */}
                                {newUser.allowed_menus.includes('Tickets') && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Support Type <span className="text-red-400">*</span>
                                    </label>
                                    <MultiSelectFormDropdown
                                        label="Support Type"
                                        icon="support_agent"
                                        options={['All', ...SUPPORT_TYPE_OPTIONS]}
                                        selected={newUser.support_type.length === SUPPORT_TYPE_OPTIONS.length ? ['All', ...newUser.support_type] : newUser.support_type}
                                        onChange={toggleSupportType}
                                    />
                                </div>
                                )}

                                {/* Users List (Courier Access) */}
                                {(newUser.allowed_menus.includes('Courier') || newUser.allowed_menus.includes('All')) && (() => {
                                    const userList = allUsers.length > 0 ? allUsers : users;
                                    const userRoleNames = userList
                                        .filter(u => (!u.role || u.role.toLowerCase() === 'user') && u.name !== newUser.name && u.email !== newUser.email)
                                        .map(u => u.name);
                                    const deptList = (departments && departments.length > 0)
                                        ? departments.map(d => typeof d === 'string' ? d : d.name)
                                        : ['Admin', 'HR', 'Finance', 'Sales', 'Production', 'Logistics', 'Courier', 'IT'];
                                    return (
                                        <>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                                    Department (Courier) <span className="text-red-400">*</span>
                                                </label>
                                                <SelectDropdown
                                                    value={newUser.department || deptList[0]}
                                                    onChange={val => setNewUser(p => ({ ...p, department: val }))}
                                                    options={deptList}
                                                    label="Select Department"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                                    Users List (Courier Access)
                                                </label>
                                                <MultiSelectFormDropdown
                                                    label="Users"
                                                    icon="group"
                                                    options={['All', ...userRoleNames]}
                                                    selected={newUser.courier_users.length === userRoleNames.length && userRoleNames.length > 0 ? ['All', ...newUser.courier_users] : newUser.courier_users}
                                                    onChange={toggleCourierUser}
                                                />
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Add as Assignee & Send Mail (Row 1) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <label className="flex items-center justify-between py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer group hover:border-primary/40 hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${newUser.add_as_assignee ? 'bg-primary/10 text-primary' : 'text-slate-400 group-hover:text-primary/70'}`}>
                                            <span className="material-symbols-outlined text-lg">person_add</span>
                                        </div>
                                        <span className={`text-sm transition-colors ${newUser.add_as_assignee ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>Assignee</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newUser.add_as_assignee}
                                            onChange={e => setNewUser(p => ({ ...p, add_as_assignee: e.target.checked }))}
                                            className="sr-only"
                                        />
                                        <div className={`w-10 h-5 rounded-full transition-colors ${newUser.add_as_assignee ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                        <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${newUser.add_as_assignee ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>

                                <label className="flex items-center justify-between py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer group hover:border-emerald-500/40 hover:shadow-sm transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${newUser.can_send_mail ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-500/70'}`}>
                                            <span className="material-symbols-outlined text-lg">forward_to_inbox</span>
                                        </div>
                                        <span className={`text-sm transition-colors ${newUser.can_send_mail ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>Send Mail</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newUser.can_send_mail}
                                            onChange={e => setNewUser(p => ({ ...p, can_send_mail: e.target.checked }))}
                                            className="sr-only"
                                        />
                                        <div className={`w-10 h-5 rounded-full transition-colors ${newUser.can_send_mail ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                        <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${newUser.can_send_mail ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>
                            </div>

                            {/* Receive Mail & Receiver's Position (Row 2) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-center justify-between py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer group hover:border-emerald-500/40 hover:shadow-sm transition-all h-full">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${newUser.can_receive_mail ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-500/70'}`}>
                                            <span className="material-symbols-outlined text-lg">mark_email_read</span>
                                        </div>
                                        <span className={`text-sm transition-colors ${newUser.can_receive_mail ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>Receive Mail</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newUser.can_receive_mail}
                                            onChange={e => setNewUser(p => ({
                                                ...p,
                                                can_receive_mail: e.target.checked,
                                                receiver_position: e.target.checked ? (p.receiver_position || 'Management') : ''
                                            }))}
                                            className="sr-only"
                                        />
                                        <div className={`w-10 h-5 rounded-full transition-colors ${newUser.can_receive_mail ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                        <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${newUser.can_receive_mail ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                </label>

                                {newUser.can_receive_mail ? (
                                    <div className="animate-in fade-in zoom-in duration-200 h-full">
                                        <div className="relative h-full group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none transition-colors group-hover:text-primary/70">
                                                <span className="material-symbols-outlined text-base">badge</span>
                                            </div>
                                            <div className="w-full h-full [&>div>div:first-child]:pl-[38px] [&>div>div:first-child]:h-full [&>div]:h-full">
                                                <SelectDropdown
                                                    value={newUser.receiver_position || 'Management'}
                                                    onChange={val => setNewUser(p => ({ ...p, receiver_position: val }))}
                                                    options={['Manager', 'Management']}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : <div className="hidden md:block"></div>}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={closeModal}
                                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" disabled={addLoading}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-colors cursor-pointer ${editingUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary/90'}`}>
                                {addLoading && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                                {addLoading ? 'Saving…' : (editingUser ? 'Save Changes' : 'Create User')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {userToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUserToDelete(null)} />
                    <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-red-600 dark:text-red-500 text-2xl">warning</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Delete User?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-300">{userToDelete.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setUserToDelete(null)}
                                className="flex-1 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={handleDeleteUser}
                                className="flex-1 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Users Table */}
            {usersLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                    Loading users…
                </div>
            ) : (
                <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full min-w-[1100px] text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                                <tr>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-12">#</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[150px]">Name</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[100px]">Role</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[200px]">Email</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[140px]">Access</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[180px]">Support Type</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[160px]">Branch</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[140px]">Created At</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[100px]">Mail</th>
                                {hasEditPermission && <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 min-w-[90px]">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={hasEditPermission ? "9" : "8"} className="text-center py-20 text-slate-400">
                                        No users
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user, idx) => (
                                <tr key={user.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-slate-800 dark:text-white">{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                                            user.role === 'Super admin' 
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                                                : user.role === 'admin' 
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' 
                                                    : 'bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {user.role || 'user'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-650 dark:text-slate-300">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1.5 flex-wrap">
                                            {(user.access || 'View').split(',').map(p => (
                                                <span key={p} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${accessBadgeColor(p.trim())}`}>
                                                    {p.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1.5 flex-wrap">
                                            {(user.support_type || 'IT Support,Admin Support').split(',').map(p => (
                                                <span key={p} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${supportBadgeColor(p.trim())}`}>
                                                    {p.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-1 flex-wrap">
                                            {parseUserBranches(user.branch || 'All', branchOptions).map((b, i) => {
                                                const colors = [
                                                    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
                                                    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
                                                    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
                                                    'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
                                                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                                                ];
                                                const tag = b.trim();
                                                if (!tag) return null;
                                                if (tag === 'All') return (
                                                    <span key="all" className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">All</span>
                                                );
                                                return (
                                                    <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[i % colors.length]}`}>
                                                        {tag}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">{user.created_at || '—'}</td>
                                    <td className="px-6 py-4">
                                        {user.can_receive_mail ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">
                                                    {user.receiver_position}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 uppercase font-medium">No Mail</span>
                                        )}
                                    </td>
                                    {hasEditPermission && (
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    title="Edit User"
                                                    onClick={() => handleOpenEdit(user)}
                                                    className="flex items-center justify-center w-8 h-8 text-blue-600 border border-blue-200 dark:border-blue-900/40 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>
                                                <button
                                                    title={user.email === 'admin@support.com' ? "Cannot delete primary admin" : "Delete User"}
                                                    onClick={() => {
                                                        if (user.email !== 'admin@support.com') setUserToDelete(user);
                                                    }}
                                                    disabled={user.email === 'admin@support.com'}
                                                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors
                                                        ${user.email === 'admin@support.com'
                                                            ? 'text-slate-300 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-800/30'
                                                            : 'text-red-600 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                            )}
                        </tbody>
                    </table>
                    </div>
                    {/* Pagination Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                        <p className="text-sm text-slate-500 dark:text-slate-400 min-w-[240px]">
                            Showing <span className="font-medium">{users.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, users.length)}</span> of <span className="font-medium">{users.length}</span> users
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
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
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
                                            className={`px-3 py-1 text-sm rounded transition-colors ${currentPage === item
                                                ? 'bg-primary text-white'
                                                : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >{item}</button>
                                    )
                                )
                            }
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-1 py-1 border border-1 border-solid border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center text-slate-600 dark:text-slate-400"
                                title="Next Page"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AssetsView = ({
    assets,
    setAssets,
    assetTypes,
    searchQuery,
    categoryFilter,
    branchFilter,
    departmentFilter,
    conditionFilter,
    showAddModal,
    setShowAddModal,
    newAsset,
    setNewAsset,
    isEditing,
    setIsEditing,
    editingId,
    setEditingId,
    isDateFilterActive,
    dateRange,
    selectedAssetIds,
    setSelectedAssetIds,
    departments,
    activeView,
    hasEditPermission,
    assetsLoading = false,
    currentBranchList = []
}) => {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [qrLightbox, setQrLightbox] = useState(null); // holds base64 src when open
    const [historyLogs, setHistoryLogs] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [successModal, setSuccessModal] = useState({ show: false, type: '', id: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalServerItems, setTotalServerItems] = useState(0);
    const [totalServerPages, setTotalServerPages] = useState(1);
    const [validationErrors, setValidationErrors] = useState({});
    const ITEMS_PER_PAGE = 20;

    const photosInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [showSourceModal, setShowSourceModal] = useState(false);

    const handleUploadContainerClick = () => {
        if ((newAsset.images || []).length >= 2) return;
        if (window.innerWidth < 640) {
            setShowSourceModal(true);
        }
    };

    const getAssetQRUrl = (qrPath) => {
        if (!qrPath) return '';
        if (qrPath.startsWith('data:image')) return qrPath;
        const apiBase = import.meta.env.VITE_API_URL || '';
        return `${apiBase}${qrPath}`;
    };
    const [selectedAsset, setSelectedAsset] = useState(null);
    const location = useLocation();
    useEffect(() => {
        if (location.pathname === '/assets/add') {
            setSelectedAsset(null);
        }
    }, [location.pathname]);
    const [qrImageBlobUrl, setQrImageBlobUrl] = useState('');
    const [qrLoading, setQrLoading] = useState(false);
    const [detailsQRBlobUrl, setDetailsQRBlobUrl] = useState('');
    const [activeImage, setActiveImage] = useState(null);

    // Prevent background scrolling when lightbox, add/edit asset modal, or details modal is open
    useEffect(() => {
        if (activeImage || showAddModal || selectedAsset) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [activeImage, showAddModal, selectedAsset]);

    // Close lightbox on ESC key press & handle arrow navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setActiveImage(null);
            } else if (e.key === 'ArrowLeft' && selectedAsset?.images?.length > 1) {
                const idx = selectedAsset.images.indexOf(activeImage);
                if (idx !== -1) {
                    setActiveImage(selectedAsset.images[idx === 0 ? selectedAsset.images.length - 1 : idx - 1]);
                }
            } else if (e.key === 'ArrowRight' && selectedAsset?.images?.length > 1) {
                const idx = selectedAsset.images.indexOf(activeImage);
                if (idx !== -1) {
                    setActiveImage(selectedAsset.images[idx === selectedAsset.images.length - 1 ? 0 : idx + 1]);
                }
            }
        };
        if (activeImage) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeImage, selectedAsset]);

    const handlePrevImage = (e) => {
        e.stopPropagation();
        if (selectedAsset?.images) {
            const idx = selectedAsset.images.indexOf(activeImage);
            if (idx !== -1) {
                setActiveImage(selectedAsset.images[idx === 0 ? selectedAsset.images.length - 1 : idx - 1]);
            }
        }
    };

    const handleNextImage = (e) => {
        e.stopPropagation();
        if (selectedAsset?.images) {
            const idx = selectedAsset.images.indexOf(activeImage);
            if (idx !== -1) {
                setActiveImage(selectedAsset.images[idx === selectedAsset.images.length - 1 ? 0 : idx + 1]);
            }
        }
    };

    const handleCloseAddModal = () => {
        if (isEditing && editingId) {
            const originalAsset = assets.find(a => a.id === editingId);
            if (originalAsset) {
                setSelectedAsset(originalAsset);
            }
        }
        setShowAddModal(false);
        setIsEditing(false);
        setEditingId(null);
        setValidationErrors({});
    };

    useEffect(() => {
        let active = true;
        if (selectedAsset) {
            setDetailsQRBlobUrl('');
            setHistoryLogs([]);
            setHistoryLoading(true);

            if (selectedAsset.qrCode) {
                api.get(`/api/assets/${selectedAsset.assetId}/qr?t=${Date.now()}`, { responseType: 'blob' })
                    .then(res => {
                        if (active) {
                            const blobUrl = URL.createObjectURL(res.data);
                            setDetailsQRBlobUrl(blobUrl);
                        }
                    })
                    .catch(err => {
                        console.error("Failed to load details QR image:", err);
                    });
            }

            api.get(`/api/assets/${selectedAsset.assetId}/history`)
                .then(res => {
                    if (active) {
                        setHistoryLogs(Array.isArray(res.data) ? res.data : []);
                    }
                })
                .catch(err => {
                    console.error("Failed to load asset history logs:", err);
                })
                .finally(() => {
                    if (active) {
                        setHistoryLoading(false);
                    }
                });
        }
        return () => {
            active = false;
        };
    }, [selectedAsset]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const targetAssetId = urlParams.get('assetId');
        if (targetAssetId && assets && assets.length > 0) {
            const found = assets.find(a => a.assetId === targetAssetId);
            if (found) {
                setSelectedAsset(found);
                const newUrl = window.location.pathname + window.location.hash;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
    }, [assets]);

    const handleViewQR = async (asset) => {
        if (!asset) return;
        setQrLightbox(asset);
        setQrImageBlobUrl('');
        setQrLoading(true);
        try {
            const res = await api.get(`/api/assets/${asset.assetId}/qr?t=${Date.now()}`, { responseType: 'blob' });
            const blobUrl = URL.createObjectURL(res.data);
            setQrImageBlobUrl(blobUrl);
        } catch (err) {
            console.error("Failed to load QR tag image:", err);
        } finally {
            setQrLoading(false);
        }
    };

    useEffect(() => {
        if (showAddModal) {
            setCurrentStep(1);
        }
    }, [showAddModal]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = filteredAssets.map(a => a.id);
            setSelectedAssetIds(allIds);
        } else {
            setSelectedAssetIds([]);
        }
    };

    const handleSelectAsset = (e, assetId) => {
        e.stopPropagation();
        if (e.target.checked) {
            setSelectedAssetIds(prev => [...prev, assetId]);
        } else {
            setSelectedAssetIds(prev => prev.filter(id => id !== assetId));
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, categoryFilter, branchFilter, departmentFilter, conditionFilter, isDateFilterActive, dateRange]);



    const filteredAssets = useMemo(() => {
        const assetList = Array.isArray(assets) ? assets : [];
        if (assetList.length === 0) return [];

        const searchLower = searchQuery.trim().toLowerCase();
        const hasSearch = searchLower.length > 0;
        const catFilterLower = categoryFilter.map(f => f.trim().toLowerCase());
        const isCatAll = catFilterLower.includes('all');
        const branchFilterLower = branchFilter.map(f => f.trim().toLowerCase());
        const isBranchAll = branchFilterLower.includes('all');
        const deptFilterLower = departmentFilter.map(f => f.trim().toLowerCase());
        const isDeptAll = deptFilterLower.includes('all');
        const condFilterLower = conditionFilter.map(f => f.trim().toLowerCase());
        const isCondAll = condFilterLower.includes('all');

        return assetList.filter(a => {
            if (hasSearch) {
                const matchesSearch = (a.assetId || '').toLowerCase().includes(searchLower) ||
                    (a.assignee || '').toLowerCase().includes(searchLower) ||
                    (a.empCode || '').toLowerCase().includes(searchLower) ||
                    (a.location || '').toLowerCase().includes(searchLower) ||
                    (a.assetName || '').toLowerCase().includes(searchLower) ||
                    (a.category || '').toLowerCase().includes(searchLower) ||
                    (normalizeCategory(a.category) || '').toLowerCase().includes(searchLower) ||
                    (a.brand || '').toLowerCase().includes(searchLower) ||
                    (a.brandModel || '').toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }

            if (!isCatAll) {
                const itemCat = ((activeView === 'admin_assets' || String(a.group).toLowerCase() === 'admin' ? a.type : a.category) || '').trim().toLowerCase();
                if (!catFilterLower.includes(itemCat)) return false;
            }

            if (!isBranchAll) {
                const itemBranch = (a.branch || '').trim().toLowerCase();
                if (!branchFilterLower.includes(itemBranch)) return false;
            }

            if (!isDeptAll) {
                const itemDept = (a.department || '').trim().toLowerCase();
                if (!deptFilterLower.includes(itemDept)) return false;
            }

            if (!isCondAll) {
                const itemCond = ((activeView === 'admin_assets' || String(a.group).toLowerCase() === 'admin' ? a.status : a.condition) || '').trim().toLowerCase();
                if (!condFilterLower.includes(itemCond)) return false;
            }

            if (isDateFilterActive && dateRange[0] && a.date) {
                const assetDate = new Date(a.date);
                const start = new Date(dateRange[0].startDate);
                const end = new Date(dateRange[0].endDate);
                assetDate.setHours(0, 0, 0, 0);
                start.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);
                if (assetDate < start || assetDate > end) return false;
            }

            return true;
        });
    }, [assets, searchQuery, categoryFilter, branchFilter, departmentFilter, conditionFilter, isDateFilterActive, dateRange, activeView]);

    const displayTotalCount = totalServerItems > 0 ? totalServerItems : (filteredAssets.length || 0);
    const displayTotalPages = totalServerPages > 0 ? totalServerPages : Math.max(1, Math.ceil(displayTotalCount / ITEMS_PER_PAGE));
    const pagedAssets = (assets.length <= ITEMS_PER_PAGE) ? filteredAssets : filteredAssets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleAdd = async (e) => {
        e.preventDefault();

        const resolvedCategory = newAsset.category || (String(newAsset.group).toLowerCase() === 'admin' ? 'Furniture' : 'Laptop');
        const resolvedBranch = newAsset.branch || (currentBranchList[0] || '');
        const resolvedWarranty = newAsset.warranty || '1 Year';
        const resolvedCondition = newAsset.condition || 'Excellent';
        const resolvedDepartment = newAsset.department || 'IT';
        const resolvedGroup = newAsset.group || 'IT';
        const resolvedType = newAsset.type || (String(newAsset.group).toLowerCase() === 'admin' ? 'Building' : '');

        const resolvedAsset = {
            ...newAsset,
            category: resolvedCategory,
            branch: resolvedBranch,
            warranty: resolvedWarranty,
            condition: resolvedCondition,
            department: resolvedDepartment,
            group: resolvedGroup,
            type: resolvedType,
            updatedBy: user?.name || user?.email || 'System'
        };

        if (resolvedAsset.group !== 'Admin' && (!resolvedAsset.assignee || !resolvedAsset.assignee.trim())) {
            const el = document.getElementById('asset-assignee');
            if (el) el.reportValidity();
            return;
        }
        if (resolvedAsset.group !== 'Admin' && (!resolvedAsset.empCode || !resolvedAsset.empCode.trim())) {
            const el = document.getElementById('asset-emp-code');
            if (el) el.reportValidity();
            return;
        }
        if (!resolvedAsset.department) {
            alert('Department is a mandatory field.');
            return;
        }

        try {
            const apiPath = activeView === 'admin_assets' ? '/api/admin-assets' : '/api/assets';
            if (isEditing) {
                await api.put(`${apiPath}/${editingId}`, resolvedAsset);
                const updatedObj = { ...selectedAsset, ...resolvedAsset, qrCode: `/api/assets/${selectedAsset?.assetId || resolvedAsset.assetId}/qr` };
                setAssets(prev => prev.map(a => a.id === editingId ? updatedObj : a));
                setSelectedAsset(updatedObj);
                setIsEditing(false);
                setEditingId(null);
                setSuccessModal({ show: true, type: 'Update', id: selectedAsset?.assetId || resolvedAsset.assetId });
            } else {
                const res = await api.post(apiPath, resolvedAsset);
                const data = res.data;
                setAssets(prev => [...prev, { ...resolvedAsset, id: data.id, assetId: data.assetId, qrCode: `/api/assets/${data.assetId}/qr`, date: new Date().toISOString().split('T')[0] }]);
                setSuccessModal({ show: true, type: 'Add', id: data.assetId });
            }
        } catch (err) {
            console.error("Failed to save asset:", err);
            alert('Failed to save asset: ' + (err.response?.data?.error || err.message));
        }
        setShowAddModal(false);
        const resetGroup = activeView === 'admin_assets' ? 'Admin' : 'IT';
        const resetCategory = activeView === 'admin_assets' ? 'Furniture' : 'Laptop';
        const resetDept = activeView === 'admin_assets' ? 'ADMIN' : 'IT';
        setNewAsset({ assetId: '', category: resetCategory, brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: resetDept, branch: (currentBranchList[0] || ''), purchaseDate: '', warranty: '1 Year', condition: 'Excellent', remarks: '', images: [], qrCode: '', group: resetGroup, assetName: '', location: '', assetProvidedTeam: '', type: '', quantity: '', status: '', warrantyExpiry: '', purchaseCost: '' });
    };

    const handleEdit = (asset) => {
        setNewAsset(asset);
        setIsEditing(true);
        setEditingId(asset.id);
        setShowAddModal(true, true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this asset?')) {
            try {
                const apiPath = activeView === 'admin_assets' ? '/api/admin-assets' : '/api/assets';
                await api.delete(`${apiPath}/${id}`);
                setAssets(prev => prev.filter(a => a.id !== id));
            } catch {
                alert('Failed to delete asset.');
            }
        }
    };

    const handleNextStep = () => {
        if (String(newAsset.group).toLowerCase() === 'admin') {
            const errs = {};
            if (!newAsset.assetName || !newAsset.assetName.trim()) {
                errs.assetName = true;
            }
            if (!newAsset.type || !newAsset.type.trim()) {
                errs.type = true;
            }
            if (newAsset.quantity === undefined || newAsset.quantity === null || String(newAsset.quantity).trim() === '') {
                errs.quantity = true;
            }
            if (!newAsset.status || !newAsset.status.trim()) {
                errs.status = true;
            }

            if (Object.keys(errs).length > 0) {
                setValidationErrors(errs);
                return;
            }
            setValidationErrors({});
            setCurrentStep(2);
            return;
        }

        const brandInput = document.getElementById('asset-brand');
        const modelInput = document.getElementById('asset-model');
        const serialInput = document.getElementById('asset-serial');
        const purchaseDateInput = document.getElementById('asset-purchase-date');

        const configInput = document.getElementById('asset-config');

        const resolvedCategory = newAsset.category || 'Laptop';
        const resolvedBranch = newAsset.branch || 'Cotton Concepts HO_ Coimbatore';
        const resolvedWarranty = newAsset.warranty || '1 Year';
        const resolvedCondition = newAsset.condition || 'Excellent';

        if (!resolvedCategory || !resolvedCategory.trim()) {
            alert('Asset Type is a mandatory field.');
            return;
        }
        if (!newAsset.brand || !newAsset.brand.trim()) {
            if (brandInput) brandInput.reportValidity();
            return;
        }
        if (!newAsset.model || !newAsset.model.trim()) {
            if (modelInput) modelInput.reportValidity();
            return;
        }
        if (!newAsset.configuration || !newAsset.configuration.trim()) {
            if (configInput) configInput.reportValidity();
            return;
        }
        if (!resolvedBranch || !resolvedBranch.trim()) {
            alert('Branch is a mandatory field.');
            return;
        }

        setNewAsset(prev => ({
            ...prev,
            category: resolvedCategory,
            branch: resolvedBranch,
            warranty: resolvedWarranty,
            condition: resolvedCondition
        }));

        setCurrentStep(2);
    };

    const handleNextToStep3 = () => {
        if (String(newAsset.group).toLowerCase() === 'admin') {
            const errs = {};
            if (!newAsset.department || !newAsset.department.trim()) {
                errs.department = true;
            }
            if (!newAsset.branch || !newAsset.branch.trim()) {
                errs.branch = true;
            }

            if (Object.keys(errs).length > 0) {
                setValidationErrors(errs);
                return;
            }
            setValidationErrors({});
            setCurrentStep(3);
            return;
        }

        const assigneeInput = document.getElementById('asset-assignee');
        const empCodeInput = document.getElementById('asset-emp-code');

        const resolvedCondition = newAsset.condition || 'Excellent';
        const resolvedGroup = newAsset.group || 'IT';
        const resolvedDepartment = newAsset.department || 'IT';

        if (!resolvedCondition || !resolvedCondition.trim()) {
            alert('Condition is a mandatory field.');
            return;
        }
        if (!newAsset.assignee || !newAsset.assignee.trim()) {
            if (assigneeInput) assigneeInput.reportValidity();
            return;
        }
        if (newAsset.group !== 'Admin' && (!newAsset.empCode || !newAsset.empCode.trim())) {
            if (empCodeInput) empCodeInput.reportValidity();
            return;
        }
        if (!resolvedGroup || !resolvedGroup.trim()) {
            alert('Group is a mandatory field.');
            return;
        }
        if (!resolvedDepartment) {
            alert('Department is a mandatory field.');
            return;
        }

        setNewAsset(prev => ({
            ...prev,
            condition: resolvedCondition,
            group: resolvedGroup,
            department: resolvedDepartment
        }));

        setCurrentStep(3);
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + (newAsset.images || []).length > 2) {
            alert("Maximum 2 images allowed.");
            if (photosInputRef.current) photosInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
            return;
        }
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewAsset(prev => ({
                    ...prev,
                    images: [...(prev.images || []), reader.result]
                }));
            };
            reader.readAsDataURL(file);
        });
        if (photosInputRef.current) photosInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handleRemoveImage = (index) => {
        setNewAsset(prev => ({
            ...prev,
            images: (prev.images || []).filter((_, idx) => idx !== index)
        }));
    };

    const handleQRUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setNewAsset(prev => ({ ...prev, qrCode: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const stats = {
        total: assets.length
    };

    return (
        <div className="flex-1 flex flex-col px-20 py-8 pt-0 gap-8 animate-in fade-in duration-200">

            {/* Assets Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[calc(100vh-10px)] max-h-[calc(100vh-10px)] flex-1 overflow-hidden">
                <div className="flex flex-col w-full flex-1 min-h-0">
                    <div className="w-full bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" style={{ paddingRight: '5px' }}>
                        <table className="w-full text-left border-collapse table-fixed select-none">
                            <thead>
                                <tr className="bg-transparent">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[4%]">
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={filteredAssets.length > 0 && filteredAssets.every(a => selectedAssetIds.includes(a.id))}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-primary focus:ring-primary cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">Asset ID</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">Asset Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[18%]">{activeView === 'admin_assets' ? 'Asset Name' : 'Brand'}</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[13%]">Serial Number</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">{activeView === 'admin_assets' ? 'Assignee' : 'User Name'}</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[13%]">{activeView === 'admin_assets' ? 'Location' : 'Emp Code'}</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[13%]">{activeView === 'admin_assets' ? 'Status' : 'Condition'}</th>
                                </tr>
                            </thead>
                        </table>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                        <table className="w-full text-left border-collapse table-fixed">
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {assetsLoading ? (
                                    <tr>
                                        <td colSpan="9">
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-2"></div>
                                                <p className="text-slate-500 text-sm font-medium">Loading assets...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredAssets.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">No assets found matching the criteria.</td>
                                    </tr>
                                ) : (
                                    pagedAssets.map((asset, idx) => (
                                        <tr key={asset.id} onClick={() => setSelectedAsset(asset)} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
                                            <td className="px-6 py-4 w-[4%]" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => handleSelectAsset(e, asset.id)}
                                                    checked={selectedAssetIds.includes(asset.id)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-primary focus:ring-primary cursor-pointer"
                                                />
                                            </td>
                                            {/* <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 w-[4%]">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td> */}
                                            <td className="px-6 py-4 w-[12%]">
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{asset.assetId}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 w-[12%] truncate" title={(activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.type : normalizeCategory(asset.category)}>{(activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.type : normalizeCategory(asset.category)}</td>
                                            <td className="px-6 py-4 w-[18%]">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white truncate" title={(activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.assetName : (`${asset.brand || ''} ${asset.model || ''}`.trim() || asset.name)}>
                                                    {(activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.assetName : (asset.brand ? `${asset.brand} ${asset.model}` : asset.name)}
                                                </div>
                                                <div className="text-[11px] text-slate-400 truncate" title={`${asset.branch}`}>{asset.branch}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400 w-[13%] truncate" title={asset.serial}>{asset.serial}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 w-[15%] truncate" title={asset.assignee}>{asset.assignee}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 w-[13%] truncate" title={(activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.location : (asset.empCode || '—')}>{(activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.location : (asset.empCode || '—')}</td>
                                            <td className="px-6 py-4 w-[13%]">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'excellent' || ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                    ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'good' || ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'in stock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                                        ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'medium' || ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'fair' || ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'under maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                                            ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'scrap' || ((activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition)?.toLowerCase() === 'poor' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}>
                                                    {(activeView === 'admin_assets' || String(asset.group).toLowerCase() === 'admin') ? asset.status : asset.condition || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 min-w-[240px]">
                            Showing <span className="font-medium">{displayTotalCount > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, displayTotalCount)}</span> of <span className="font-medium">{displayTotalCount}</span> assets
                        </p>
                        <div className="flex justify-center flex-1">
                            {selectedAssetIds.length > 0 && (
                                <span className="text-xs font-bold text-primary animate-in fade-in slide-in-from-bottom-2 duration-150 bg-primary/10 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-primary/20">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                                    {selectedAssetIds.length} {selectedAssetIds.length === 1 ? 'RECORD' : 'RECORDS'} SELECTED
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 min-w-[240px] justify-end">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-1 py-1 border border-1 border-solid border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center text-slate-600 dark:text-slate-400"
                                title="Previous Page"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                            </button>
                            {Array.from({ length: displayTotalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === displayTotalPages || Math.abs(p - currentPage) <= 1)
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
                                            className={`px-3 py-1 text-sm rounded transition-colors ${currentPage === item
                                                ? 'bg-primary text-white'
                                                : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >{item}</button>
                                    )
                                )
                            }
                            <button
                                onClick={() => setCurrentPage(p => Math.min(displayTotalPages, p + 1))}
                                disabled={currentPage === displayTotalPages}
                                className="px-1 py-1 border border-1 border-solid border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center text-slate-600 dark:text-slate-400"
                                title="Next Page"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Asset Detail Modal */}
            {selectedAsset && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200" onClick={() => setSelectedAsset(null)}>
                    <div className="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-2xl w-full max-w-2xl h-full sm:h-auto max-h-screen sm:max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-primary text-lg">inventory_2</span>
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-800 dark:text-white leading-tight">Asset Details</h2>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedAsset.assetId || `#${selectedAsset.id}`}</p>
                                </div>
                                <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">{normalizeCategory(selectedAsset.category)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleViewQR(selectedAsset)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="View QR Code Label"
                                >
                                    <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
                                    Show QR Code
                                </button>
                                {hasEditPermission && (
                                    <button
                                        onClick={() => { handleEdit(selectedAsset); setSelectedAsset(null); }}
                                        title="Edit Asset"
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">edit</span>
                                        Edit
                                    </button>
                                )}
                                <button onClick={() => setSelectedAsset(null)} className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {String(selectedAsset.group).toLowerCase() === 'admin' ? (
                                <>
                                    {/* Admin Asset Info */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Asset Info</p>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Asset Name</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedAsset.assetName || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Sub-type</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedAsset.category || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Type</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedAsset.type || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Brand/Model</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedAsset.brandModel || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Serial Number</p>
                                                <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{selectedAsset.serial || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Quantity (Nos)</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedAsset.quantity || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${selectedAsset.status?.toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    selectedAsset.status?.toLowerCase() === 'in stock' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        selectedAsset.status?.toLowerCase() === 'under maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                                                    {selectedAsset.status || '—'}
                                                </span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Purchase Cost</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.purchaseCost || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Warranty Expiry</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.warrantyExpiry || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Admin Assignment */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Assignment</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Assigned To</p>
                                                <p className="text-sm font-medium text-slate-800 dark:text-white">{selectedAsset.assignee || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Department</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.department || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Branch</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.branch || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.location || '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Device Info */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Device Info</p>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Brand</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedAsset.brand || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Model</p>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">{selectedAsset.model || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 col-span-2 lg:col-span-1">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Serial Number</p>
                                                <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{selectedAsset.serial || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 col-span-2">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Configuration</p>
                                                <p className="text-sm text-slate-700 dark:text-slate-300">{selectedAsset.configuration || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Group</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.group || 'IT'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Condition & Dates */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Condition &amp; Dates</p>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Condition</p>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${selectedAsset.condition === 'Excellent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    selectedAsset.condition === 'Good' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        selectedAsset.condition === 'Fair' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                                                    {selectedAsset.condition || '—'}
                                                </span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Purchase Date</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.purchaseDate || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Warranty Duration</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {selectedAsset.warrantyLabel || selectedAsset.warranty || '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assignment */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Assignment</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Assigned To</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-slate-800 dark:text-white">{selectedAsset.assignee || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Emp Code</p>
                                                <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">{selectedAsset.empCode || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Department</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.department || '—'}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Branch</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedAsset.branch || '—'}</p>
                                            </div>
                                            {(selectedAsset.cug || selectedAsset.email) && (
                                                <>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">CUG Number</p>
                                                        <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{selectedAsset.cug || '—'}</p>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                                                        <p className="text-sm text-slate-700 dark:text-slate-300 break-all">{selectedAsset.email || '—'}</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Device Images - always visible */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device Images</p>
                                </div>
                                {(selectedAsset.images && selectedAsset.images.length > 0) ? (
                                    <div className="flex flex-wrap gap-3">
                                        {selectedAsset.images.map((img, i) => (
                                            <div key={i} className="flex flex-col items-center gap-1.5">
                                                <div
                                                    onClick={() => setActiveImage(img)}
                                                    className="relative w-28 h-28 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 shadow-sm cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all active:scale-[0.98] group/thumb"
                                                >
                                                    <img src={img} loading="lazy" alt={`Asset image ${i + 1}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/15 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                                        <span className="material-symbols-outlined text-white text-[18px] bg-slate-900/60 p-1.5 rounded-full backdrop-blur-sm border border-slate-800/50">zoom_in</span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-medium">Image {i + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                                        <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-2xl">photo_camera</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No images uploaded</p>
                                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                                                Image Pending
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Asset History */}
                            <div className="mt-2 mb-6">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Asset History</p>
                                {historyLoading ? (
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                                        Loading history...
                                    </div>
                                ) : historyLogs && historyLogs.length > 0 ? (
                                    <div className="bg-slate-50 dark:bg-slate-850/30 border border-slate-100 dark:border-slate-800/50 rounded-xl p-4 max-h-48 overflow-y-auto space-y-3">
                                        {historyLogs.map((log, idx) => (
                                            <div key={idx} className="text-xs flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-2 border-b border-slate-200/50 dark:border-slate-800/30 last:border-b-0 last:pb-0">
                                                <div className="text-slate-700 dark:text-slate-300">
                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{log.fieldName}</span> updated from <span className="font-mono bg-slate-200/50 dark:bg-slate-700/50 px-1 rounded">{log.oldValue || 'none'}</span> to <span className="font-mono bg-slate-200/50 dark:bg-slate-700/50 px-1 rounded">{log.newValue || 'none'}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-450 shrink-0 font-medium self-end sm:self-auto">
                                                    by {log.changedBy || 'System'} at {log.changedAt}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-slate-50/50 dark:bg-slate-800/10 border border-slate-100/30 dark:border-slate-800/30 rounded-xl p-4 text-xs text-slate-400 italic">
                                        No history logs recorded for this asset yet.
                                    </div>
                                )}
                            </div>

                            {/* Remarks */}
                            {selectedAsset.remarks && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Remarks</p>
                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/40 rounded-xl p-4">
                                        <p className="text-sm text-slate-700 dark:text-amber-200/80 leading-relaxed whitespace-pre-wrap">{selectedAsset.remarks}</p>
                                    </div>
                                </div>
                            )}

                            {/* Footer: Last Updated */}
                            {selectedAsset.updatedAt && (
                                <p className="text-[11px] text-slate-400 text-right">Last updated: {selectedAsset.updatedAt}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FULL SCREEN LIGHTBOX FOR DEVICE IMAGES */}
            {activeImage && (
                <div
                    className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setActiveImage(null)}
                >
                    {/* Close Button */}
                    <button
                        onClick={() => setActiveImage(null)}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-800/80 text-white/90 hover:text-white flex items-center justify-center transition-all border border-slate-800 cursor-pointer shadow-lg z-[310]"
                        title="Close Full Screen"
                    >
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>

                    {/* Left Navigation Arrow */}
                    {selectedAsset?.images?.length > 1 && (
                        <button
                            onClick={handlePrevImage}
                            className="absolute left-4 sm:left-6 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-800/80 text-white/90 hover:text-white flex items-center justify-center transition-all border border-slate-800 cursor-pointer shadow-lg z-[310] active:scale-95"
                            title="Previous Image"
                        >
                            <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                        </button>
                    )}

                    {/* Right Navigation Arrow */}
                    {selectedAsset?.images?.length > 1 && (
                        <button
                            onClick={handleNextImage}
                            className="absolute right-4 sm:right-6 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-800/80 text-white/90 hover:text-white flex items-center justify-center transition-all border border-slate-800 cursor-pointer shadow-lg z-[310] active:scale-95"
                            title="Next Image"
                        >
                            <span className="material-symbols-outlined text-[24px]">chevron_right</span>
                        </button>
                    )}

                    {/* Image Container with Page Indicator */}
                    <div
                        className="relative max-w-full max-h-[85vh] flex flex-col items-center justify-center gap-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <img
                            src={activeImage}
                            alt="Device Photo Fullscreen"
                            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-900/50 animate-in zoom-in-95 duration-200"
                        />
                        {selectedAsset?.images?.length > 1 && (
                            <span className="px-3 py-1.5 rounded-full bg-slate-900/60 text-[11px] font-bold text-slate-300 border border-slate-800 tracking-wider">
                                {selectedAsset.images.indexOf(activeImage) + 1} / {selectedAsset.images.length}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Add/Edit Asset Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 mb-6">
                            <h3 className="font-semibold text-slate-800 dark:text-white text-lg font-display">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h3>
                            <button onClick={handleCloseAddModal} className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleAdd} className="space-y-4 overflow-y-auto flex-1 px-6 pb-6">
                            {currentStep === 1 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    {String(newAsset.group).toLowerCase() === 'admin' ? (
                                        <div className="space-y-4">
                                            {/* Row 1: Asset Name + Sub-type + Type */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Asset Name <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={newAsset.assetName || ''}
                                                        onChange={e => {
                                                            setNewAsset(p => ({ ...p, assetName: e.target.value }));
                                                            setValidationErrors(prev => ({ ...prev, assetName: false }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm focus:ring-2 outline-none text-slate-800 dark:text-white font-medium ${validationErrors.assetName
                                                            ? 'border-red-500 focus:ring-red-500/20'
                                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary'
                                                            }`}
                                                        placeholder="e.g. Office Desk"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Type <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        label="Select Type"
                                                        value={newAsset.type || ''}
                                                        onChange={v => {
                                                            setNewAsset(p => ({ ...p, type: v }));
                                                            setValidationErrors(prev => ({ ...prev, type: false }));
                                                        }}
                                                        options={assetTypes?.filter(t => (t.asset_group || 'IT').split(',').includes('Admin')).map(t => t.name).sort((a, b) => a.localeCompare(b)) || []}
                                                        error={validationErrors.type}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Sub-type</label>
                                                    <input
                                                        type="text"
                                                        value={newAsset.category || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, category: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. Chair"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 2: Brand/Model + Serial No + Quantity (Nos) */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Brand/Model</label>
                                                    <input
                                                        type="text"
                                                        value={newAsset.brand || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, brand: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. Godrej"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Serial No</label>
                                                    <input
                                                        type="text"
                                                        value={newAsset.serial || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, serial: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-mono"
                                                        placeholder="e.g. SN-12345"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Quantity (Nos) <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        required
                                                        value={newAsset.quantity || ''}
                                                        onChange={e => {
                                                            setNewAsset(p => ({ ...p, quantity: e.target.value }));
                                                            setValidationErrors(prev => ({ ...prev, quantity: false }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm focus:ring-2 outline-none text-slate-800 dark:text-white font-medium ${validationErrors.quantity
                                                            ? 'border-red-500 focus:ring-red-500/20'
                                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary'
                                                            }`}
                                                        placeholder="e.g. 1"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 3: Status + Purchase Cost + Warranty Expiry */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Status <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        label="Select Status"
                                                        value={newAsset.status || ''}
                                                        onChange={v => {
                                                            setNewAsset(p => ({ ...p, status: v }));
                                                            setValidationErrors(prev => ({ ...prev, status: false }));
                                                        }}
                                                        options={['Active', 'In Stock', 'Under Maintenance', 'Scrap']}
                                                        error={validationErrors.status}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Purchase Cost</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={newAsset.purchaseCost || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, purchaseCost: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. 5000"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Warranty Expiry</label>
                                                    <input
                                                        type="date"
                                                        value={newAsset.warrantyExpiry || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, warrantyExpiry: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 4: Remarks */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Remarks</label>
                                                <textarea
                                                    value={newAsset.remarks || ''}
                                                    onChange={e => setNewAsset(p => ({ ...p, remarks: e.target.value }))}
                                                    rows="2"
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium resize-none"
                                                    placeholder="e.g. Location specifics or conditions..."
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Row 1: Asset Type + Brand */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Asset Type <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        value={newAsset.category || ''}
                                                        onChange={v => setNewAsset(p => ({ ...p, category: v }))}
                                                        options={assetTypes?.filter(t => (t.asset_group || 'IT') === 'IT').map(t => t.name) || []}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Brand <span className="text-red-500">*</span></label>
                                                    <input
                                                        id="asset-brand"
                                                        type="text"
                                                        required
                                                        value={newAsset.brand || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, brand: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. Apple"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Model <span className="text-red-500">*</span></label>
                                                    <input
                                                        id="asset-model"
                                                        type="text"
                                                        required
                                                        value={newAsset.model || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, model: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder='e.g. MacBook Pro 16"'
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 2: Model + Serial Number + Configuration + Branch */}
                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Serial Number</label>
                                                    <input
                                                        id="asset-serial"
                                                        type="text"
                                                        value={newAsset.serial}
                                                        onChange={e => setNewAsset(p => ({ ...p, serial: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-mono"
                                                        placeholder="e.g. C02F123XYZ45"
                                                    />
                                                </div>
                                                <div className="col-span-2 lg:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Configuration <span className="text-red-500">*</span></label>
                                                    <input
                                                        id="asset-config"
                                                        type="text"
                                                        required
                                                        value={newAsset.configuration || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, configuration: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. M3 Pro, 18GB, 512GB"
                                                    />
                                                </div>
                                                <div className="col-span-2 lg:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Branch <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        value={newAsset.branch || (currentBranchList[0] || '')}
                                                        onChange={v => setNewAsset(p => ({ ...p, branch: v }))}
                                                        options={currentBranchList}
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 3: Purchase Date + Warranty (date) + Condition */}
                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Purchase Date</label>
                                                    <input
                                                        id="asset-purchase-date"
                                                        type="date"
                                                        value={newAsset.purchaseDate || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, purchaseDate: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Warranty</label>
                                                    <SelectDropdown
                                                        value={newAsset.warranty || '1 Year'}
                                                        onChange={v => setNewAsset(p => ({ ...p, warranty: v }))}
                                                        options={['6 Months', '1 Year', '2 Years', '3 Years', '4 Years', '5 Years']}
                                                    />
                                                </div>
                                                <div className="col-span-2 lg:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Condition <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        value={newAsset.condition || 'Excellent'}
                                                        onChange={v => setNewAsset(p => ({ ...p, condition: v }))}
                                                        options={['Excellent', 'Good', 'Medium', 'Average', 'Scrap', "Stock"]}
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 4: Remarks (full width) */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Remarks</label>
                                                <textarea
                                                    value={newAsset.remarks || ''}
                                                    onChange={e => setNewAsset(p => ({ ...p, remarks: e.target.value }))}
                                                    rows="2"
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium resize-none"
                                                    placeholder="e.g. Write remarks about the device..."
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col-reverse lg:flex-row gap-3 pt-4">
                                        <button type="button" onClick={handleCloseAddModal} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleNextStep}
                                            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            Next: User Details
                                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    {String(newAsset.group).toLowerCase() === 'admin' ? (
                                        <div className="space-y-4">
                                            {/* Row 1: Assigned To + Department */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Assigned To</label>
                                                    <input
                                                        id="asset-assignee"
                                                        type="text"
                                                        value={newAsset.assignee || ''}
                                                        onChange={e => {
                                                            setNewAsset(p => ({ ...p, assignee: e.target.value }));
                                                            setValidationErrors(prev => ({ ...prev, assignee: false }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm focus:ring-2 outline-none text-slate-800 dark:text-white font-medium ${validationErrors.assignee
                                                            ? 'border-red-500 focus:ring-red-500/20'
                                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary'
                                                            }`}
                                                        placeholder="e.g. John Doe"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Department <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        label="Select Department"
                                                        value={newAsset.department || ''}
                                                        onChange={v => {
                                                            setNewAsset(p => ({ ...p, department: v }));
                                                            setValidationErrors(prev => ({ ...prev, department: false }));
                                                        }}
                                                        options={departments?.length > 0 ? departments.map(d => d.name) : ['Admin', 'HR', 'Finance', 'Sales', 'Production', 'Logistics']}
                                                        maxHeight="max-h-20"
                                                        error={validationErrors.department}
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 2: Branch + Location */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Branch <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        label="Select Branch"
                                                        value={newAsset.branch || ''}
                                                        onChange={v => {
                                                            setNewAsset(p => ({ ...p, branch: v }));
                                                            setValidationErrors(prev => ({ ...prev, branch: false }));
                                                        }}
                                                        options={currentBranchList}
                                                        direction='up'
                                                        maxHeight='max-h-20'
                                                        error={validationErrors.branch}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Location</label>
                                                    <input
                                                        type="text"
                                                        value={newAsset.location || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, location: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. First Floor Cabin 2"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">User Name <span className="text-red-500">*</span></label>
                                                    <input
                                                        id="asset-assignee"
                                                        type="text"
                                                        required
                                                        value={newAsset.assignee || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, assignee: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. John Doe or Unassigned"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Employee Code <span className="text-red-500">*</span></label>
                                                    <input
                                                        id="asset-emp-code"
                                                        type="text"
                                                        required
                                                        value={newAsset.empCode || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, empCode: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. EMP001"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Department <span className="text-red-500">*</span></label>
                                                    <SelectDropdown
                                                        value={newAsset.department || 'IT'}
                                                        onChange={v => setNewAsset(p => ({ ...p, department: v }))}
                                                        options={departments?.length > 0 ? departments.map(d => d.name) : ['IT', 'HR', 'Finance', 'Sales', 'Production', 'Logistics']}
                                                        maxHeight="max-h-35"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Email Address</label>
                                                    <input
                                                        type="email"
                                                        value={newAsset.email || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, email: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. user@company.com"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">CUG (SIM Number)</label>
                                                    <input
                                                        type="text"
                                                        value={newAsset.cug || ''}
                                                        onChange={e => setNewAsset(p => ({ ...p, cug: e.target.value }))}
                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                                        placeholder="e.g. +91 98765 43210"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col-reverse lg:flex-row gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                                            Back: Device Details
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleNextToStep3}
                                            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            Next: Upload Images
                                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex flex-col gap-3">
                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 font-display">Asset Photos <span className="font-normal text-slate-400">(max 2)</span></label>
                                        <div
                                            onClick={handleUploadContainerClick}
                                            className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 transition-all hover:bg-slate-50 dark:hover:bg-slate-900/50 relative group min-h-[140px] cursor-pointer"
                                        >
                                            <input
                                                type="file"
                                                ref={photosInputRef}
                                                multiple
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none sm:pointer-events-auto sm:cursor-pointer z-10"
                                                disabled={(newAsset.images || []).length >= 2}
                                            />
                                            <input
                                                type="file"
                                                ref={cameraInputRef}
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                            <div className="flex flex-col items-center text-center space-y-1.5 pointer-events-none">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Click or drag to upload asset photos</p>
                                                <p className="text-[11px] text-slate-400">PNG, JPG, WEBP (max 2)</p>
                                            </div>
                                        </div>
                                        {(newAsset.images || []).length > 0 && (
                                            <div className="grid grid-cols-2 gap-3 mt-1">
                                                {newAsset.images.map((img, idx) => (
                                                    <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group bg-slate-100 dark:bg-slate-950">
                                                        <img src={img} loading="lazy" alt={`Asset preview ${idx + 1}`} className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveImage(idx)}
                                                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow z-20 cursor-pointer"
                                                            title="Remove"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col-reverse lg:flex-row gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(2)}
                                            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                                            Back: User Details
                                        </button>
                                        <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors cursor-pointer">
                                            {isEditing ? 'Save Changes' : 'Add Asset'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* QR Code Lightbox */}
            {qrLightbox && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
                    onClick={() => setQrLightbox(null)}
                >
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[540px]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between w-full">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 font-display">
                                <span className="material-symbols-outlined text-primary text-lg">qr_code_2</span>
                                Asset Tag Sticker
                            </h4>
                            <button
                                onClick={() => setQrLightbox(null)}
                                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <div className="w-full bg-slate-50 dark:bg-slate-950 p-4 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800/60 min-h-[160px]">
                            {qrLoading ? (
                                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-8 animate-pulse">
                                    <span className="material-symbols-outlined text-3xl animate-spin text-primary">autorenew</span>
                                    <span className="text-xs font-semibold">Generating Sticker...</span>
                                </div>
                            ) : qrImageBlobUrl ? (
                                <img
                                    src={qrImageBlobUrl}
                                    alt="Asset Tag sticker"
                                    className="w-full max-w-[240px] sm:max-w-[320px] lg:max-w-full h-auto object-contain rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 bg-white"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2 text-red-500 py-8 font-medium">
                                    <span className="material-symbols-outlined text-3xl">error</span>
                                    <span className="text-xs">Failed to load sticker image</span>
                                </div>
                            )}
                        </div>
                        <a
                            href={qrImageBlobUrl || '#'}
                            download={`${qrLightbox.assetId || 'asset'}_tag.png`}
                            onClick={(e) => {
                                if (qrLoading || !qrImageBlobUrl) {
                                    e.preventDefault();
                                }
                            }}
                            className={`w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${qrLoading || !qrImageBlobUrl
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20 cursor-pointer'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            {qrLoading ? 'Loading Tag...' : 'Download Label PNG'}
                        </a>
                    </div>
                </div>
            )}
            {showSourceModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-end sm:items-center justify-center p-4" onClick={() => setShowSourceModal(false)}>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom duration-200" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <h4 className="font-bold text-slate-800 dark:text-white text-base font-display">Add Photo</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Choose an image source to upload</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSourceModal(false);
                                    cameraInputRef.current?.click();
                                }}
                                className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border border-slate-100 dark:border-slate-855 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined text-2xl">photo_camera</span>
                                </div>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-display">Camera</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSourceModal(false);
                                    photosInputRef.current?.click();
                                }}
                                className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border border-slate-100 dark:border-slate-855 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                    <span className="material-symbols-outlined text-2xl">image</span>
                                </div>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-display">Photos</span>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowSourceModal(false)}
                            className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-705 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors cursor-pointer text-center text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {/* SUCCESS MODAL CARD */}
            {successModal.show && (
                <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSuccessModal({ ...successModal, show: false })}>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 flex flex-col items-center" onClick={e => e.stopPropagation()}>
                        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500 dark:text-emerald-450 flex items-center justify-center mb-4 border border-emerald-200 dark:border-emerald-800/30 shadow-md">
                            <span className="material-symbols-outlined text-[36px]">check_circle</span>
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{successModal.type === 'Add' ? 'Added Successfully' : 'Update Successful'}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                            The details for asset <strong className="text-slate-700 dark:text-slate-350 font-semibold">{successModal.id || selectedAsset?.assetId || newAsset.assetId}</strong> have been {successModal.type === 'Add' ? 'added' : 'updated'} successfully.
                        </p>
                        <button
                            onClick={() => setSuccessModal({ ...successModal, show: false })}
                            className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-650 dark:hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] cursor-pointer text-sm"
                        >
                            Okay, Got it
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const AssigneesView = ({ assignees, setAssignees, assigneesLoading, isExpanded, onToggle, hasEditPermission }) => {
    const [showAddAssignee, setShowAddAssignee] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const filteredAssignees = (assignees || []).filter(a =>
        (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.support_type || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const [editingAssignee, setEditingAssignee] = useState(null);
    const [name, setName] = useState('');
    const [supportType, setSupportType] = useState('IT Support');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);

    const toggleSupportType = (type) => {
        setSupportType(prev => {
            const arr = prev ? String(prev).split(',').map(s => s.trim()).filter(Boolean) : [];
            const next = arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type];
            return next.join(',');
        });
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !supportType) {
            setError('Name and support type are required.');
            return;
        }
        const lowerName = name.trim().toLowerCase();
        const exists = assignees.some(a => a.name.trim().toLowerCase() === lowerName && (!editingAssignee || a.id !== editingAssignee.id));
        if (exists) {
            setError('Assignee name already exists.');
            return;
        }
        setIsSubmitting(true);
        try {
            if (editingAssignee) {
                await api.put(`/api/assignees/${editingAssignee.id}`, { name, support_type: supportType });
            } else {
                await api.post('/api/assignees', { name, support_type: supportType });
            }
            const res = await api.get('/api/assignees');
            setAssignees(res.data);
            handleCloseModal();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${editingAssignee ? 'edit' : 'add'} assignee.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setShowAddAssignee(false);
        setEditingAssignee(null);
        setName('');
        setSupportType('IT Support');
        setError('');
    };

    const handleOpenEdit = (assignee) => {
        setEditingAssignee(assignee);
        setName(assignee.name);
        setSupportType(assignee.support_type);
        setShowAddAssignee(true);
    };

    const handleDeleteClick = (assignee) => {
        setItemToDelete(assignee);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await api.delete(`/api/assignees/${itemToDelete.id}`);
            const res = await api.get('/api/assignees');
            setAssignees(res.data);
            setItemToDelete(null);
        } catch (err) {
            alert('Failed to delete assignee.');
        }
    };

    return (
        <div className="w-full shrink-0 px-20 py-8 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-4 flex items-end justify-between">
                <div onClick={onToggle} className="cursor-pointer group select-none">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        Assignees ({assignees?.length || 0})
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage support staff who can be assigned to tickets.</p>
                </div>
                {isExpanded && (
                    <div className="flex items-center gap-3">
                        <div className="relative w-64 animate-in fade-in zoom-in-95 duration-200">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                placeholder="Search assignees..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddAssignee(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Add Assignee
                        </button>
                    </div>
                )}
            </div>

            {/* List */}
            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-y-auto overflow-x-auto custom-scrollbar max-h-[500px]">
                    {assigneesLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading assignees...</div>
                    ) : (assignees || []).length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No assignees found. Add one on the left.</div>
                    ) : filteredAssignees.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No assignees match your search criteria.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-sm">
                                    <tr className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800">
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[12%]' : 'w-[15%]'}`}>S.No</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[48%]' : 'w-[55%]'}`}>Assignee Name</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[25%]' : 'w-[30%]'}`}>Support Type</th>
                                        {hasEditPermission && <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>}
                                    </tr>
                                </thead>
                            </table>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Array.isArray(filteredAssignees) && filteredAssignees.map((a, idx) => (
                                            <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className={`px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 ${hasEditPermission ? 'w-[12%]' : 'w-[15%]'}`}>{idx + 1}</td>
                                                <td className={`px-6 py-4 ${hasEditPermission ? 'w-[48%]' : 'w-[55%]'}`}>
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{a.name}</div>
                                                    <div className="text-xs text-slate-400">Added {formatCreatedAt(a.created_at)}</div>
                                                </td>
                                                <td className={`px-6 py-4 ${hasEditPermission ? 'w-[25%]' : 'w-[30%]'}`}>
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${a.support_type === 'IT Support' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : a.support_type === 'Admin Support' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'}`}>
                                                        {a.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : a.support_type}
                                                    </span>
                                                </td>
                                                {hasEditPermission && (
                                                    <td className="px-6 py-4 w-[15%]">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                title="Edit Assignee"
                                                                onClick={() => handleOpenEdit(a)}
                                                                className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-blue-600 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                            </button>
                                                            <button
                                                                title="Delete Assignee"
                                                                onClick={() => handleDeleteClick(a)}
                                                                className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-red-600 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                                Delete Assignee
                            </h3>
                            <button
                                onClick={() => setItemToDelete(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-white">{itemToDelete.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setItemToDelete(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Assignee Modal */}
            {showAddAssignee && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-slate-800 dark:text-white">{editingAssignee ? 'Edit Assignee' : 'Add New Assignee'}</h3>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleAdd} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    placeholder="e.g. John Doe"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Support Type</label>
                                <MultiSelectFormDropdown
                                    label="Support Type"
                                    options={['IT Support', 'Admin Support', 'Courier']}
                                    selected={supportType}
                                    onChange={toggleSupportType}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white ${isSubmitting ? 'bg-primary/70 cursor-wait' : 'bg-primary hover:bg-primary/90'}`}
                                >
                                    {isSubmitting ? 'Saving...' : editingAssignee ? 'Save Changes' : 'Add Assignee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const AssetTypesView = ({ assetTypes, setAssetTypes, assetTypesLoading, isExpanded, onToggle, hasEditPermission }) => {
    const [showAddType, setShowAddType] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const filteredAssetTypes = (assetTypes || []).filter(t =>
        (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.prefix || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.asset_group || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const [editingType, setEditingType] = useState(null);
    const [name, setName] = useState('');
    const [assetGroup, setAssetGroup] = useState(['IT']);
    const [prefix, setPrefix] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [typeToDelete, setTypeToDelete] = useState(null);

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) {
            setError('Name is required.');
            return;
        }
        const lowerName = name.trim().toLowerCase();
        const exists = assetTypes.some(t => t.name.trim().toLowerCase() === lowerName && (!editingType || t.id !== editingType.id));
        if (exists) {
            setError('Asset type name already exists.');
            return;
        }
        if (assetGroup.length === 0) {
            setError('At least one group must be selected.');
            return;
        }
        if (!prefix.trim()) {
            setError('Prefix code is required.');
            return;
        }
        const cleanedPrefix = prefix.trim().toUpperCase();
        if (cleanedPrefix.length < 2 || cleanedPrefix.length > 3) {
            setError('Prefix value must be 2 to 3 characters.');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                asset_group: assetGroup.join(','),
                prefix: cleanedPrefix
            };
            if (editingType) {
                await api.put(`/api/asset_types/${editingType.id}`, payload);
            } else {
                await api.post('/api/asset_types', payload);
            }
            const res = await api.get('/api/asset_types');
            setAssetTypes(res.data);
            handleCloseModal();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${editingType ? 'edit' : 'add'} asset type.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setShowAddType(false);
        setEditingType(null);
        setName('');
        setAssetGroup(['IT']);
        setPrefix('');
        setError('');
    };

    const handleOpenEdit = (type) => {
        setEditingType(type);
        setName(type.name);
        setAssetGroup(type.asset_group ? type.asset_group.split(',') : ['IT']);
        setPrefix(type.prefix || '');
        setShowAddType(true);
    };

    const handleDeleteClick = (type) => {
        setTypeToDelete(type);
    };

    const confirmDelete = async () => {
        if (!typeToDelete) return;
        try {
            await api.delete(`/api/asset_types/${typeToDelete.id}`);
            const res = await api.get('/api/asset_types');
            setAssetTypes(res.data);
            setTypeToDelete(null);
        } catch (err) {
            alert('Failed to delete asset type.');
        }
    };

    return (
        <div className="w-full shrink-0 px-20 py-8 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-4 flex items-end justify-between">
                <div onClick={onToggle} className="cursor-pointer group select-none">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        Asset Types ({assetTypes?.length || 0})
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage asset categories dynamically.</p>
                </div>
                {isExpanded && (
                    <div className="flex items-center gap-3">
                        <div className="relative w-64 animate-in fade-in zoom-in-95 duration-200">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                placeholder="Search asset types..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddType(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Add Type
                        </button>
                    </div>
                )}
            </div>

            {/* List */}
            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-y-auto overflow-x-auto custom-scrollbar max-h-[500px]">
                    {assetTypesLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading asset types...</div>
                    ) : (assetTypes || []).length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No asset types found. Add one on the left.</div>
                    ) : filteredAssetTypes.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No asset types match your search criteria.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-sm">
                                    <tr className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800">
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[10%]' : 'w-[12%]'}`}>S.No</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[40%]' : 'w-[45%]'}`}>Type Name</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[20%]' : 'w-[25%]'}`}>Group</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[15%]' : 'w-[18%]'}`}>Prefix</th>
                                        {hasEditPermission && <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {Array.isArray(filteredAssetTypes) && filteredAssetTypes.map((c, idx) => (
                                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className={`px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 ${hasEditPermission ? 'w-[10%]' : 'w-[12%]'}`}>{idx + 1}</td>
                                            <td className={`px-6 py-4 ${hasEditPermission ? 'w-[40%]' : 'w-[45%]'}`}>
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                                                <div className="text-xs text-slate-400">Added {formatCreatedAt(c.created_at)}</div>
                                            </td>
                                            <td className={`px-6 py-4 ${hasEditPermission ? 'w-[20%]' : 'w-[25%]'}`}>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(c.asset_group || 'IT').split(',').map(grp => (
                                                        <span key={grp} className={`px-3 py-1.5 rounded-full text-[12px] font-semibold leading-none ${grp === 'Admin'
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                            }`}>
                                                            {grp}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200 ${hasEditPermission ? 'w-[15%]' : 'w-[18%]'}`}>
                                                {c.prefix || '—'}
                                            </td>
                                            {hasEditPermission && (
                                                <td className="px-6 py-4 w-[15%]">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            title="Edit Type"
                                                            onClick={() => handleOpenEdit(c)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-blue-600 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                                        </button>
                                                        <button
                                                            title="Delete Type"
                                                            onClick={() => handleDeleteClick(c)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-red-650 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {typeToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                                Delete Type
                            </h3>
                            <button
                                onClick={() => setTypeToDelete(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-white">{typeToDelete.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setTypeToDelete(null)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddType && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                                {editingType ? 'Edit Asset Type' : 'Add New Asset Type'}
                            </h3>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Type Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Printer"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Group</label>
                                    <div className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3 h-[46px]">
                                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer font-medium select-none">
                                            <input
                                                type="checkbox"
                                                checked={assetGroup.includes('IT')}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setAssetGroup(p => [...p, 'IT']);
                                                    } else {
                                                        setAssetGroup(p => p.filter(x => x !== 'IT'));
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                                            />
                                            IT
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer font-medium select-none">
                                            <input
                                                type="checkbox"
                                                checked={assetGroup.includes('Admin')}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setAssetGroup(p => [...p, 'Admin']);
                                                    } else {
                                                        setAssetGroup(p => p.filter(x => x !== 'Admin'));
                                                    }
                                                }}
                                                className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                                            />
                                            Admin
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Prefix Code (2-3 chars)</label>
                                    <input
                                        type="text"
                                        value={prefix}
                                        onChange={e => setPrefix(e.target.value.toUpperCase())}
                                        placeholder="e.g. PRN"
                                        maxLength={3}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all uppercase text-sm font-medium h-[46px]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Saving...' : editingType ? 'Save Changes' : 'Add Type'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const PRESET_GIFS = [
    {
        name: 'Gatsby Toast',
        url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z0ZmlwMHM1OGxldW82azFqMmZvdHBmNDg5azlhOHc4bmthOWtyciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif'
    },
    {
        name: 'Confetti Party',
        url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif'
    },
    {
        name: 'Minion High Five',
        url: 'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif'
    },
    {
        name: 'Success Check',
        url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHY1Y2Nuc3ZvaTNocTZycXZwbnAycmsydnd2bWtzOHI4eHcxM3Y3ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/d21y4ZqEw735lD2/giphy.gif'
    }
];

const SUPPORT_TYPES = ['IT Support', 'Admin Support'];

const GifPickerModal = ({ value, onSelect, onClose, title }) => {
    const [tab, setTab] = useState('preset'); // 'preset' | 'url'
    const [urlInput, setUrlInput] = useState(value || '');
    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">{title || 'Pick a GIF'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex gap-2 mb-5">
                    <button onClick={() => setTab('preset')} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${tab === 'preset' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                        Preset GIFs
                    </button>
                    <button onClick={() => setTab('url')} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${tab === 'url' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                        Custom URL
                    </button>
                </div>

                {tab === 'preset' && (
                    <div className="grid grid-cols-2 gap-3">
                        {PRESET_GIFS.map(p => (
                            <button key={p.name} onClick={() => onSelect(p.url)} className={`p-2 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer hover:border-primary hover:ring-2 hover:ring-primary/20 ${value === p.url ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                                <img src={p.url} alt={p.name} className="h-20 w-full object-cover rounded-lg" />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {tab === 'url' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">GIF URL</label>
                            <input
                                type="url"
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                                placeholder="https://media.giphy.com/media/.../giphy.gif"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                            />
                        </div>
                        {urlInput && (
                            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                <img src={urlInput} alt="Preview" className="w-full h-40 object-cover" onError={e => { e.target.style.display = 'none'; }} />
                            </div>
                        )}
                        <button
                            onClick={() => urlInput.trim() && onSelect(urlInput.trim())}
                            disabled={!urlInput.trim()}
                            className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 cursor-pointer hover:bg-primary/90 transition-all"
                        >
                            Use This URL
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const GifPreviewModal = ({ rule, onClose }) => {
    if (!rule) return null;
    const TicketCard = ({ compact = false }) => (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 text-center overflow-hidden ${compact ? 'w-full' : 'w-full'}`}>
            {rule.gif_url && (
                <div className="overflow-hidden bg-slate-900/5 dark:bg-slate-950 p-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center">
                    <img
                        src={rule.gif_url}
                        alt="GIF"
                        className={`w-full object-contain mx-auto rounded-lg ${compact ? 'h-32 max-h-36' : 'h-52 max-h-60'}`}
                        onError={e => { e.target.style.display = 'none'; }}
                    />
                </div>
            )}
            <div className={compact ? 'p-3' : 'p-5'}>
                <div className={`flex items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20 mx-auto mb-2 ${compact ? 'w-8 h-8' : 'w-12 h-12'}`}>
                    <span className={`material-symbols-outlined text-green-500 ${compact ? 'text-lg' : 'text-2xl'}`}>check_circle</span>
                </div>
                <h4 className={`font-bold text-slate-800 dark:text-white mb-1 ${compact ? 'text-[10px]' : 'text-sm'}`}>Ticket Successfully Created!</h4>
                <p className={`text-slate-500 dark:text-slate-400 mb-3 ${compact ? 'text-[9px]' : 'text-xs'}`}>Our admin team will contact you shortly.</p>
                <div className={`inline-block bg-slate-100 dark:bg-slate-800 rounded-lg font-mono font-bold text-primary ${compact ? 'px-2 py-0.5 text-[9px]' : 'px-4 py-1.5 text-xs'}`}>
                    TICK-2026-8842
                </div>
                <p className={`text-slate-400 dark:text-slate-500 mt-2 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                    {rule.support_type}{rule.category ? ` · ${rule.category}` : ''}
                </p>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">GIF Preview</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {rule.support_type}{rule.category ? ` · ${rule.category}` : ' · All categories'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Desktop Preview */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-xl">laptop_mac</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Desktop / Laptop</span>
                        </div>
                        {/* Browser chrome mockup */}
                        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg">
                            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                </div>
                                <div className="flex-1 mx-2 bg-white dark:bg-slate-700 rounded-md px-3 py-0.5 text-[10px] text-slate-400 truncate">
                                    ticketraise.company.com
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 p-6 flex items-center justify-center min-h-[200px]">
                                {/* Simulated modal overlay */}
                                <div className="relative w-full max-w-xs">
                                    <div className="absolute inset-0 -m-6 bg-black/30 rounded-b-xl"></div>
                                    <div className="relative z-10">
                                        <TicketCard />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Preview */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-xl">smartphone</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mobile</span>
                        </div>
                        {/* Phone mockup */}
                        <div className="flex justify-center">
                            <div className="relative w-48">
                                {/* Phone shell */}
                                <div className="bg-slate-800 dark:bg-slate-950 rounded-[2rem] p-2 shadow-2xl border-4 border-slate-700 dark:border-slate-800">
                                    {/* Notch */}
                                    <div className="flex justify-center mb-1">
                                        <div className="w-16 h-4 bg-slate-900 dark:bg-black rounded-full"></div>
                                    </div>
                                    {/* Screen */}
                                    <div className="bg-slate-50 dark:bg-slate-950 rounded-[1.5rem] overflow-hidden min-h-[320px] flex items-center justify-center p-3">
                                        <div className="relative w-full">
                                            <div className="absolute inset-0 -m-3 bg-black/30 rounded-[1.5rem]"></div>
                                            <div className="relative z-10">
                                                <TicketCard compact />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Home indicator */}
                                    <div className="flex justify-center mt-2">
                                        <div className="w-12 h-1 bg-slate-600 dark:bg-slate-700 rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const TicketGifView = ({ isExpanded, onToggle, hasEditPermission, showToast, categories }) => {

    const [settings, setSettings] = useState({
        enabled: true,
        display_on_submit: true,
        display_on_resolve: true,
        default_gif_url: PRESET_GIFS[0].url,
        rules: []
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewRule, setPreviewRule] = useState(null); // ruleId for live preview

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const res = await api.get('/api/settings/ticket-gif');
                if (res.data) {
                    const data = res.data;
                    setSettings({
                        enabled: data.enabled ?? true,
                        display_on_submit: data.display_on_submit ?? true,
                        display_on_resolve: data.display_on_resolve ?? true,
                        default_gif_url: data.default_gif_url || data.gif_url || PRESET_GIFS[0].url,
                        rules: Array.isArray(data.rules) ? data.rules : []
                    });
                }
            } catch (err) {
                console.error("Failed to fetch ticket gif settings:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const addRule = () => {
        const newRule = {
            id: `rule_${Date.now()}`,
            support_type: SUPPORT_TYPES[0],
            category: '',
            gif_url: PRESET_GIFS[0].url
        };
        setSettings(s => ({ ...s, rules: [...s.rules, newRule] }));
    };

    const updateRule = (id, field, value) => {
        setSettings(s => ({
            ...s,
            rules: s.rules.map(r => r.id === id ? { ...r, [field]: value, ...(field === 'support_type' ? { category: '' } : {}) } : r)
        }));
    };

    const removeRule = (id) => {
        setSettings(s => ({ ...s, rules: s.rules.filter(r => r.id !== id) }));
        if (previewRule === id) setPreviewRule(null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...settings,
                gif_url: settings.default_gif_url
            };
            const res = await api.post('/api/settings/ticket-gif', payload);
            if (res.data?.settings) {
                const d = res.data.settings;
                setSettings({
                    enabled: d.enabled ?? true,
                    display_on_submit: d.display_on_submit ?? true,
                    display_on_resolve: d.display_on_resolve ?? true,
                    default_gif_url: d.default_gif_url || d.gif_url || PRESET_GIFS[0].url,
                    rules: Array.isArray(d.rules) ? d.rules : []
                });
            }
            if (showToast) showToast('Ticket GIF settings saved!');
        } catch (err) {
            console.error("Error saving ticket GIF settings:", err);
            alert("Failed to save Ticket GIF settings.");
        } finally {
            setSaving(false);
        }
    };

    // Compute categories for a given support type
    const getCategoriesForType = (supportType) => {
        if (!categories || !supportType) return [];
        return categories.filter(c => {
            const types = (c.support_type || '').split(',').map(s => s.trim());
            return types.includes(supportType);
        });
    };

    // Determine preview GIF url
    const getPreviewGifUrl = () => {
        if (previewRule) {
            const r = settings.rules.find(r => r.id === previewRule);
            if (r?.gif_url) return r.gif_url;
        }
        return settings.default_gif_url;
    };

    return (
        <div className="w-full shrink-0 px-20 py-8 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-4 flex items-end justify-between">
                <div onClick={onToggle} className="cursor-pointer group select-none">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        Ticket GIF
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Assign celebration GIFs per support type and category.</p>
                </div>
            </div>

            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-sm space-y-8">
                    {loading ? (
                        <div className="py-12 text-center text-slate-500">Loading Ticket GIF settings...</div>
                    ) : (
                        <>

                            {/* ── Rules layout ── */}
                            <div className="space-y-6">

                                    {/* Rules */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Rules <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">{settings.rules.length}</span></h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Assign specific GIFs per support type and category. Rules are matched top to bottom.</p>
                                            </div>
                                            {hasEditPermission && (
                                                <button
                                                    onClick={addRule}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                                                >
                                                    <span className="material-symbols-outlined text-base">add</span>
                                                    Add Rule
                                                </button>
                                            )}
                                        </div>

                                        {settings.rules.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">gif_box</span>
                                                <p className="text-sm font-medium">No rules yet</p>
                                                <p className="text-xs">Click "Add Rule" to assign GIFs per support type or category.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {settings.rules.map((rule, idx) => {
                                                    const cats = getCategoriesForType(rule.support_type);
                                                    const isSelected = previewRule?.id === rule.id;
                                                    return (
                                                        <div key={rule.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 overflow-hidden transition-all">
                                                            <div className="flex items-start gap-3 p-4">
                                                                {/* Index badge */}
                                                                <span className="mt-1 flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">{idx + 1}</span>

                                                                {/* Fields */}
                                                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Support Type</label>
                                                                        <select
                                                                            value={rule.support_type}
                                                                            onChange={e => updateRule(rule.id, 'support_type', e.target.value)}
                                                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                                                                        >
                                                                            {SUPPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Category <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                                                                        <select
                                                                            value={rule.category}
                                                                            onChange={e => updateRule(rule.id, 'category', e.target.value)}
                                                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                                                                        >
                                                                            <option value="">All categories</option>
                                                                            {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">GIF URL</label>
                                                                        <input
                                                                            type="url"
                                                                            value={rule.gif_url}
                                                                            onChange={e => updateRule(rule.id, 'gif_url', e.target.value)}
                                                                            placeholder="https://media.giphy.com/..."
                                                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary/40"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Actions */}
                                                                <div className="flex flex-col gap-1 shrink-0">
                                                                    <button
                                                                        title="Preview"
                                                                        onClick={() => setPreviewRule(isSelected ? null : rule)}
                                                                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${isSelected ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                                    >
                                                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                                    </button>
                                                                    {hasEditPermission && (
                                                                        <button
                                                                            title="Delete rule"
                                                                            onClick={() => removeRule(rule.id)}
                                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                {/* Save */}

                                {hasEditPermission && (
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-lg shadow-primary/25 transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-lg">save</span>
                                        <span>{saving ? 'Saving...' : 'Save GIF Settings'}</span>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* GIF Preview Modal */}
            {previewRule && (
                <GifPreviewModal
                    rule={previewRule}
                    onClose={() => setPreviewRule(null)}
                />
            )}
        </div>
    );
};

const BranchesLocationsView = ({ isExpanded, onToggle, hasEditPermission, showToast }) => {
    const [activeTab, setActiveTab] = useState('branches'); // 'branches' | 'locations'
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ branches: [], locations: [] });
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [itemName, setItemName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);


    const fetchBranchesLocations = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/settings/branches-locations');
            if (res.data) {
                setData(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch branches and locations settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranchesLocations();
    }, []);

    const handleOpenAddModal = () => {
        setEditingItem(null);
        setItemName('');
        setError('');
        setShowModal(true);
    };

    const handleOpenEditModal = (item) => {
        setEditingItem(item);
        setItemName(item.name || '');
        setError('');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setItemName('');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!itemName.trim()) return;
        setIsSubmitting(true);
        setError('');

        try {
            if (editingItem) {
                const payload = { name: itemName.trim() };
                const res = await api.put(`/api/settings/branches-locations/${activeTab}/${editingItem.id}`, payload);
                if (res.data?.settings) {
                    handleCloseModal();
                    if (showToast) showToast('Item updated successfully!');
                    fetchBranchesLocations();
                }
            } else {
                const payload = { type: activeTab, name: itemName.trim() };
                const res = await api.post('/api/settings/branches-locations', payload);
                if (res.data?.settings) {
                    handleCloseModal();
                    if (showToast) showToast('Item added successfully!');
                    fetchBranchesLocations();
                }
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save item');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            const res = await api.delete(`/api/settings/branches-locations/${activeTab}/${itemToDelete.id}`);
            if (res.data?.settings) {
                setData(res.data.settings);
                if (showToast) showToast('Item deleted successfully!');
            }
        } catch (err) {
            if (showToast) showToast(err.response?.data?.error || 'Failed to delete item');
        } finally {
            setItemToDelete(null);
        }
    };

    const currentItems = data[activeTab] || [];
    const filteredItems = currentItems.filter(item =>
        (item.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTabTitle = (tabKey) => {
        if (tabKey === 'branches') return 'Branch List';
        if (tabKey === 'locations') return 'Location';
        return '';
    };

    const totalCount = (data.branches?.length || 0) + (data.locations?.length || 0);

    return (
        <div className="w-full shrink-0 px-20 py-8 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-4 flex items-end justify-between">
                <div onClick={onToggle} className="cursor-pointer group select-none">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        Branches & Locations ({totalCount})
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage branch list and locations for tickets and couriers.</p>
                </div>
                {isExpanded && (
                    <div className="flex items-center gap-3">
                        <div className="relative w-64 animate-in fade-in zoom-in-95 duration-200">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                placeholder={`Search ${getTabTitle(activeTab).toLowerCase()}...`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
                            />
                        </div>
                        {hasEditPermission && (
                            <button
                                onClick={handleOpenAddModal}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors shrink-0 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Add {activeTab === 'branches' ? 'Branch' : 'Location'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* List & Sub-tabs */}
            {isExpanded && (
                <div className="space-y-4">
                    {/* Sub-tabs */}
                    <div className="flex items-center gap-2">
                        {[
                            { key: 'branches', label: 'Branch List', count: data.branches?.length || 0, icon: 'store' },
                            { key: 'locations', label: 'Locations', count: data.locations?.length || 0, icon: 'location_on' }
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => { setActiveTab(t.key); setSearchQuery(''); }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                                    activeTab === t.key
                                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                                        : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                                }`}
                            >
                                <span>{t.label}</span>
                                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                    activeTab === t.key
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-y-auto overflow-x-auto custom-scrollbar max-h-[500px]">
                        {loading ? (
                            <div className="p-10 text-center text-slate-500">Loading {getTabTitle(activeTab).toLowerCase()}...</div>
                        ) : currentItems.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">No items found. Add one above.</div>
                        ) : filteredItems.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">No items match your search query.</div>
                        ) : (
                            <div className="flex flex-col w-full">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-sm">
                                        <tr className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[10%]">S.No</th>
                                            <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[85%]' : 'w-[90%]'}`}>{getTabTitle(activeTab)} Name</th>
                                            {hasEditPermission && <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredItems.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 w-[10%]">{idx + 1}</td>
                                                <td className={`px-6 py-4 ${hasEditPermission ? 'w-[85%]' : 'w-[90%]'}`}>
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</div>
                                                    {item.created_at && <div className="text-xs text-slate-400 mt-0.5">Added {formatCreatedAt(item.created_at)}</div>}
                                                </td>
                                                {hasEditPermission && (
                                                    <td className="px-6 py-4 w-[15%]">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                title="Edit Item"
                                                                onClick={() => handleOpenEditModal(item)}
                                                                className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-blue-600 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm cursor-pointer"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                            </button>
                                                            <button
                                                                title="Delete Item"
                                                                onClick={() => setItemToDelete(item)}
                                                                className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-red-600 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm cursor-pointer"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setItemToDelete(null)}>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                                Delete {activeTab === 'branches' ? 'Branch' : 'Location'}
                            </h3>
                            <button onClick={() => setItemToDelete(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-white">{itemToDelete.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setItemToDelete(null)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleCloseModal}>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                                {editingItem ? `Edit ${getTabTitle(activeTab)} Item` : `Add New ${getTabTitle(activeTab)} Item`}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Name</label>
                                <input
                                    type="text"
                                    value={itemName}
                                    onChange={e => setItemName(e.target.value)}
                                    placeholder={activeTab === 'branches' ? 'e.g. Coimbatore HO' : 'e.g. Warehouse 1'}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Type field — only for from/to locations */}
                            {/* Removed: type field is no longer shown for locations */}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const CategoriesView = ({ categories, setCategories, categoriesLoading, isExpanded, onToggle, hasEditPermission }) => {

    const [showAddCategory, setShowAddCategory] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const filteredCategories = (categories || []).filter(c =>
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.support_type || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const [editingCategory, setEditingCategory] = useState(null);
    const [name, setName] = useState('');
    const [supportType, setSupportType] = useState('IT Support');
    const [subcategories, setSubcategories] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    const toggleSupportType = (type) => {
        setSupportType(prev => {
            const arr = prev ? String(prev).split(',').map(s => s.trim()).filter(Boolean) : [];
            const next = arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type];
            return next.join(',');
        });
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !supportType) {
            setError('Name and support type are required.');
            return;
        }
        const lowerName = name.trim().toLowerCase();
        const exists = categories.some(c => c.name.trim().toLowerCase() === lowerName && (!editingCategory || c.id !== editingCategory.id));
        if (exists) {
            setError('Category name already exists.');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = { 
                name, 
                support_type: supportType, 
                subcategories: String(supportType).includes('Petty Cash') ? subcategories : '' 
            };
            if (editingCategory) {
                await api.put(`/api/categories/${editingCategory.id}`, payload);
            } else {
                await api.post('/api/categories', payload);
            }
            const res = await api.get('/api/categories');
            setCategories(res.data);
            handleCloseModal();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${editingCategory ? 'edit' : 'add'} category.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setShowAddCategory(false);
        setEditingCategory(null);
        setName('');
        setSupportType('IT Support');
        setSubcategories('');
        setError('');
    };

    const handleOpenEdit = (category) => {
        setEditingCategory(category);
        setName(category.name);
        setSupportType(category.support_type);
        setSubcategories(category.subcategories || '');
        setShowAddCategory(true);
    };

    const handleDeleteClick = (category) => {
        setCategoryToDelete(category);
    };

    const confirmDelete = async () => {
        if (!categoryToDelete) return;
        try {
            await api.delete(`/api/categories/${categoryToDelete.id}`);
            const res = await api.get('/api/categories');
            setCategories(res.data);
            setCategoryToDelete(null);
        } catch (err) {
            alert('Failed to delete category.');
        }
    };

    return (
        <div className="w-full shrink-0 px-20 py-8 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-4 flex items-end justify-between">
                <div onClick={onToggle} className="cursor-pointer group select-none">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        Categories ({categories?.length || 0})
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage issue categories for ticket routing.</p>
                </div>
                {isExpanded && (
                    <div className="flex items-center gap-3">
                        <div className="relative w-64 animate-in fade-in zoom-in-95 duration-200">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                placeholder="Search categories..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddCategory(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Add Category
                        </button>
                    </div>
                )}
            </div>

            {/* List */}
            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-y-auto overflow-x-auto custom-scrollbar max-h-[500px]">
                    {categoriesLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading categories...</div>
                    ) : (categories || []).length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No categories found. Add one on the left.</div>
                    ) : filteredCategories.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No categories match your search criteria.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-sm">
                                    <tr className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800">
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[10%]' : 'w-[12%]'}`}>S.No</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[28%]' : 'w-[32%]'}`}>Category Name</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[32%]' : 'w-[36%]'}`}>Sub Category</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[18%]' : 'w-[20%]'}`}>Support Type</th>
                                        {hasEditPermission && <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {Array.isArray(filteredCategories) && filteredCategories.map((c, idx) => (
                                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className={`px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 ${hasEditPermission ? 'w-[10%]' : 'w-[12%]'}`}>{idx + 1}</td>
                                            <td className={`px-6 py-4 ${hasEditPermission ? 'w-[28%]' : 'w-[32%]'}`}>
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">Added {formatCreatedAt(c.created_at)}</div>
                                            </td>
                                            <td className={`px-6 py-4 text-sm text-slate-650 dark:text-slate-350 truncate ${hasEditPermission ? 'w-[32%]' : 'w-[36%]'}`} title={c.subcategories || '-'}>
                                                {c.subcategories || '-'}
                                            </td>
                                            <td className={`px-6 py-4 ${hasEditPermission ? 'w-[18%]' : 'w-[20%]'}`}>
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                                    c.support_type === 'IT Support' 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' 
                                                    : c.support_type === 'Petty Cash'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
                                                    : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'
                                                }`}>
                                                    {c.support_type}
                                                </span>
                                            </td>
                                            {hasEditPermission && (
                                                <td className="px-6 py-4 w-[12%]">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            title="Edit Category"
                                                            onClick={() => handleOpenEdit(c)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-blue-600 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                                        </button>
                                                        <button
                                                            title="Delete Category"
                                                            onClick={() => handleDeleteClick(c)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-red-605 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {categoryToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                                Delete Category
                            </h3>
                            <button
                                onClick={() => setCategoryToDelete(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-white">{categoryToDelete.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setCategoryToDelete(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Category Modal */}
            {showAddCategory && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-slate-800 dark:text-white">{editingCategory ? 'Edit Category' : 'Add New Category'}</h3>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleAdd} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category Name</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    placeholder="e.g. Hardware Issue"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Support Type</label>
                                <MultiSelectFormDropdown
                                    label="Support Type"
                                    options={['IT Support', 'Admin Support', 'Petty Cash', 'Courier']}
                                    selected={supportType}
                                    onChange={toggleSupportType}
                                />
                            </div>
                            {String(supportType).includes('Petty Cash') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sub Categories (comma-separated)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                        placeholder="e.g. Office Supplies, Travel, Food"
                                        value={subcategories}
                                        onChange={e => setSubcategories(e.target.value)}
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white ${isSubmitting ? 'bg-primary/70 cursor-wait' : 'bg-primary hover:bg-primary/90'}`}
                                >
                                    {isSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Add Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const DepartmentsView = ({ departments, setDepartments, departmentsLoading, isExpanded, onToggle, showToast, hasEditPermission }) => {
    const [showAddDepartment, setShowAddDepartment] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const filteredDepartments = (departments || []).filter(d =>
        (d.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.support_type || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [name, setName] = useState('');
    const [supportType, setSupportType] = useState('IT Support');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [departmentToDelete, setDepartmentToDelete] = useState(null);

    const toggleSupportType = (type) => {
        setSupportType(prev => {
            const arr = prev ? String(prev).split(',').map(s => s.trim()).filter(Boolean) : [];
            const next = arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type];
            return next.join(',');
        });
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !supportType) {
            setError('Name and support type are required.');
            return;
        }
        const lowerName = name.trim().toLowerCase();
        const exists = departments.some(d => d.name.trim().toLowerCase() === lowerName && (!editingDepartment || d.id !== editingDepartment.id));
        if (exists) {
            setError('Department name already exists.');
            return;
        }
        setIsSubmitting(true);
        try {
            if (editingDepartment) {
                await api.put(`/api/departments/${editingDepartment.id}`, { name, support_type: supportType });
                showToast('Department updated successfully');
            } else {
                await api.post('/api/departments', { name, support_type: supportType });
                showToast('Department added successfully');
            }
            const res = await api.get('/api/departments');
            setDepartments(res.data);
            handleCloseModal();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${editingDepartment ? 'edit' : 'add'} department.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setShowAddDepartment(false);
        setEditingDepartment(null);
        setName('');
        setSupportType('IT Support');
        setError('');
    };

    const handleOpenEdit = (dept) => {
        setEditingDepartment(dept);
        setName(dept.name);
        setSupportType(dept.support_type);
        setShowAddDepartment(true);
    };

    const handleDeleteClick = (dept) => {
        setDepartmentToDelete(dept);
    };

    const confirmDelete = async () => {
        if (!departmentToDelete) return;
        try {
            await api.delete(`/api/departments/${departmentToDelete.id}`);
            const res = await api.get('/api/departments');
            setDepartments(res.data);
            setDepartmentToDelete(null);
            showToast('Department deleted successfully');
        } catch (err) {
            alert('Failed to delete department.');
        }
    };

    // Note: I missed showToast in the prop list, I'll need to pass it from AdminDashboard
    // But for now let's just use alert or similar if needed, or pass showToast
    return (
        <div className="w-full shrink-0 px-20 py-8 border-b border-slate-200 dark:border-slate-800">
            <div className="mb-4 flex items-end justify-between">
                <div onClick={onToggle} className="cursor-pointer group select-none">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        Departments ({departments?.length || 0})
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage organizational departments and their support types.</p>
                </div>
                {isExpanded && (
                    <div className="flex items-center gap-3">
                        <div className="relative w-64 animate-in fade-in zoom-in-95 duration-200">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                placeholder="Search departments..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
                            />
                        </div>
                        <button
                            onClick={() => setShowAddDepartment(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Add Department
                        </button>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-y-auto overflow-x-auto custom-scrollbar max-h-[500px]">
                    {departmentsLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading departments...</div>
                    ) : (departments || []).length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No departments found.</div>
                    ) : filteredDepartments.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No departments match your search criteria.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-sm">
                                    <tr className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800">
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[12%]' : 'w-[15%]'}`}>S.No</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[48%]' : 'w-[55%]'}`}>Department Name</th>
                                        <th className={`px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${hasEditPermission ? 'w-[25%]' : 'w-[30%]'}`}>Support Type</th>
                                        {hasEditPermission && <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {Array.isArray(filteredDepartments) && filteredDepartments.map((d, idx) => (
                                        <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className={`px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 ${hasEditPermission ? 'w-[12%]' : 'w-[15%]'}`}>{idx + 1}</td>
                                            <td className={`px-6 py-4 ${hasEditPermission ? 'w-[48%]' : 'w-[55%]'}`}>
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">{d.name}</div>
                                                <div className="text-xs text-slate-400">Added {formatCreatedAt(d.created_at)}</div>
                                            </td>
                                            <td className={`px-6 py-4 ${hasEditPermission ? 'w-[25%]' : 'w-[30%]'}`}>
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${d.support_type?.includes('IT Support') ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'}`}>
                                                    {d.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : d.support_type}
                                                </span>
                                            </td>
                                            {hasEditPermission && (
                                                <td className="px-6 py-4 w-[15%]">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            title="Edit Department"
                                                            onClick={() => handleOpenEdit(d)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-blue-600 border border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                                        </button>
                                                        <button
                                                            title="Delete Department"
                                                            onClick={() => handleDeleteClick(d)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-red-600 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {departmentToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                                Delete Department
                            </h3>
                            <button onClick={() => setDepartmentToDelete(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-white">{departmentToDelete.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDepartmentToDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                            <button onClick={confirmDelete} className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {showAddDepartment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-slate-800 dark:text-white">{editingDepartment ? 'Edit Department' : 'Add New Department'}</h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleAdd} className="space-y-4">
                            {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">{error}</div>}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department Name</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    placeholder="e.g. Accounts"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Support Type</label>
                                <MultiSelectFormDropdown
                                    label="Support Type"
                                    options={['IT Support', 'Admin Support', 'Courier']}
                                    selected={supportType}
                                    onChange={toggleSupportType}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={handleCloseModal} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white bg-primary hover:bg-primary/90 shadow-sm">
                                    {isSubmitting ? 'Saving...' : editingDepartment ? 'Update' : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const MultiSelectFilter = ({ label, icon, options, selected, onChange, widthClass = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option) => {
        if (option === 'All') {
            onChange(['All']);
        } else {
            let next = selected.includes(option)
                ? selected.filter(o => o !== option)
                : [...selected.filter(o => o !== 'All'), option];
            if (next.length === 0) next = ['All'];
            onChange(next);
        }
    };

    const isSelected = (option) => selected.includes(option);

    const getDisplayValue = () => {
        if (selected.includes('All')) return `All ${label}`;
        if (selected.length === 1) return selected[0];
        return `${selected.length} Selected`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-2 px-3 py-2 bg-[#eceef0] dark:bg-slate-900 border border-transparent rounded-lg text-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700 outline-none cursor-pointer ${widthClass} ${isOpen ? 'ring-2 ring-primary border-primary bg-white dark:bg-slate-900 shadow-sm' : ''}`}
            >
                <div className="flex items-center gap-2 truncate">
                    {icon && <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>}
                    <span className={`truncate max-w-[120px] font-medium ${selected.includes('All') ? 'text-slate-500 dark:text-slate-400' : 'text-primary'}`}>
                        {getDisplayValue()}
                    </span>
                </div>
                <span className={`material-symbols-outlined text-slate-400 text-base transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 min-w-full w-max max-w-[360px] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[60] py-2 overflow-hidden animate-in fade-in zoom-in duration-150">
                    <div className="max-h-72 overflow-y-auto custom-scrollbar">
                        {options.map((option) => (
                            <label
                                key={option}
                                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group ${isSelected(option) ? 'bg-primary/5' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isSelected(option)}
                                    onChange={() => toggleOption(option)}
                                />
                                <div className={`h-5 w-5 rounded flex items-center justify-center border-2 transition-all shrink-0 ${isSelected(option) ? 'bg-primary border-primary shadow-sm shadow-primary/20' : 'border-slate-300 dark:border-slate-600 group-hover:border-primary/50'}`}>
                                    {isSelected(option) && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                                </div>
                                <span className={`text-[13px] font-medium whitespace-nowrap transition-colors ${isSelected(option) ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {option === 'All' ? `All ${label}` : option}
                                </span>
                            </label>
                        ))}
                    </div>
                    {selected.length > 0 && !selected.includes('All') && (
                        <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1 px-2">
                            <button
                                onClick={() => onChange(['All'])}
                                className="w-full py-1.5 text-[11px] font-bold text-slate-400 hover:text-primary transition-colors uppercase tracking-wider"
                            >
                                Reset to All
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, refreshUser } = useAuth();
    const isSuperAdmin = user?.email === 'admin@support.com';
    const userAllowedMenus = (user?.allowed_menus || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const hasUsersAccess = isSuperAdmin || userAllowedMenus.includes('users');
    const hasSettingsAccess = isSuperAdmin || userAllowedMenus.includes('settings');
    const isPowerUser = user?.receiver_position === 'Management' || user?.receiver_position === 'Manager';
    const hasEditPermission = user?.email === 'admin@support.com' || (user?.access && user.access.includes('Edit'));

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isModalOpen]);

    const [updateStatus, setUpdateStatus] = useState('');
    const [updateAssignee, setUpdateAssignee] = useState('');
    const [expandedSettingsView, setExpandedSettingsView] = useState('assignees');
    const [resolutionComments, setResolutionComments] = useState('');
    const [pendingComments, setPendingComments] = useState('');
    const [commentError, setCommentError] = useState('');
    const [addExpense, setAddExpense] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [billFile, setBillFile] = useState(null);
    const [billFileError, setBillFileError] = useState('');
    const [vendorName, setVendorName] = useState('');

    const [isUpdating, setIsUpdating] = useState(false);
    const [activeView, setActiveView] = useState(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('assetId')) {
            return 'assets';
        }
        return 'tickets';
    }); // 'tickets' | 'users' | 'assets' | 'admin_assets'
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [showAddUser, setShowAddUser] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [assignees, setAssignees] = useState([]);
    const [assigneesLoading, setAssigneesLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [departmentsLoading, setDepartmentsLoading] = useState(false);
    const [assetTypes, setAssetTypes] = useState([]);
    const [assetTypesLoading, setAssetTypesLoading] = useState(false);
    // Assets state
    const [assets, setAssets] = useState([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [assetSearchQuery, setAssetSearchQuery] = useState('');
    const [assetCategoryFilter, setAssetCategoryFilter] = useState(['All']);
    const [assetBranchFilter, setAssetBranchFilter] = useState(['All']);
    const [assetDepartmentFilter, setAssetDepartmentFilter] = useState(['All']);
    const [assetConditionFilter, setAssetConditionFilter] = useState(['All']);
    const [showAddAssetModal, setShowAddAssetModal] = useState(false);
    const [newAsset, setNewAsset] = useState({ assetId: '', category: 'Laptop', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'IT', branch: '', purchaseDate: '', warranty: '1 Year', condition: 'Good', remarks: '', images: [], qrCode: '', group: 'IT', assetName: '', location: '', assetProvidedTeam: '', type: '', quantity: '', status: '', warrantyExpiry: '', purchaseCost: '' });
    const [isEditingAsset, setIsEditingAsset] = useState(false);
    const [editingAssetId, setEditingAssetId] = useState(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);
    const [showAssetDeleteConfirm, setShowAssetDeleteConfirm] = useState(false);



    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(['All']);
    const [branchFilter, setBranchFilter] = useState(['All']);
    const [departmentFilter, setDepartmentFilter] = useState(['All']);
    const [categoryFilter, setCategoryFilter] = useState(['All']);
    const [assigneeFilter, setAssigneeFilter] = useState(['All']);
    const [mailApprovalFilter, setMailApprovalFilter] = useState(['All']);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
    const downloadDropdownRef = useRef(null);
    const [isGeneratingQRs, setIsGeneratingQRs] = useState(false);
    const [qrScannerError, setQrScannerError] = useState(null);
    const [configuredBranches, setConfiguredBranches] = useState([]);

    useEffect(() => {
        const fetchBranchSettings = async () => {
            try {
                const res = await api.get('/api/settings/branches-locations');
                if (res.data?.branches && res.data.branches.length > 0) {
                    setConfiguredBranches(res.data.branches.map(b => b.name));
                }
            } catch (err) {
                console.error('Failed to fetch branch settings:', err);
            }
        };
        fetchBranchSettings();
    }, []);

    const currentBranchList = configuredBranches.length > 0 ? configuredBranches : [
        'Cotton Concepts HO, Coimbatore',
        'Doctor Towels HO',
        'Cotton Concepts, Vengamedu',
        'Cotton Concepts, Karur',
        'Doctor Towels, Karur'
    ];


    useEffect(() => {
        const handleClickOutside = (event) => {
            if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target)) {
                setShowDownloadDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (selectedAssetIds.length === 0) {
            setShowDownloadDropdown(false);
        }
    }, [selectedAssetIds]);

    const [isDateFilterActive, setIsDateFilterActive] = useState(false);
    const [dateRange, setDateRange] = useState([
        {
            startDate: new Date(),
            endDate: new Date(),
            key: 'selection'
        }
    ]);

    const handleDownloadSelectedAssets = () => {
        if (selectedAssetIds.length === 0) return;
        const selectedList = assets.filter(a => selectedAssetIds.includes(a.id));
        const rows = selectedList.map((asset, idx) => ({
            "S.No": idx + 1,
            "Asset ID": asset.assetId || '',
            "Asset Type": asset.category || '',
            "Brand": asset.brand || '',
            "Model": asset.model || '',
            "Serial Number": asset.serial || '',
            "User Name": asset.assignee || '',
            "Emp Code": asset.empCode || '',
            "Email": asset.email || '',
            "Branch": asset.branch || '',
            "Department": asset.department || '',
            "Purchase Date": asset.purchaseDate || '',
            "Warranty": asset.warranty || '',
            "Condition": asset.condition || '',
            "Remarks": asset.remarks || ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Selected Assets");
        XLSX.writeFile(workbook, `Selected_Assets_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadSelectedQRs = async () => {
        if (selectedAssetIds.length === 0) return;

        setIsGeneratingQRs(true);

        try {
            const selectedList = assets.filter(a => selectedAssetIds.includes(a.id));

            // Helper to convert blob to base64
            const blobToBase64 = (blob) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            };

            const qrImages = [];
            const batchSize = 10;

            // Resilient batching to avoid connection timeouts or browser concurrency throttling
            for (let i = 0; i < selectedList.length; i += batchSize) {
                const batch = selectedList.slice(i, i + batchSize);
                const batchPromises = batch.map(async (asset) => {
                    if (!asset.assetId) return null;
                    try {
                        const isAdminAsset = asset.group === 'Admin' || asset.group === 'ADMIN';
                        const qty = isAdminAsset ? parseInt(asset.quantity || 1, 10) : 1;
                        
                        if (qty > 1) {
                            const subPromises = [];
                            for (let j = 1; j <= qty; j++) {
                                subPromises.push((async () => {
                                    const subId = `${asset.assetId}-${j}`;
                                    const response = await api.get(`/api/assets/${subId}/qr?t=${Date.now()}`, { responseType: 'blob' });
                                    const base64 = await blobToBase64(response.data);
                                    return { assetId: subId, base64 };
                                })());
                            }
                            return await Promise.all(subPromises);
                        } else {
                            const response = await api.get(`/api/assets/${asset.assetId}/qr?t=${Date.now()}`, { responseType: 'blob' });
                            const base64 = await blobToBase64(response.data);
                            return [{ assetId: asset.assetId, base64 }];
                        }
                    } catch (err) {
                        console.error(`Failed to fetch QR label for asset ${asset.assetId}:`, err);
                        return null; // Gracefully continue if a single request fails
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                qrImages.push(...batchResults.flat().filter(Boolean));
            }

            if (qrImages.length === 0) {
                setIsGeneratingQRs(false);
                showToast("No valid QR labels could be compiled.", "error");
                return;
            }

            // Partition into chunks of 40 labels (4 columns x 10 rows)
            const chunks = [];
            for (let i = 0; i < qrImages.length; i += 40) {
                chunks.push(qrImages.slice(i, i + 40));
            }

            let pagesHtml = '';
            chunks.forEach((chunk) => {
                pagesHtml += `<div class="a4-page">`;
                chunk.forEach((imgData) => {
                    pagesHtml += `
                        <div class="label-cell">
                            <img class="label-img" src="${imgData.base64}" alt="${imgData.assetId}" />
                        </div>
                    `;
                });

                // Pad remaining cells on last page to preserve 4x10 grid format
                const remaining = 40 - chunk.length;
                for (let i = 0; i < remaining; i++) {
                    pagesHtml += `<div class="label-cell empty-cell"></div>`;
                }
                pagesHtml += `</div>`;
            });

            // Create a hidden iframe for print invocation
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.zIndex = '-9999';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print Asset Labels</title>
                    <style>
                        * {
                            box-sizing: border-box;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        .preview-container {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                        }
                        .a4-page {
                            width: 210mm;
                            height: 297mm;
                            display: grid;
                            grid-template-columns: repeat(4, 52.5mm);
                            grid-template-rows: repeat(10, 29.7mm);
                            gap: 0;
                            padding: 0;
                            margin: 0 auto;
                            box-sizing: border-box;
                            page-break-after: always;
                        }
                        .label-cell {
                            width: 52.5mm;
                            height: 29.7mm;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            overflow: hidden;
                            border: 0.1mm dashed #e2e8f0;
                            padding: 2mm;
                            box-sizing: border-box;
                        }
                        .label-img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                            display: block;
                        }
                        .empty-cell {
                            background-color: transparent;
                        }
                        @media print {
                            body, html {
                                margin: 0;
                                padding: 0;
                                width: 210mm;
                                height: 297mm;
                            }
                            .a4-page {
                                page-break-after: always;
                                margin: 0;
                            }
                            * {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            @page {
                                size: A4 portrait;
                                margin: 0;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="preview-container">
                        ${pagesHtml}
                    </div>
                </body>
                </html>
            `);
            iframeDoc.close();

            // Wait for all images in the iframe to finish loading
            const images = iframeDoc.getElementsByTagName('img');
            const imageLoadPromises = Array.from(images).map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            });

            await Promise.all(imageLoadPromises);

            // Give browser a split second to render base64 textures
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();

                document.body.removeChild(iframe);
                setIsGeneratingQRs(false);
            }, 500);

        } catch (error) {
            console.error("Failed to generate printable QR grid:", error);
            setIsGeneratingQRs(false);
            showToast("Failed to compile A4 sheet layout.", "error");
        }
    };

    const handleDateChange = (item) => {
        setDateRange([item.selection]);
        setIsDateFilterActive(true);
    };

    const clearDateFilter = (e) => {
        e.stopPropagation();
        setIsDateFilterActive(false);
        setDateRange([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
    };
    const [currentPage, setCurrentPage] = useState(1);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState(() => EXPORT_COLUMNS.map(c => c.id));

    // Selection State
    const [selectedTickets, setSelectedTickets] = useState(new Set());
    const ticketDetailsRef = useRef(null);

    // Inline Approval Form State
    const [showApprovalForm, setShowApprovalForm] = useState(false);
    const [approvalData, setApprovalData] = useState({
        description: '',
        receivers: [],
        file: null
    });

    // Delete Confirmation State
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [ticketToDelete, setTicketToDelete] = useState(null);

    // Auth variables defined at component top level

    // Dark mode
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? saved === 'true' : false;
    });

    // User profile popup
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

    // Detailed View Mode
    const [detailedView, setDetailedView] = useState(() => {
        const saved = localStorage.getItem('detailedView');
        return saved ? saved === 'true' : false;
    });

    useEffect(() => {
        localStorage.setItem('detailedView', detailedView);
    }, [detailedView]);

    const toggleDetailedView = () => setDetailedView(prev => !prev);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode(prev => !prev);

    // Toast notification
    const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000);
    };

    const fetchTickets = async () => {
        try {
            let url = '/api/tickets?';
            const params = new URLSearchParams();

            if (user?.support_type) {
                params.append('support_type', user.support_type);
            }

            // user.branch is | separated: e.g. "Doctor Towels HO|Cotton Concepts, Karur"
            // 'All' means no branch filter needed
            if (!isSuperAdmin && user?.branch && user.branch !== 'All') {
                // Only add filter if not all branches selected
                const userBranches = (user.branch || '').includes('|')
                    ? user.branch.split('|').map(b => b.trim()).filter(Boolean)
                    : user.branch.split(',').map(b => b.trim()).filter(Boolean);
                if (userBranches.length > 0 && !userBranches.includes('All')) {
                    params.append('branch', user.branch);
                }
            }

            url += params.toString();
            const response = await api.get(url);
            if (response.status !== 200) {
                throw new Error('Failed to fetch tickets');
            }
            const data = await response.data;
            setTickets(data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching tickets:", err);
            setError(err.message);
            setLoading(false);
        }
    };

    const fetchAssignees = async () => {
        setAssigneesLoading(true);
        try {
            const response = await api.get('/api/assignees');
            setAssignees(response.data);
        } catch (err) {
            console.error("Failed to fetch assignees:", err);
        } finally {
            setAssigneesLoading(false);
        }
    };

    const fetchCategories = async () => {
        setCategoriesLoading(true);
        try {
            const response = await api.get('/api/categories');
            setCategories(response.data);
        } catch (err) {
            console.error("Failed to fetch categories:", err);
        } finally {
            setCategoriesLoading(false);
        }
    };

    const fetchDepartments = async () => {
        setDepartmentsLoading(true);
        try {
            const response = await api.get('/api/departments');
            setDepartments(response.data);
        } catch (err) {
            console.error("Failed to fetch departments:", err);
        } finally {
            setDepartmentsLoading(false);
        }
    };

    const fetchAssetTypes = async () => {
        setAssetTypesLoading(true);
        try {
            const response = await api.get('/api/asset_types');
            setAssetTypes(response.data);
        } catch (err) {
            console.error("Failed to fetch asset types:", err);
        } finally {
            setAssetTypesLoading(false);
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const response = await api.get('/api/users');
            setUsers(response.data);
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchAssets = async (view = activeView, page = currentPage, limit = ITEMS_PER_PAGE, search = searchQuery, catF = categoryFilter, bF = branchFilter, dF = departmentFilter, condF = conditionFilter) => {
        setAssetsLoading(true);
        try {
            const endpoint = view === 'admin_assets' ? '/api/admin-assets' : '/api/assets';
            const params = new URLSearchParams();
            params.append('page', page);
            params.append('limit', limit);
            params.append('page_size', limit);

            if (search) params.append('search', search);

            const catVal = (catF || []).join(',');
            if (catVal && !catVal.toLowerCase().includes('all')) {
                params.append(view === 'admin_assets' ? 'type' : 'category', catVal);
            }
            const bVal = (bF || []).join(',');
            if (bVal && !bVal.toLowerCase().includes('all')) params.append('branch', bVal);

            const dVal = (dF || []).join(',');
            if (dVal && !dVal.toLowerCase().includes('all')) params.append('department', dVal);

            const condVal = (condF || []).join(',');
            if (condVal && !condVal.toLowerCase().includes('all')) {
                params.append(view === 'admin_assets' ? 'status' : 'condition', condVal);
            }

            const response = await api.get(`${endpoint}?${params.toString()}`);
            if (response.data && Array.isArray(response.data.data)) {
                setAssets(response.data.data);
                setTotalServerItems(response.data.total);
                setTotalServerPages(response.data.totalPages || 1);
            } else if (Array.isArray(response.data)) {
                setAssets(response.data);
                setTotalServerItems(response.data.length);
                setTotalServerPages(Math.max(1, Math.ceil(response.data.length / limit)));
            } else {
                setAssets([]);
                setTotalServerItems(0);
                setTotalServerPages(1);
            }
        } catch (err) {
            console.error("Failed to fetch assets:", err);
            setAssets([]);
            setTotalServerItems(0);
            setTotalServerPages(1);
        } finally {
            setAssetsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchAssets(activeView, currentPage, ITEMS_PER_PAGE);
        }
    }, [currentPage]);

    useEffect(() => {
        if (user) {
            refreshUser(); // Sync user permissions (e.g. can_send_mail) from the backend
        }
    }, [user?.email]);





    useEffect(() => {
        if (!user) return;
        const path = location.pathname;
        if (path === '/assets/add' && !hasEditPermission) {
            navigate('/assets');
            return;
        }
        if (path === '/admin-assets/add' && !hasEditPermission) {
            navigate('/admin-assets');
            return;
        }
        if (path === '/assets' || path === '/assets/add') {
            setActiveView('assets');
            fetchAssets('assets');
            fetchAssignees();
            fetchCategories();
            fetchDepartments();
            fetchAssetTypes();
            setAssetCategoryFilter(['All']);
            setAssetBranchFilter(['All']);
            setAssetDepartmentFilter(['All']);
            setAssetConditionFilter(['All']);
            setAssetSearchQuery('');
            if (path === '/assets/add') {
                setIsEditingAsset(false);
                const initialGroup = location.state?.group || 'IT';
                if (initialGroup === 'Admin') {
                    setNewAsset({ assetId: '', category: '', brand: '', model: '', configuration: '', serial: '', assignee: '', empCode: '', cug: '', email: '', department: '', branch: '', purchaseDate: '', warranty: '', condition: '', remarks: '', images: [], qrCode: '', group: 'Admin', assetName: '', location: '', assetProvidedTeam: '', type: '', quantity: '', status: '', warrantyExpiry: '', purchaseCost: '' });
                } else {
                    setNewAsset({ assetId: '', category: 'Laptop', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'IT', branch: 'Cotton Concepts HO_ Coimbatore', purchaseDate: '', warranty: '1 Year', condition: 'Good', remarks: '', images: [], qrCode: '', group: 'IT', assetName: '', location: '', assetProvidedTeam: '', type: '', quantity: '', status: '', warrantyExpiry: '', purchaseCost: '' });
                }
            }
        } else if (path === '/admin-assets' || path === '/admin-assets/add') {
            setActiveView('admin_assets');
            fetchAssets('admin_assets');
            fetchAssignees();
            fetchCategories();
            fetchDepartments();
            fetchAssetTypes();
            setAssetCategoryFilter(['All']);
            setAssetBranchFilter(['All']);
            setAssetDepartmentFilter(['All']);
            setAssetConditionFilter(['All']);
            setAssetSearchQuery('');
            if (path === '/admin-assets/add') {
                setIsEditingAsset(false);
                setNewAsset({ assetId: '', category: 'Furniture', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'ADMIN', branch: (currentBranchList[0] || ''), purchaseDate: '', warranty: '', condition: 'Good', remarks: '', images: [], qrCode: '', group: 'Admin', assetName: '', location: '', assetProvidedTeam: '', type: '', quantity: '', status: '', warrantyExpiry: '', purchaseCost: '' });
            }
        } else if (path === '/users') {
            setActiveView('users');
            fetchUsers();
        } else if (path === '/settings') {
            setActiveView('settings');
            fetchAssignees();
            fetchCategories();
            fetchDepartments();
            fetchAssetTypes();
        } else if (path === '/tickets') {
            setActiveView('tickets');
            fetchTickets();
        } else if (path === '/admin') {
            navigate('/tickets', { replace: true });
        }
    }, [location.pathname, user?.email]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            fetchTickets();
        }, 30 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSelectTicket = (ticketId) => {
        setSelectedTickets(prev => {
            const next = new Set(prev);
            if (next.has(ticketId)) {
                next.delete(ticketId);
            } else {
                next.add(ticketId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedTickets.size === pagedTickets.length) {
            setSelectedTickets(new Set());
        } else {
            setSelectedTickets(new Set(pagedTickets.map(t => t.ticket_id)));
        }
    };

    const handleRowClick = (ticket) => {
        setSelectedTicket(ticket);
        setUpdateStatus(ticket.status || 'Not Started');
        setUpdateAssignee(ticket.assignee || '');
        setResolutionComments(ticket.resolutionComments || '');
        setPendingComments(ticket.pendingComments || '');
        setAddExpense(!!ticket.expenseAmount);
        setExpenseAmount(ticket.expenseAmount || '');
        setBillFile(null);
        setBillFileError('');
        setVendorName(ticket.vendorName || '');
        setIsModalOpen(true);
        setShowApprovalForm(false); // Reset approval form on row click
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        setResolutionComments('');
        setPendingComments('');
        setCommentError('');
        setAddExpense(false);
        setExpenseAmount('');
        setBillFile(null);
        setBillFileError('');
        setVendorName('');
        setShowApprovalForm(false); // Reset approval form on close
    };

    const handleSaveChanges = async () => {
        if (!selectedTicket) return;
        setCommentError('');

        if (!updateAssignee.trim()) {
            setCommentError("Please select an assignee before saving.");
            return;
        }

        if (updateStatus === 'Pending' && !pendingComments.trim()) {
            setCommentError("Comments are mandatory when marking an issue as Pending.");
            return;
        }

        if (updateStatus === 'Completed' && selectedTicket.category === 'Material request' && addExpense) {
            if (!expenseAmount.trim() || isNaN(expenseAmount)) {
                setCommentError("Please provide a valid expense amount.");
                return;
            }
            if (!vendorName.trim()) {
                setCommentError("Please provide a vendor name.");
                return;
            }
            if (billFileError) {
                setCommentError("Please fix the file upload error.");
                return;
            }
        }

        setIsUpdating(true);
        try {
            let res;
            if (updateStatus === 'Completed' && selectedTicket.category === 'Material request' && (addExpense || billFile)) {
                const formData = new FormData();
                formData.append('status', updateStatus);
                formData.append('assignee', updateAssignee);
                formData.append('resolution_comments', resolutionComments);
                formData.append('pending_comments', pendingComments);
                if (addExpense) {
                    formData.append('expense_amount', expenseAmount);
                    formData.append('vendor_name', vendorName);
                }
                if (billFile) {
                    formData.append('bill_attachment', billFile);
                }
                formData.append('admin_name', user?.name || 'Admin');
                res = await api.put(`/api/tickets/${selectedTicket.ticket_id}`, formData);
            } else {
                res = await api.put(`/api/tickets/${selectedTicket.ticket_id}`, {
                    status: updateStatus,
                    assignee: updateAssignee,
                    resolution_comments: resolutionComments,
                    pending_comments: pendingComments,
                    admin_name: user?.name || 'Admin'
                });
            }

            if (res.status !== 200) {
                const data = await res.data;
                throw new Error(data.error || 'Failed to update status');
            }

            // Refresh tickets
            await fetchTickets();
            closeModal();
            showToast('Ticket updated successfully');
        } catch (err) {
            console.error("Error updating ticket:", err);
            alert(`Failed to update status: ${err.message}`);
        } finally {
            setIsUpdating(false);
        }
    };



    const handleDeleteTicket = (e, ticketId) => {
        e.stopPropagation();
        setTicketToDelete(ticketId);
        setShowDeleteConfirm(true);
        setActiveAction(null); // Close dropdown
    };

    const confirmDelete = async () => {
        if (!ticketToDelete && selectedTickets.size === 0) return;
        setIsUpdating(true);

        try {
            if (selectedTickets.size > 0) {
                const response = await api.post('/api/bulk-delete-tickets', {
                    ticket_ids: Array.from(selectedTickets),
                    admin_email: user?.email
                });
                if (response.status === 200) {
                    setTickets(prev => prev.filter(t => !selectedTickets.has(t.ticket_id)));
                    showToast(`Successfully deleted ${selectedTickets.size} tickets`, 'success');
                    setSelectedTickets(new Set());
                } else {
                    showToast('Failed to delete some tickets', 'error');
                }
            } else {
                const response = await api.post(`/api/tickets/${ticketToDelete}`, {
                    admin_email: user?.email
                });
                if (response.status === 200) {
                    setTickets(prev => prev.filter(t => t.ticket_id !== ticketToDelete));
                    showToast('Ticket deleted successfully', 'success');
                }
            }
        } catch (err) {
            console.error("Error deleting ticket:", err);
            showToast('An error occurred while deleting.', 'error');
        } finally {
            setIsUpdating(false);
            setShowDeleteConfirm(false);
            setTicketToDelete(null);
        }
    };

    const confirmDeleteAssets = async () => {
        if (selectedAssetIds.length === 0) return;
        setIsUpdating(true);
        try {
            const apiPath = activeView === 'admin_assets' ? '/api/bulk-delete-admin-assets' : '/api/bulk-delete-assets';
            const response = await api.post(apiPath, {
                asset_ids: selectedAssetIds,
                admin_email: user?.email
            });
            if (response.status === 200) {
                setAssets(prev => prev.filter(a => !selectedAssetIds.includes(a.id)));
                showToast(`Successfully deleted ${selectedAssetIds.length} assets`, 'success');
                setSelectedAssetIds([]);
            } else {
                showToast('Failed to delete assets', 'error');
            }
        } catch (err) {
            console.error("Error deleting assets:", err);
            showToast('An error occurred while deleting assets.', 'error');
        } finally {
            setIsUpdating(false);
            setShowAssetDeleteConfirm(false);
        }
    };

    const handleRequestApproval = (e, ticketId) => {
        e.stopPropagation();
        setActiveAction(null);
        setApprovalData({
            ticketId,
            description: '',
            receivers: [],
            file: null
        });
        setIsApprovalModalOpen(true);
    };

    const handleAddReceiver = (receiver) => {
        setApprovalData(prev => ({
            ...prev,
            receivers: [...new Set([...prev.receivers, receiver])] // Add unique receiver
        }));
    };

    const handleRemoveReceiver = (receiverToRemove) => {
        setApprovalData(prev => ({
            ...prev,
            receivers: prev.receivers.filter(receiver => receiver !== receiverToRemove)
        }));
    };

    const submitApprovalRequest = async (e, ticketId) => {
        e.preventDefault();

        if (!approvalData.receivers || approvalData.receivers.length === 0) {
            alert("Please select at least one receiver.");
            return;
        }

        if (!approvalData.description.trim() && selectedTicket.adminManagerStatus?.toLowerCase() !== 'approved') {
            alert("Please describe the material details.");
            return;
        }

        setIsUpdating(true);
        try {
            // 1. Save status & assignee to DB first
            await api.put(`/api/tickets/${ticketId}`, {
                status: updateStatus,
                assignee: updateAssignee
            });

            // 2. Send approval email
            const formData = new FormData();
            formData.append('description', approvalData.description);
            formData.append('receiver', approvalData.receivers.join(', '));
            formData.append('admin_name', updateAssignee);
            if (approvalData.file) {
                formData.append('attachment', approvalData.file);
            }

            const response = await api.post(`/api/tickets/${ticketId}/notify-manager`, formData);
            const data = await response.data;

            if (response.status === 200) {
                showToast('Mail sent successfully');
                await fetchTickets();
                setShowApprovalForm(false);
                setApprovalData({ description: '', receivers: [], file: null });
            } else {
                showToast(`Failed to send email: ${data.error}`, 'error');
            }
        } catch (err) {
            console.error("Error sending approval request:", err);
            showToast('An error occurred while sending the request.', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    // (Summary Stats moved below filtered logic)

    const getStatusColor = (status) => {
        const s = status?.toLowerCase() || '';
        if (s === 'completed' || s === 'resolved') return 'text-green-600';
        if (s === 'in progress') return 'text-blue-600';
        if (s === 'pending') return 'text-amber-600';
        if (s === 'rejected') return 'text-red-600';
        return 'text-slate-500';
    };

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase() || '';
        if (s === 'completed' || s === 'resolved') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-green-500"></span> */}
                    {status}
                </span>
            );
        } else if (s === 'in progress') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-blue-600 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-blue-500"></span> */}
                    {status}
                </span>
            );
        } else if (s === 'pending') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-amber-500"></span> */}
                    {status}
                </span>
            );
        } else if (s === 'rejected') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-red-500"></span> */}
                    {status}
                </span>
            );
        } else {
            return (
                <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"></span> */}
                    {status}
                </span>
            );
        }
    };

    const getMailStatusBadge = (ticket) => {
        const hasAdminMail = ticket.adminManagerHasMail || (ticket.adminManagerMailTime && ticket.adminManagerMailTime !== "");
        const hasMgmtMail = ticket.managementMailTime && ticket.managementMailTime !== "";

        let mailStatus = "no mail";
        if (hasAdminMail || hasMgmtMail) {
            const isMgrPending = hasAdminMail && (!ticket.adminManagerStatus || ticket.adminManagerStatus.toLowerCase().includes('pending'));
            const isMgmtPending = hasMgmtMail && (!ticket.managementStatus || ticket.managementStatus.toLowerCase().includes('pending'));
            if (isMgrPending || isMgmtPending) {
                mailStatus = "pending";
            } else {
                mailStatus = "approved";
            }
        }

        if (mailStatus === 'approved') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-green-500"></span> */}
                    Approved
                </span>
            );
        } else if (mailStatus === 'pending') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-amber-500"></span> */}
                    Pending
                </span>
            );
        } else {
            return (
                <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {/* <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"></span> */}
                    No mail
                </span>
            );
        }
    };

    const parseTicketDate = (dateString) => {
        if (!dateString) return null;
        // Backend returns "DD-MM-YYYY hh:mm A"
        const parts = dateString.split(/[\s-:]+/);
        if (parts.length >= 5 && parts[2].length === 4) {
            const [day, month, year, hourStr, minStr, ampm] = parts;
            let hour = parseInt(hourStr, 10);
            if (ampm && ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
            if (ampm && ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
            return new Date(year, parseInt(month, 10) - 1, day, hour, parseInt(minStr, 10));
        }
        return new Date(dateString);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = parseTicketDate(dateString);
        if (!date || isNaN(date.getTime())) {
            return typeof dateString === 'string' ? dateString.split(' ')[0] : dateString;
        }

        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    };

    const handleExportData = () => {
        const includedCols = EXPORT_COLUMNS.filter(col => selectedExportColumns.includes(col.id));
        const headers = includedCols.map(col => col.label);

        const xlsxRows = filteredTickets.map((ticket, index) => {
            let monthStr = '';
            if (ticket.timestamp) {
                const d = parseTicketDate(ticket.timestamp);
                if (d && !isNaN(d.getTime())) {
                    monthStr = format(d, 'MMMM');
                }
            }

            const rowData = {
                sno: index + 1,
                ticket_id: ticket.ticket_id,
                date: ticket.timestamp ? formatDate(ticket.timestamp) : '',
                month: monthStr,
                branch: ticket.branch || '',
                name: ticket.fullName || '',
                mobile: ticket.mobile || '',
                department: ticket.department || '',
                category: ticket.category || '',
                subCategory: ticket.subCategory || '',
                supportType: ticket.supportType || '',
                description: ticket.description || '',
                mode: ticket.mode || '',
                assignee: ticket.assignee || '',
                status: ticket.status || '',
                expense: ticket.expenseAmount || '',
                adminComments: ticket.adminDescription || '',
                managerComments: ticket.adminManagerComments || '',
                managementComments: ticket.managementComments || '',
                resolutionComments: ticket.resolutionComments || '',
                userConfirmation: ticket.userConfirmation || ''
            };

            return includedCols.map(col => rowData[col.id]);
        });

        const worksheetData = [headers, ...xlsxRows];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        // Ensure the headers are bold logically in excel if supported by xlsx (it usually requires paid pro version to style, but we do basic export here)
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");

        XLSX.writeFile(workbook, `ticket_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        setShowExportModal(false);
    };

    const handlePrint = () => {
        if (!ticketDetailsRef.current) return;

        const printWindow = window.open('', '_blank', 'width=800,height=900');
        const content = ticketDetailsRef.current.innerHTML;

        // Get all style tags and link tags
        const styles = Array.from(document.getElementsByTagName('style'))
            .map(tag => tag.outerHTML)
            .join('');
        const links = Array.from(document.getElementsByTagName('link'))
            .filter(link => link.rel === 'stylesheet')
            .map(link => link.outerHTML)
            .join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Ticket Details - ${selectedTicket?.ticket_id}</title>
                    ${styles}
                    ${links}
                    <style>
                        body { 
                            background-color: white !important; 
                            color: #1e293b !important; 
                            padding: 2cm !important;
                            font-family: 'Inter', sans-serif !important;
                        }
                        .dark { background-color: white !important; color: #1e293b !important; }
                        /* Ensure text colors are visible on white background */
                        .text-slate-500, .text-slate-400 { color: #64748b !important; }
                        .text-slate-800, .text-slate-900 { color: #1e293b !important; }
                        /* Hide elements that shouldn't be printed */
                        button, .material-symbols-outlined:not(.text-primary), .sticky, 
                        .no-print { display: none !important; }
                        
                        /* Remove borders and shadows for a clean look */
                        * { border: none !important; box-shadow: none !important; border-width: 0 !important; }
                        .border, .border-t, .border-b, .border-l, .border-r { border: none !important; }
                        
                        /* Force 2-column layout for specific rows in print */
                        .print-grid-2 { 
                            display: grid !important; 
                            grid-template-columns: repeat(2, minmax(0, 1fr)) !important; 
                            gap: 1.5rem !important;
                        }
                        
                        .md\:grid-cols-3 { 
                            display: grid !important;
                            grid-template-columns: repeat(3, minmax(0, 1fr)) !important; 
                            gap: 1.5rem !important;
                        }

                        .sticky { position: static !important; }
                        .max-h-[90vh] { max-height: none !important; overflow: visible !important; }
                        .overflow-y-auto { overflow: visible !important; }
                        /* Ensure grid/flex layouts work */
                        .grid { display: grid !important; }
                        .flex { display: flex !important; }
                        /* Force background colors to print */
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        @page { margin: 0; }
                    </style>
                </head>
                <body class="bg-white">
                    <div class="w-full text-slate-900">
                        ${content}
                    </div>
                </body>
            </html>
        `);

        printWindow.document.close();

        // Wait for styles/images to load
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 1000);
    };

    const baseFilteredTickets = tickets.filter(ticket => {
        const matchesSearch = searchQuery === '' ||
            ticket.ticket_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (ticket.assignee && ticket.assignee.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (ticket.category && ticket.category.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesDepartment = departmentFilter.includes('All') || departmentFilter.includes(ticket.department);
        const matchesBranch = branchFilter.includes('All') || branchFilter.includes(ticket.branch);
        const matchesCategory = categoryFilter.includes('All') || categoryFilter.includes(ticket.category);
        const matchesAssignee = assigneeFilter.includes('All') || assigneeFilter.includes(ticket.assignee);

        let matchesDate = true;
        if (isDateFilterActive) {
            const ticketDateStr = parseTicketDate(ticket.timestamp);
            if (ticketDateStr && !isNaN(ticketDateStr.getTime())) {
                const ticketDate = new Date(ticketDateStr.getFullYear(), ticketDateStr.getMonth(), ticketDateStr.getDate());
                const selection = dateRange[0];

                if (selection.startDate) {
                    const from = new Date(selection.startDate);
                    const fromDateOnly = new Date(from.getFullYear(), from.getMonth(), from.getDate());
                    if (ticketDate < fromDateOnly) matchesDate = false;
                }

                if (selection.endDate && matchesDate) {
                    const to = new Date(selection.endDate);
                    const toDateOnly = new Date(to.getFullYear(), to.getMonth(), to.getDate());
                    if (ticketDate > toDateOnly) matchesDate = false;
                }
            } else {
                matchesDate = false; // Exclude invalid dates if filter is active
            }
        }

        return matchesSearch && matchesBranch && matchesDepartment && matchesCategory && matchesAssignee && matchesDate;
    });

    const getMailApprovalStatus = (ticket) => {
        const hasAdminMail = ticket.adminManagerHasMail || (ticket.adminManagerMailTime && ticket.adminManagerMailTime !== '');
        const hasMgmtMail = ticket.managementMailTime && ticket.managementMailTime !== '';
        if (!hasAdminMail && !hasMgmtMail) return 'No Mail';
        const isMgrPending = hasAdminMail && (!ticket.adminManagerStatus || ticket.adminManagerStatus.toLowerCase().includes('pending'));
        const isMgmtPending = hasMgmtMail && (!ticket.managementStatus || ticket.managementStatus.toLowerCase().includes('pending'));
        if (isMgrPending || isMgmtPending) return 'Pending';
        return 'Approved';
    };

    const filteredTickets = baseFilteredTickets
        .filter(ticket => statusFilter.includes('All') || statusFilter.includes(ticket.status))
        .filter(ticket => mailApprovalFilter.includes('All') || mailApprovalFilter.includes(getMailApprovalStatus(ticket)));

    // Calculate Summary Stats based on current base filters (date, search, etc.)
    const totalTickets = baseFilteredTickets.length;
    const notStartedTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'not started').length;
    const pendingTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'pending').length;
    const inProgressTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'in progress').length;
    const completedTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'resolved').length;
    const rejectedTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'rejected').length;
    const mailPendingTickets = baseFilteredTickets.filter(ticket => {
        const hasAdminMail = ticket.adminManagerHasMail || (ticket.adminManagerMailTime && ticket.adminManagerMailTime !== "");
        const hasMgmtMail = ticket.managementMailTime && ticket.managementMailTime !== "";
        if (hasAdminMail || hasMgmtMail) {
            const isMgrPending = hasAdminMail && (!ticket.adminManagerStatus || ticket.adminManagerStatus.toLowerCase().includes('pending'));
            const isMgmtPending = hasMgmtMail && (!ticket.managementStatus || ticket.managementStatus.toLowerCase().includes('pending'));
            return isMgrPending || isMgmtPending;
        }
        return false;
    }).length;

    const ITEMS_PER_PAGE = 20;
    const totalPages = Math.max(1, Math.ceil(filteredTickets.length / ITEMS_PER_PAGE));
    const pagedTickets = filteredTickets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, branchFilter, departmentFilter, categoryFilter, assigneeFilter, mailApprovalFilter, dateRange, isDateFilterActive]);

    const uniqueBranches = ['All', ...new Set([...currentBranchList, ...tickets.map(t => t.branch).filter(Boolean)])];
    const uniqueDepartments = ['All', ...new Set(tickets.map(t => t.department).filter(Boolean))];
    const uniqueCategories = ['All', ...new Set(tickets.map(t => t.category).filter(Boolean))];
    const uniqueAssignees = ['All', ...new Set(tickets.map(t => t.assignee).filter(Boolean))];
    const uniqueAssetBranches = ['All', ...new Set([...currentBranchList, ...(assets || []).map(a => a.branch).filter(Boolean)])];
    const uniqueAssetDepartments = ['All', ...new Set((assets || []).map(a => a.department).filter(Boolean).sort((a, b) => a.localeCompare(b)))];
    const uniqueAssetTypes = ['All', ...new Set((assets || []).map(a => activeView === 'admin_assets' ? a.type : a.category).filter(Boolean).sort((a, b) => a.localeCompare(b)))];
    const uniqueAssetConditions = ['All', ...new Set((assets || []).map(a => activeView === 'admin_assets' ? a.status : a.condition).filter(Boolean).sort((a, b) => a.localeCompare(b)))];

    if (isMobile) {
        return (
            <div className="font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col justify-center items-center p-6">
                <div className="w-full max-w-sm flex flex-col space-y-6">
                    <div className="text-center space-y-2">
                        <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm mb-4">
                            <span className="material-symbols-outlined text-[32px]">qr_code_scanner</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Scan Asset QR</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Scan an asset tag to instantly view or update its details.
                        </p>
                    </div>

                    <div className="w-full aspect-square bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative ring-4 ring-primary/20">
                        {qrScannerError || !navigator.mediaDevices || !window.isSecureContext ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-200">
                                <span className="material-symbols-outlined text-4xl text-amber-500 mb-3 animate-pulse">photo_camera_off</span>
                                <h3 className="text-sm font-bold text-white mb-2">Camera Access Blocked</h3>
                                <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                                    {!window.isSecureContext
                                        ? "Camera access requires a secure HTTPS connection. Please access this app via HTTPS."
                                        : qrScannerError
                                            ? `Error: ${qrScannerError}`
                                            : "Unable to find or access camera. Please check your browser's camera permissions."
                                    }
                                </p>
                                {!window.isSecureContext && (
                                    <span className="mt-3 px-3 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-semibold rounded-full border border-amber-500/20">
                                        Insecure HTTP Context
                                    </span>
                                )}
                            </div>
                        ) : (
                            <Scanner
                                onScan={(result) => {
                                    if (result && result.length > 0 && result[0].rawValue) {
                                        const qrContent = result[0].rawValue;
                                        try {
                                            const urlObj = new URL(qrContent);
                                            if (urlObj.pathname.startsWith('/asset/')) {
                                                navigate(urlObj.pathname + '?edit=true');
                                                return;
                                            }
                                        } catch (e) {
                                            // Ignore invalid URL error, try fallback string matching
                                        }

                                        if (qrContent.includes('/asset/')) {
                                            const assetPath = qrContent.substring(qrContent.indexOf('/asset/'));
                                            navigate(assetPath + (assetPath.includes('?') ? '&' : '?') + 'edit=true');
                                        } else {
                                            showToast('Invalid Asset QR Code scanned.', 'error');
                                        }
                                    }
                                }}
                                onError={(error) => {
                                    console.log(error?.message);
                                    setQrScannerError(error?.message || "Unknown error opening camera.");
                                }}
                                components={{
                                    audio: true,
                                    onOff: true,
                                    tracker: true,
                                }}
                            />
                        )}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="mt-8 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer w-full"
                    >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        Logout
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="font-display bg-background-light dark:bg-[#181D27] text-slate-900 dark:text-[#f0f0f2] min-h-screen flex flex-col">
            <main className="flex-1 flex flex-col min-w-0">

                {/* ── Page Title Header Bar ───────────────────────────────────── */}
                {(() => {
                    const pageConfig = {
                        tickets: { icon: 'confirmation_number', label: 'Tickets', desc: 'View and manage all support tickets', iconBg: 'bg-[#E0F2FE]', iconColor: 'text-[#0080FF]', border: 'border-[#0080FF]/20' },
                        assets: { icon: 'laptop_mac', label: 'IT Assets', desc: 'Track and manage all IT equipment', iconBg: 'bg-[#ECFDF5]', iconColor: 'text-[#059669]', border: 'border-[#059669]/20' },
                        admin_assets: { icon: 'corporate_fare', label: 'Admin Assets', desc: 'Manage furniture, fixtures and office assets', iconBg: 'bg-[#E0E7FF]', iconColor: 'text-[#4F46E5]', border: 'border-[#4F46E5]/20' },
                        users: { icon: 'group', label: 'Users', desc: 'Manage user accounts and permissions', iconBg: 'bg-[#F5F3FF]', iconColor: 'text-[#7C3AED]', border: 'border-[#7C3AED]/20' },
                        settings: { icon: 'settings', label: 'Settings', desc: 'Configure assignees, categories and more', iconBg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
                    };
                    const cfg = pageConfig[activeView];
                    if (!cfg) return null;
                    return (
                        <div className="sticky top-0 z-40 flex items-center justify-between gap-5 px-20 py-4 bg-white dark:bg-[#1C212B] shrink-0">
                            <div className="flex items-center gap-5">
                                <button
                                    onClick={() => navigate('/')}
                                    className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} ${cfg.iconColor} flex items-center justify-center shrink-0`}>
                                        <span className="material-symbols-outlined text-xl">{cfg.icon}</span>
                                    </div>
                                    <div>
                                        <h1 className="text-base font-bold text-slate-800 dark:text-white leading-tight">{cfg.label}</h1>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cfg.desc}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {(activeView === 'assets' || activeView === 'admin_assets') && hasEditPermission && (
                                    <button
                                        onClick={() => {
                                            setIsEditingAsset(false);
                                            if (activeView === 'admin_assets') {
                                                setNewAsset({ assetId: '', category: 'Furniture', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'ADMIN', branch: (currentBranchList[0] || ''), purchaseDate: '', warranty: '', condition: 'Good', remarks: '', images: [], qrCode: '', group: 'Admin', assetName: '', location: '', assetProvidedTeam: '', type: '', quantity: '', status: '', warrantyExpiry: '', purchaseCost: '' });
                                                navigate('/admin-assets/add', { state: { group: 'Admin' } });
                                            } else {
                                                setNewAsset({ assetId: '', category: 'Laptop', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'IT', branch: (currentBranchList[0] || ''), purchaseDate: '', warranty: '1 Year', condition: 'Good', remarks: '', images: [], qrCode: '', group: 'IT', assetName: '', location: '', assetProvidedTeam: '', type: '', quantity: '', status: '', warrantyExpiry: '', purchaseCost: '' });
                                                navigate('/assets/add', { state: { group: 'IT' } });
                                            }
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer border-0 text-sm font-display ${
                                            activeView === 'admin_assets' 
                                                ? 'bg-[#4F46E5] hover:bg-[#4338CA]' 
                                                : 'bg-[#059669] hover:bg-[#047857]'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-lg">add</span>
                                        Add Asset
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
                    );
                })()}

                {/* ── Tickets View Analysis Section ────────────────────────────────── */}
                {activeView === 'tickets' && (
                    <div className="px-20 pt-6 bg-[#F8FAFC] dark:bg-[#181D27] shrink-0">
                        <style>{`
                            .ticket-stat-card {
                                border: 1.5px solid transparent;
                                box-shadow: 0 10px 30px -10px rgba(0,0,0,0.07);
                                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                            }
                            .ticket-stat-card:hover {
                                transform: translateY(-4px);
                            }
                            .ticket-stat-blue:hover  { border-color: #0080FF; box-shadow: 0 16px 36px -10px rgba(0,128,255,0.25); }
                            .ticket-stat-red:hover   { border-color: #DC2626; box-shadow: 0 16px 36px -10px rgba(220,38,38,0.22); }
                            .ticket-stat-amber:hover { border-color: #F59E0B; box-shadow: 0 16px 36px -10px rgba(245,158,11,0.22); }
                            .ticket-stat-green:hover { border-color: #059669; box-shadow: 0 16px 36px -10px rgba(5,150,105,0.22); }
                            .ticket-stat-purple:hover{ border-color: #7C3AED; box-shadow: 0 16px 36px -10px rgba(124,58,237,0.22); }
                            .ticket-table-card {
                                box-shadow: 0 10px 30px -10px rgba(0,0,0,0.07);
                            }
                        `}</style>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-5">
                            <div className="ticket-stat-card ticket-stat-blue bg-white dark:bg-slate-900 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Tickets</p>
                                    <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : totalTickets}</h3>
                                </div>
                                <div className="h-12 w-12 bg-[#E0F2FE] text-[#0080FF] rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">analytics</span>
                                </div>
                            </div>
                            <div className="ticket-stat-card ticket-stat-red bg-white dark:bg-slate-900 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Not Started</p>
                                    <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : notStartedTickets}</h3>
                                </div>
                                <div className="h-12 w-12 bg-[#FEE2E2] text-[#DC2626] rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">priority_high</span>
                                </div>
                            </div>
                            <div className="ticket-stat-card ticket-stat-amber bg-white dark:bg-slate-900 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending</p>
                                    <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : pendingTickets}</h3>
                                </div>
                                <div className="h-12 w-12 bg-[#FFF7ED] text-[#F59E0B] rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">hourglass_empty</span>
                                </div>
                            </div>
                            <div className="ticket-stat-card ticket-stat-blue bg-white dark:bg-slate-900 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">In Progress</p>
                                    <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : inProgressTickets}</h3>
                                </div>
                                <div className="h-12 w-12 bg-[#E0F2FE] text-[#0080FF] rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">running_with_errors</span>
                                </div>
                            </div>
                            <div className="ticket-stat-card ticket-stat-green bg-white dark:bg-slate-900 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed</p>
                                    <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : completedTickets}</h3>
                                </div>
                                <div className="h-12 w-12 bg-[#ECFDF5] text-[#059669] rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">task_alt</span>
                                </div>
                            </div>
                            <div className="ticket-stat-card ticket-stat-purple bg-white dark:bg-slate-900 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Mail Pending</p>
                                    <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : mailPendingTickets}</h3>
                                </div>
                                <div className="h-12 w-12 bg-[#F5F3FF] text-[#7C3AED] rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">mail</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeView !== 'settings' && (
                    <header
                        className="h-24 flex items-center justify-between px-20 shrink-0 dark:bg-[#181D27]">

                        {activeView === 'users' && (
                            <div className="relative flex-1 max-w-sm mr-auto animate-in fade-in slide-in-from-left-2 duration-200">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                <input
                                    type="text"
                                    placeholder="Search users by name, email or branch..."
                                    value={userSearchQuery}
                                    onChange={e => setUserSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-200 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                />
                            </div>
                        )}

                        {(activeView === 'assets' || activeView === 'admin_assets') && <>
                            <div className="relative flex-1 max-w-sm mr-6">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                <input
                                    type="text"
                                    placeholder="Search asset id, type, brand, username..."
                                    value={assetSearchQuery}
                                    onChange={e => setAssetSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <MultiSelectFilter
                                    label="Type"
                                    icon="category"
                                    options={uniqueAssetTypes}
                                    selected={assetCategoryFilter}
                                    onChange={setAssetCategoryFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label="Branch"
                                    icon="location_on"
                                    options={uniqueAssetBranches}
                                    selected={assetBranchFilter}
                                    onChange={setAssetBranchFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label="Dept"
                                    icon="corporate_fare"
                                    options={uniqueAssetDepartments}
                                    selected={assetDepartmentFilter}
                                    onChange={setAssetDepartmentFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label={activeView === 'admin_assets' ? 'Status' : 'Condition'}
                                    icon={activeView === 'admin_assets' ? 'check_circle' : 'healing'}
                                    options={uniqueAssetConditions}
                                    selected={assetConditionFilter}
                                    onChange={setAssetConditionFilter}
                                    widthClass="w-38"
                                />
                                <div className="relative flex items-center gap-2">
                                    <button
                                        onClick={() => setShowDatePicker(!showDatePicker)}
                                        aria-label="Toggle date filter"
                                        title="Date Range Filter"
                                        className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors shadow-sm relative
                                        ${isDateFilterActive || showDatePicker
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            calendar_today
                                        </span>
                                        {isDateFilterActive && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"></span>
                                            </span>
                                        )}
                                    </button>

                                    {showDatePicker && (
                                        <div className="absolute top-12 right-0 z-50 shadow-2xl rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
                                            <DateRangePicker
                                                onChange={handleDateChange}
                                                moveRangeOnFirstSelection={false}
                                                months={2}
                                                ranges={dateRange}
                                                direction="horizontal"
                                                rangeColors={['#137fec']}
                                                staticRanges={[]}
                                                inputRanges={[]}
                                            />
                                            <div className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700/50 p-3 flex justify-between items-center">
                                                {isDateFilterActive ? (
                                                    <button
                                                        onClick={clearDateFilter}
                                                        className="text-sm font-medium text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors ml-2"
                                                    >
                                                        Clear filter
                                                    </button>
                                                ) : (
                                                    <div></div>
                                                )}
                                                <button
                                                    onClick={() => setShowDatePicker(false)}
                                                    className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                                                >
                                                    Done
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="relative" ref={downloadDropdownRef}>
                                    <button
                                        onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                                        disabled={selectedAssetIds.length === 0}
                                        title={selectedAssetIds.length === 0 ? "Select assets to download" : "Download Options"}
                                        className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all shadow-sm
                                        ${selectedAssetIds.length > 0
                                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 cursor-pointer animate-in fade-in scale-in-95 duration-200'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'}`}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            download
                                        </span>
                                    </button>
                                    {selectedAssetIds.length > 0 && (
                                        <div
                                            className={`absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1.5 transition-all duration-200 
                                            ${showDownloadDropdown
                                                    ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                                                    : 'opacity-0 invisible translate-y-1 pointer-events-none'
                                                }`}
                                        >
                                            <button
                                                onClick={() => {
                                                    handleDownloadSelectedQRs();
                                                    setShowDownloadDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">qr_code</span>
                                                <span>QR Code</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleDownloadSelectedAssets();
                                                    setShowDownloadDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2.5 transition-colors border-t border-slate-100 dark:border-slate-800/80 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">description</span>
                                                <span>Export</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isSuperAdmin && (
                                    <button
                                        onClick={() => setShowAssetDeleteConfirm(true)}
                                        disabled={selectedAssetIds.length === 0}
                                        title={selectedAssetIds.length === 0 ? "Select assets to delete" : "Delete Selected Assets"}
                                        className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-all shadow-sm
                                        ${selectedAssetIds.length > 0
                                                ? 'bg-red-600 text-white border-red-600 hover:bg-red-700 cursor-pointer animate-in fade-in scale-in-95 duration-200'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'}`}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            delete
                                        </span>
                                    </button>
                                )}
                                {((assetSearchQuery !== '') || !assetCategoryFilter.includes('All') || !assetBranchFilter.includes('All') || !assetDepartmentFilter.includes('All') || !assetConditionFilter.includes('All') || isDateFilterActive) && (
                                    <button
                                        onClick={() => {
                                            setAssetSearchQuery('');
                                            setAssetCategoryFilter(['All']);
                                            setAssetBranchFilter(['All']);
                                            setAssetDepartmentFilter(['All']);
                                            setAssetConditionFilter(['All']);
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
                        </>}

                        {activeView === 'tickets' && <>
                            <div className="relative flex-1 max-w-md">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-[#eceef0] dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Search tickets..."
                                    type="text" />
                            </div>
                            <div className="flex items-center gap-2 mx-4">
                                <MultiSelectFilter
                                    label="Branch"
                                    icon="location_on"
                                    options={uniqueBranches}
                                    selected={branchFilter}
                                    onChange={setBranchFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label="Dept"
                                    icon="corporate_fare"
                                    options={uniqueDepartments}
                                    selected={departmentFilter}
                                    onChange={setDepartmentFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label="Category"
                                    icon="category"
                                    options={uniqueCategories}
                                    selected={categoryFilter}
                                    onChange={setCategoryFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label="Status"
                                    icon="checklist"
                                    options={['All', 'Not Started', 'In Progress', 'Pending', 'Completed', 'Rejected']}
                                    selected={statusFilter}
                                    onChange={setStatusFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label="Assignee"
                                    icon="person"
                                    options={uniqueAssignees}
                                    selected={assigneeFilter}
                                    onChange={setAssigneeFilter}
                                    widthClass="w-38"
                                />
                                <MultiSelectFilter
                                    label="Mail"
                                    icon="mail"
                                    options={['All', 'No Mail', 'Pending', 'Approved']}
                                    selected={mailApprovalFilter}
                                    onChange={setMailApprovalFilter}
                                    widthClass="w-38"
                                />
                                <button
                                    onClick={() => setShowDatePicker(!showDatePicker)}
                                    aria-label="Toggle date filter"
                                    title="Date Range Filter"
                                    className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors shadow-sm relative
                                    ${isDateFilterActive || showDatePicker
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        calendar_today
                                    </span>
                                    {isDateFilterActive && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"></span>
                                        </span>
                                    )}
                                </button>

                                {/* Clear Filters Button */}
                                {(searchQuery !== '' || !statusFilter.includes('All') || !branchFilter.includes('All') || !departmentFilter.includes('All') || !categoryFilter.includes('All') || !assigneeFilter.includes('All') || !mailApprovalFilter.includes('All') || isDateFilterActive) && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('');
                                            setStatusFilter(['All']);
                                            setBranchFilter(['All']);
                                            setDepartmentFilter(['All']);
                                            setCategoryFilter(['All']);
                                            setAssigneeFilter(['All']);
                                            setMailApprovalFilter(['All']);
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
                            <div className="relative flex items-center gap-2">

                                {isSuperAdmin && selectedTickets.size > 0 && (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        aria-label="Bulk delete"
                                        title={`Delete ${selectedTickets.size} selected tickets`}
                                        className="flex items-center justify-center h-9 w-9 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                )}

                                <button
                                    aria-label="Export to CSV"
                                    title={!user?.access?.includes('Export') ? "You don't have permission to export" : "Export to CSV"}
                                    disabled={!user?.access?.includes('Export')}
                                    className={`flex items-center justify-center h-10 w-10 rounded-lg border transition-colors shadow-sm text-sm font-medium
                                    ${user?.access?.includes('Export')
                                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                                        : 'bg-slate-100 dark:bg-slate-800/30 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'}`}
                                    onClick={() => {
                                        if (!user?.access?.includes('Export')) return;
                                        setShowExportModal(true);
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                </button>

                                {showDatePicker && (
                                    <div className="absolute top-12 right-0 z-50 shadow-2xl rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
                                        <DateRangePicker
                                            onChange={handleDateChange}
                                            moveRangeOnFirstSelection={false}
                                            months={2}
                                            ranges={dateRange}
                                            direction="horizontal"
                                            rangeColors={['#137fec']}
                                            staticRanges={[]}
                                            inputRanges={[]}
                                        />
                                        <div className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700/50 p-3 flex justify-between items-center">
                                            {isDateFilterActive ? (
                                                <button
                                                    onClick={clearDateFilter}
                                                    className="text-sm font-medium text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors ml-2"
                                                >
                                                    Clear filter
                                                </button>
                                            ) : (
                                                <div></div>
                                            )}
                                            <button
                                                onClick={() => setShowDatePicker(false)}
                                                className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                    </>}
                    <div className="flex items-center gap-4">
                        {activeView === 'users' && (
                            <button
                                onClick={() => setShowAddUser(p => !p)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow"
                            >
                                <span className="material-symbols-outlined text-base">person_add</span>
                                {showAddUser ? 'Cancel' : 'Add User'}
                            </button>
                        )}
                    </div>
                </header>
                )}

                {/* Users View */}
                {activeView === 'users' && hasUsersAccess && (
                    <UsersView
                        allUsers={users}
                        users={users.filter(u =>
                            (u.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            (u.branch || '').toLowerCase().includes(userSearchQuery.toLowerCase())
                        )}
                        setUsers={setUsers}
                        usersLoading={usersLoading}
                        showAddUser={showAddUser}
                        setShowAddUser={setShowAddUser}
                        searchQuery={userSearchQuery}
                        hasEditPermission={hasEditPermission}
                        currentUser={user}
                        refreshUser={refreshUser}
                        fetchUsers={fetchUsers}
                        departments={departments}
                        branchOptions={currentBranchList}
                    />
                )}

                {/* Settings View */}
                {activeView === 'settings' && hasSettingsAccess && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        <AssigneesView
                            assignees={assignees}
                            setAssignees={setAssignees}
                            assigneesLoading={assigneesLoading}
                            isExpanded={expandedSettingsView === 'assignees'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'assignees' ? null : 'assignees')}
                            hasEditPermission={hasEditPermission}
                        />
                        <CategoriesView
                            categories={categories}
                            setCategories={setCategories}
                            categoriesLoading={categoriesLoading}
                            isExpanded={expandedSettingsView === 'categories'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'categories' ? null : 'categories')}
                            hasEditPermission={hasEditPermission}
                        />
                        <DepartmentsView
                            departments={departments}
                            setDepartments={setDepartments}
                            departmentsLoading={departmentsLoading}
                            isExpanded={expandedSettingsView === 'departments'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'departments' ? null : 'departments')}
                            showToast={showToast}
                            hasEditPermission={hasEditPermission}
                        />
                        <AssetTypesView
                            assetTypes={assetTypes}
                            setAssetTypes={setAssetTypes}
                            assetTypesLoading={assetTypesLoading}
                            isExpanded={expandedSettingsView === 'assetTypes'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'assetTypes' ? null : 'assetTypes')}
                            hasEditPermission={hasEditPermission}
                        />
                        <BranchesLocationsView
                            isExpanded={expandedSettingsView === 'branchesLocations'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'branchesLocations' ? null : 'branchesLocations')}
                            hasEditPermission={hasEditPermission}
                            showToast={showToast}
                        />
                        <TicketGifView

                            isExpanded={expandedSettingsView === 'ticketGif'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'ticketGif' ? null : 'ticketGif')}
                            hasEditPermission={hasEditPermission}
                            showToast={showToast}
                            categories={categories}
                        />
                    </div>
                )}

                {/* Assets View */}
                {(activeView === 'assets' || activeView === 'admin_assets') && (
                    <AssetsView
                        assets={assets}
                        setAssets={setAssets}
                        assetTypes={assetTypes}
                        hasEditPermission={hasEditPermission}
                        searchQuery={assetSearchQuery}
                        setSearchQuery={setAssetSearchQuery}
                        categoryFilter={assetCategoryFilter}
                        branchFilter={assetBranchFilter}
                        departmentFilter={assetDepartmentFilter}
                        conditionFilter={assetConditionFilter}
                        showAddModal={location.pathname === '/assets/add' || location.pathname === '/admin-assets/add' || (showAddAssetModal && isEditingAsset)}
                        setShowAddModal={(val, isEdit = false) => {
                            if (val) {
                                if (isEditingAsset || isEdit) {
                                    setShowAddAssetModal(true);
                                } else {
                                    navigate(activeView === 'admin_assets' ? '/admin-assets/add' : '/assets/add');
                                }
                            } else {
                                if (location.pathname === '/assets/add' || location.pathname === '/admin-assets/add') {
                                    navigate(activeView === 'admin_assets' ? '/admin-assets' : '/assets');
                                } else {
                                    setShowAddAssetModal(false);
                                }
                            }
                        }}
                        newAsset={newAsset}
                        setNewAsset={setNewAsset}
                        isEditing={isEditingAsset}
                        setIsEditing={setIsEditingAsset}
                        editingId={editingAssetId}
                        setEditingId={setEditingAssetId}
                        isDateFilterActive={isDateFilterActive}
                        dateRange={dateRange}
                        selectedAssetIds={selectedAssetIds}
                        setSelectedAssetIds={setSelectedAssetIds}
                        departments={departments}
                        activeView={activeView}
                        assetsLoading={assetsLoading}
                        currentBranchList={currentBranchList}
                    />
                )}

                {/* Tickets View */}
                {activeView === 'tickets' && <div className="flex-1 flex flex-col px-20 pb-10 gap-6 bg-[#F8FAFC] dark:bg-[#181D27]">
                    <div className="ticket-table-card bg-white dark:bg-slate-900 rounded-2xl flex flex-col min-h-[calc(100vh-10px)] max-h-[calc(100vh-10px)] flex-1 overflow-hidden">

                        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-[#eceef0] dark:bg-[#333844]">
                                    <tr
                                        className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                                        {isSuperAdmin && (
                                            <th className="px-4 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary cursor-pointer"
                                                    checked={pagedTickets.length > 0 && selectedTickets.size === pagedTickets.length}
                                                    onChange={toggleSelectAll}
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-4 text-left">Ticket ID</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4">Assignee</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Mail Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={isSuperAdmin ? "10" : "9"}>
                                                <div className="flex flex-col items-center justify-center py-12">
                                                    <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-2"></div>
                                                    <p className="text-slate-500 text-sm font-medium">Loading tickets...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredTickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={isSuperAdmin ? "10" : "9"} className="px-6 py-8 text-center text-slate-500">
                                                {tickets.length === 0 ? "No tickets found." : "No tickets match your search."}
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedTickets.map((ticket, index) => (
                                            <tr key={ticket.ticket_id} onClick={() => handleRowClick(ticket)} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedTickets.has(ticket.ticket_id) ? 'bg-primary/5 dark:bg-primary/10 select-none' : ''}`}>
                                                {isSuperAdmin && (
                                                    <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary cursor-pointer"
                                                            checked={selectedTickets.has(ticket.ticket_id)}
                                                            onChange={() => toggleSelectTicket(ticket.ticket_id)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-6 py-2 text-sm font-medium text-primary text-left">#{ticket.ticket_id}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.branch || '-'}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(ticket.timestamp)}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.fullName}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.department || '-'}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.category}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.assignee || '-'}</td>
                                                <td className="px-6 py-2">
                                                    {getStatusBadge(ticket.status)}
                                                </td>
                                                <td className="px-6 py-2">
                                                    {getMailStatusBadge(ticket)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Showing <span className="font-medium">{filteredTickets.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}</span> of <span className="font-medium">{filteredTickets.length}</span> tickets
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-1 py-1 border border-1 border-solid border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center text-slate-600 dark:text-slate-400"
                                    title="Previous Page"
                                >
                                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
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
                                                className={`px-3 py-1 text-sm rounded transition-colors ${currentPage === item
                                                    ? 'bg-primary text-white'
                                                    : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                            >{item}</button>
                                        )
                                    )
                                }
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-1 py-1 border border-1 border-solid border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center text-slate-600 dark:text-slate-400"
                                    title="Next Page"
                                >
                                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>}

                {/* Ticket Details Modal */}
                {
                    isModalOpen && selectedTicket && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
                            <div ref={ticketDetailsRef} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">sticky_note_2</span>
                                        Ticket Details <span className="text-slate-400 font-normal text-sm">#{selectedTicket.ticket_id}</span>
                                        {selectedTicket.mode && selectedTicket.mode !== '-' && (
                                            <span className={`ml-3 px-2 py-0.5 text-xs font-medium rounded-full ${selectedTicket.mode === 'Remote Support'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {selectedTicket.mode}
                                            </span>
                                        )}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handlePrint}
                                            title={selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' ? 'Print Ticket' : 'Print is only available for Completed tickets'}
                                            disabled={!(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved')}
                                            className={`p-2 flex items-center justify-center rounded-lg transition-all ${selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved'
                                                ? 'text-primary hover:bg-primary/10 cursor-pointer'
                                                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined">print</span>
                                        </button>
                                        <button onClick={closeModal} className="px-2 pt-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    {/* Row 1: Branch, Submitted */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Branch</label>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedTicket.branch || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Submitted</label>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{formatDate(selectedTicket.timestamp)}</p>
                                        </div>
                                    </div>

                                    {/* Row 2: Name, Mobile */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer</label>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedTicket.fullName}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mobile</label>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedTicket.mobile}</p>
                                        </div>
                                    </div>

                                    {/* Row 3: Department, Category */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</label>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                <p className="font-medium text-sm">{selectedTicket.department || '-'}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                <p className="font-medium text-sm">{selectedTicket.category}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 4: Support Type */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Support Type</label>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                <p className="font-medium text-sm">{selectedTicket.supportType || '-'}</p>
                                            </div>
                                        </div>
                                        {/* Empty div to maintain 2-column balance if needed, or just let it align left */}
                                        <div className="print:hidden"></div>
                                    </div>

                                    {/* Row 4: Description */}
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Issue Description</label>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-100 dark:border-slate-800">
                                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {selectedTicket.description || "No specific description provided."}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Admin History / Material Details */}
                                        {/* Legacy Admin Description (for compatibility with very old tickets) */}
                                        {selectedTicket.adminDescription && (!selectedTicket.adminComments || selectedTicket.adminComments.length === 0) && (
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Technical Details / Material Specs (Admin)</label>
                                                <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-4 border border-amber-100/50 dark:border-amber-800/50">
                                                    <p className="text-sm text-slate-700 dark:text-amber-200/80 leading-relaxed whitespace-pre-wrap">
                                                        {selectedTicket.adminDescription}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Attachment */}
                                    {selectedTicket.attachment && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Attachment</label>
                                            <div className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                                                <span className="material-symbols-outlined text-slate-400">attachment</span>
                                                <span className="text-sm font-medium truncate flex-1">{selectedTicket.attachment}</span>
                                                <a
                                                    href={`/api/tickets/${selectedTicket.ticket_id}/attachment`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline text-sm font-medium cursor-pointer"
                                                >
                                                    View Image
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Approval Status */}
                                    {(selectedTicket.adminManagerStatus || selectedTicket.managementStatus) && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 px-1">
                                            <div className="flex items-center justify-between mb-5 border-b border-slate-200 dark:border-slate-700 pb-2">
                                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">APPROVAL HISTORY</h3>
                                            </div>

                                            {/* MANAGER SECTION — supports multiple managers with per-manager data */}
                                            {selectedTicket.adminManagerStatus && (() => {
                                                // Use adminManagerApprovals JSON if available (new), else fall back to text parsing
                                                let managerApprovals = [];
                                                if (selectedTicket.adminManagerApprovals && Array.isArray(selectedTicket.adminManagerApprovals) && selectedTicket.adminManagerApprovals.length > 0) {
                                                    managerApprovals = selectedTicket.adminManagerApprovals;
                                                } else {
                                                    // Fallback: parse from text fields for older tickets
                                                    const commentsByManager = {};
                                                    (selectedTicket.adminManagerComments || '').split('\n').forEach(line => {
                                                        const colonIdx = line.indexOf(':');
                                                        if (colonIdx > -1) {
                                                            commentsByManager[line.substring(0, colonIdx).trim()] = line.substring(colonIdx + 1).trim();
                                                        }
                                                    });
                                                    managerApprovals = selectedTicket.adminManagerStatus.split(',').map(part => {
                                                        const [name, ...rest] = part.split(':');
                                                        const n = name?.trim();
                                                        return { name: n, status: rest.join(':').trim(), admin_description: selectedTicket.adminManagerAdminDesc || selectedTicket.adminDescription || '', mail_receive: selectedTicket.adminManagerMailTime, decision_made: selectedTicket.adminManagerStatusTime, comments: commentsByManager[n] || '' };
                                                    }).filter(e => e.name);
                                                }

                                                // Comments from text field per manager (for both paths)
                                                const commentsByManager = {};
                                                (selectedTicket.adminManagerComments || '').split('\n').forEach(line => {
                                                    const colonIdx = line.indexOf(':');
                                                    if (colonIdx > -1) {
                                                        commentsByManager[line.substring(0, colonIdx).trim()] = line.substring(colonIdx + 1).trim();
                                                    }
                                                });

                                                return (
                                                    <div className="mb-6">
                                                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">MANAGER</h4>
                                                        <div className="flex flex-col gap-3">
                                                            {managerApprovals.map((entry, idx) => {
                                                                const st = (entry.status || '').toLowerCase();
                                                                const isApproved = st.includes('approved');
                                                                const isPending = st.includes('pending');
                                                                const cardCls = isApproved
                                                                    ? 'bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50'
                                                                    : isPending
                                                                        ? 'bg-amber-50/60 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50'
                                                                        : 'bg-rose-50/60 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50';
                                                                const badgeCls = isApproved
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                    : isPending
                                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
                                                                const managerComment = commentsByManager[entry.name] || entry.comments || '';
                                                                return (
                                                                    <div key={idx} className={`border rounded-xl p-4 relative transition-colors duration-200 ${cardCls}`}>
                                                                        <div className="flex items-center justify-between mb-4">
                                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">
                                                                                {entry.name || 'Manager'}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${badgeCls}`}>
                                                                                {entry.status || '-'}
                                                                            </span>
                                                                        </div>

                                                                        <div className="mb-4">
                                                                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                                                Comments: <span className="normal-case text-slate-700 dark:text-slate-300 ml-1">{managerComment || '-'}</span>
                                                                            </p>
                                                                        </div>

                                                                        {/* Per-manager admin description */}
                                                                        <div className="bg-white/60 dark:bg-slate-900/40 border border-white dark:border-slate-800/40 p-3 mb-4 rounded-lg shadow-sm">
                                                                            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-relaxed mb-1">ADMIN DESCRIPTION</p>
                                                                            <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                                                {entry.admin_description || '-'}
                                                                            </p>
                                                                        </div>

                                                                        <div className="flex flex-col gap-1 mt-2">
                                                                            {entry.mail_receive && (
                                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span> Request Sent: {entry.mail_receive}
                                                                                </p>
                                                                            )}
                                                                            {entry.decision_made && (
                                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>event_available</span> Status Updated: {entry.decision_made}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* MANAGEMENT SECTION */}
                                            {selectedTicket.managementStatus && (!selectedTicket.adminManagerStatus || !selectedTicket.adminManagerStatus.trim().toLowerCase().includes('rejected')) && (() => {
                                                let arrivals = [];
                                                if (selectedTicket.managementApprovals && Array.isArray(selectedTicket.managementApprovals) && selectedTicket.managementApprovals.length > 0) {
                                                    arrivals = selectedTicket.managementApprovals;
                                                } else {
                                                    const parts = (selectedTicket.managementStatus || '').split(',').map(s => s.trim()).filter(Boolean);
                                                    const seen = new Map();
                                                    parts.forEach(part => {
                                                        if (part.includes(':')) {
                                                            const [name, stat] = part.split(':').map(s => s.trim());
                                                            seen.set(name, {
                                                                name,
                                                                mail_receive: selectedTicket.managementMailTime,
                                                                decision_made: stat !== 'Pending' ? selectedTicket.managementStatusTime : null,
                                                                comments: stat !== 'Pending' ? stat : null,
                                                                status: stat
                                                            });
                                                        }
                                                    });
                                                    arrivals = Array.from(seen.values());
                                                }
                                                if (arrivals.length === 0) return null;

                                                return (
                                                    <div className="mb-6">
                                                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">MANAGEMENT</h4>
                                                        <div className="space-y-4">
                                                            {arrivals.map((entry, idx) => {
                                                                const rawStatus = (entry.status || (entry.decision_made ? 'Approved' : 'Pending')).toLowerCase();
                                                                const adminNoteMatch = selectedTicket.adminComments && selectedTicket.adminComments.find(c => c.target_role === 'Management' && c.recipients && c.recipients.includes(entry.name));
                                                                const adminNote = entry.admin_description || entry.admin_desc || (adminNoteMatch ? adminNoteMatch.comment : (selectedTicket.adminComments && selectedTicket.adminComments.find(c => c.target_role === 'Management' && (!c.recipients || c.recipients.length === 0))?.comment || selectedTicket.adminDescription || 'Need your approval'));

                                                                return (
                                                                    <div key={`mgmt-box-${idx}`} className={`border rounded-xl p-4 relative transition-colors duration-200 ${rawStatus.includes('approved')
                                                                        ? 'bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50'
                                                                        : rawStatus.includes('pending')
                                                                            ? 'bg-amber-50/60 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50'
                                                                            : 'bg-rose-50/60 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50'
                                                                        }`}>
                                                                        <div className="flex items-center justify-between mb-4">
                                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">{entry.name}</span>
                                                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${rawStatus.includes('approved')
                                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                                : rawStatus.includes('pending')
                                                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                                }`}>
                                                                                {rawStatus.toUpperCase()}
                                                                            </span>
                                                                        </div>

                                                                        <div className="mb-4">
                                                                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                                                                Comments: <span className="normal-case text-slate-700 dark:text-slate-300 ml-1">{entry.comments || '-'}</span>
                                                                            </p>
                                                                        </div>

                                                                        {/* ADMIN DESCRIPTION Box */}
                                                                        <div className="bg-white/60 dark:bg-slate-900/40 border border-white dark:border-slate-800/40 p-3 mb-4 rounded-lg shadow-sm">
                                                                            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-relaxed mb-1">ADMIN DESCRIPTION</p>
                                                                            <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                                                {adminNote}
                                                                            </p>
                                                                        </div>

                                                                        <div className="flex flex-col gap-1 mt-2">
                                                                            {entry.mail_receive && (
                                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span> Request Sent: {entry.mail_receive}
                                                                                </p>
                                                                            )}
                                                                            {entry.decision_made && (
                                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>event_available</span> Status Updated: {entry.decision_made}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Final Processing History */}
                                            {selectedTicket.adminComments && selectedTicket.adminComments.some(c => c.target_role === 'StatusUpdate') && (
                                                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                                                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                                                        Processing History
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {selectedTicket.adminComments
                                                            .filter(c => c.target_role === 'StatusUpdate')
                                                            .map((note, idx) => (
                                                                <div key={`status-hist-${idx}`} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                    <div className={`mt-1.5 w-2 h-2 rounded-full ${note.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} title={note.status}></div>
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                                                                                {note.status}:
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{note.timestamp}</span>
                                                                        </div>
                                                                        <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-snug">
                                                                            {note.comment}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* User Confirmation Status */}
                                    {selectedTicket.status === 'Completed' && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">User Confirmation</h3>
                                            <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border 
                                                ${selectedTicket.userConfirmation === 'Pending' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' :
                                                    selectedTicket.userConfirmation?.startsWith('Yes') ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' :
                                                        'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30'}`}>

                                                <span className={`material-symbols-outlined text-xl mt-0.5 shrink-0 
                                                    ${selectedTicket.userConfirmation === 'Pending' ? 'text-blue-500' :
                                                        selectedTicket.userConfirmation?.startsWith('Yes') ? 'text-emerald-500' :
                                                            'text-rose-500'}`}>
                                                    {selectedTicket.userConfirmation === 'Pending' ? 'help' :
                                                        selectedTicket.userConfirmation?.startsWith('Yes') ? 'check_circle' :
                                                            'cancel'}
                                                </span>

                                                <div>
                                                    <p className={`text-sm font-semibold 
                                                        ${selectedTicket.userConfirmation === 'Pending' ? 'text-blue-700 dark:text-blue-400' :
                                                            selectedTicket.userConfirmation?.startsWith('Yes') ? 'text-emerald-700 dark:text-emerald-400' :
                                                                'text-rose-700 dark:text-rose-400'}`}>
                                                        {selectedTicket.userConfirmation}
                                                    </p>
                                                    <p className={`text-xs mt-0.5 
                                                        ${selectedTicket.userConfirmation === 'Pending' ? 'text-blue-600 dark:text-blue-500' :
                                                            selectedTicket.userConfirmation?.startsWith('Yes') ? 'text-emerald-600 dark:text-emerald-500' :
                                                                'text-rose-600 dark:text-rose-500'}`}>
                                                        {selectedTicket.userConfirmation === 'Pending' ? 'Awaiting user to confirm if the issue is resolved.' :
                                                            selectedTicket.userConfirmation === 'Yes' ? 'User has confirmed the issue is resolved.' :
                                                                selectedTicket.userConfirmation === 'Yes (System Auto-Confirmed)' ? 'System automatically confirmed the issue as resolved after 1 hour.' :
                                                                    'User has reported the issue is not resolved.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Row 4.5: Resolution Comments Tracking (visible on modal regardless of mode) */}
                                    {selectedTicket.resolutionComments && !(['Pending', 'Completed', 'Resolved'].includes(updateStatus) && !(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected')) && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resolution Comments</h3>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                                {selectedTicket.resolutionComments}
                                            </p>
                                        </div>
                                    )}

                                    {/* Expense Tracking Display / Input */}
                                    {selectedTicket.category === 'Material request' && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Expense Tracking</h3>
                                                    <p className="text-[11px] text-slate-400">Record bill amounts for material requests.</p>
                                                </div>
                                                {updateStatus === 'Completed' && !(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected') && (
                                                    <label className={`flex items-center ${user.access && !user.access.includes('Edit') ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                                        <div className="relative">
                                                            <input type="checkbox" className="sr-only" checked={addExpense} disabled={user.access && !user.access.includes('Edit')} onChange={() => { setAddExpense(!addExpense); setCommentError(''); }} />
                                                            <div className={`block w-10 h-6 rounded-full transition-colors ${addExpense ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                                                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${addExpense ? 'transform translate-x-4' : ''}`}></div>
                                                        </div>
                                                        <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">Add Expense</span>
                                                    </label>
                                                )}
                                            </div>

                                            {/* Display existing expense if Already Completed */}
                                            {(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved') && selectedTicket.expenseAmount && (
                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-500 mb-1">Total Expense Amount</p>
                                                        <p className="text-xl font-bold text-slate-800 dark:text-slate-200">₹ {selectedTicket.expenseAmount}</p>
                                                        {selectedTicket.vendorName && (
                                                            <p className="text-sm font-medium text-slate-500 mt-1">Vendor: <span className="text-slate-800 dark:text-slate-200">{selectedTicket.vendorName}</span></p>
                                                        )}
                                                    </div>
                                                    {selectedTicket.billAttachmentName && (
                                                        <a href={`/api/tickets/${selectedTicket.ticket_id}/bill`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-primary shadow-sm shadow-slate-200/50 dark:shadow-none">
                                                            <span className="material-symbols-outlined text-lg">receipt_long</span>
                                                            View Bill
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {/* Input form if adding expense currently */}
                                            {addExpense && updateStatus === 'Completed' && !(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved') && (
                                                <div className="mt-4 animate-fade-in">
                                                    <div className="mb-4">
                                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Vendor Name <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="text"
                                                            value={vendorName}
                                                            onChange={(e) => {
                                                                setVendorName(e.target.value);
                                                                setCommentError('');
                                                            }}
                                                            disabled={user.access && !user.access.includes('Edit')}
                                                            placeholder="Enter vendor name"
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Amount (₹) <span className="text-red-500">*</span></label>
                                                            <input
                                                                type="text"
                                                                value={
                                                                    !expenseAmount ? '' :
                                                                        (expenseAmount.toString().endsWith('.') ?
                                                                            new Intl.NumberFormat('en-IN').format(parseFloat(expenseAmount.replace('.', ''))) + '.' :
                                                                            new Intl.NumberFormat('en-IN').format(parseFloat(expenseAmount)))
                                                                }
                                                                onChange={(e) => {
                                                                    // Strip everything except numbers and a single decimal point
                                                                    let rawVal = e.target.value.replace(/[^0-9.]/g, '');
                                                                    // Ensure only one decimal point exists
                                                                    const parts = rawVal.split('.');
                                                                    if (parts.length > 2) {
                                                                        rawVal = parts[0] + '.' + parts.slice(1).join('');
                                                                    }
                                                                    setExpenseAmount(rawVal);
                                                                    setCommentError('');
                                                                }}
                                                                disabled={user.access && !user.access.includes('Edit')}
                                                                placeholder="0"
                                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Upload Bill (Optional)</label>
                                                            <input
                                                                type="file"
                                                                onChange={(e) => {
                                                                    const file = e.target.files && e.target.files[0];
                                                                    if (file) {
                                                                        if (file.size > 5 * 1024 * 1024) {
                                                                            setBillFileError('File size is larger than 5MB limit.');
                                                                            setBillFile(null);
                                                                            e.target.value = ''; // Reset input
                                                                        } else {
                                                                            setBillFileError('');
                                                                            setBillFile(file);
                                                                        }
                                                                    } else {
                                                                        setBillFileError('');
                                                                        setBillFile(null);
                                                                    }
                                                                }}
                                                                disabled={user.access && !user.access.includes('Edit')}
                                                                className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border ${billFileError ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800`}
                                                            />
                                                            {billFileError && (
                                                                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">error</span>
                                                                    {billFileError}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Row 5: Footer Actions */}
                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6 no-print">
                                        {/* Pending Comments — mandatory when setting to Pending */}
                                        {updateStatus === 'Pending' && !(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved') && (
                                            <div className="mb-4">
                                                <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                                                    Pending Comments <span className="text-red-500">*</span>
                                                </label>
                                                <textarea
                                                    className={`w-full p-3 bg-white dark:bg-slate-900 border ${commentError ? 'border-red-400 focus:ring-red-400' : 'border-amber-300 dark:border-amber-700/50 focus:ring-amber-400'} rounded-lg focus:ring-2 focus:border-transparent outline-none transition-shadow text-sm disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800`}
                                                    rows="3"
                                                    placeholder="Please provide justification / comments for moving this ticket to Pending..."
                                                    value={pendingComments}
                                                    onChange={(e) => {
                                                        setPendingComments(e.target.value);
                                                        setCommentError('');
                                                    }}
                                                    disabled={user.access && !user.access.includes('Edit')}
                                                    required
                                                ></textarea>
                                                {commentError && (
                                                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                                        {commentError}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {/* Resolution Comments — optional when setting to Completed */}
                                        {updateStatus === 'Completed' && !(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected') && (
                                            <div className="mb-4">
                                                <label className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                                                    Resolution Comments (Optional)
                                                </label>
                                                <textarea
                                                    className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/50 focus:ring-emerald-400 rounded-lg focus:ring-2 focus:border-transparent outline-none transition-shadow text-sm disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800"
                                                    rows="3"
                                                    placeholder="Add any final comments / resolution details before completing..."
                                                    value={resolutionComments}
                                                    onChange={(e) => {
                                                        setResolutionComments(e.target.value);
                                                        setCommentError('');
                                                    }}
                                                    disabled={user.access && !user.access.includes('Edit')}
                                                ></textarea>
                                                {commentError && (
                                                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                                        {commentError}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {/* Show commentError for other statuses too */}
                                        {commentError && updateStatus !== 'Pending' && updateStatus !== 'Completed' && (
                                            <p className="text-xs text-red-500 mb-4 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">error</span>
                                                {commentError}
                                            </p>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                                                <SelectDropdown
                                                    label="Status"
                                                    options={['Not Started', 'In Progress', 'Pending', 'Completed']}
                                                    value={updateStatus}
                                                    onChange={(val) => setUpdateStatus(val)}
                                                    disabled={['Completed', 'Resolved'].includes(selectedTicket.status) || (!isSuperAdmin && !isPowerUser && user?.name !== selectedTicket.assignee && user?.access && !user.access.includes('Edit'))}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <SelectDropdown
                                                        label="Assignee"
                                                        options={Array.isArray(assignees)
                                                            ? assignees
                                                                .filter(a => !selectedTicket.supportType || a.support_type.includes(selectedTicket.supportType))
                                                                .map(a => ({ value: a.name, label: a.name }))
                                                            : []}
                                                        value={updateAssignee}
                                                        onChange={(val) => setUpdateAssignee(val)}
                                                        disabled={['Completed', 'Resolved'].includes(selectedTicket.status) || (!isSuperAdmin && !isPowerUser && user?.name !== selectedTicket.assignee && user?.access && !user.access.includes('Edit'))}
                                                    />
                                                </div>
                                                {!(['Completed', 'Resolved'].includes(selectedTicket.status)) && (isSuperAdmin || isPowerUser || user?.name === selectedTicket.assignee || (user.access && user.access.includes('Edit'))) && (
                                                    <button
                                                        onClick={handleSaveChanges}
                                                        disabled={isUpdating}
                                                        className="px-4 py-3 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                                    >
                                                        {isUpdating ? (
                                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                        ) : (
                                                            <span className="material-symbols-outlined">check</span>
                                                        )}
                                                    </button>
                                                )}

                                            </div>
                                        </div>
                                        {/* Request Approval section — allowed if user has send mail access, or for specific request types */}
                                        {(user?.can_send_mail || isSuperAdmin || selectedTicket.category === 'Material request' || selectedTicket.supportType?.includes('Admin Support') || selectedTicket.supportType?.includes('IT Support')) && (
                                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                {/* Toggle button — disabled until status & assignee chosen */}
                                                {/* Compute whether all members have responded */}
                                                {(() => {
                                                    const respondedNames = new Set();
                                                    if (selectedTicket.managementComments) {
                                                        selectedTicket.managementComments.split('\n').forEach(line => {
                                                            const commentPart = line.includes('|||') ? line.split('|||')[1] : line;
                                                            const match = commentPart?.trim().match(/^([^[]+)\s*\[(?:APPROVED|REJECTED)\]/i);
                                                            if (match) respondedNames.add(match[1].trim());
                                                        });
                                                    }
                                                    // Dynamic check based on users who have mail enabled and match ticket's support type
                                                    const mailUsers = users.filter(u => u.can_receive_mail && (!selectedTicket.supportType || (u.support_type && u.support_type.includes(selectedTicket.supportType))));
                                                    const managementNames = mailUsers.filter(u => u.receiver_position === 'Management').map(u => u.name);
                                                    const adminManagerNames = mailUsers.filter(u => u.receiver_position === 'Manager').map(u => u.name);

                                                    const adminManagerDone = adminManagerNames.length > 0 ? adminManagerNames.every(n => respondedNames.has(n)) : true;
                                                    const allManagementDone = managementNames.every(n => respondedNames.has(n));
                                                    const allMembersResponded = (adminManagerNames.length > 0 || managementNames.length > 0) && adminManagerDone && allManagementDone;

                                                    const isAlreadyInProgress = selectedTicket.status === 'In Progress';
                                                    const isDisabled = !updateAssignee || !updateStatus
                                                        || selectedTicket.status === 'Completed'
                                                        || selectedTicket.status === 'Resolved'
                                                        || (user.access && !user.access.includes('Edit'))
                                                        || (!isSuperAdmin && !user.can_send_mail);

                                                    return (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={isDisabled}
                                                                onClick={() => {
                                                                    setShowApprovalForm(prev => !prev);
                                                                    setApprovalData({ description: '', receivers: [], file: null });
                                                                }}
                                                                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all border ${isDisabled
                                                                    ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                                                                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                                                                    }`}
                                                            >
                                                                <span className="material-symbols-outlined text-base">approval</span>
                                                                {showApprovalForm ? 'Hide Approval Form' : 'Request Approval'}
                                                            </button>
                                                            {allMembersResponded && (
                                                                <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center justify-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                                    Status received from all members
                                                                </p>
                                                            )}

                                                            {/* Inline approval form — only visible if NOT disabled */}
                                                            {showApprovalForm && !isDisabled && (
                                                                <div className="mt-4 space-y-4">
                                                                    {/* Receiver Name */}
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                                            Receiver Name <span className="text-red-500">*</span>
                                                                        </label>
                                                                        <div className="min-h-[42px] w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-wrap gap-1.5 items-center">
                                                                            {approvalData.receivers.length === 0 && (
                                                                                <span className="text-sm text-slate-400">Select receivers below…</span>
                                                                            )}
                                                                            {approvalData.receivers.map((name) => (
                                                                                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                                                                    {name}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setApprovalData({
                                                                                            ...approvalData,
                                                                                            receivers: approvalData.receivers.filter(r => r !== name)
                                                                                        })}
                                                                                        className="hover:text-primary/60 ml-0.5"
                                                                                    >
                                                                                        <span className="material-icons" style={{ fontSize: '13px' }}>close</span>
                                                                                    </button>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                        {(() => {
                                                                            // Parse names that have already responded from managementComments
                                                                            const alreadyNotified = new Set();
                                                                            if (selectedTicket.managementComments) {
                                                                                selectedTicket.managementComments.split('\n').forEach(line => {
                                                                                    const commentPart = line.includes('|||') ? line.split('|||')[1] : line;
                                                                                    const match = commentPart?.trim().match(/^([^[]+)\s*\[(?:APPROVED|REJECTED)\]/i);
                                                                                    if (match) alreadyNotified.add(match[1].trim());
                                                                                });
                                                                            }
                                                                            // Exclude Management users who were already sent an email
                                                                            if (selectedTicket.managementStatus) {
                                                                                selectedTicket.managementStatus.split(',').forEach(part => {
                                                                                    if (part.includes(':')) {
                                                                                        alreadyNotified.add(part.split(':')[0].trim());
                                                                                    }
                                                                                });
                                                                            }
                                                                            // Exclude Managers who have already been notified (tracked in adminManagerStatus as "Name: Status")
                                                                            if (selectedTicket.adminManagerStatus) {
                                                                                selectedTicket.adminManagerStatus.split(',').forEach(part => {
                                                                                    const namePart = part.split(':')[0].trim();
                                                                                    if (namePart) alreadyNotified.add(namePart);
                                                                                });
                                                                            }

                                                                            const available = users.filter(u => u.can_receive_mail && (!selectedTicket.supportType || (u.support_type && u.support_type.includes(selectedTicket.supportType))))
                                                                                .map(u => u.name)
                                                                                .filter(n => !approvalData.receivers.includes(n))
                                                                                .filter(n => !alreadyNotified.has(n));

                                                                            return available.length > 0 ? (
                                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                                    {available.map((name) => (
                                                                                        <button
                                                                                            key={name}
                                                                                            type="button"
                                                                                            onClick={() => setApprovalData({
                                                                                                ...approvalData,
                                                                                                receivers: [...approvalData.receivers, name]
                                                                                            })}
                                                                                            className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary transition-all"
                                                                                        >
                                                                                            + {name}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="mt-2 text-sm text-slate-500 italic">
                                                                                    No new receivers available. All eligible receivers have already been notified.
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>

                                                                    {/* Material Description */}
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                                            {selectedTicket.category === 'Material request' ? 'Material Description' : 'Approval Justification'} {selectedTicket.adminManagerStatus?.toLowerCase() !== 'approved' && <span className="text-red-500">*</span>}
                                                                        </label>
                                                                        <textarea
                                                                            rows="3"
                                                                            placeholder={selectedTicket.category === 'Material request' ? "Describe the material details" : "Provide justification for this approval request"}
                                                                            value={approvalData.description}
                                                                            onChange={(e) => setApprovalData({ ...approvalData, description: e.target.value })}
                                                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none outline-none"
                                                                        />
                                                                    </div>

                                                                    {/* Attachment */}
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Attachment (Optional)</label>
                                                                        <input
                                                                            type="file"
                                                                            onChange={(e) => setApprovalData({ ...approvalData, file: e.target.files[0] })}
                                                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                                                        />
                                                                    </div>

                                                                    {/* Send button */}
                                                                    <div className="flex justify-end gap-3 pt-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setShowApprovalForm(false)}
                                                                            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isUpdating}
                                                                            onClick={(e) => submitApprovalRequest(e, selectedTicket.ticket_id)}
                                                                            className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                                        >
                                                                            {isUpdating ? 'Sending…' : 'Send Request'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Custom Delete Confirmation Modal */}
                {
                    showDeleteConfirm && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-zoom-in" onClick={e => e.stopPropagation()}>
                                <div className="p-6 text-center">
                                    <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-red-600 text-3xl">delete_forever</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Delete {selectedTickets.size > 0 ? `${selectedTickets.size} Tickets` : 'Ticket'}?</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                        Are you sure you want to delete {selectedTickets.size > 0 ? 'the selected tickets' : 'this ticket'}? This action cannot be undone.
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={confirmDelete}
                                            disabled={isUpdating}
                                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isUpdating ? (
                                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            ) : (
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            )}
                                            Delete Ticket
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Custom Asset Delete Confirmation Modal */}
                {
                    showAssetDeleteConfirm && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAssetDeleteConfirm(false)}>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-zoom-in" onClick={e => e.stopPropagation()}>
                                <div className="p-6 text-center">
                                    <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-red-600 text-3xl">delete_forever</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Delete {selectedAssetIds.length} Asset{selectedAssetIds.length > 1 ? 's' : ''}?</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                        Are you sure you want to delete the selected asset{selectedAssetIds.length > 1 ? 's' : ''}? This action cannot be undone.
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={confirmDeleteAssets}
                                            disabled={isUpdating}
                                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isUpdating ? (
                                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            ) : (
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            )}
                                            Delete Asset{selectedAssetIds.length > 1 ? 's' : ''}
                                        </button>
                                        <button
                                            onClick={() => setShowAssetDeleteConfirm(false)}
                                            className="w-full py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >

            {/* Export Columns Modal */}
            {
                showExportModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowExportModal(false)}>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-zoom-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">view_column</span>
                                        Customize Export
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select the columns to include in your exported report.</p>
                                </div>
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {EXPORT_COLUMNS.map(col => (
                                        <label key={col.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 shadow-sm cursor-pointer transition-all group">
                                            <input
                                                type="checkbox"
                                                checked={selectedExportColumns.includes(col.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedExportColumns(prev => [...prev, col.id]);
                                                    } else {
                                                        setSelectedExportColumns(prev => prev.filter(id => id !== col.id));
                                                    }
                                                }}
                                                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer transition-all"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between gap-3 shrink-0 items-center">
                                <div className="text-sm text-slate-500 font-medium">
                                    {selectedExportColumns.length} columns selected
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowExportModal(false)}
                                        className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleExportData}
                                        disabled={selectedExportColumns.length === 0}
                                        className="px-6 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">file_download</span>
                                        Export Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Generating QRs Loader Overlay */}
            {isGeneratingQRs && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-5 text-center animate-in zoom-in-95 duration-200">
                        <div className="relative flex items-center justify-center">
                            <div className="h-16 w-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                            <span className="material-symbols-outlined text-[28px] text-emerald-500 absolute">qr_code_2</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Generating Printable Sheet</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                                Compiling selected asset QR labels into a high-DPI A4 printable layout...
                            </p>
                            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-semibold">
                                <span className="animate-pulse h-1.5 w-1.5 bg-emerald-500 rounded-full"></span>
                                <span>Processing {selectedAssetIds.length} Label(s)</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast notification */}
            {
                toast && (
                    <div className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-white text-sm font-medium transition-all animate-fade-in ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                        <span className="material-symbols-outlined text-base">
                            {toast.type === 'error' ? 'error' : 'check_circle'}
                        </span>
                        {toast.message}
                    </div>
                )
            }
        </div >
    );
};

export default AdminDashboard;
