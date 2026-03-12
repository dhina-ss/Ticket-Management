import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import api from '../api';
import logoImage from '../assets/logo.png';
import logoDarkImage from '../assets/logo1.png';

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

const UsersView = ({ users, setUsers, usersLoading, showAddUser, setShowAddUser }) => {
    const [newUser, setNewUser] = useState({
        name: '', email: '', password: '',
        access: ['View'],
        support_type: ['IT Support', 'Admin Support'],
        add_as_assignee: false,
        can_receive_mail: false,
        receiver_position: ''
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
            receiver_position: ''
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
            receiver_position: user.receiver_position || ''
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

            const payload = { ...newUser, access: newUser.access.join(','), support_type: newUser.support_type.join(',') };

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
                    receiver_position: newUser.receiver_position,
                    is_assignee: newUser.add_as_assignee
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
                    receiver_position: newUser.receiver_position,
                    is_assignee: newUser.add_as_assignee
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
                                    {editingUser ? 'Edit Admin User' : 'Add Admin User'}
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
                                <div className="flex gap-3">
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
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Need to send mail</span>
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
                                            <option value="Admin Manager">Admin Manager</option>
                                            <option value="Management">Management</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                            )}

                            {/* Password */}
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
                <div className="text-center py-20 text-slate-400">No admin users found.</div>
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
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created At</th>
                                <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mail Settings</th>
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
                        Assignees
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
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assignee Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Support Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {Array.isArray(assignees) && assignees.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">{a.name}</div>
                                            <div className="text-xs text-slate-400">Added {new Date(a.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${a.support_type === 'IT Support' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : a.support_type === 'Admin Support' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'}`}>
                                                {a.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : a.support_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
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
        <div className="w-full shrink-0 p-8">
            <div className="mb-4 flex items-end justify-between">
                <div onClick={onToggle} className="cursor-pointer group select-none">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                        Categories
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
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Support Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {Array.isArray(categories) && categories.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                                            <div className="text-xs text-slate-400">Added {new Date(c.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${c.support_type?.includes('IT Support') ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'}`}>
                                                {c.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : c.support_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
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
                        Departments
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
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Support Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {Array.isArray(departments) && departments.map(d => (
                                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">{d.name}</div>
                                            <div className="text-xs text-slate-400">Added {new Date(d.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${d.support_type?.includes('IT Support') ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300'}`}>
                                                {d.support_type === 'IT Support,Admin Support' ? 'Both (IT & Admin)' : d.support_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
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

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [updateStatus, setUpdateStatus] = useState('');
    const [updateAssignee, setUpdateAssignee] = useState('');
    const [expandedSettingsView, setExpandedSettingsView] = useState('assignees');
    const [resolutionComments, setResolutionComments] = useState('');
    const [commentError, setCommentError] = useState('');
    const [addExpense, setAddExpense] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [billFile, setBillFile] = useState(null);
    const [billFileError, setBillFileError] = useState('');
    const [vendorName, setVendorName] = useState('');

    const [isUpdating, setIsUpdating] = useState(false);
    const [activeView, setActiveView] = useState('tickets'); // 'tickets' | 'users'
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [showAddUser, setShowAddUser] = useState(false);
    const [assignees, setAssignees] = useState([]);
    const [assigneesLoading, setAssigneesLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [departmentsLoading, setDepartmentsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [assigneeFilter, setAssigneeFilter] = useState('All');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isDateFilterActive, setIsDateFilterActive] = useState(false);
    const [dateRange, setDateRange] = useState([
        {
            startDate: new Date(),
            endDate: new Date(),
            key: 'selection'
        }
    ]);

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
    const [activeAction, setActiveAction] = useState(null);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState(() => EXPORT_COLUMNS.map(c => c.id));

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

    const { user, logout } = useAuth();

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
            const url = user?.support_type
                ? `/api/tickets?support_type=${encodeURIComponent(user.support_type)}`
                : '/api/tickets';
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

    useEffect(() => {
        if (user) {
            fetchTickets();
            fetchAssignees(); // Fetch assignees on load
            fetchCategories(); // Fetch categories on load
            fetchDepartments(); // Fetch departments on load
            if (user.email === 'admin@support.com') fetchUsers(); // Fetch users on load if admin
        }
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleRowClick = (ticket) => {
        setSelectedTicket(ticket);
        setUpdateStatus(ticket.status || 'Not Started');
        setUpdateAssignee(ticket.assignee || '');
        setResolutionComments(ticket.resolutionComments || '');
        setAddExpense(!!ticket.expenseAmount);
        setExpenseAmount(ticket.expenseAmount || '');
        setBillFile(null);
        setBillFileError('');
        setVendorName(ticket.vendorName || '');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTicket(null);
        setResolutionComments('');
        setCommentError('');
        setAddExpense(false);
        setExpenseAmount('');
        setBillFile(null);
        setBillFileError('');
        setVendorName('');
    };

    const handleSaveChanges = async () => {
        if (!selectedTicket) return;
        setCommentError('');

        if (updateStatus === 'Pending' && !resolutionComments.trim()) {
            setCommentError("Resolution comments are mandatory when marking an issue as Pending.");
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
                if (addExpense) {
                    formData.append('expense_amount', expenseAmount);
                    formData.append('vendor_name', vendorName);
                }
                if (billFile) {
                    formData.append('bill_attachment', billFile);
                }
                res = await api.put(`/api/tickets/${selectedTicket.ticket_id}`, formData);
            } else {
                res = await api.put(`/api/tickets/${selectedTicket.ticket_id}`, {
                    status: updateStatus,
                    assignee: updateAssignee,
                    resolution_comments: resolutionComments
                });
            }

            if (res.status !== 200) {
                const data = await res.data;
                throw new Error(data.error || 'Failed to update status');
            }

            // Refresh tickets
            await fetchTickets();
            closeModal();
            // alert('Ticket status updated successfully!'); // Optional: removed for cleaner UI or replace with toast
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
        if (!ticketToDelete) return;
        setIsUpdating(true);

        try {
            const response = await api.delete(`/api/tickets/${ticketToDelete}`);
            const data = await response.data;

            if (response.status === 200) {
                setTickets(prev => prev.filter(t => t.ticket_id !== ticketToDelete));
                showToast('Ticket deleted successfully', 'success');
            } else {
                showToast(`Failed to delete ticket: ${data.error}`, 'error');
            }
        } catch (err) {
            console.error("Error deleting ticket:", err);
            showToast('An error occurred while deleting the ticket.', 'error');
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
            await api.put(`/api/tickets/${ticketId}`, { status: updateStatus, assignee: updateAssignee });

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

    const toggleActionDropdown = (e, ticket) => {
        e.stopPropagation();
        if (activeAction?.id === ticket.ticket_id) {
            setActiveAction(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 150;

            setActiveAction({
                id: ticket.ticket_id,
                top: rect.bottom,
                bottom: window.innerHeight - rect.top,
                left: rect.right - 192,
                openUp,
                category: ticket.category // specific field needed for condition
            });
        }
    };

    // Close dropdown when clicking outside or scrolling
    useEffect(() => {
        const handleInteraction = () => activeAction && setActiveAction(null);

        document.addEventListener('click', handleInteraction);
        window.addEventListener('scroll', handleInteraction, true); // Capture scroll on any element

        return () => {
            document.removeEventListener('click', handleInteraction);
            window.removeEventListener('scroll', handleInteraction, true);
        };
    }, [activeAction]);

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
            year: 'numeric'
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

    const baseFilteredTickets = tickets.filter(ticket => {
        const matchesSearch = searchQuery === '' ||
            ticket.ticket_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (ticket.assignee && ticket.assignee.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (ticket.category && ticket.category.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesDepartment = departmentFilter === 'All' || ticket.department === departmentFilter;
        const matchesCategory = categoryFilter === 'All' || ticket.category === categoryFilter;
        const matchesAssignee = assigneeFilter === 'All' || ticket.assignee === assigneeFilter;

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

        return matchesSearch && matchesDepartment && matchesCategory && matchesAssignee && matchesDate;
    });

    const filteredTickets = baseFilteredTickets.filter(ticket => statusFilter === 'All' || ticket.status === statusFilter);

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
    }, [searchQuery, statusFilter, departmentFilter, categoryFilter, assigneeFilter, dateRange, isDateFilterActive]);

    const uniqueDepartments = ['All', ...new Set(tickets.map(t => t.department).filter(Boolean))];
    const uniqueCategories = ['All', ...new Set(tickets.map(t => t.category).filter(Boolean))];
    const uniqueAssignees = ['All', ...new Set(tickets.map(t => t.assignee).filter(Boolean))];

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
                            setActiveView('tickets');
                            fetchTickets();
                        }}
                        className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${activeView === 'tickets'
                            ? 'text-primary bg-primary/10 border-r-4 border-primary'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary'
                            }`}>
                        <span className="material-symbols-outlined mr-3">confirmation_number</span>
                        <span>All Tickets</span>
                    </button>
                    {user?.email === 'admin@support.com' && (
                        <button
                            onClick={() => {
                                setActiveView('users');
                                fetchUsers();
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
                                setActiveView('settings');
                                fetchAssignees();
                                fetchCategories();
                                fetchDepartments();
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
                            <div className="relative w-[150px]">
                                <select
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                    className="appearance-none w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary pl-3 pr-7 py-2.5 outline-none cursor-pointer"
                                >
                                    {uniqueDepartments.map(dept => (
                                        <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-base">expand_more</span>
                            </div>
                            <div className="relative w-[150px]">
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="appearance-none w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary pl-3 pr-7 py-2.5 outline-none cursor-pointer"
                                >
                                    {uniqueCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-base">expand_more</span>
                            </div>
                            <div className="relative w-[150px]">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="appearance-none w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary pl-3 pr-7 py-2.5 outline-none cursor-pointer"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Not Started">Not Started</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                                <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-base">expand_more</span>
                            </div>
                            <div className="relative w-[150px]">
                                <select
                                    value={assigneeFilter}
                                    onChange={(e) => setAssigneeFilter(e.target.value)}
                                    className="appearance-none w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary pl-3 pr-7 py-2.5 outline-none cursor-pointer"
                                >
                                    {uniqueAssignees.map(assignee => (
                                        <option key={assignee} value={assignee}>{assignee === 'All' ? 'All Assignees' : assignee}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-base">expand_more</span>
                            </div>
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
                            {(searchQuery !== '' || statusFilter !== 'All' || departmentFilter !== 'All' || categoryFilter !== 'All' || assigneeFilter !== 'All' || isDateFilterActive) && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('All');
                                        setDepartmentFilter('All');
                                        setCategoryFilter('All');
                                        setAssigneeFilter('All');
                                        setIsDateFilterActive(false);
                                        setDateRange([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
                                    }}
                                    aria-label="Clear all filters"
                                    title="Clear all filters"
                                    className="flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shadow-sm"
                                >
                                    <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                                </button>
                            )}
                        </div>
                        <div className="relative ml-2 mr-4 flex items-center gap-2">

                            <button
                                aria-label="Export to CSV"
                                title={!user?.access?.includes('Export') ? "You don't have permission to export" : "Export to CSV"}
                                disabled={!user?.access?.includes('Export')}
                                className={`flex items-center justify-center h-9 px-3 rounded-lg border transition-colors shadow-sm text-sm font-medium
                                    ${user?.access?.includes('Export')
                                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                                        : 'bg-slate-100 dark:bg-slate-800/30 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'}`}
                                onClick={() => {
                                    if (!user?.access?.includes('Export')) return;
                                    setShowExportModal(true);
                                }}
                            >
                                <span className="material-symbols-outlined text-[18px] mr-1.5">download</span>
                                Export
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
                    </div>
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
                                        <th className="px-6 py-4">Ticket ID</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4">Assignee</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Expense</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-8 text-center text-slate-500">
                                                Loading tickets...
                                            </td>
                                        </tr>
                                    ) : filteredTickets.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-8 text-center text-slate-500">
                                                {tickets.length === 0 ? "No tickets found." : "No tickets match your search."}
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedTickets.map((ticket, index) => (
                                            <tr key={ticket.ticket_id} onClick={() => handleRowClick(ticket)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                                                <td className="px-6 py-2 text-sm font-medium text-primary">#{ticket.ticket_id}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(ticket.timestamp)}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.fullName}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.department || '-'}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.category}</td>
                                                <td className="px-6 py-2 text-sm text-slate-700 dark:text-slate-300">{ticket.assignee || '-'}</td>
                                                <td className="px-6 py-2">
                                                    {getStatusBadge(ticket.status)}
                                                </td>
                                                <td className="px-6 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {ticket.expenseAmount ? ticket.expenseAmount : '-'}
                                                </td>

                                                <td className="px-6 py-2 text-center relative">
                                                    <button
                                                        onClick={(e) => toggleActionDropdown(e, ticket)}
                                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-slate-500">more_vert</span>
                                                    </button>
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
                            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                                    <button onClick={closeModal} className="px-2 pt-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <div className="p-6 space-y-6">
                                    {/* Row 1: Branch, Submitted */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer</label>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedTicket.fullName}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mobile</label>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{selectedTicket.mobile}</p>
                                        </div>
                                    </div>

                                    {/* Row 3: Department, Category, Support Type */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Support Type</label>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                <p className="font-medium text-sm">{selectedTicket.supportType || '-'}</p>
                                            </div>
                                        </div>
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
                                        {selectedTicket.adminDescription && (
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Material Details (Admin)</label>
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
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approval History</h3>
                                            </div>
                                            {selectedTicket.adminManagerStatus && (
                                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Admin Manager</span>
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${selectedTicket.adminManagerStatus.toLowerCase() === 'approved'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                            : selectedTicket.adminManagerStatus.toLowerCase() === 'pending'
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                            }`}>
                                                            {selectedTicket.adminManagerStatus}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {selectedTicket.adminManagerComments && (
                                                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                                                "{selectedTicket.adminManagerComments}"
                                                            </p>
                                                        )}
                                                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-1">
                                                            {selectedTicket.adminManagerMailTime && (
                                                                <span className="text-[11px] text-slate-500">
                                                                    <strong>Request Sent:</strong> {selectedTicket.adminManagerMailTime}
                                                                </span>
                                                            )}
                                                            {selectedTicket.adminManagerStatusTime && (
                                                                <span className="text-[11px] text-slate-500">
                                                                    <strong>Status Updated:</strong> {selectedTicket.adminManagerStatusTime}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedTicket.managementStatus && (!selectedTicket.adminManagerStatus || selectedTicket.adminManagerStatus.trim().toLowerCase() !== 'rejected') && (
                                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Management</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {selectedTicket.managementComments && (
                                                            <div className="space-y-2.5">
                                                                {selectedTicket.managementComments.split('\n').filter(comment => comment.trim()).map((comment, index) => {
                                                                    let displayComment = comment.trim();
                                                                    let displayTime = null;
                                                                    if (displayComment.includes('|||')) {
                                                                        const parts = displayComment.split('|||');
                                                                        displayTime = parts[0].trim();
                                                                        displayComment = parts[1].trim();
                                                                    }

                                                                    let individualStatus = null;
                                                                    const statusMatch = displayComment.match(/\[(APPROVED|REJECTED)\]/i);
                                                                    if (statusMatch) {
                                                                        individualStatus = statusMatch[1].toUpperCase();
                                                                        // Remove the tag and clean up any double spaces/colons
                                                                        displayComment = displayComment.replace(statusMatch[0], '').replace(/\s+:/, ':').trim();
                                                                    }

                                                                    return (
                                                                        <div key={index} className="p-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg shadow-sm flex flex-col gap-2 relative">
                                                                            <div className="flex items-start gap-2 pr-16">
                                                                                <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-sm mt-0.5">chat</span>
                                                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                                                                                    {displayComment}
                                                                                </p>
                                                                            </div>

                                                                            {individualStatus && (
                                                                                <div className="absolute top-2.5 right-2.5">
                                                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${individualStatus === 'APPROVED'
                                                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50'
                                                                                        : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/50'
                                                                                        }`}>
                                                                                        {individualStatus}
                                                                                    </span>
                                                                                </div>
                                                                            )}

                                                                            {displayTime && (
                                                                                <div className="flex items-center gap-1.5 ml-6">
                                                                                    <span className="material-symbols-outlined text-[12px] text-slate-400">schedule</span>
                                                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                                                        {displayTime}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-1">
                                                            {selectedTicket.managementMailTime && (
                                                                <span className="text-[11px] text-slate-500">
                                                                    <strong>Request Sent:</strong> {selectedTicket.managementMailTime}
                                                                </span>
                                                            )}
                                                            {selectedTicket.managementStatusTime && !selectedTicket.managementComments?.includes('|||') && (
                                                                <span className="text-[11px] text-slate-500">
                                                                    <strong>Status Updated:</strong> {selectedTicket.managementStatusTime}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Lifecycle Tracking */}
                                    {(selectedTicket.pendingTime || selectedTicket.completedTime) && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Core Lifecycle</h3>
                                            <div className="flex gap-4">
                                                {selectedTicket.pendingTime && (
                                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 px-3 py-2 rounded-lg flex-1">
                                                        <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-500 mb-0.5">Marked Pending</p>
                                                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{selectedTicket.pendingTime}</p>
                                                    </div>
                                                )}
                                                {selectedTicket.completedTime && (
                                                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 px-3 py-2 rounded-lg flex-1">
                                                        <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-500 mb-0.5">Marked Completed</p>
                                                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">{selectedTicket.completedTime}</p>
                                                    </div>
                                                )}
                                            </div>
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
                                            {addExpense && updateStatus === 'Completed' && !(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected') && (
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
                                                                        if (file.size > 200 * 1024) {
                                                                            setBillFileError('File size is larger than 200KB limit.');
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
                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                        {updateStatus === 'Pending' && !(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected') && (
                                            <div className="mb-4">
                                                <label className="block text-xs font-semibold text-primary uppercase tracking-wider mb-1">Mandatory Comments *</label>
                                                <textarea
                                                    className={`w-full p-3 bg-white dark:bg-slate-900 border ${commentError ? 'border-red-400 focus:ring-red-400' : 'border-amber-300 dark:border-amber-700/50 focus:ring-primary'} rounded-lg focus:ring-2 focus:border-transparent outline-none transition-shadow text-sm disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800`}
                                                    rows="3"
                                                    placeholder="Please provide justification / comments for moving this ticket to Pending or Completed..."
                                                    value={resolutionComments}
                                                    onChange={(e) => {
                                                        setResolutionComments(e.target.value);
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                                                <div className="relative">
                                                    <select
                                                        value={updateStatus}
                                                        onChange={(e) => setUpdateStatus(e.target.value)}
                                                        disabled={(user.access && !user.access.includes('Edit')) || selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected'}
                                                        className={`w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none transition-shadow ${selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected' || (user.access && !user.access.includes('Edit')) ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
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
                                                        disabled={(user.access && !user.access.includes('Edit')) || selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected'}
                                                        className={`w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none transition-shadow ${selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected' || (user.access && !user.access.includes('Edit')) ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
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
                                                {!(selectedTicket.status === 'Completed' || selectedTicket.status === 'Resolved' || selectedTicket.status === 'Rejected') && user.access && user.access.includes('Edit') && (
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
                                        {/* Request Approval section — only for Material request */}
                                        {selectedTicket.category === 'Material request' && (
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
                                                    // Dynamic check based on users who have mail enabled
                                                    const mailUsers = users.filter(u => u.can_receive_mail);
                                                    const managementNames = mailUsers.filter(u => u.receiver_position === 'Management').map(u => u.name);
                                                    const adminManagerNames = mailUsers.filter(u => u.receiver_position === 'Admin Manager').map(u => u.name);

                                                    const adminManagerDone = adminManagerNames.length > 0 ? adminManagerNames.every(n => respondedNames.has(n)) : true;
                                                    const allManagementDone = managementNames.every(n => respondedNames.has(n));
                                                    const allMembersResponded = (adminManagerNames.length > 0 || managementNames.length > 0) && adminManagerDone && allManagementDone;

                                                    const isDisabled = !updateStatus || !updateAssignee
                                                        || selectedTicket.status === 'Completed'
                                                        || selectedTicket.status === 'Resolved'
                                                        || selectedTicket.status === 'Rejected'
                                                        || allMembersResponded
                                                        || (user.access && !user.access.includes('Edit'));

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
                                                        </>
                                                    );
                                                })()}

                                                {/* Inline approval form */}
                                                {showApprovalForm && (
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
                                                                // Also exclude Admin Manager if already approved
                                                                if (selectedTicket.adminManagerStatus?.toLowerCase() === 'approved') {
                                                                    alreadyNotified.add('Admin Manager');
                                                                }

                                                                const available = users.filter(u => u.can_receive_mail).map(u => u.name)
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
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* Material Description */}
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                                Material Description {selectedTicket.adminManagerStatus?.toLowerCase() !== 'approved' && <span className="text-red-500">*</span>}
                                                            </label>
                                                            <textarea
                                                                rows="3"
                                                                placeholder="Describe the material details"
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
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Fixed Dropdown Menu */}
                {
                    activeAction && (
                        <div
                            className="fixed z-[9999] bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 w-48 py-1"
                            style={{
                                top: activeAction.openUp ? 'auto' : activeAction.top,
                                bottom: activeAction.openUp ? activeAction.bottom : 'auto',
                                left: activeAction.left
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={(e) => handleDeleteTicket(e, activeAction.id)}
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium transition-colors"
                            >
                                Delete Ticket
                            </button>
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
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Are you sure?</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                                        Are you sure you want to delete this ticket?
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
