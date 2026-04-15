import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api';
import { copyToClipboard } from '../utils/clipboard';

// Status Stepper Component
const StatusStepper = ({ currentStatus, isRejected }) => {
    const steps = [
        { label: 'Not Started', value: 'not started' },
        { label: 'In Progress', value: 'in progress' },
        { label: isRejected ? 'Rejected' : 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' }
    ];

    const normalizedStatus = currentStatus?.toLowerCase() || 'not started';
    let currentStepIndex = steps.findIndex(step => step.value === normalizedStatus);
    if (currentStepIndex === -1) {
        if (normalizedStatus.includes('submit')) currentStepIndex = 0;
        else if (normalizedStatus.includes('progress')) currentStepIndex = 1;
        else if (normalizedStatus.includes('pend') || normalizedStatus.includes('reject')) currentStepIndex = 2;
        else if (normalizedStatus.includes('resolv') || normalizedStatus.includes('clos')) currentStepIndex = 3;
        else currentStepIndex = 0;
    }

    // Color mapping based on current status
    const colorThemes = {
        0: { bg: 'bg-rose-500', text: 'text-rose-500', shadow: 'shadow-rose-500/20', border: 'border-rose-100' },    // Not Started
        1: { bg: 'bg-blue-500', text: 'text-blue-500', shadow: 'shadow-blue-500/20', border: 'border-blue-100' },    // In Progress
        2: { bg: 'bg-amber-500', text: 'text-amber-500', shadow: 'shadow-amber-500/20', border: 'border-amber-100' }, // Pending
        3: { bg: 'bg-emerald-500', text: 'text-emerald-500', shadow: 'shadow-emerald-500/20', border: 'border-emerald-100' } // Completed
    };

    const theme = colorThemes[currentStepIndex] || colorThemes[0];

    return (
        <div className="w-full py-8 text-center mt-4">
            <div className="relative flex items-center justify-between max-w-2xl mx-auto px-4">
                {/* Background Line */}
                <div className="absolute left-4 right-4 top-1/2 transform -translate-y-1/2 h-[2px] bg-slate-200 dark:bg-slate-700 z-0"></div>
                
                {/* Progress Line */}
                <div
                    className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-[2px] ${theme.bg} transition-all duration-500 z-0`}
                    style={{ width: `calc(${(currentStepIndex / (steps.length - 1)) * 100}% - ${(currentStepIndex === 3 ? 32 : 16)}px)` }}
                ></div>

                {steps.map((step, index) => {
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    const isFuture = index > currentStepIndex;

                    return (
                        <div key={index} className="relative flex flex-col items-center z-10">
                            {/* Circle */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 
                                ${isCompleted || isCurrent 
                                    ? `${theme.bg} text-white shadow-lg ${theme.shadow}` 
                                    : 'bg-white dark:bg-slate-900 border-2 border-slate-300 text-slate-300'}`}
                            >
                                {isCompleted ? (
                                    <span className="material-symbols-outlined text-base font-bold scale-110">check</span>
                                ) : (
                                    <span className="text-xs font-bold">{index + 1}</span>
                                )}
                                
                                {/* Caret Arrow for Current Step */}
                                {isCurrent && (
                                    <span className={`material-symbols-outlined absolute -top-7 text-slate-400 text-lg animate-bounce-subtle`}>
                                        expand_more
                                    </span>
                                )}
                            </div>

                            {/* Label */}
                            <div
                                className={`absolute top-10 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 whitespace-nowrap
                                    ${index <= currentStepIndex ? theme.text : 'text-slate-400 dark:text-slate-500'}`}
                                style={{ left: '50%', transform: 'translateX(-50%)' }}
                            >
                                {step.label}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="h-6"></div>
        </div>
    );
};

// Simple Copy Button Component
const CopyButton = ({ text, className = "" }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const success = await copyToClipboard(text);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            onClick={handleCopy}
            type="button"
            title={copied ? "Copied!" : "Copy to clipboard"}
            className={`inline-flex items-center justify-center p-1 rounded-md transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${className} ${copied ? "text-emerald-500" : "text-slate-400 hover:text-primary"}`}
        >
            <span className="material-symbols-outlined text-base">
                {copied ? "check" : "content_copy"}
            </span>
        </button>
    );
};

// Single ticket card used for both search modes
const TicketCard = ({ ticketData, onUpdateTicket }) => {
    const [isConfirming, setIsConfirming] = useState(false);

    // Derive who handled the ticket status updates
    const adminComments = ticketData.adminComments || [];
    
    // Prioritize actual assignee name over generic history entries
    const handlerName = ticketData.assignee || 'Admin';

    const completedEntry = [...adminComments].reverse().find(c => c.status === 'Completed');
    const completedTime = completedEntry?.timestamp || ticketData.completedTime;

    const pendingEntry = [...adminComments].reverse().find(c => c.status === 'Pending');
    const pendingTime = pendingEntry?.timestamp || ticketData.pendingTime;

    const isCompleted = ticketData.status === 'Completed';
    const isPending = ticketData.status === 'Pending';
    const themeColor = isCompleted ? 'emerald' : isPending ? 'amber' : 'slate';

    const handleConfirmation = async (status) => {
        setIsConfirming(true);
        try {
            const formData = new FormData();
            formData.append('user_confirmation', status);

            const response = await api.put(`/api/tickets/${ticketData.ticket_id}`, formData);

            if (response.status === 200) {
                if (onUpdateTicket) {
                    onUpdateTicket(ticketData.ticket_id, { userConfirmation: status });
                }
            } else {
                console.error("Failed to submit confirmation");
            }
        } catch (error) {
            console.error("Error submitting confirmation:", error);
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8 border-b border-slate-100 dark:border-slate-800 pb-4 sm:pb-6">
                    <div>
                        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">Ticket Details</h2>
                        <div className="mt-1 flex flex-col gap-1">
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                ID: <span className="font-mono font-medium text-slate-700 dark:text-slate-300 select-all">{ticketData.ticket_id}</span>
                                <CopyButton text={ticketData.ticket_id} />
                            </p>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                Submitted By: <span className="font-semibold text-slate-700 dark:text-slate-300">{ticketData.fullName}</span>
                            </p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right">
                        <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest">Submitted On</p>
                        <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">{ticketData.timestamp}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
                    <div>
                        <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Department</h3>
                        <p className="text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm">{ticketData.department || '-'}</p>
                    </div>
                    <div>
                        <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Category</h3>
                        <p className="text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm hover:break-words whitespace-normal break-words sm:break-normal">
                            {ticketData.category}
                        </p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Support Type</h3>
                        <p className="text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm">
                            {ticketData.supportType || '-'}
                        </p>
                    </div>
                </div>

                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 mb-6">
                    <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2">
                        <span className="material-symbols-outlined text-sm sm:text-base">description</span>
                        Description
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                        {ticketData.description || "No description provided."}
                    </p>
                </div>

                {ticketData.attachment && (
                    <div className="mb-6">
                        <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 sm:gap-2">
                            <span className="material-symbols-outlined text-sm sm:text-base">attachment</span>
                            Attachments
                        </h3>
                        <a
                            href={`/api/tickets/${ticketData.ticket_id}/attachment`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            <span className="material-icons text-primary text-base sm:text-lg">image</span>
                            <span className="truncate max-w-[150px] sm:max-w-none">{ticketData.attachment}</span>
                            <span className="material-symbols-outlined text-slate-400 text-xs sm:text-sm ml-auto">open_in_new</span>
                        </a>
                    </div>
                )}

                <div className="mb-10 px-2 sm:px-4 border-t border-slate-100 dark:border-slate-800 pt-8 mt-4">
                    <StatusStepper
                        currentStatus={ticketData.status}
                        isRejected={ticketData.adminManagerStatus === 'Rejected'}
                    />
                </div>

                <div className="space-y-6">

                    {/* Unified Status Updates Card */}
                    {(ticketData.resolutionComments || ticketData.pendingComments) && (
                        <div className={`bg-${themeColor}-50/60 dark:bg-${themeColor}-900/20 border border-${themeColor}-100 dark:border-${themeColor}-800/50 rounded-2xl p-4 sm:p-6 shadow-sm`}>
                            <div className={`flex items-center justify-between mb-6 border-b border-${themeColor}-200/50 dark:border-${themeColor}-800/50 pb-3`}>
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-${themeColor}-600 dark:text-${themeColor}-400 text-xl`}>
                                        {isCompleted ? 'check_circle' : isPending ? 'pause_circle' : 'history_edu'}
                                    </span>
                                    <h3 className={`text-sm font-bold text-${themeColor}-800 dark:text-${themeColor}-100 uppercase tracking-tight`}>
                                        Status Update
                                    </h3>
                                </div>
                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-${themeColor}-100 text-${themeColor}-700 dark:bg-${themeColor}-900/40 dark:text-${themeColor}-400`}>
                                    {ticketData.status}
                                </span>
                            </div>

                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-1">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Handled By</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">{handlerName}</p>
                                </div>

                                {/* Resolution Content */}
                                {ticketData.resolutionComments && (
                                    <div className={`p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-${themeColor}-100 dark:border-${themeColor}-800/50`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className={`text-[10px] font-bold text-${themeColor}-600 dark:text-${themeColor}-400 uppercase tracking-widest`}>Resolution Details</p>
                                            {completedTime && <span className="text-[10px] text-slate-400 font-medium">{completedTime}</span>}
                                        </div>
                                        <p className={`text-xs sm:text-sm text-${themeColor}-900 dark:text-${themeColor}-100 leading-relaxed whitespace-pre-line font-medium`}>
                                            {ticketData.resolutionComments}
                                        </p>
                                    </div>
                                )}

                                {/* Pending Content */}
                                {ticketData.pendingComments && (
                                    <div className="p-4 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Pending Reason</p>
                                            {pendingTime && <span className="text-[10px] text-slate-400 font-medium">{pendingTime}</span>}
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium italic">
                                            "{ticketData.pendingComments}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manager & Management Approval Statuses */}
                    {(ticketData.adminManagerStatus || ticketData.managementStatus) && (
                        <div className="space-y-6 px-1">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">APPROVAL HISTORY</h3>
                            </div>

                            {/* MANAGER SECTION — uses adminManagerApprovals for per-manager data */}
                            {ticketData.adminManagerStatus && (() => {
                                // Use adminManagerApprovals JSON if available, else fall back to text parsing
                                let managerApprovals = [];
                                if (ticketData.adminManagerApprovals && Array.isArray(ticketData.adminManagerApprovals) && ticketData.adminManagerApprovals.length > 0) {
                                    managerApprovals = ticketData.adminManagerApprovals;
                                } else {
                                    // Fallback for legacy tickets without JSON
                                    managerApprovals = ticketData.adminManagerStatus.split(',').map(part => {
                                        const [name, ...rest] = part.split(':');
                                        return { name: name?.trim(), status: rest.join(':').trim(), mail_receive: ticketData.adminManagerMailTime, decision_made: rest.join(':').trim().toLowerCase() !== 'pending' ? ticketData.adminManagerStatusTime : null };
                                    }).filter(e => e.name);
                                }

                                // Helper: is link expired? (mail sent & no decision & > 24h ago)
                                const isLinkExpired = (entry) => {
                                    if (!entry.mail_receive || entry.decision_made) return false;
                                    const sent = new Date(entry.mail_receive.replace(/(\d{2})-(\d{2})-(\d{4})/, '$3-$2-$1'));
                                    return !isNaN(sent) && (Date.now() - sent.getTime()) > 24 * 60 * 60 * 1000;
                                };

                                return (
                                    <div className="mb-6">
                                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">MANAGER</h4>
                                        <div className="space-y-3">
                                            {managerApprovals.map((entry, idx) => {
                                                const st = (entry.status || '').toLowerCase();
                                                const isApproved = st.includes('approved');
                                                const isPending = st.includes('pending');
                                                const expired = isPending && isLinkExpired(entry);
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
                                                return (
                                                    <div key={idx} className={`border rounded-xl p-4 relative transition-colors duration-200 shadow-sm ${cardCls}`}>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">
                                                                {entry.name || 'Manager'}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                {expired && (
                                                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                                                                        Link Expired
                                                                    </span>
                                                                )}
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${badgeCls}`}>
                                                                    {(entry.status || '-').toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-1.5 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                                                            {entry.mail_receive && (
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>send</span> Request Sent: {entry.mail_receive}
                                                                </p>
                                                            )}
                                                            {entry.decision_made && (
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>event_available</span> Status Updated: {entry.decision_made}
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
                            {ticketData.managementStatus && ticketData.managementMailTime && (!ticketData.adminManagerStatus || ticketData.adminManagerStatus.trim().toLowerCase() !== 'rejected') && (() => {
                                let arrivals = [];
                                if (ticketData.managementApprovals && Array.isArray(ticketData.managementApprovals) && ticketData.managementApprovals.length > 0) {
                                    arrivals = ticketData.managementApprovals;
                                } else {
                                    const rawStatusText = ticketData.managementStatus || '';
                                    const parts = rawStatusText.split(',').map(s => s.trim()).filter(Boolean);
                                    const seen = new Map();
                                    parts.forEach(part => {
                                        if (part.includes(':')) {
                                            const [name, stat] = part.split(':').map(s => s.trim());
                                            seen.set(name, {
                                                name,
                                                mail_receive: ticketData.managementMailTime,
                                                decision_made: stat !== 'Pending' ? ticketData.managementStatusTime : null,
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

                                                return (
                                                    <div key={`mgmt-box-${idx}`} className={`border rounded-xl p-4 relative transition-colors duration-200 shadow-sm ${rawStatus.includes('approved')
                                                        ? 'bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50'
                                                        : rawStatus.includes('pending')
                                                            ? 'bg-amber-50/60 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50'
                                                            : 'bg-rose-50/60 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50'
                                                        }`}>
                                                        <div className="flex items-center justify-between mb-3">
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

                                                        <div className="flex flex-col gap-1.5 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                                                            {entry.mail_receive && (
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>send</span> Request Sent: {entry.mail_receive}
                                                                </p>
                                                            )}
                                                            {entry.decision_made && (
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>event_available</span> Status Updated: {entry.decision_made}
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
                        </div>
                    )}



                    {/* --- USER CONFIRMATION UI --- */}
                    {ticketData.status === 'Completed' && (
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">how_to_reg</span>
                                USER CONFIRMATION
                            </h3>
                            <div className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all
                                ${ticketData.userConfirmation === 'Pending'
                                    ? 'bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/30'
                                    : ticketData.userConfirmation?.startsWith('Yes')
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'}`}>

                                <div className="flex items-start gap-3">
                                    {ticketData.userConfirmation === 'Pending' && (
                                        <span className="material-symbols-outlined text-primary text-xl mt-0.5 shrink-0">help</span>
                                    )}
                                    {ticketData.userConfirmation?.startsWith('Yes') && (
                                        <span className="material-symbols-outlined text-emerald-500 text-xl mt-0.5 shrink-0">task_alt</span>
                                    )}
                                    {ticketData.userConfirmation === 'No' && (
                                        <span className="material-symbols-outlined text-red-500 text-xl mt-0.5 shrink-0">error</span>
                                    )}

                                    <div>
                                        <p className={`text-sm font-semibold 
                                            ${ticketData.userConfirmation === 'Pending' ? 'text-primary dark:text-primary' :
                                                ticketData.userConfirmation?.startsWith('Yes') ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                            {ticketData.userConfirmation === 'Pending' ? 'Has your issue been fully resolved?' :
                                                ticketData.userConfirmation?.startsWith('Yes') ? 'You confirmed this issue is fixed.' :
                                                    'You reported this issue is not fixed.'}
                                        </p>
                                        <p className={`text-xs mt-0.5 
                                            ${ticketData.userConfirmation === 'Pending' ? 'text-slate-600 dark:text-slate-400' :
                                                ticketData.userConfirmation?.startsWith('Yes') ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                                            {ticketData.userConfirmation === 'Pending' ? 'Please let us know so we can ensure everything is working properly.' :
                                                ticketData.userConfirmation === 'Yes' ? 'Thank you for your feedback!' :
                                                    ticketData.userConfirmation === 'Yes (System Auto-Confirmed)' ? 'System automatically confirmed the issue as resolved after 1 hour.' :
                                                        'Our team has been notified and will look into it further.'}
                                        </p>
                                    </div>
                                </div>

                                {ticketData.userConfirmation === 'Pending' && (
                                    <div className="flex items-center gap-3 shrink-0">
                                        <button
                                            onClick={() => handleConfirmation('No')}
                                            disabled={isConfirming}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 text-slate-700 dark:text-slate-300 active:scale-95 text-sm font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                            <span className="material-symbols-outlined text-sm">thumb_down</span>
                                            No, not fixed
                                        </button>
                                        <button
                                            onClick={() => handleConfirmation('Yes')}
                                            disabled={isConfirming}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                            <span className="material-symbols-outlined text-sm">thumb_up</span>
                                            Yes, fixed
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

const CheckStatus = () => {
    const location = useLocation();
    const [searchType, setSearchType] = useState('ticket'); // 'ticket' | 'mobile'
    const [ticketId, setTicketId] = useState('');
    const [mobile, setMobile] = useState('');
    const [ticketData, setTicketData] = useState(null);     // single ticket (ID search)
    const [mobileTickets, setMobileTickets] = useState([]); // list of tickets (mobile search)
    const [selectedTicket, setSelectedTicket] = useState(null); // expanded ticket from list
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const ticketIdFromUrl = queryParams.get('ticketId');

        if (ticketIdFromUrl) {
            setSearchType('ticket');
            setTicketId(ticketIdFromUrl);

            const fetchTicketFromUrl = async () => {
                setLoading(true);
                setError('');
                setTicketData(null);
                setMobileTickets([]);

                try {
                    const response = await api.get(`/api/status/${ticketIdFromUrl.trim()}`);
                    setTicketData(response.data);
                } catch (err) {
                    if (err.response && err.response.status === 404) {
                        setError('The ticket id not in the list');
                    } else {
                        setError('Failed to connect to server');
                    }
                } finally {
                    setLoading(false);
                }
            };

            fetchTicketFromUrl();
        }
    }, [location.search]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setTicketData(null);
        setMobileTickets([]);

        try {
            if (searchType === 'ticket') {
                const response = await api.get(`/api/status/${ticketId.trim()}`);
                setTicketData(response.data);
            } else {
                const response = await api.get(`/api/status/mobile/${encodeURIComponent(mobile.trim())}`);
                setMobileTickets(response.data);
            }
        } catch (err) {
            if (err.response && err.response.status === 404) {
                if (searchType === 'ticket') {
                    setError('The ticket id not in the list');
                } else {
                    setError('No tickets found for this mobile number');
                }
            } else {
                setError('Failed to connect to server');
            }
        } finally {
            setLoading(false);
        }
    };

    // Switch tabs → reset results
    const switchTab = (type) => {
        setSearchType(type);
        setError('');
        setTicketData(null);
        setMobileTickets([]);
        setSelectedTicket(null);
        setTicketId('');
        setMobile('');
    };

    return (
        <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
            <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="p-5 sm:p-8">
                    <div className="text-center mb-6 sm:mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full mb-3 sm:mb-4">
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '32px' }}>assignment_turned_in</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">Check Ticket Status</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 sm:mt-2">
                            Search by Ticket ID or your registered mobile number.
                        </p>
                    </div>

                    {/* Tab Toggle */}
                    <div className="flex max-w-md mx-auto mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => switchTab('ticket')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${searchType === 'ticket'
                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">tag</span>
                            Ticket ID
                        </button>
                        <button
                            type="button"
                            onClick={() => switchTab('mobile')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${searchType === 'mobile'
                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">smartphone</span>
                            Mobile Number
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
                        {searchType === 'ticket' ? (
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="ticket-id">
                                    Ticket ID
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <span className="material-symbols-outlined text-xl">tag</span>
                                    </div>
                                    <input
                                        className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        id="ticket-id"
                                        placeholder="e.g. AB12CD34"
                                        type="text"
                                        required
                                        value={ticketId}
                                        onChange={(e) => setTicketId(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="mobile">
                                    Mobile Number
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <span className="material-symbols-outlined text-xl">smartphone</span>
                                    </div>
                                    <input
                                        className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        id="mobile"
                                        placeholder="+91 98765 43210"
                                        type="tel"
                                        required
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">{error}</div>
                        )}

                        <button
                            className="w-full flex justify-center items-center gap-2 py-3.5 px-6 border border-transparent rounded-lg shadow-lg text-base font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-all disabled:opacity-50 cursor-pointer"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Searching...' : 'Track Status'}
                        </button>
                    </form>
                </div>

                {!ticketData && mobileTickets.length === 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/80 px-8 py-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="material-icons text-sm">info</span>
                            Looking for a new ticket? <Link className="text-primary font-semibold hover:underline" to="/">Click here</Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Single ticket (Ticket ID search) */}
            {ticketData && <TicketCard ticketData={ticketData} onUpdateTicket={(id, updates) => {
                setTicketData(prev => ({ ...prev, ...updates }));
            }} />}

            {/* Multiple tickets (Mobile search) */}
            {mobileTickets.length > 0 && (
                <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your Tickets</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {mobileTickets.length} ticket(s) found for this mobile number
                            </p>
                        </div>
                        <span className="material-icons text-primary">confirmation_number</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {mobileTickets.map(t => {
                            const statusColors = {
                                'not started': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                                'in progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                                'completed': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                                'approved': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                                'rejected': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                            };
                            const statusKey = t.status?.toLowerCase() || 'not started';
                            const badgeClass = statusColors[statusKey] || statusColors['not started'];
                            const isSelected = selectedTicket?.ticket_id === t.ticket_id;

                            return (
                                <div
                                    key={t.ticket_id}
                                    className={`p-4 sm:p-5 cursor-pointer transition-colors ${isSelected
                                        ? 'bg-primary/5 dark:bg-primary/10'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                    onClick={() => setSelectedTicket(isSelected ? null : t)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1.5">
                                                    <span className="select-all">{t.ticket_id}</span>
                                                    <CopyButton text={t.ticket_id} className="h-4 w-4" />
                                                </span>
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                                                    {t.status || 'Not Started'}
                                                </span>
                                            </div>
                                            <p className="text-slate-800 dark:text-slate-200 font-semibold truncate">{t.department || 'Support Ticket'}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons text-xs">category</span>
                                                    {t.category}
                                                </span>
                                                {t.mode && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <span className="material-icons text-xs">devices</span>
                                                        {t.mode}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1">
                                                    <span className="material-icons text-xs">schedule</span>
                                                    {t.timestamp}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`material-icons text-slate-400 transition-transform duration-200 ${isSelected ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Expanded ticket detail from mobile list */}
            {selectedTicket && <TicketCard ticketData={selectedTicket} onUpdateTicket={(id, updates) => {
                const newMobileTickets = mobileTickets.map(t =>
                    t.ticket_id === id ? { ...t, ...updates } : t
                );
                setMobileTickets(newMobileTickets);
                setSelectedTicket(prev => ({ ...prev, ...updates }));
            }} />}

            <div className="mt-8 text-center">
                <Link className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center gap-2" to="/">
                    <span className="material-icons text-sm">arrow_back</span>
                    Back to Home
                </Link>
            </div>
        </main>
    );
};

export default CheckStatus;
