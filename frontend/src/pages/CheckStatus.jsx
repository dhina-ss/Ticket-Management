import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

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

    return (
        <div className="w-full py-8 text-center">
            <div className="relative flex items-center justify-between max-w-2xl mx-auto">
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-700"></div>
                <div
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-primary transition-all duration-500"
                    style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                ></div>
                {steps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    return (
                        <div key={index} className="relative flex flex-col items-center group">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10 bg-white dark:bg-slate-900 
                                ${isCompleted ? 'border-primary text-primary' : 'border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600'}
                                ${isCurrent ? 'scale-110' : ''}`}
                            >
                                {index <= currentStepIndex ? (
                                    <div className="w-4 h-4 rounded-full bg-primary"></div>
                                ) : (
                                    <span className="text-xs font-bold">{index + 1}</span>
                                )}
                            </div>
                            <div
                                className={`absolute top-14 text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors duration-300 whitespace-nowrap
                                    ${isCompleted ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}
                                    ${isCurrent ? 'opacity-100' : 'opacity-70'}`}
                                style={{ left: '50%', transform: 'translateX(-50%)' }}
                            >
                                {step.label}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="h-10"></div>
        </div>
    );
};

// Single ticket card used for both search modes
const TicketCard = ({ ticketData, onUpdateTicket }) => {
    const [isConfirming, setIsConfirming] = useState(false);

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
            <div className="p-8">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ticket Details</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            ID: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{ticketData.ticket_id}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest">Submitted On</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{ticketData.timestamp}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Department</h3>
                        <p className="text-slate-800 dark:text-slate-200 font-medium text-lg">{ticketData.department || '-'}</p>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Category</h3>
                        <p className="text-slate-800 dark:text-slate-200 font-medium text-lg">
                            {ticketData.category}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Support Type</h3>
                        <p className="text-slate-800 dark:text-slate-200 font-medium text-lg">
                            {ticketData.supportType || '-'}
                        </p>
                    </div>
                </div>

                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 mb-6">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">description</span>
                        Description
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                        {ticketData.description || "No description provided."}
                    </p>
                </div>

                {ticketData.attachment && (
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">attachment</span>
                            Attachments
                        </h3>
                        <a
                            href={`/api/tickets/${ticketData.ticket_id}/attachment`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            <span className="material-icons text-primary text-lg">image</span>
                            {ticketData.attachment}
                            <span className="material-symbols-outlined text-slate-400 text-sm ml-auto">open_in_new</span>
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

                    {/* Material Request Approval Statuses */}
                    {ticketData.category?.toLowerCase().includes('material request') && (
                        <div className="space-y-3">
                            {/* Admin Manager Status */}
                            {ticketData.adminManagerStatus && (
                                <div className={`flex items-start gap-3 px-4 py-3 border rounded-xl 
                                ${ticketData.adminManagerStatus === 'Approved' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                                        ticketData.adminManagerStatus === 'Rejected' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                                            'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'}`}>
                                    <span className={`material-symbols-outlined text-xl mt-0.5 shrink-0 
                                    ${ticketData.adminManagerStatus === 'Approved' ? 'text-green-500' :
                                            ticketData.adminManagerStatus === 'Rejected' ? 'text-red-500' :
                                                'text-amber-500'}`}>
                                        {ticketData.adminManagerStatus === 'Approved' ? 'check_circle' :
                                            ticketData.adminManagerStatus === 'Rejected' ? 'cancel' : 'hourglass_top'}
                                    </span>
                                    <div>
                                        <p className={`text-sm font-semibold 
                                        ${ticketData.adminManagerStatus === 'Approved' ? 'text-green-700 dark:text-green-400' :
                                                ticketData.adminManagerStatus === 'Rejected' ? 'text-red-700 dark:text-red-400' :
                                                    'text-amber-700 dark:text-amber-400'}`}>
                                            {ticketData.adminManagerStatus === 'Pending' ? 'Pending for Admin Manager Approval' :
                                                ticketData.adminManagerStatus === 'Approved' ? 'Approved by Admin Manager' :
                                                    'Rejected by Admin Manager'}
                                        </p>
                                        <p className={`text-xs mt-0.5 
                                        ${ticketData.adminManagerStatus === 'Approved' ? 'text-green-600 dark:text-green-500' :
                                                ticketData.adminManagerStatus === 'Rejected' ? 'text-red-600 dark:text-red-500' :
                                                    'text-amber-600 dark:text-amber-500'}`}>
                                            {ticketData.adminManagerStatus === 'Pending' ? 'Your request is awaiting decision from the Admin Manager.' :
                                                ticketData.adminManagerStatus === 'Approved' ? 'The Admin Manager has reviewed and approved this request.' :
                                                    'The Admin Manager has rejected this request.'}
                                        </p>
                                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-1">
                                            {ticketData.adminManagerMailTime && (
                                                <span className="text-[11px] text-slate-500">
                                                    <strong>Sent To Manager:</strong> {ticketData.adminManagerMailTime}
                                                </span>
                                            )}
                                            {ticketData.adminManagerStatusTime && (
                                                <span className="text-[11px] text-slate-500">
                                                    <strong>Decision Made:</strong> {ticketData.adminManagerStatusTime}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Management Status - Only show if not rejected by Admin Manager and explicitly mailed out*/}
                            {ticketData.managementStatus && ticketData.managementMailTime && (!ticketData.adminManagerStatus || ticketData.adminManagerStatus.trim().toLowerCase() !== 'rejected') && (
                                <div className={`flex items-start gap-3 px-4 py-3 border rounded-xl 
                                ${ticketData.managementStatus === 'Approved' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                                        ticketData.managementStatus === 'Rejected' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
                                            'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'}`}>
                                    <span className={`material-symbols-outlined text-xl mt-0.5 shrink-0 
                                    ${ticketData.managementStatus === 'Approved' ? 'text-green-500' :
                                            ticketData.managementStatus === 'Rejected' ? 'text-red-500' :
                                                ticketData.managementStatus === 'Hold' ? 'text-orange-500' :
                                                    'text-amber-500'}`}>
                                        {ticketData.managementStatus === 'Approved' ? 'verified' :
                                            ticketData.managementStatus === 'Rejected' ? 'block' :
                                                ticketData.managementStatus === 'Hold' ? 'pause_circle' : 'pending'}
                                    </span>
                                    <div>
                                        <p className={`text-sm font-semibold 
                                        ${ticketData.managementStatus === 'Approved' ? 'text-green-700 dark:text-green-400' :
                                                ticketData.managementStatus === 'Rejected' ? 'text-red-700 dark:text-red-400' :
                                                    ticketData.managementStatus === 'Hold' ? 'text-orange-700 dark:text-orange-400' :
                                                        'text-amber-700 dark:text-amber-400'}`}>
                                            {ticketData.managementStatus === 'Pending' ? 'Pending for Management Approval' :
                                                ticketData.managementStatus === 'Approved' ? 'Approved by Management' :
                                                    ticketData.managementStatus === 'Hold' ? 'Hold by Management' :
                                                        'Rejected by Management'}
                                        </p>
                                        <p className={`text-xs mt-0.5 
                                        ${ticketData.managementStatus === 'Approved' ? 'text-green-600 dark:text-green-500' :
                                                ticketData.managementStatus === 'Rejected' ? 'text-red-600 dark:text-red-500' :
                                                    ticketData.managementStatus === 'Hold' ? 'text-orange-600 dark:text-orange-500' :
                                                        'text-amber-600 dark:text-amber-500'}`}>
                                            {ticketData.managementStatus === 'Pending' ? 'Your request is awaiting final decision from the Management.' :
                                                ticketData.managementStatus === 'Approved' ? 'The Management has given final approval.' :
                                                    ticketData.managementStatus === 'Hold' ? 'The Management vote is tied. Awaiting further review.' :
                                                        'The Management has rejected this request.'}
                                        </p>
                                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-1">
                                            {ticketData.managementMailTime && (
                                                <span className="text-[11px] text-slate-500">
                                                    <strong>Sent To Management:</strong> {ticketData.managementMailTime}
                                                </span>
                                            )}
                                            {ticketData.managementStatusTime && (
                                                <span className="text-[11px] text-slate-500">
                                                    <strong>Decision Made:</strong> {ticketData.managementStatusTime}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Core Lifecycle Timestamps & Comments for Customer View */}
                    {(ticketData.inProgressTime || ticketData.pendingTime || ticketData.completedTime) && (
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">history</span>
                                ADMIN COMMENTS {ticketData.assignee ? `- ${ticketData.assignee}` : ''}
                            </h3>
                            <div className={`flex items-start gap-3 px-4 py-3 border rounded-xl 
                                ${ticketData.completedTime
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                                    : ticketData.pendingTime
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'}`}>
                                <span className={`material-symbols-outlined text-xl mt-0.5 shrink-0 
                                ${ticketData.completedTime ? 'text-emerald-500' : ticketData.pendingTime ? 'text-amber-500' : 'text-blue-500'}`}>
                                    {ticketData.completedTime ? 'check_circle' : ticketData.pendingTime ? 'hourglass_top' : 'build_circle'}
                                </span>
                                <div className="w-full">
                                    <p className={`text-sm font-semibold 
                                    ${ticketData.completedTime ? 'text-emerald-700 dark:text-emerald-400' : ticketData.pendingTime ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                                        {ticketData.completedTime
                                            ? 'Resolved (Completed)'
                                            : ticketData.pendingTime
                                                ? 'Work Started (Pending)'
                                                : 'Work Started (In Progress)'}
                                    </p>

                                    {ticketData.resolutionComments && (
                                        <p className={`text-sm font-normal italic mt-1 mb-2 
                                        ${ticketData.completedTime ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                            "{ticketData.resolutionComments}"
                                        </p>
                                    )}

                                    <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-1">
                                        {ticketData.inProgressTime && (
                                            <span className="text-[11px] text-slate-500">
                                                <strong>Work started at:</strong> {ticketData.inProgressTime}
                                            </span>
                                        )}
                                        {ticketData.pendingTime && (
                                            <span className="text-[11px] text-slate-500">
                                                <strong>Work Started:</strong> {ticketData.pendingTime}
                                            </span>
                                        )}
                                        {ticketData.completedTime && (
                                            <span className="text-[11px] text-slate-500">
                                                <strong>Resolved On:</strong> {ticketData.completedTime}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
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
                                            onClick={() => handleConfirmation('Yes')}
                                            disabled={isConfirming}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                            <span className="material-symbols-outlined text-sm">thumb_up</span>
                                            Yes, fixed
                                        </button>
                                        <button
                                            onClick={() => handleConfirmation('No')}
                                            disabled={isConfirming}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 text-slate-700 dark:text-slate-300 active:scale-95 text-sm font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                            <span className="material-symbols-outlined text-sm">thumb_down</span>
                                            No, not fixed
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
    const [searchType, setSearchType] = useState('ticket'); // 'ticket' | 'mobile'
    const [ticketId, setTicketId] = useState('');
    const [mobile, setMobile] = useState('');
    const [ticketData, setTicketData] = useState(null);     // single ticket (ID search)
    const [mobileTickets, setMobileTickets] = useState([]); // list of tickets (mobile search)
    const [selectedTicket, setSelectedTicket] = useState(null); // expanded ticket from list
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setTicketData(null);
        setMobileTickets([]);

        try {
            if (searchType === 'ticket') {
                const response = await api.get(`/api/status/${ticketId.trim()}`);
                if (response.status === 200) setTicketData(response.data);
                else setError('Ticket not found');
            } else {
                const response = await api.get(`/api/status/mobile/${encodeURIComponent(mobile.trim())}`);
                if (response.status === 200) setMobileTickets(response.data);
                else setError('No tickets found for this mobile number');
            }
        } catch (err) {
            setError('Failed to connect to server');
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
        <main className="w-[70%] mx-auto px-4 py-10 space-y-8">
            <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                            <span className="material-symbols-outlined text-primary text-3xl">search_check</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Check Ticket Status</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
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
                            Looking for a new ticket? <Link className="text-primary font-semibold hover:underline" to="/" state={{ fromTicketForm: true }}>Click here</Link>
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
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
                                    className={`p-5 cursor-pointer transition-colors ${isSelected
                                        ? 'bg-primary/5 dark:bg-primary/10'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                    onClick={() => setSelectedTicket(isSelected ? null : t)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                                    {t.ticket_id}
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
