import React, { useState, useEffect, useRef } from 'react';
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

const normalizeCategory = (cat) => {
    const trimmed = (cat || '').trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower === 'ups' || lower === 'cpu' || lower === 'nas' || lower === 'it') {
        return trimmed.toUpperCase();
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const BRANCH_OPTIONS = [
    'All',
    'Cotton Concepts HO_ Coimbatore',
    'Doctor Towels HO',
    'Cotton Concepts_ Vengamedu',
    'Cotton Concepts_ Karur',
    'Doctor Towels_ Karur'
];

const MultiSelectFormDropdown = ({ label, icon, options, selected, onChange }) => {
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

    const isSelected = (option) => selected.includes(option);

    const getDisplayValue = () => {
        if (selected.includes('All')) return `All ${label}`;
        if (selected.length === 1) return selected[0];
        return `${selected.length} Selected`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-3 w-full pl-3 pr-10 py-2.5 text-sm rounded-xl border cursor-pointer transition-all bg-slate-50 dark:bg-slate-800 ${isOpen ? 'ring-2 ring-primary border-primary bg-white dark:bg-slate-900 shadow-sm' : 'border-slate-200 dark:border-slate-700'}`}
            >
                {icon && <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>}
                <span className={`truncate font-medium ${selected.includes('All') ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'}`}>
                    {getDisplayValue()}
                </span>
                <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[60] py-2 overflow-hidden animate-in fade-in zoom-in duration-150">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
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
                                <div className={`h-4.5 w-4.5 rounded flex items-center justify-center border-2 transition-all ${isSelected(option) ? 'bg-primary border-primary shadow-sm shadow-primary/20' : 'border-slate-300 dark:border-slate-600 group-hover:border-primary/50'}`}>
                                    {isSelected(option) && <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>}
                                </div>
                                <span className={`text-[13px] font-medium transition-colors ${isSelected(option) ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {option === 'All' ? `All Branches` : option}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SelectDropdown = ({ label, options, value, onChange, direction = 'down', maxHeight = 'max-h-40' }) => {
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
                className={`flex items-center justify-between w-full px-4 py-3 text-sm rounded-xl border cursor-pointer transition-all bg-slate-50 dark:bg-slate-800 font-medium ${
                    isOpen ? 'ring-2 ring-primary border-primary' : 'border-slate-200 dark:border-slate-700'
                }`}
            >
                <span className="text-slate-800 dark:text-white truncate">{value || label}</span>
                <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform duration-200 shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            {isOpen && (
                <div className={`absolute left-0 w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[200] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                    direction === 'up' 
                        ? 'bottom-full mb-1.5 origin-bottom' 
                        : 'top-full mt-1.5 origin-top'
                }`}>
                    <div className={`${maxHeight} overflow-y-auto custom-scrollbar px-1.5 py-0.5 space-y-0.5`}>
                        {options.map(opt => (
                            <div
                                key={opt.value ?? opt}
                                onClick={() => { onChange(opt.value ?? opt); setIsOpen(false); }}
                                className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors font-medium ${
                                    (opt.value ?? opt) === value
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

const UsersView = ({ users, setUsers, usersLoading, showAddUser, setShowAddUser }) => {
    const [newUser, setNewUser] = useState({
        name: '', email: '', password: '',
        access: ['View'],
        support_type: ['IT Support', 'Admin Support'],
        add_as_assignee: false,
        can_receive_mail: false,
        can_send_mail: false,
        receiver_position: '',
        branch: ['All']
    });
    const [addError, setAddError] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [editingUser, setEditingUser] = useState(null);

    const toggleAccess = (perm) => {
        setNewUser(p => ({
            ...p,
            access: p.access.includes(perm)
                ? p.access.filter(a => a !== perm)
                : [...p.access, perm]
        }));
    };

    const toggleSupportType = (type) => {
        setNewUser(p => ({
            ...p,
            support_type: p.support_type.includes(type)
                ? p.support_type.filter(t => t !== type)
                : [...p.support_type, type]
        }));
    };

    const toggleBranch = (branch) => {
        setNewUser(p => {
            if (branch === 'All') {
                return { ...p, branch: ['All'] };
            }
            const newBranches = p.branch.includes(branch)
                ? p.branch.filter(b => b !== branch)
                : [...p.branch.filter(b => b !== 'All'), branch];
            return { ...p, branch: newBranches.length ? newBranches : ['All'] };
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
            add_as_assignee: false,
            can_receive_mail: false,
            can_send_mail: false,
            receiver_position: '',
            branch: ['All']
        });
    };

    const handleOpenEdit = (user) => {
        setEditingUser(user);
        setNewUser({
            name: user.name,
            email: user.email,
            password: '', // Leave blank to not change
            access: (user.access || 'View').split(',').map(s => s.trim()),
            support_type: (user.support_type || 'IT Support,Admin Support').split(',').map(s => s.trim()),
            add_as_assignee: !!user.is_assignee,
            can_receive_mail: !!user.can_receive_mail,
            can_send_mail: !!user.can_send_mail,
            receiver_position: user.receiver_position || '',
            branch: (user.branch || 'All').split(',').map(s => s.trim())
        });
        setAddError('');
        setShowAddUser(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        if (newUser.access.length === 0) { setAddError('Please select at least one access permission.'); return; }
        if (newUser.support_type.length === 0) { setAddError('Please select at least one support type.'); return; }
        if (!editingUser && !newUser.password) { setAddError('Password is required for new users.'); return; }
        if (newUser.password && newUser.password.length < 6) { setAddError('Password must be at least 6 characters long.'); return; }
        setAddError('');
        setAddLoading(true);
        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
            const method = editingUser ? 'PUT' : 'POST';

            const payload = { ...newUser, access: newUser.access.join(','), support_type: newUser.support_type.join(','), branch: newUser.branch.join(',') };

            const res = await (method === 'PUT' ? api.put(url, payload) : api.post(url, payload));
            const data = await res.data;
            if (res.status !== 200 && res.status !== 201) { setAddError(data.error || `Failed to ${editingUser ? 'update' : 'create'} user.`); return; }

            if (editingUser) {
                setUsers(prev => prev.map(u => u.id === editingUser.id ? {
                    ...u,
                    name: newUser.name,
                    email: newUser.email,
                    access: newUser.access.join(','),
                    support_type: newUser.support_type.join(','),
                    can_receive_mail: newUser.can_receive_mail,
                    can_send_mail: newUser.can_send_mail,
                    receiver_position: newUser.receiver_position,
                    is_assignee: newUser.add_as_assignee,
                    branch: newUser.branch.join(',')
                } : u));
            } else {
                setUsers(prev => [...prev, {
                    name: newUser.name,
                    email: newUser.email,
                    access: newUser.access.join(','),
                    support_type: newUser.support_type.join(','),
                    id: data.id,
                    created_at: 'Just now',
                    can_receive_mail: newUser.can_receive_mail,
                    can_send_mail: newUser.can_send_mail,
                    receiver_position: newUser.receiver_position,
                    is_assignee: newUser.add_as_assignee,
                    branch: newUser.branch.join(',')
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
        <div className="flex-1 overflow-auto p-8">
            {/* ── Add User Modal ── */}
            {showAddUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
                    {/* Panel */}
                    <form onSubmit={handleSaveUser}
                        className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8">
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
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
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

                            {/* Branch Selection and Password in same row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Branch <span className="text-red-400">*</span>
                                    </label>
                                    <MultiSelectFormDropdown
                                        label="Branches"
                                        icon="location_on"
                                        options={BRANCH_OPTIONS}
                                        selected={newUser.branch}
                                        onChange={toggleBranch}
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

                            {/* Access */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                    Access <span className="text-red-400">*</span>
                                </label>
                                <div className="flex gap-3">
                                    {ACCESS_OPTIONS.map(perm => (
                                        <label key={perm}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all select-none text-sm font-semibold ${newUser.access.includes(perm)
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/40'}`}>
                                            <input type="checkbox" className="sr-only" checked={newUser.access.includes(perm)}
                                                onChange={() => toggleAccess(perm)} />
                                            <span className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${newUser.access.includes(perm) ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                                                {newUser.access.includes(perm) && <span className="material-symbols-outlined text-white font-bold" style={{ fontSize: '13px' }}>check</span>}
                                            </span>
                                            {perm}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Support Type */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                    Support Type <span className="text-red-400">*</span>
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {SUPPORT_TYPE_OPTIONS.map(type => (
                                        <label key={type}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all select-none text-sm font-semibold ${newUser.support_type.includes(type)
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/40'}`}>
                                            <input type="checkbox" className="sr-only" checked={newUser.support_type.includes(type)}
                                                onChange={() => toggleSupportType(type)} />
                                            <span className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${newUser.support_type.includes(type) ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                                                {newUser.support_type.includes(type) && <span className="material-symbols-outlined text-white font-bold" style={{ fontSize: '13px' }}>check</span>}
                                            </span>
                                            {type}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Add as Assignee & Need to send mail */}
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newUser.add_as_assignee}
                                            onChange={e => setNewUser(p => ({ ...p, add_as_assignee: e.target.checked }))}
                                            className="sr-only"
                                        />
                                        <div className={`w-10 h-5 rounded-full transition-colors ${newUser.add_as_assignee ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                        <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${newUser.add_as_assignee ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Add as Assignee</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group">
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
                                        <div className={`w-10 h-5 rounded-full transition-colors ${newUser.can_receive_mail ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                        <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${newUser.can_receive_mail ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Access to receive mail</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={newUser.can_send_mail}
                                            onChange={e => setNewUser(p => ({ ...p, can_send_mail: e.target.checked }))}
                                            className="sr-only"
                                        />
                                        <div className={`w-10 h-5 rounded-full transition-colors ${newUser.can_send_mail ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                        <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${newUser.can_send_mail ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Access to send mail</span>
                                </label>
                            </div>

                            {/* Receiver Position Dropdown */}
                            {newUser.can_receive_mail && (
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                        Receiver's Position <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">badge</span>
                                        <select
                                            value={newUser.receiver_position}
                                            onChange={e => setNewUser(p => ({ ...p, receiver_position: e.target.value }))}
                                            className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary text-slate-800 dark:text-white appearance-none transition-shadow"
                                            required
                                        >
                                            <option value="Manager">Manager</option>
                                            <option value="Management">Management</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                            )}
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
            ) : users.length === 0 ? (
                <div className="text-center py-20 text-slate-400">No users found.</div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">#</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Email</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Access</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Support Type</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Branch</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created At</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mail</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {users.map((user, idx) => (
                                <tr key={user.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                {user.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <span className="font-semibold text-slate-800 dark:text-white">{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{user.email}</td>
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
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-xs">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            {user.branch || 'All'}
                                        </span>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
    departments
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [qrLightbox, setQrLightbox] = useState(null); // holds base64 src when open
    const [currentPage, setCurrentPage] = useState(1);
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

    // Prevent background scrolling when lightbox is open
    useEffect(() => {
        if (activeImage) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [activeImage]);

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
    };

    useEffect(() => {
        let active = true;
        if (selectedAsset && selectedAsset.qrCode) {
            setDetailsQRBlobUrl('');
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
    }, [searchQuery, categoryFilter, branchFilter, departmentFilter, isDateFilterActive, dateRange]);



    const filteredAssets = (Array.isArray(assets) ? assets : []).filter(a => {
        const matchesSearch = (a.assetId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                              a.assignee.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (a.empCode || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter.includes('All') || categoryFilter.includes(normalizeCategory(a.category));
        const matchesBranch = branchFilter.includes('All') || branchFilter.includes(a.branch);
        const matchesDepartment = departmentFilter.includes('All') || departmentFilter.includes(a.department);
        
        let matchesDate = true;
        if (isDateFilterActive && dateRange[0] && a.date) {
            const assetDate = new Date(a.date);
            const start = new Date(dateRange[0].startDate);
            const end = new Date(dateRange[0].endDate);
            assetDate.setHours(0,0,0,0);
            start.setHours(0,0,0,0);
            end.setHours(0,0,0,0);
            matchesDate = assetDate >= start && assetDate <= end;
        }
        
        return matchesSearch && matchesCategory && matchesBranch && matchesDepartment && matchesDate;
    });

    const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ITEMS_PER_PAGE));
    const pagedAssets = filteredAssets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleAdd = async (e) => {
        e.preventDefault();
        
        const resolvedCategory = newAsset.category || 'Laptop';
        const resolvedBranch = newAsset.branch || 'Cotton Concepts HO_ Coimbatore';
        const resolvedWarranty = newAsset.warranty || '1 Year';
        const resolvedCondition = newAsset.condition || 'Excellent';
        const resolvedDepartment = newAsset.department || 'IT';
        const resolvedGroup = newAsset.group || 'IT';

        const resolvedAsset = {
            ...newAsset,
            category: resolvedCategory,
            branch: resolvedBranch,
            warranty: resolvedWarranty,
            condition: resolvedCondition,
            department: resolvedDepartment,
            group: resolvedGroup
        };

        if (!resolvedAsset.assignee || !resolvedAsset.assignee.trim()) {
            const el = document.getElementById('asset-assignee');
            if (el) el.reportValidity();
            return;
        }
        if (!resolvedAsset.empCode || !resolvedAsset.empCode.trim()) {
            const el = document.getElementById('asset-emp-code');
            if (el) el.reportValidity();
            return;
        }
        if (!resolvedAsset.department) {
            alert('Department is a mandatory field.');
            return;
        }

        try {
            if (isEditing) {
                await api.put(`/api/assets/${editingId}`, resolvedAsset);
                const updatedObj = { ...selectedAsset, ...resolvedAsset, qrCode: `/api/assets/${selectedAsset?.assetId || resolvedAsset.assetId}/qr` };
                setAssets(prev => prev.map(a => a.id === editingId ? updatedObj : a));
                setSelectedAsset(updatedObj);
                setIsEditing(false);
                setEditingId(null);
            } else {
                const res = await api.post('/api/assets', resolvedAsset);
                const data = res.data;
                setAssets(prev => [...prev, { ...resolvedAsset, id: data.id, assetId: data.assetId, qrCode: `/api/assets/${data.assetId}/qr`, date: new Date().toISOString().split('T')[0] }]);
            }
        } catch (err) {
            console.error("Failed to save asset:", err);
            alert('Failed to save asset: ' + (err.response?.data?.error || err.message));
        }
        setShowAddModal(false);
        setNewAsset({ assetId: '', category: 'Laptop', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'IT', branch: 'Cotton Concepts HO_ Coimbatore', purchaseDate: '', warranty: '1 Year', condition: 'Excellent', remarks: '', images: [], qrCode: '', group: 'IT' });
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
                await api.delete(`/api/assets/${id}`);
                setAssets(prev => prev.filter(a => a.id !== id));
            } catch {
                alert('Failed to delete asset.');
            }
        }
    };

    const handleNextStep = () => {
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
        if (!newAsset.empCode || !newAsset.empCode.trim()) {
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
        <div className="flex-1 flex flex-col overflow-hidden p-8 gap-8 animate-in fade-in duration-200">

            {/* Assets Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex flex-col w-full flex-1 min-h-0">
                    <table className="w-full text-left border-collapse table-fixed select-none">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
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
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[22%]">Brand</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[16%]">Serial Number</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[17%]">User Name</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[13%]">Emp Code</th>
                            </tr>
                        </thead>
                    </table>
                    <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                        <table className="w-full text-left border-collapse table-fixed">
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredAssets.length === 0 ? (
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
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 w-[12%] truncate" title={normalizeCategory(asset.category)}>{normalizeCategory(asset.category)}</td>
                                            <td className="px-6 py-4 w-[22%]">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white truncate" title={`${asset.brand || ''} ${asset.model || ''}`.trim() || asset.name}>
                                                    {asset.brand ? `${asset.brand} ${asset.model}` : asset.name}
                                                </div>
                                                <div className="text-[11px] text-slate-400 truncate" title={`${asset.branch}`}>{asset.branch}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400 w-[16%] truncate" title={asset.serial}>{asset.serial}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 w-[17%] truncate" title={asset.assignee}>{asset.assignee}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 w-[13%] truncate" title={asset.empCode}>{asset.empCode || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 min-w-[240px]">
                            Showing <span className="font-medium">{filteredAssets.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAssets.length)}</span> of <span className="font-medium">{filteredAssets.length}</span> assets
                        </p>
                        <div className="flex justify-center flex-1">
                            {selectedAssetIds.length > 0 && (
                                <span className="text-xs font-bold text-primary animate-in fade-in slide-in-from-bottom-2 duration-150 bg-primary/10 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-primary/20">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                                    {selectedAssetIds.length} {selectedAssetIds.length === 1 ? 'RECORD' : 'RECORDS'} SELECTED
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 min-w-[240px] justify-end">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >Previous</button>
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
                                className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >Next</button>
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
                                {selectedAsset.qrCode && (
                                    <button
                                        type="button"
                                        onClick={() => handleViewQR(selectedAsset)}
                                        className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="View QR Code Label"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
                                        View QR Code
                                    </button>
                                )}
                                <button
                                    onClick={() => { handleEdit(selectedAsset); setSelectedAsset(null); }}
                                    title="Edit Asset"
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[15px]">edit</span>
                                    Edit
                                </button>
                                <button onClick={() => setSelectedAsset(null)} className="hidden lg:flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
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
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                            selectedAsset.condition === 'Excellent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
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
                                    {/* <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Warranty Expiry</p>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {selectedAsset.warrantyDate || '—'}
                                        </p>
                                    </div> */}
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

                            {/* Device Images - always visible */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device Images</p>
                                    {selectedAsset.qrCode && (
                                        <button
                                            type="button"
                                            onClick={() => handleViewQR(selectedAsset)}
                                            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                            title="View QR Code Label"
                                        >
                                            <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
                                            View QR Code
                                        </button>
                                    )}
                                </div>
                                {(selectedAsset.images && selectedAsset.images.length > 0) ? (
                                    <div className="flex flex-wrap gap-3">
                                        {selectedAsset.images.map((img, i) => (
                                            <div key={i} className="flex flex-col items-center gap-1.5">
                                                <div 
                                                    onClick={() => setActiveImage(img)}
                                                    className="relative w-28 h-28 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 shadow-sm cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all active:scale-[0.98] group/thumb"
                                                >
                                                    <img src={img} alt={`Asset image ${i + 1}`} className="w-full h-full object-cover" />
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
                                    {/* Row 1: Asset Type + Brand */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 font-display">Asset Type <span className="text-red-500">*</span></label>
                                            <SelectDropdown
                                                value={newAsset.category || 'Laptop'}
                                                onChange={v => setNewAsset(p => ({ ...p, category: v }))}
                                                options={assetTypes?.map(t => t.name) || []}
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
                                                value={newAsset.branch || 'Cotton Concepts HO_ Coimbatore'}
                                                onChange={v => setNewAsset(p => ({ ...p, branch: v }))}
                                                options={['Cotton Concepts HO_ Coimbatore','Doctor Towels HO','Cotton Concepts_ Vengamedu','Cotton Concepts_ Karur','Doctor Towels_ Karur']}
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
                                                options={['Excellent','Good','Medium','Average','Scrap', "Stock"]}
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
                                                options={departments?.length > 0 ? departments.map(d => d.name) : ['IT','HR','Finance','Sales','Production','Logistics']}
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
                                                        <img src={img} alt={`Asset preview ${idx + 1}`} className="w-full h-full object-cover" />
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
                            className={`w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${
                                qrLoading || !qrImageBlobUrl 
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
        </div>
    );
};

const AssigneesView = ({ assignees, setAssignees, assigneesLoading, isExpanded, onToggle }) => {
    const [showAddAssignee, setShowAddAssignee] = useState(false);
    const [editingAssignee, setEditingAssignee] = useState(null);
    const [name, setName] = useState('');
    const [supportType, setSupportType] = useState('IT Support');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !supportType) {
            setError('Name and support type are required.');
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
        <div className="w-full shrink-0 p-8 border-b border-slate-200 dark:border-slate-800">
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
                    <button
                        onClick={() => setShowAddAssignee(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Assignee
                    </button>
                )}
            </div>

            {/* List */}
            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden h-fit">
                    {assigneesLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading assignees...</div>
                    ) : assignees.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No assignees found. Add one on the left.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">S.No</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[48%]">Assignee Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[25%]">Support Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>
                                    </tr>
                                </thead>
                            </table>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Array.isArray(assignees) && assignees.map((a, idx) => (
                                            <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 w-[12%]">{idx + 1}</td>
                                                <td className="px-6 py-4 w-[48%]">
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{a.name}</div>
                                                    <div className="text-xs text-slate-400">Added {new Date(a.created_at).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4 w-[25%]">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${a.support_type === 'IT Support' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : a.support_type === 'Admin Support' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'}`}>
                                                        {a.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : a.support_type}
                                                    </span>
                                                </td>
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
                                <select
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    value={supportType}
                                    onChange={e => setSupportType(e.target.value)}
                                >
                                    <option value="IT Support">IT Support</option>
                                    <option value="Admin Support">Admin Support</option>
                                    <option value="IT Support,Admin Support">Both (IT & Admin Support)</option>
                                </select>
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

const AssetTypesView = ({ assetTypes, setAssetTypes, assetTypesLoading, isExpanded, onToggle }) => {
    const [showAddType, setShowAddType] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [name, setName] = useState('');
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
        setIsSubmitting(true);
        try {
            if (editingType) {
                await api.put(`/api/asset_types/${editingType.id}`, { name });
            } else {
                await api.post('/api/asset_types', { name });
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
        setError('');
    };

    const handleOpenEdit = (type) => {
        setEditingType(type);
        setName(type.name);
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
        <div className="w-full shrink-0 p-8 border-b border-slate-200 dark:border-slate-800">
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
                    <button
                        onClick={() => setShowAddType(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Type
                    </button>
                )}
            </div>

            {/* List */}
            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden h-fit">
                    {assetTypesLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading asset types...</div>
                    ) : assetTypes.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No asset types found. Add one on the left.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">S.No</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[73%]">Type Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>
                                    </tr>
                                </thead>
                            </table>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Array.isArray(assetTypes) && assetTypes.map((c, idx) => (
                                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 w-[12%]">{idx + 1}</td>
                                                <td className="px-6 py-4 w-[73%]">
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                                                    <div className="text-xs text-slate-400">Added {new Date(c.created_at).toLocaleDateString()}</div>
                                                </td>
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
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-red-600 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
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
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                    required
                                />
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

const CategoriesView = ({ categories, setCategories, categoriesLoading, isExpanded, onToggle }) => {
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [name, setName] = useState('');
    const [supportType, setSupportType] = useState('IT Support');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !supportType) {
            setError('Name and support type are required.');
            return;
        }
        setIsSubmitting(true);
        try {
            if (editingCategory) {
                await api.put(`/api/categories/${editingCategory.id}`, { name, support_type: supportType });
            } else {
                await api.post('/api/categories', { name, support_type: supportType });
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
        setError('');
    };

    const handleOpenEdit = (category) => {
        setEditingCategory(category);
        setName(category.name);
        setSupportType(category.support_type);
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
        <div className="w-full shrink-0 p-8 border-b border-slate-200 dark:border-slate-800">
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
                    <button
                        onClick={() => setShowAddCategory(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Category
                    </button>
                )}
            </div>

            {/* List */}
            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden h-fit">
                    {categoriesLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading categories...</div>
                    ) : categories.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No categories found. Add one on the left.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">S.No</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[48%]">Category Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[25%]">Support Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>
                                    </tr>
                                </thead>
                            </table>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Array.isArray(categories) && categories.map((c, idx) => (
                                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 w-[12%]">{idx + 1}</td>
                                                <td className="px-6 py-4 w-[48%]">
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                                                    <div className="text-xs text-slate-400">Added {new Date(c.created_at).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4 w-[25%]">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${c.support_type?.includes('IT Support') ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'}`}>
                                                        {c.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : c.support_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 w-[15%]">
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
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-red-600 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
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
                                <select
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    value={supportType}
                                    onChange={e => setSupportType(e.target.value)}
                                >
                                    <option value="IT Support">IT Support</option>
                                    <option value="Admin Support">Admin Support</option>
                                    <option value="IT Support,Admin Support">Both (IT & Admin Support)</option>
                                </select>
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

const DepartmentsView = ({ departments, setDepartments, departmentsLoading, isExpanded, onToggle, showToast }) => {
    const [showAddDepartment, setShowAddDepartment] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [name, setName] = useState('');
    const [supportType, setSupportType] = useState('IT Support');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [departmentToDelete, setDepartmentToDelete] = useState(null);

    const handleAdd = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !supportType) {
            setError('Name and support type are required.');
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
        <div className="w-full shrink-0 p-8 border-b border-slate-200 dark:border-slate-800">
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
                    <button
                        onClick={() => setShowAddDepartment(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Department
                    </button>
                )}
            </div>

            {isExpanded && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden h-fit">
                    {departmentsLoading ? (
                        <div className="p-10 text-center text-slate-500">Loading departments...</div>
                    ) : departments.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">No departments found.</div>
                    ) : (
                        <div className="flex flex-col w-full">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">S.No</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[48%]">Department Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[25%]">Support Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">Actions</th>
                                    </tr>
                                </thead>
                            </table>
                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {Array.isArray(departments) && departments.map((d, idx) => (
                                            <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400 w-[12%]">{idx + 1}</td>
                                                <td className="px-6 py-4 w-[48%]">
                                                    <div className="text-sm font-medium text-slate-900 dark:text-white">{d.name}</div>
                                                    <div className="text-xs text-slate-400">Added {new Date(d.created_at).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4 w-[25%]">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${d.support_type?.includes('IT Support') ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'}`}>
                                                        {d.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : d.support_type}
                                                    </span>
                                                </td>
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                                <select
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                    value={supportType}
                                    onChange={e => setSupportType(e.target.value)}
                                >
                                    <option value="IT Support">IT Support</option>
                                    <option value="Admin Support">Admin Support</option>
                                    <option value="IT Support,Admin Support">Both (IT & Admin)</option>
                                </select>
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
                className={`flex items-center justify-between gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-lg text-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700 outline-none cursor-pointer ${widthClass} ${isOpen ? 'ring-2 ring-primary border-primary bg-white dark:bg-slate-900 shadow-sm' : ''}`}
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
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[60] py-2 overflow-hidden animate-in fade-in zoom-in duration-150">
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
                                <div className={`h-5 w-5 rounded flex items-center justify-center border-2 transition-all ${isSelected(option) ? 'bg-primary border-primary shadow-sm shadow-primary/20' : 'border-slate-300 dark:border-slate-600 group-hover:border-primary/50'}`}>
                                    {isSelected(option) && <span className="material-symbols-outlined text-white text-sm font-bold">check</span>}
                                </div>
                                <span className={`text-[13px] font-medium transition-colors ${isSelected(option) ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
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
    const isPowerUser = user?.receiver_position === 'Management' || user?.receiver_position === 'Manager';

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
    }); // 'tickets' | 'users' | 'assets'
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [showAddUser, setShowAddUser] = useState(false);
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
    const [showAddAssetModal, setShowAddAssetModal] = useState(false);
    const [showAddAssetDropdown, setShowAddAssetDropdown] = useState(false);
    const [newAsset, setNewAsset] = useState({ assetId: '', category: 'Laptop', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'IT', branch: 'Cotton Concepts HO_ Coimbatore', purchaseDate: '', warranty: '1 Year', condition: 'Good', remarks: '', images: [], qrCode: '', group: 'IT' });
    const [isEditingAsset, setIsEditingAsset] = useState(false);
    const [editingAssetId, setEditingAssetId] = useState(null);
    const [selectedAssetIds, setSelectedAssetIds] = useState([]);



    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(['All']);
    const [branchFilter, setBranchFilter] = useState(['All']);
    const [departmentFilter, setDepartmentFilter] = useState(['All']);
    const [categoryFilter, setCategoryFilter] = useState(['All']);
    const [assigneeFilter, setAssigneeFilter] = useState(['All']);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
    const downloadDropdownRef = useRef(null);
    const [isGeneratingQRs, setIsGeneratingQRs] = useState(false);

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

    useEffect(() => {
        setSelectedAssetIds([]);
    }, [assetSearchQuery, assetCategoryFilter, assetBranchFilter, assetDepartmentFilter, isDateFilterActive, dateRange]);

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
                        const response = await api.get(`/api/assets/${asset.assetId}/qr?t=${Date.now()}`, { responseType: 'blob' });
                        const base64 = await blobToBase64(response.data);
                        return { assetId: asset.assetId, base64 };
                    } catch (err) {
                        console.error(`Failed to fetch QR label for asset ${asset.assetId}:`, err);
                        return null; // Gracefully continue if a single request fails
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                qrImages.push(...batchResults.filter(Boolean));
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

            // user.branch is comma-separated: e.g. "Doctor Towels HO,Cotton Concepts_ Karur"
            // 'All' means no branch filter needed
            if (!isSuperAdmin && user?.branch && user.branch !== 'All') {
                // Only add filter if not all branches selected
                const userBranches = user.branch.split(',').map(b => b.trim()).filter(Boolean);
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

    const fetchAssets = async () => {
        setAssetsLoading(true);
        try {
            const response = await api.get('/api/assets');
            setAssets(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error("Failed to fetch assets:", err);
            setAssets([]);
        } finally {
            setAssetsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            refreshUser(); // Sync user permissions (e.g. can_send_mail) from the backend
            // Initial load of assets and global metadata
            fetchAssets();
            fetchAssignees();
            fetchCategories();
            fetchDepartments();
            fetchAssetTypes();
        }
    }, [user?.email]);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.add-asset-dropdown-container')) {
                setShowAddAssetDropdown(false);
            }
        };
        if (showAddAssetDropdown) {
            document.addEventListener('mousedown', handleOutsideClick);
        }
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showAddAssetDropdown]);

    useEffect(() => {
        if (!user) return;
        const path = location.pathname;
        if (path === '/assets' || path === '/assets/add') {
            setActiveView('assets');
            if (path === '/assets/add') {
                setIsEditingAsset(false);
                const initialGroup = location.state?.group || 'IT';
                setNewAsset({ assetId: '', category: 'Laptop', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'IT', branch: 'Cotton Concepts HO_ Coimbatore', purchaseDate: '', warranty: '1 Year', condition: 'Good', remarks: '', images: [], qrCode: '', group: initialGroup });
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
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    {status}
                </span>
            );
        } else if (s === 'in progress') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-blue-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    {status}
                </span>
            );
        } else if (s === 'pending') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    {status}
                </span>
            );
        } else if (s === 'rejected') {
            return (
                <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    {status}
                </span>
            );
        } else {
            return (
                <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                    <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                    {status}
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

    const filteredTickets = baseFilteredTickets.filter(ticket => statusFilter.includes('All') || statusFilter.includes(ticket.status));

    // Calculate Summary Stats based on current base filters (date, search, etc.)
    const totalTickets = baseFilteredTickets.length;
    const notStartedTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'not started').length;
    const pendingTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'pending').length;
    const inProgressTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'in progress').length;
    const completedTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'resolved').length;
    const rejectedTickets = baseFilteredTickets.filter(t => t.status?.toLowerCase() === 'rejected').length;

    const ITEMS_PER_PAGE = 20;
    const totalPages = Math.max(1, Math.ceil(filteredTickets.length / ITEMS_PER_PAGE));
    const pagedTickets = filteredTickets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, branchFilter, departmentFilter, categoryFilter, assigneeFilter, dateRange, isDateFilterActive]);

    const uniqueBranches = ['All', ...new Set(tickets.map(t => t.branch).filter(Boolean))];
    const uniqueDepartments = ['All', ...new Set(tickets.map(t => t.department).filter(Boolean))];
    const uniqueCategories = ['All', ...new Set(tickets.map(t => t.category).filter(Boolean))];
    const uniqueAssignees = ['All', ...new Set(tickets.map(t => t.assignee).filter(Boolean))];
    const uniqueAssetTypes = ['All', ...new Set((assetTypes || []).map(t => t.name).filter(Boolean))];

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
                            onError={(error) => console.log(error?.message)}
                            components={{
                                audio: true,
                                onOff: true,
                                tracker: true,
                            }}
                        />
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
        <div className="font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 h-screen flex overflow-hidden">
            <aside className="w-64 h-screen bg-sidebar-light dark:bg-sidebar-dark border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
                <div className="h-24 flex items-center justify-center px-4 py-2 border-b border-slate-200 dark:border-slate-600">
                    <img src={logoImage} alt="Logo" className="h-20 w-auto object-contain dark:hidden" />
                    <img src={logoDarkImage} alt="Logo" className="h-20 w-auto object-contain hidden dark:block" />
                </div>
                <nav className="flex-1 space-y-1">
                    <button
                        onClick={() => {
                            navigate('/tickets');
                        }}
                        className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${activeView === 'tickets'
                            ? 'text-primary bg-primary/10 border-r-4 border-primary'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary'
                            }`}>
                        <span className="material-symbols-outlined mr-3">confirmation_number</span>
                        <span>Tickets</span>
                    </button>
                    <button
                        onClick={() => {
                            navigate('/assets');
                        }}
                        className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${activeView === 'assets'
                            ? 'text-primary bg-primary/10 border-r-4 border-primary'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary'
                            }`}>
                        <span className="material-symbols-outlined mr-3">inventory_2</span>
                        <span>Assets</span>
                    </button>
                    {user?.email === 'admin@support.com' && (
                        <button
                            onClick={() => {
                                navigate('/users');
                            }}
                            className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${activeView === 'users'
                                ? 'text-primary bg-primary/10 border-r-4 border-primary'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary'
                                }`}>
                            <span className="material-symbols-outlined mr-3">group</span>
                            <span>Users</span>
                        </button>
                    )}
                    {user?.email === 'admin@support.com' && (
                        <button
                            onClick={() => {
                                navigate('/settings');
                            }}
                            className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${activeView === 'settings'
                                ? 'text-primary bg-primary/10 border-r-4 border-primary'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary'
                                }`}>
                            <span className="material-symbols-outlined mr-3">settings</span>
                            <span>Settings</span>
                        </button>
                    )}
                </nav>
                <div className="p-6 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex items-center gap-3 mb-4">
                        <div
                            className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {user?.name?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate">{user?.name || 'Admin User'}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@support.com'}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors border border-red-200 dark:border-red-600">
                        <span className="material-symbols-outlined mr-2 text-lg">logout</span>
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header
                    className="h-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
                    {activeView === 'users' && (
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Users</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">The user dashboard has admin users data</p>
                        </div>
                    )}
                    {activeView === 'assets' && <>
                        <div className="relative flex-1 max-w-sm mr-6">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                type="text"
                                placeholder="Search asset id, username and emp code..."
                                value={assetSearchQuery}
                                onChange={e => setAssetSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-2 mx-4">
                            <MultiSelectFilter
                                label="Type"
                                icon="category"
                                options={uniqueAssetTypes}
                                selected={assetCategoryFilter}
                                onChange={setAssetCategoryFilter}
                                widthClass="w-48"
                            />
                            <MultiSelectFilter
                                label="Branch"
                                icon="location_on"
                                options={[
                                    'All',
                                    'Cotton Concepts HO_ Coimbatore',
                                    'Doctor Towels HO',
                                    'Cotton Concepts_ Vengamedu',
                                    'Cotton Concepts_ Karur',
                                    'Doctor Towels_ Karur'
                                ]}
                                selected={assetBranchFilter}
                                onChange={setAssetBranchFilter}
                                widthClass="w-48"
                            />
                            <MultiSelectFilter
                                label="Dept"
                                icon="corporate_fare"
                                options={['All', ...(departments?.length > 0 ? departments.map(d => d.name) : ['IT', 'HR', 'Finance', 'Sales', 'Production', 'Logistics'])]}
                                selected={assetDepartmentFilter}
                                onChange={setAssetDepartmentFilter}
                                widthClass="w-48"
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
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2.5 transition-colors border-t border-slate-100 dark:border-slate-800/80 mt-1 pt-1 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-base">description</span>
                                            <span>Asset Details</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            {((assetSearchQuery !== '') || !assetCategoryFilter.includes('All') || !assetBranchFilter.includes('All') || !assetDepartmentFilter.includes('All') || isDateFilterActive) && (
                                <button
                                    onClick={() => {
                                        setAssetSearchQuery('');
                                        setAssetCategoryFilter(['All']);
                                        setAssetBranchFilter(['All']);
                                        setAssetDepartmentFilter(['All']);
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
                    {activeView === 'settings' && (
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Settings</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Manage application settings</p>
                        </div>
                    )}
                    {activeView === 'tickets' && <>
                        <div className="relative flex-1 max-w-sm mr-6">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none"
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
                            />
                            <MultiSelectFilter
                                label="Dept"
                                icon="corporate_fare"
                                options={uniqueDepartments}
                                selected={departmentFilter}
                                onChange={setDepartmentFilter}
                            />
                            <MultiSelectFilter
                                label="Category"
                                icon="category"
                                options={uniqueCategories}
                                selected={categoryFilter}
                                onChange={setCategoryFilter}
                            />
                            <MultiSelectFilter
                                label="Status"
                                icon="checklist"
                                options={['All', 'Not Started', 'In Progress', 'Pending', 'Completed', 'Rejected']}
                                selected={statusFilter}
                                onChange={setStatusFilter}
                            />
                            <MultiSelectFilter
                                label="Assignee"
                                icon="person"
                                options={uniqueAssignees}
                                selected={assigneeFilter}
                                onChange={setAssigneeFilter}
                            />
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

                            {/* Clear Filters Button */}
                            {(searchQuery !== '' || !statusFilter.includes('All') || !branchFilter.includes('All') || !departmentFilter.includes('All') || !categoryFilter.includes('All') || !assigneeFilter.includes('All') || isDateFilterActive) && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter(['All']);
                                        setBranchFilter(['All']);
                                        setDepartmentFilter(['All']);
                                        setCategoryFilter(['All']);
                                        setAssigneeFilter(['All']);
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
                        <div className="relative mx-2 flex items-center gap-2">

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
                                className={`flex items-center justify-center h-9 w-9 rounded-lg border transition-colors shadow-sm text-sm font-medium
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
                    <div className="flex items-center gap-4 ml-auto">
                        {activeView === 'users' && (
                            <button
                                onClick={() => setShowAddUser(p => !p)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow"
                            >
                                <span className="material-symbols-outlined text-base">person_add</span>
                                {showAddUser ? 'Cancel' : 'Add User'}
                            </button>
                        )}
                        {activeView === 'assets' && (
                            <div className="relative add-asset-dropdown-container">
                                <button
                                    onClick={() => setShowAddAssetDropdown(p => !p)}
                                    className="flex items-center gap-2 p-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow cursor-pointer font-display"
                                >
                                    <span className="material-symbols-outlined text-base">add</span>
                                    Add Asset
                                    <span className="material-symbols-outlined text-sm leading-none">keyboard_arrow_down</span>
                                </button>
                                {showAddAssetDropdown && (
                                    <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-[250] py-1">
                                        <button
                                            onClick={() => {
                                                setShowAddAssetDropdown(false);
                                                setIsEditingAsset(false);
                                                setNewAsset({ assetId: '', category: 'Laptop', brand: '', model: '', configuration: '', serial: '', assignee: 'Unassigned', empCode: '', cug: '', email: '', department: 'IT', branch: 'Cotton Concepts HO_ Coimbatore', purchaseDate: '', warranty: '1 Year', condition: 'Good', remarks: '', images: [], qrCode: '', group: 'IT' });
                                                navigate('/assets/add', { state: { group: 'IT' } });
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-medium transition-colors cursor-pointer"
                                        >
                                            IT
                                        </button>
                                        <button
                                            disabled
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 dark:text-slate-700 font-medium cursor-not-allowed"
                                        >
                                            Admin
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={toggleDarkMode}
                            aria-label="Toggle dark mode"
                            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">
                                {darkMode ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>
                    </div>
                </header>

                {/* Users View */}
                {activeView === 'users' && user?.email === 'admin@support.com' && (
                    <UsersView users={users} setUsers={setUsers} usersLoading={usersLoading} showAddUser={showAddUser} setShowAddUser={setShowAddUser} />
                )}

                {/* Settings View */}
                {activeView === 'settings' && user?.email === 'admin@support.com' && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        <AssigneesView
                            assignees={assignees}
                            setAssignees={setAssignees}
                            assigneesLoading={assigneesLoading}
                            isExpanded={expandedSettingsView === 'assignees'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'assignees' ? null : 'assignees')}
                        />
                        <CategoriesView
                            categories={categories}
                            setCategories={setCategories}
                            categoriesLoading={categoriesLoading}
                            isExpanded={expandedSettingsView === 'categories'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'categories' ? null : 'categories')}
                        />
                        <DepartmentsView
                            departments={departments}
                            setDepartments={setDepartments}
                            departmentsLoading={departmentsLoading}
                            isExpanded={expandedSettingsView === 'departments'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'departments' ? null : 'departments')}
                            showToast={showToast}
                        />
                        <AssetTypesView
                            assetTypes={assetTypes}
                            setAssetTypes={setAssetTypes}
                            assetTypesLoading={assetTypesLoading}
                            isExpanded={expandedSettingsView === 'assetTypes'}
                            onToggle={() => setExpandedSettingsView(prev => prev === 'assetTypes' ? null : 'assetTypes')}
                        />
                    </div>
                )}

                {/* Assets View */}
                {activeView === 'assets' && (
                    <AssetsView
                        assets={assets}
                        setAssets={setAssets}
                        assetTypes={assetTypes}
                        searchQuery={assetSearchQuery}
                        setSearchQuery={setAssetSearchQuery}
                        categoryFilter={assetCategoryFilter}
                        branchFilter={assetBranchFilter}
                        departmentFilter={assetDepartmentFilter}
                        showAddModal={location.pathname === '/assets/add' || (showAddAssetModal && isEditingAsset)}
                        setShowAddModal={(val, isEdit = false) => {
                            if (val) {
                                if (isEditingAsset || isEdit) {
                                    setShowAddAssetModal(true);
                                } else {
                                    navigate('/assets/add');
                                }
                            } else {
                                if (location.pathname === '/assets/add') {
                                    navigate('/assets');
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
                    />
                )}

                {/* Tickets View */}
                {activeView === 'tickets' && <div className="flex-1 flex flex-col overflow-hidden p-8 gap-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 shrink-0">
                        <div
                            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Tickets</p>
                                <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : totalTickets}</h3>
                            </div>
                            <div
                                className="h-8 w-8 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base">analytics</span>
                            </div>
                        </div>
                        <div
                            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Not Started</p>
                                <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : notStartedTickets}</h3>
                            </div>
                            <div
                                className="h-8 w-8 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base">priority_high</span>
                            </div>
                        </div>
                        <div
                            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending</p>
                                <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : pendingTickets}</h3>
                            </div>
                            <div
                                className="h-8 w-8 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base">hourglass_empty</span>
                            </div>
                        </div>
                        <div
                            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">In Progress</p>
                                <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : inProgressTickets}</h3>
                            </div>
                            <div
                                className="h-8 w-8 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base">running_with_errors</span>
                            </div>
                        </div>
                        <div
                            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed</p>
                                <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : completedTickets}</h3>
                            </div>
                            <div
                                className="h-8 w-8 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base">task_alt</span>
                            </div>
                        </div>
                        <div
                            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Rejected</p>
                                <h3 className="text-2xl font-bold mt-0.5">{loading ? '...' : rejectedTickets}</h3>
                            </div>
                            <div
                                className="h-8 w-8 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-base">cancel</span>
                            </div>
                        </div>
                    </div>
                    <div
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">

                        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                                    <tr
                                        className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
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
                                        <th className="px-6 py-4 text-center">Ticket ID</th>
                                        <th className="px-6 py-4">Branch</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4">Assignee</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={isSuperAdmin ? "9" : "8"} className="px-6 py-8 text-center text-slate-500">
                                                Loading tickets...
                                            </td>
                                        </tr>
                                    ) : filteredTickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={isSuperAdmin ? "9" : "8"} className="px-6 py-8 text-center text-slate-500">
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
                                                <td className="px-6 py-2 text-sm font-medium text-primary text-center">#{ticket.ticket_id}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.branch || '-'}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(ticket.timestamp)}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.fullName}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.department || '-'}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.category}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.assignee || '-'}</td>
                                                <td className="px-6 py-2">
                                                    {getStatusBadge(ticket.status)}
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
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >Previous</button>
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
                                    className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >Next</button>
                            </div>
                        </div>
                    </div>
                </div>}

                {/* Ticket Details Modal */}
                {
                    isModalOpen && selectedTicket && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={closeModal}>
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
                                                <div className="relative">
                                                    <select
                                                        value={updateStatus}
                                                        onChange={(e) => setUpdateStatus(e.target.value)}
                                                        disabled={['Completed', 'Resolved'].includes(selectedTicket.status) || (!isSuperAdmin && !isPowerUser && user?.name !== selectedTicket.assignee && user?.access && !user.access.includes('Edit'))}
                                                        className={`w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none transition-shadow ${['Completed', 'Resolved'].includes(selectedTicket.status) || (!isSuperAdmin && !isPowerUser && user?.name !== selectedTicket.assignee && user?.access && !user.access.includes('Edit')) ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                                                    >
                                                         <option value="Not Started">Not Started</option>
                                                        <option value="In Progress">In Progress</option>
                                                        <option value="Pending">Pending</option>
                                                        <option value="Completed">Completed</option>

                                                    </select>
                                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <select
                                                        value={updateAssignee}
                                                        onChange={(e) => setUpdateAssignee(e.target.value)}
                                                        disabled={['Completed', 'Resolved'].includes(selectedTicket.status) || (!isSuperAdmin && !isPowerUser && user?.name !== selectedTicket.assignee && user?.access && !user.access.includes('Edit'))}
                                                        className={`w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none transition-shadow ${['Completed', 'Resolved'].includes(selectedTicket.status) || (!isSuperAdmin && !isPowerUser && user?.name !== selectedTicket.assignee && user?.access && !user.access.includes('Edit')) ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                                                    >
                                                        <option value="">Assignee</option>
                                                        {Array.isArray(assignees) && assignees
                                                            .filter(a => !selectedTicket.supportType || a.support_type.includes(selectedTicket.supportType))
                                                            .map(a => (
                                                                <option key={a.id} value={a.name}>{a.name}</option>
                                                            ))
                                                        }
                                                    </select>
                                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
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
