import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ccLogo from '../assets/cc.png';
import dtLogo from '../assets/dt.png';
import logoImage from '../assets/logo.png';
import logoDarkImage from '../assets/logo1.png';

const INITIAL_CARDS = [
  {
	id: 'tickets',
	name: 'Tickets',
	icon: 'confirmation_number',
	iconBgColor: 'bg-[#E0F2FE]',
	iconTextColor: 'text-[#0080FF]',
	borderColor: 'border-[#0080FF]/15 dark:border-[#0080FF]/25',
	hoverBorderColor: 'hover:border-[#0080FF]',
	bgGradient: 'bg-gradient-to-br from-[#0080FF]/5 dark:from-[#0080FF]/10 to-transparent dark:to-transparent',
	description: 'View and manage support tickets',
	group: 'actions',
	starred: false,
	added: false,
  },
  {
	id: 'assets',
	name: 'Assets',
	icon: 'inventory_2',
	iconBgColor: 'bg-[#ECFDF5]',
	iconTextColor: 'text-[#059669]',
	borderColor: 'border-[#059669]/15 dark:border-[#059669]/25',
	hoverBorderColor: 'hover:border-[#059669]',
	bgGradient: 'bg-gradient-to-br from-[#059669]/5 dark:from-[#059669]/10 to-transparent dark:to-transparent',
	description: 'Track and assign company assets',
	group: 'actions',
	starred: false,
	added: false,
  },
  {
	id: 'petty-cash',
	name: 'Petty Cash',
	icon: 'payments',
	iconBgColor: 'bg-[#FFF7ED]',
	iconTextColor: 'text-[#F59E0B]',
	borderColor: 'border-[#F59E0B]/15 dark:border-[#F59E0B]/25',
	hoverBorderColor: 'hover:border-[#F59E0B]',
	bgGradient: 'bg-gradient-to-br from-[#F59E0B]/5 dark:from-[#F59E0B]/10 to-transparent dark:to-transparent',
	description: 'Manage daily cash expenses',
	group: 'actions',
	starred: false,
	added: false,
  },
  {
	id: 'courier',
	name: 'Courier',
	icon: 'local_shipping',
	iconBgColor: 'bg-[#FDF2F8]',
	iconTextColor: 'text-[#DB2777]',
	borderColor: 'border-[#DB2777]/15 dark:border-[#DB2777]/25',
	hoverBorderColor: 'hover:border-[#DB2777]',
	bgGradient: 'bg-gradient-to-br from-[#DB2777]/5 dark:from-[#DB2777]/10 to-transparent dark:to-transparent',
	description: 'Track incoming and outgoing shipments',
	group: 'actions',
	starred: false,
	added: false,
  },
  {
	id: 'users',
	name: 'Users',
	icon: 'group',
	iconBgColor: 'bg-[#F5F3FF]',
	iconTextColor: 'text-[#7C3AED]',
	borderColor: 'border-[#7C3AED]/15 dark:border-[#7C3AED]/25',
	hoverBorderColor: 'hover:border-[#7C3AED]',
	bgGradient: 'bg-gradient-to-br from-[#7C3AED]/5 dark:from-[#7C3AED]/10 to-transparent dark:to-transparent',
	description: 'Manage user profiles and roles',
	group: 'actions',
	starred: false,
	added: false,
  },
  {
	id: 'settings',
	name: 'Settings',
	icon: 'settings',
	iconBgColor: 'bg-[#F8FAFC]',
	iconTextColor: 'text-[#0F172A]',
	borderColor: 'border-slate-200 dark:border-slate-800',
	hoverBorderColor: 'hover:border-[#0F172A] dark:hover:border-white',
	bgGradient: 'bg-gradient-to-br from-slate-500/5 dark:from-slate-500/10 to-transparent dark:to-transparent',
	description: 'Configure application settings',
	group: 'actions',
	starred: false,
	added: false,
  }
];

// All dashboard cards require authentication
const PROTECTED_CARD_IDS = new Set(['tickets', 'assets', 'users', 'settings', 'courier', 'petty-cash']);

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const [showAssetChoiceModal, setShowAssetChoiceModal] = useState(false);

  // User profile popup state
  const [showUserPopup, setShowUserPopup] = useState(false);
  const userPopupRef = useRef(null);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
	const saved = localStorage.getItem('darkMode');
	return saved ? saved === 'true' : false;
  });

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

  useEffect(() => {
	const handleOutsideClick = (e) => {
	  if (userPopupRef.current && !userPopupRef.current.contains(e.target)) {
		setShowUserPopup(false);
	  }
	};
	document.addEventListener('mousedown', handleOutsideClick);
	return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isCardAllowed = (cardId) => {
	if (!user) return false;
	
	// Admin gets full access to all cards
	if (user.email === 'admin@support.com') {
	  return true;
	}
	
	// Non-admin users cannot access Users or Settings
	if (cardId === 'users' || cardId === 'settings') {
	  return false;
	}
	
	const allowedMenus = (user.allowed_menus || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
	
	if (cardId === 'tickets') {
	  return allowedMenus.includes('tickets');
	}
	if (cardId === 'assets') {
	  return allowedMenus.includes('it assets') || allowedMenus.includes('admin assets');
	}
	if (cardId === 'petty-cash') {
	  return allowedMenus.includes('petty cash');
	}
	if (cardId === 'courier') {
	  return allowedMenus.includes('courier');
	}
	
	return false;
  };

  const isSuperAdmin = user?.email === 'admin@support.com';
  const allowedMenus = (user?.allowed_menus || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const hasItAssetsPermission = isSuperAdmin || allowedMenus.includes('it assets');
  const hasAdminAssetsPermission = isSuperAdmin || allowedMenus.includes('admin assets');

  const handleCardClick = (id) => {
	if (id === 'assets') {
	  if (hasItAssetsPermission && hasAdminAssetsPermission) {
		setShowAssetChoiceModal(true);
	  } else if (hasItAssetsPermission) {
		navigate('/assets');
	  } else if (hasAdminAssetsPermission) {
		navigate('/admin-assets');
	  }
	  return;
	}
	const destination = '/' + id;
	if (PROTECTED_CARD_IDS.has(id) && !isAuthenticated) {
	  navigate('/');
	} else {
	  // Check allowed menus
	  if (user && user.email !== 'admin@support.com') {
		if (id === 'users' || id === 'settings') {
		  navigate('/');
		  return;
		}
		const mapping = {
		  'tickets': 'tickets',
		  'petty-cash': 'petty cash',
		  'courier': 'courier'
		};
		const required = mapping[id];
		if (required && !allowedMenus.includes(required)) {
		  navigate('/');
		  return;
		}
	  }
	  navigate(destination);
	}
  };

  const handleChoice = (destination) => {
	setShowAssetChoiceModal(false);
	if (!isAuthenticated) {
	  navigate('/');
	} else {
	  // Check allowed menus
	  if (user && user.email !== 'admin@support.com') {
		const requiredMenu = destination === '/admin-assets' ? 'admin assets' : 'it assets';
		if (!allowedMenus.includes(requiredMenu)) {
		  navigate('/');
		  return;
		}
	  }
	  navigate(destination);
	}
  };

  return (
	<div className="bg-[#F8FAFC] dark:bg-[#181D27] text-slate-800 dark:text-slate-100 min-h-screen font-sans transition-colors duration-200 selection:bg-db-primary-container selection:text-db-on-primary-container">
	  <style>{`
		.integration-card-shadow {
		  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.04);
		  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		}
		.integration-card-shadow:hover {
		  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.08);
		  transform: translateY(-6px) scale(1.02);
		}
	  `}</style>

	  {/* TopNavBar */}
	  <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm flex justify-between items-center w-full px-margin-desktop py-4 h-20">
		<div className="flex items-center gap-xl">
		  <img src={logoImage} alt="Logo" className="h-15 object-contain dark:hidden" />
		  <img src={logoDarkImage} alt="Logo" className="h-15 object-contain hidden dark:block" />
		</div>

		{/* Profile Dropdown Container */}
		<div className="relative flex items-center" ref={userPopupRef}>
		  <button
			onClick={() => setShowUserPopup(prev => !prev)}
			aria-label="User profile"
			className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#ec1d22] to-[#780003] text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer select-none shrink-0"
		  >
			{user?.name ? user.name.charAt(0).toUpperCase() : (
			  <span className="material-symbols-outlined text-[18px]">person</span>
			)}
		  </button>

		  {showUserPopup && (
			<div className="absolute right-4 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[300] overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right text-left">
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
				  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer border-none bg-transparent"
				>
				  <span className="material-symbols-outlined text-[18px]">logout</span>
				  Sign Out
				</button>
			  </div>
			</div>
		  )}
		</div>
	  </header>

	  {/* Main Content Canvas */}
	  <main className="pl-margin-desktop p-20 pt-28">
		{/* Welcome Banner */}
		<div className="mb-10 p-8 rounded-[32px] bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/10 dark:border-slate-800 shadow-sm relative overflow-hidden">
		  <div className="relative z-10">
			<h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-2">Welcome back {user?.name || 'User'}</h1>
		  </div>
		</div>

		<section>
		  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
			{INITIAL_CARDS.filter(card => isCardAllowed(card.id)).map((card) => (
			  <div
				key={card.id}
				onClick={() => handleCardClick(card.id)}
				className={`group relative bg-white dark:bg-slate-900 ${card.bgGradient} p-[2rem] rounded-[32px] integration-card-shadow border ${card.borderColor} transition-all duration-300 cursor-pointer ${card.hoverBorderColor}`}
			  >
				<div className="flex flex-col items-center text-center p-md">
				  <div className={`w-20 h-20 rounded-3xl ${card.iconBgColor} flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform duration-200`}>
					<span className={`material-symbols-outlined ${card.iconTextColor} text-4xl`} style={{ fontVariationSettings: "'wght' 600" }}>
					  {card.icon}
					</span>
				  </div>
				  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{card.name}</h3>
				  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 max-w-[220px]">{card.description}</p>
				</div>
			  </div>
			))}
		  </div>
		</section>
	  </main>

	  {showAssetChoiceModal && (
		<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
		  <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl max-w-md w-full relative animate-in zoom-in-95 duration-200">
			{/* Close Button */}
			<button
			  onClick={() => setShowAssetChoiceModal(false)}
			  className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
			>
			  <span className="material-symbols-outlined text-[24px]">close</span>
			</button>

			<h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 pr-8 font-sans">Select Asset Group</h3>
			<p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-sans">
			  Which category of company assets would you like to view?
			</p>

			<div className="flex flex-col gap-4">
			  {hasItAssetsPermission && (
				<button
				  onClick={() => handleChoice('/assets')}
				  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition-all text-left group cursor-pointer"
				>
				  <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center shrink-0">
					<span className="material-symbols-outlined text-2xl">laptop_mac</span>
				  </div>
				  <div>
					<h4 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors text-sm">IT Assets</h4>
					<p className="text-xs text-slate-500/80 dark:text-slate-400/80 mt-0.5 leading-relaxed">Laptops, mouse, keyboards, ups, printer, cctv, etc.</p>
				  </div>
				</button>
			  )}

			  {hasAdminAssetsPermission && (
				<button
				  onClick={() => handleChoice('/admin-assets')}
				  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 transition-all text-left group cursor-pointer"
				>
				  <div className="w-12 h-12 rounded-xl bg-[#E0E7FF] text-[#4F46E5] flex items-center justify-center shrink-0">
					<span className="material-symbols-outlined text-2xl">corporate_fare</span>
				  </div>
				  <div>
					<h4 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors text-sm">Admin Assets</h4>
					<p className="text-xs text-slate-500/80 dark:text-slate-400/80 mt-0.5 leading-relaxed">Furniture, tables, chairs, fans, electrical items, etc.</p>
				  </div>
				</button>
			  )}
			</div>
		  </div>
		</div>
	  )}
	</div>
  );
};

export default Dashboard;
