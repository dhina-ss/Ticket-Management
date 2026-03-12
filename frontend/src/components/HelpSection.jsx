import React from 'react';

const HelpSection = () => {
    return (
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:shadow-md">
                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                    <span className="material-icons">menu_book</span>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Knowledge Base</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Browse our guides and tutorials.</p>
                </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:shadow-md">
                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                    <span className="material-icons">chat</span>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Live Chat</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Talk to an agent in real-time.</p>
                </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:shadow-md">
                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                    <span className="material-icons">forum</span>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">Community</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Get help from other users.</p>
                </div>
            </div>
        </div>
    );
};

export default HelpSection;
