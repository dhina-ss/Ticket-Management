import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

/**
 * Compress an image File using a canvas element.
 * Downscales to max 1024px on the longest side and exports as JPEG at 0.75 quality.
 * Returns a Promise that resolves with the compressed base64 data URL.
 */
const compressImage = (file) =>
    new Promise((resolve, reject) => {
        const MAX_PX = 1024;
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (evt) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                let { width, height } = img;
                if (width > MAX_PX || height > MAX_PX) {
                    if (width >= height) {
                        height = Math.round((height * MAX_PX) / width);
                        width = MAX_PX;
                    } else {
                        width = Math.round((width * MAX_PX) / height);
                        height = MAX_PX;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });

const AssetDetails = () => {
    const { assetId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [activeImage, setActiveImage] = useState(null);
    const [departments, setDepartments] = useState([]);

    // Prevent background scrolling when modal or lightbox is open
    useEffect(() => {
        if (showEditModal || activeImage) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showEditModal, activeImage]);

    // Close lightbox on ESC key press & handle arrow navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setActiveImage(null);
            } else if (e.key === 'ArrowLeft' && asset?.images?.length > 1) {
                const idx = asset.images.indexOf(activeImage);
                if (idx !== -1) {
                    setActiveImage(asset.images[idx === 0 ? asset.images.length - 1 : idx - 1]);
                }
            } else if (e.key === 'ArrowRight' && asset?.images?.length > 1) {
                const idx = asset.images.indexOf(activeImage);
                if (idx !== -1) {
                    setActiveImage(asset.images[idx === asset.images.length - 1 ? 0 : idx + 1]);
                }
            }
        };
        if (activeImage) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeImage, asset]);

    const handlePrevImage = (e) => {
        e.stopPropagation();
        if (asset?.images) {
            const idx = asset.images.indexOf(activeImage);
            if (idx !== -1) {
                setActiveImage(asset.images[idx === 0 ? asset.images.length - 1 : idx - 1]);
            }
        }
    };

    const handleNextImage = (e) => {
        e.stopPropagation();
        if (asset?.images) {
            const idx = asset.images.indexOf(activeImage);
            if (idx !== -1) {
                setActiveImage(asset.images[idx === asset.images.length - 1 ? 0 : idx + 1]);
            }
        }
    };

    // Edit form state
    const [editForm, setEditForm] = useState({
        category: '',
        brand: '',
        model: '',
        configuration: '',
        serial: '',
        assignee: '',
        empCode: '',
        cug: '',
        email: '',
        group: 'IT',
        department: '',
        branch: '',
        purchaseDate: '',
        warranty: '',
        condition: 'Good',
        remarks: '',
        images: []
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const photosInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [showSourceModal, setShowSourceModal] = useState(false);

    const handleUploadContainerClick = () => {
        if ((editForm.images || []).length >= 2) return;
        if (window.innerWidth < 640) {
            setShowSourceModal(true);
        }
    };

    const CATEGORY_OPTIONS = ['Monitor', 'Laptop', 'CPU', 'Server', 'Printer', 'Mobile'];
    const BRANCH_OPTIONS = [
        'Cotton Concepts HO_ Coimbatore',
        'Doctor Towels HO',
        'Cotton Concepts_ Vengamedu',
        'Cotton Concepts_ Karur',
        'Doctor Towels_ Karur'
    ];
    const DEPARTMENT_OPTIONS = ['IT', 'HR', 'Finance', 'Sales', 'Production', 'Logistics'];
    const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

    // Category casing normalization
    const normalizeCategory = (cat) => {
        const trimmed = (cat || '').trim();
        if (!trimmed) return '';
        const lower = trimmed.toLowerCase();
        if (lower === 'ups' || lower === 'cpu' || lower === 'nas' || lower === 'it') {
            return trimmed.toUpperCase();
        }
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    };

    const fetchAsset = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get(`/api/assets/${assetId}`);
            setAsset(response.data);
            setEditForm({
                category: response.data.category || '',
                brand: response.data.brand || '',
                model: response.data.model || '',
                configuration: response.data.configuration || '',
                serial: response.data.serial || '',
                assignee: response.data.assignee || 'Unassigned',
                empCode: response.data.empCode || '',
                cug: response.data.cug || '',
                email: response.data.email || '',
                group: response.data.group || 'IT',
                department: response.data.department || '',
                branch: response.data.branch || '',
                purchaseDate: response.data.purchaseDate || '',
                warranty: response.data.warranty || '',
                condition: response.data.condition || 'Good',
                remarks: response.data.remarks || '',
                images: response.data.images || []
            });
        } catch (err) {
            console.error("Error fetching asset details:", err);
            setError(err.response?.data?.error || 'Asset not found or failed to load details.');
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const response = await api.get('/api/departments');
            setDepartments(response.data);
        } catch (err) {
            console.error("Failed to fetch departments:", err);
        }
    };

    useEffect(() => {
        fetchAsset();
        fetchDepartments();
    }, [assetId]);

    // Handle auto-edit trigger if redirected back after login with ?edit=true
    useEffect(() => {
        if (asset) {
            const urlParams = new URLSearchParams(location.search);
            if (urlParams.get('edit') === 'true') {
                if (isAuthenticated) {
                    setShowEditModal(true);
                }
                // Strip the ?edit=true parameter from URL quietly
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
    }, [asset, isAuthenticated, location.search]);

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (photosInputRef.current) photosInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (files.length === 0) return;
        if (files.length + (editForm.images || []).length > 2) {
            alert("Maximum 2 images allowed.");
            return;
        }
        // Compress images sequentially to avoid concurrent state race conditions
        const compressed = [];
        for (const file of files) {
            try {
                const dataUrl = await compressImage(file);
                compressed.push(dataUrl);
            } catch (err) {
                console.error('Image compression failed:', err);
            }
        }
        if (compressed.length > 0) {
            setEditForm(prev => ({
                ...prev,
                images: [...(prev.images || []), ...compressed]
            }));
        }
    };

    const handleRemoveImage = (index) => {
        setEditForm(prev => ({
            ...prev,
            images: (prev.images || []).filter((_, idx) => idx !== index)
        }));
    };

    const handleEditClick = () => {
        if (!isAuthenticated) {
            // Redirect to login page and preserve target page state with ?edit=true query param
            navigate('/login', {
                state: {
                    from: {
                        pathname: `/asset/${assetId}`,
                        search: '?edit=true'
                    }
                }
            });
            return;
        }
        setShowEditModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveError('');

        // Programmatic validation to bypass hidden HTML5 bubble validation bugs on mobile
        if (!editForm.category || !editForm.category.trim()) {
            setSaveError('Asset Type is a required field.');
            setSaving(false);
            return;
        }
        if (!editForm.brand || !editForm.brand.trim()) {
            setSaveError('Brand is a required field.');
            setSaving(false);
            return;
        }
        if (!editForm.model || !editForm.model.trim()) {
            setSaveError('Model is a required field.');
            setSaving(false);
            return;
        }
        if (!editForm.assignee || !editForm.assignee.trim()) {
            setSaveError('Assignee Name is a required field.');
            setSaving(false);
            return;
        }
        if (!editForm.empCode || !editForm.empCode.trim()) {
            setSaveError('Employee Code is a required field.');
            setSaving(false);
            return;
        }
        if (!editForm.branch || !editForm.branch.trim()) {
            setSaveError('Branch Location is a required field.');
            setSaving(false);
            return;
        }
        if (!editForm.condition || !editForm.condition.trim()) {
            setSaveError('Physical Condition is a required field.');
            setSaving(false);
            return;
        }
        if (!editForm.group || !editForm.group.trim()) {
            setSaveError('Group is a required field.');
            setSaving(false);
            return;
        }

        try {
            await api.put(`/api/assets/${asset.id}`, editForm);
            await fetchAsset();
            setShowEditModal(false);
        } catch (err) {
            console.error("Error updating asset details:", err);
            setSaveError(err.response?.data?.error || 'Failed to update asset details.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] py-12">
                <div className="relative flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                    <span className="material-symbols-outlined text-[28px] text-emerald-500 absolute">inventory_2</span>
                </div>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium animate-pulse">Loading asset details...</p>
            </div>
        );
    }

    if (error || !asset) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[65vh] p-6 text-center">
                <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-4 border border-red-100 dark:border-red-900/30">
                    <span className="material-symbols-outlined text-[32px]">warning</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Asset Details Unavailable</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md">{error || 'This asset could not be found or you may have scanned an invalid code.'}</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                    <span className="material-symbols-outlined text-lg">home</span>
                    Go to Home
                </button>
            </div>
        );
    }

    return (
        <main className="w-full max-w-xl mx-auto px-0 sm:px-6 py-6 sm:py-12 space-y-6 sm:space-y-8 flex-1">
            {/* Header / Brand Banner */}
            <div className="flex flex-col justify-between items-start gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 px-4 sm:px-0">
                <div className="flex items-center gap-3 sm:gap-3.5">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-sm border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">inventory_2</span>
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white font-display leading-tight">Asset Information</h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-primary/10 text-primary">
                                {normalizeCategory(asset.category)}
                            </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5 sm:mt-1">ID: {asset.assetId}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full">
                    {isAuthenticated && (
                        <button
                            onClick={handleEditClick}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-primary/10 active:scale-[0.98] cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-sm sm:text-base">edit</span>
                            Edit Details
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/')}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm sm:text-base">home</span>
                        Home
                    </button>
                </div>
            </div>

            {/* Content Cards */}
            <div className="grid grid-cols-1 gap-6 sm:gap-8">
                {/* QR and Sticker Card */}
                <div className={`flex-col items-center ${isAuthenticated ? 'hidden sm:flex' : 'flex'}`}>
                    <div className="w-full max-w-[200px] sm:max-w-[280px] bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-center flex flex-col items-center">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Official Asset Tag</h3>
                        <div className="relative border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden shadow-inner p-2 bg-slate-50 dark:bg-slate-950 flex items-center justify-center min-h-[120px] sm:min-h-[160px] w-full">
                            {asset.qrCode ? (
                                <img
                                    src={asset.qrCode.startsWith('data:image') ? asset.qrCode : `${import.meta.env.VITE_API_URL || ''}${asset.qrCode}`}
                                    alt="Asset QR Label"
                                    className="w-full h-auto object-contain max-h-[110px] sm:max-h-[150px] rounded"
                                />
                            ) : (
                                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700">qr_code_2</span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-4 leading-normal italic">
                            (Please scan this label at any time to verify real-time configuration and assignment)
                        </p>
                    </div>
                </div>

                {/* Specification Table */}
                <div className="bg-white dark:bg-slate-900 border-y sm:border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-100/40 dark:shadow-none rounded-none sm:rounded-3xl p-4 sm:p-8 space-y-6 sm:space-y-8">
                    {/* General Specs */}
                    <div>
                        <h2 className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Specifications</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Brand</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.brand || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Model</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.model || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5 sm:col-span-2">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Serial Number</span>
                                <span className="text-slate-800 dark:text-slate-200 font-mono font-bold select-all break-all">{asset.serial || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Condition</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold uppercase">{asset.condition || '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Configuration / Description — plain row like Serial Number */}
                    {asset.configuration && (
                        <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5 text-sm">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">Configuration</span>
                            <span className="text-slate-800 dark:text-slate-200 font-bold font-mono break-all whitespace-pre-wrap">{asset.configuration}</span>
                        </div>
                    )}

                    {/* Assignment details */}
                    <div>
                        <h2 className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Assignment & Location</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Assignee</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold break-words">{asset.assignee || 'Unassigned'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Employee Code</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.empCode || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Department</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.department || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Branch Location</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold break-words">{asset.branch || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">CUG (SIM Number)</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold break-words">{asset.cug || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Email Address</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold break-words break-all">{asset.email || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Group</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.group || 'IT'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Purchase & Warranty details */}
                    <div>
                        <h2 className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Purchase & Warranty</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5 sm:col-span-2">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Purchase Date</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.purchaseDate || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Warranty Duration</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.warrantyLabel || asset.warranty || '—'}</span>
                            </div>
                            <div className="flex flex-col xs:flex-row xs:justify-between gap-1 border-b border-slate-50 dark:border-slate-850 pb-2.5 col-span-1">
                                <span className="text-slate-400 dark:text-slate-500 font-medium">Warranty Expiry Date</span>
                                <span className="text-slate-800 dark:text-slate-200 font-bold">{asset.warrantyDate || '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Remarks box */}
                    {asset.remarks && (
                        <div>
                            <h2 className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Remarks</h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic break-words">"{asset.remarks}"</p>
                        </div>
                    )}

                    {/* Device Images Section — Visible on all viewports */}
                    {asset.images && asset.images.length > 0 && (
                        <div className="block border-t border-slate-100 dark:border-slate-800 pt-6">
                            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pb-2 mb-4">Device Images</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {asset.images.map((img, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setActiveImage(img)}
                                        className="relative aspect-video rounded-2xl overflow-hidden border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer shadow-sm group/thumb"
                                    >
                                        <img 
                                            src={img.startsWith('data:image') ? img : `${import.meta.env.VITE_API_URL || ''}${img}`} 
                                            alt={`Device photo ${idx + 1}`} 
                                            className="w-full h-full object-cover" 
                                        />
                                        <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-slate-900/60 backdrop-blur-md border border-slate-800/80 flex items-center justify-center text-white/90 shadow sm:opacity-0 sm:group-hover/thumb:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* EDIT ASSET DETAILS MODAL (Requires admin session) */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-3.5 sm:pb-4 px-5 sm:px-8 pt-5 sm:pt-8 shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg font-display">Edit Asset Details</h3>
                                <p className="text-[10px] sm:text-xs text-slate-400 font-mono mt-0.5">Asset ID: {asset.assetId}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer">
                                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4 sm:space-y-5 overflow-y-auto flex-1 px-5 sm:px-8 pb-5 sm:pb-8">
                            {saveError && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs sm:text-sm text-center font-medium">
                                    {saveError}
                                </div>
                            )}
                            {/* Row 1: Category + Brand */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Asset Type <span className="text-red-500">*</span></label>
                                    <select
                                        value={editForm.category}
                                        onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-semibold appearance-none cursor-pointer"
                                    >
                                        {CATEGORY_OPTIONS.map((cat, idx) => (
                                            <option key={idx} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Brand <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editForm.brand}
                                        onChange={e => setEditForm(p => ({ ...p, brand: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                        placeholder="e.g. Apple"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Model + Serial */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Model <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editForm.model}
                                        onChange={e => setEditForm(p => ({ ...p, model: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                        placeholder="e.g. MacBook Pro"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Serial Number</label>
                                    <input
                                        type="text"
                                        value={editForm.serial}
                                        onChange={e => setEditForm(p => ({ ...p, serial: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium font-mono"
                                        placeholder="Serial Number"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Configuration (Full Width) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Configuration / Description</label>
                                <textarea
                                    value={editForm.configuration}
                                    onChange={e => setEditForm(p => ({ ...p, configuration: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium font-mono min-h-[80px]"
                                    placeholder="e.g. 16GB RAM, 512GB SSD, M3 Chip"
                                />
                            </div>

                            {/* Row 4: Assignee + Emp Code */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Assignee Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editForm.assignee}
                                        onChange={e => setEditForm(p => ({ ...p, assignee: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Employee Code <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editForm.empCode}
                                        onChange={e => setEditForm(p => ({ ...p, empCode: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                        placeholder="e.g. EMP123"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Email Address</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                        placeholder="e.g. user@company.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Group <span className="text-red-500">*</span></label>
                                    <select
                                        value={editForm.group}
                                        onChange={e => setEditForm(p => ({ ...p, group: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-semibold appearance-none cursor-pointer"
                                    >
                                        <option value="IT">IT</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 4.5: CUG + Department */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">CUG (SIM Number)</label>
                                    <input
                                        type="text"
                                        value={editForm.cug}
                                        onChange={e => setEditForm(p => ({ ...p, cug: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                        placeholder="e.g. +91 98765 43210"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Department</label>
                                    <select
                                        value={editForm.department}
                                        onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-semibold appearance-none cursor-pointer"
                                    >
                                        {(departments && departments.length > 0 ? departments.map(d => d.name) : DEPARTMENT_OPTIONS).map((dept, idx) => (
                                            <option key={idx} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Row 5: Branch */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Branch Location <span className="text-red-500">*</span></label>
                                <select
                                    value={editForm.branch}
                                    onChange={e => setEditForm(p => ({ ...p, branch: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-semibold appearance-none cursor-pointer"
                                >
                                    {BRANCH_OPTIONS.map((br, idx) => (
                                        <option key={idx} value={br}>{br}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Row 6: Purchase Date + Warranty Duration */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Purchase Date</label>
                                    <input
                                        type="date"
                                        value={editForm.purchaseDate}
                                        onChange={e => setEditForm(p => ({ ...p, purchaseDate: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Warranty</label>
                                    <input
                                        type="text"
                                        value={editForm.warranty}
                                        onChange={e => setEditForm(p => ({ ...p, warranty: e.target.value }))}
                                        placeholder="e.g. 1 Year, 6 Months, or YYYY-MM-DD"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium"
                                    />
                                </div>
                            </div>

                            {/* Row 7: Condition */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Physical Condition <span className="text-red-500">*</span></label>
                                <select
                                    value={editForm.condition}
                                    onChange={e => setEditForm(p => ({ ...p, condition: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-semibold appearance-none cursor-pointer"
                                >
                                    {CONDITION_OPTIONS.map((cond, idx) => (
                                        <option key={idx} value={cond}>{cond}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Row 8: Remarks */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Remarks</label>
                                <textarea
                                    value={editForm.remarks}
                                    onChange={e => setEditForm(p => ({ ...p, remarks: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-white font-medium min-h-[60px]"
                                    placeholder="Remarks or warnings..."
                                />
                            </div>

                            {/* Row 9: Image Upload */}
                            <div className="flex flex-col gap-3">
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-display">Asset Photos <span className="font-normal normal-case tracking-normal text-slate-400">(max 2)</span></label>
                                <div 
                                    onClick={handleUploadContainerClick}
                                    className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 relative group min-h-[140px] cursor-pointer"
                                >
                                    <input
                                        type="file"
                                        ref={photosInputRef}
                                        multiple
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none sm:pointer-events-auto sm:cursor-pointer z-10"
                                        disabled={(editForm.images || []).length >= 2}
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
                                {(editForm.images || []).length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                        {editForm.images.map((img, idx) => (
                                            <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group bg-slate-100 dark:bg-slate-900">
                                                <img src={img.startsWith('data:image') ? img : `${import.meta.env.VITE_API_URL || ''}${img}`} alt={`Asset preview ${idx + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(idx)}
                                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600/80 text-white flex items-center justify-center transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 shadow z-20 cursor-pointer"
                                                    title="Remove"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex flex-col-reverse lg:flex-row lg:justify-end gap-3.5 border-t border-slate-100 dark:border-slate-800 pt-6 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="w-full lg:w-auto px-5 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full lg:w-auto px-6 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 disabled:opacity-60 transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {saving && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
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
                                className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all active:scale-[0.98] cursor-pointer"
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
                                className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all active:scale-[0.98] cursor-pointer"
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
                    {asset?.images?.length > 1 && (
                        <button 
                            onClick={handlePrevImage}
                            className="absolute left-4 sm:left-6 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-800/80 text-white/90 hover:text-white flex items-center justify-center transition-all border border-slate-800 cursor-pointer shadow-lg z-[310] active:scale-95"
                            title="Previous Image"
                        >
                            <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                        </button>
                    )}

                    {/* Right Navigation Arrow */}
                    {asset?.images?.length > 1 && (
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
                            src={activeImage.startsWith('data:image') ? activeImage : `${import.meta.env.VITE_API_URL || ''}${activeImage}`} 
                            alt="Device Photo Fullscreen" 
                            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-900/50 animate-in zoom-in-95 duration-200"
                        />
                        {asset?.images?.length > 1 && (
                            <span className="px-3 py-1.5 rounded-full bg-slate-900/60 text-[11px] font-bold text-slate-300 border border-slate-800 tracking-wider">
                                {asset.images.indexOf(activeImage) + 1} / {asset.images.length}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
};

export default AssetDetails;
