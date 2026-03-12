import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api';
import logoImage from '../assets/logo.png';
import logoDarkImage from '../assets/logo1.png';

const TicketForm = () => {
    const location = useLocation();
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const [copied, setCopied] = useState(false);

    const initiallyShowPopup = !(location.state && location.state.fromTicketForm);
    const [showBranchPopup, setShowBranchPopup] = useState(initiallyShowPopup);
    const [attachment, setAttachment] = useState(null);
    const [attachmentError, setAttachmentError] = useState('');
    const [ticketId, setTicketId] = useState(null);
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [departmentsLoading, setDepartmentsLoading] = useState(false);

    useEffect(() => {
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
        fetchCategories();
        fetchDepartments();
    }, []);

    // Lock body scrolling when the branch popup is open
    useEffect(() => {
        if (showBranchPopup) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showBranchPopup]);

    const [formData, setFormData] = useState({
        fullName: '',
        mobile: '',
        category: '',
        subCategory: '',
        mode: '',
        description: '',
        supportType: '',
        branch: '',
        department: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'mobile') {
            // Only allow digits and prevent entering more than 10 characters
            const onlyNums = value.replace(/[^0-9]/g, '');
            if (onlyNums.length <= 10) {
                setFormData(prev => ({ ...prev, [name]: onlyNums }));
            }
            return; // Exit the function after handling mobile
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            if (name === 'category') {
                if (value !== 'Material request') newData.subCategory = '';
                // Printer issues only supports User End Support
                if (value === 'Printer issues') newData.mode = 'User End Support';
                // Material request has no mode
                if (value === 'Material request') newData.mode = '';
            }
            return newData;
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');

        const submissionData = new FormData();
        Object.keys(formData).forEach(key => {
            submissionData.append(key, formData[key]);
        });

        if (attachment) {
            submissionData.append('attachment', attachment);
        }

        try {
            const response = await api.post('/api/submit', submissionData);

            if (response.status === 200) {
                setStatus('success');
                setTicketId(response.data.ticket_id);
                // We keep the branch selected for the next ticket if they want to raise another? 
                // Usually better to reset everything but keep the branch if they are in the same location.
                // However, user said "once user select and click next, then hide the popup".
                // Let's reset but keep the branch for convenience, or reset everything.
                // The prompt says "first popup shown", implying it's a per-session or per-ticket thing.
                // Let's reset everything.
                setFormData({
                    fullName: '',
                    mobile: '',
                    category: '',
                    subCategory: '',
                    mode: '',
                    description: '',
                    supportType: '',
                    branch: '',
                    department: ''
                });
                setShowBranchPopup(true);
                setAttachment(null);
                setAttachmentError('');
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('Error submitting ticket:', error);
            setStatus('error');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-8 space-y-6">
                {/* ── Branch Selection Popup ── */}
                {showBranchPopup && status !== 'success' && (
                    <div className="fixed top-0 left-0 w-full h-[100dvh] z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md overflow-hidden">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 p-8 animate-fade-in">
                            <div className="flex flex-col items-center justify-center mb-8">
                                <img src={logoImage} alt="Logo" className="h-20 object-contain dark:hidden" />
                                <img src={logoDarkImage} alt="Logo" className="h-20 object-contain hidden dark:block" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-6">Select Your Support Type and Branch</h3>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Support Type <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                                            value={formData.supportType}
                                            onChange={(e) => setFormData({ ...formData, supportType: e.target.value, category: '', subCategory: '', mode: '' })}
                                            required
                                        >
                                            <option value="">Select support type</option>
                                            <option value="IT Support">IT Support</option>
                                            <option value="Admin Support">Admin Support</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                                            <span className="material-symbols-outlined">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Branch <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer pr-10"
                                            value={formData.branch}
                                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                            required
                                        >
                                            <option value="">Select a branch</option>
                                            <option value="Cotton Concepts HO, Coimbatore">Cotton Concepts HO, Coimbatore</option>
                                            <option value="Doctor Towels HO">Doctor Towels HO</option>
                                            <option value="Cotton Concepts, Vengamedu">Cotton Concepts, Vengamedu</option>
                                            <option value="Cotton Concepts, Karur">Cotton Concepts, Karur Factory</option>
                                            <option value="Doctor Towels, Karur">Doctor Towels, Karur</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                                            <span className="material-symbols-outlined">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    disabled={!formData.branch || !formData.supportType}
                                    onClick={() => {
                                        setShowBranchPopup(false);
                                        window.scrollTo(0, 0);
                                    }}
                                    className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 group"
                                >
                                    <span>Next</span>
                                    <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                                </button>

                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                                    <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase tracking-wider font-semibold">Other Actions</span>
                                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Link
                                        to="/login"
                                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-all"
                                    >
                                        <span className="material-symbols-outlined text-sm">login</span>
                                        <span>Login</span>
                                    </Link>
                                    <Link
                                        to="/status"
                                        state={{ fromTicketForm: true }}
                                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-all"
                                    >
                                        <span className="material-symbols-outlined text-sm">fact_check</span>
                                        <span>Status</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Success Modal Overlay ── */}
                {status === 'success' && ticketId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl mx-4 p-8 text-center">
                            {/* Icon */}
                            <div className="flex items-center justify-center w-24 h-24 rounded-full bg-green-50 dark:bg-green-900/20 mx-auto mb-5">
                                <span className="material-icons text-green-500" style={{ fontSize: '50px' }}>check_circle</span>
                            </div>

                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Ticket Successfully Created!</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-7">Our admin team will contact you shortly.</p>

                            {/* Ticket ID + Copy */}
                            <div className="inline-flex flex-col items-center gap-2 mb-8">
                                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Your Ticket ID</p>
                                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                    <span className="text-2xl font-mono font-bold text-primary tracking-widest">{ticketId}</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(ticketId);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        title="Copy Ticket ID"
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            {copied ? 'check' : 'content_copy'}
                                        </span>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 dark:text-slate-500">Save this ID to check your ticket status.</p>
                            </div>

                            {/* Close button */}
                            <button
                                type="button"
                                onClick={() => {
                                    setStatus('idle');
                                    setTicketId(null);
                                    setCopied(false);
                                }}
                                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                                title="Close"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Ticket Form (always visible) ── */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="fullName">Full Name <span className="text-red-500">*</span></label>
                            <input
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                id="fullName"
                                name="fullName"
                                placeholder="John Doe"
                                type="text"
                                required
                                value={formData.fullName}
                                onChange={handleChange}
                            />
                        </div>
                        {/* Mobile Number */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="mobile">Mobile Number <span className="text-red-500">*</span></label>
                            <input
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                id="mobile"
                                name="mobile"
                                placeholder="+91 98765 43210"
                                type="tel"
                                required
                                pattern="[0-9]{10}"
                                maxLength={10}
                                title="Please enter exactly 10 digits"
                                value={formData.mobile}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Department */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="department">Department <span className="text-red-500">*</span></label>
                            <select
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                id="department"
                                name="department"
                                required
                                value={formData.department}
                                onChange={handleChange}
                                disabled={departmentsLoading || !formData.supportType}
                            >
                                <option value="">{departmentsLoading ? 'Loading Departments...' : 'Select a department'}</option>
                                {departments
                                    .filter(d => d.support_type.includes(formData.supportType))
                                    .map(d => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                            </select>
                        </div>
                        {/* Issue Category */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="category">Category <span className="text-red-500">*</span></label>
                            <select
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                id="category"
                                name="category"
                                required
                                value={formData.category}
                                onChange={handleChange}
                                disabled={categoriesLoading || !formData.supportType}
                            >
                                <option value="">{categoriesLoading ? 'Loading Categories...' : 'Select a category'}</option>
                                {categories
                                    .filter(c => c.support_type.includes(formData.supportType))
                                    .map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sub Category - Material Request Only */}
                        {formData.category === 'Material request' && (
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="subCategory">Sub Category <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                    id="subCategory"
                                    name="subCategory"
                                    required
                                    value={formData.subCategory}
                                    onChange={handleChange}
                                >
                                    <option value="">Select type</option>
                                    <option value="New request">New request</option>
                                    <option value="Replacement">Replacement</option>
                                    <option value="Broken/Lost">Broken/Lost</option>
                                    <option value="Temporary request">Temporary request</option>
                                </select>
                            </div>
                        )}
                        {/* Mode — hidden for Material Request */}
                        {formData.category !== 'Material request' && (
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="mode">Mode <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                    id="mode"
                                    name="mode"
                                    required
                                    value={formData.mode}
                                    onChange={handleChange}
                                >
                                    <option value="">Select mode</option>
                                    {formData.category !== 'Printer issues' && (
                                        <option value="Remote">Remote Support</option>
                                    )}
                                    <option value="User End Support">User End Support</option>
                                </select>

                            </div>
                        )}
                    </div>
                    {/* Description */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="description">Description</label>
                        <textarea
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            id="description"
                            name="description"
                            placeholder="Please provide as much detail as possible... (Optional)"
                            rows="5"
                            value={formData.description}
                            onChange={handleChange}
                        ></textarea>
                    </div>

                    {/* Attachments */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Attachments (Images only) - Optional</label>
                        <div className={`mt-1 flex justify-center px-6 pt-7 pb-8 border-2 ${attachmentError ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'} border-dashed rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group relative`}>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept=".jpg,.jpeg,.png"
                                onChange={(e) => {
                                    const file = e.target.files && e.target.files[0];
                                    if (file) {
                                        if (file.size > 200 * 1024) {
                                            setAttachmentError('File size is larger than 200KB limit.');
                                            setAttachment(null);
                                            e.target.value = '';
                                        } else {
                                            setAttachmentError('');
                                            setAttachment(file);
                                        }
                                    } else {
                                        setAttachmentError('');
                                        setAttachment(null);
                                    }
                                }}
                            />
                            <div className="space-y-2 text-center">
                                <span className="material-icons text-primary text-4xl group-hover:scale-110 transition-transform">cloud_upload</span>
                                <div className="flex text-sm text-slate-600 dark:text-slate-400 justify-center">
                                    <span className="relative font-medium text-primary hover:text-primary/80 focus-within:outline-none">
                                        {attachment ? attachment.name : 'Click to upload'}
                                    </span>
                                    {!attachment && <p className="pl-1 text-slate-500">or drag and drop</p>}
                                </div>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    PNG, JPG up to 200KB
                                </p>
                            </div>
                        </div>
                        {attachmentError && (
                            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">error</span>
                                {attachmentError}
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 space-y-3">
                        <button
                            className="w-full flex justify-center items-center gap-2 py-4 px-6 border border-transparent rounded-lg shadow-lg text-lg font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                            type="submit"
                            disabled={status === 'submitting' || !!attachmentError}
                        >
                            {status === 'submitting' ? 'Submitting...' : 'Submit Ticket'}
                            {!status === 'submitting' && <span className="material-icons text-xl">send</span>}
                        </button>

                        <Link
                            to="/"
                            onClick={() => window.location.reload()}
                            className="w-full flex justify-center items-center gap-2 py-4 px-6 border border-slate-300 dark:border-slate-700 rounded-lg text-lg font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer group"
                        >
                            <span className="material-symbols-outlined text-xl transition-transform group-hover:-translate-x-1">arrow_back</span>
                            Back to Home
                        </Link>
                    </div>
                    {status === 'error' && (
                        <div className="text-red-500 text-sm text-center mt-2">
                            Something went wrong. Please try again.
                        </div>
                    )}
                </form>
            </div>
            {/* Footer Info within Card */}
            <div className="bg-slate-50 dark:bg-slate-800/80 px-8 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="material-icons text-sm">lock</span>
                    Your data is securely encrypted
                </div>
                <div className="flex items-center gap-4 text-sm font-medium text-primary">
                    <a className="hover:underline" href="#">Privacy Policy</a>
                    <a className="hover:underline" href="#">Help Center</a>
                </div>
            </div>
        </div>
    );
};

export default TicketForm;
