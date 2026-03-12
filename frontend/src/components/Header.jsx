import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logoImage from '../assets/logo.png';
import logoDarkImage from '../assets/logo1.png';

const Header = () => {
    const [dark, setDark] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (dark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [dark]);

    return (
        <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center">
                        <img src={logoImage} alt="Logo" className="h-10 object-contain dark:hidden" />
                        <img src={logoDarkImage} alt="Logo" className="h-10 object-contain hidden dark:block" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {/* Dark / Light toggle */}
                        <button
                            onClick={() => setDark(d => !d)}
                            aria-label="Toggle dark mode"
                            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <span className="material-icons text-[20px]">
                                {dark ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
