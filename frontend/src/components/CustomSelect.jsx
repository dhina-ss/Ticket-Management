import React, { useState, useRef, useEffect } from 'react';

const CustomSelect = ({
    options = [],
    value = '',
    onChange,
    placeholder = 'Select an option',
    disabled = false,
    error = false,
    direction = 'down',
    maxHeight = 'max-h-60',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDisplayLabel = () => {
        if (!value) return placeholder;
        const found = options.find(opt => {
            if (typeof opt === 'object' && opt !== null) {
                return (opt.value ?? opt.id ?? opt.name) === value;
            }
            return opt === value;
        });
        if (!found) return value;
        if (typeof found === 'object' && found !== null) {
            return found.label ?? found.name ?? found.value;
        }
        return found;
    };

    const handleSelect = (optVal) => {
        onChange(optVal);
        setIsOpen(false);
    };

    return (
        <div className={`relative w-full ${className}`} ref={ref}>
            <div
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700'
                        : 'cursor-pointer bg-white dark:bg-slate-800'
                } ${
                    error
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : isOpen
                        ? 'ring-2 ring-primary border-primary'
                        : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
            >
                <span className={`truncate ${!value ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                    {getDisplayLabel()}
                </span>
                <span className={`material-symbols-outlined text-slate-400 text-xl transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </div>

            {isOpen && !disabled && (
                <div
                    className={`absolute left-0 min-w-full w-max max-w-[360px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[100] p-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                        direction === 'up' ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'
                    }`}
                >
                    <div className={`${maxHeight} overflow-y-auto custom-scrollbar space-y-1 p-0.5`}>
                        {options.map((opt, idx) => {
                            const val = (typeof opt === 'object' && opt !== null) ? (opt.value ?? opt.id ?? opt.name) : opt;
                            const label = (typeof opt === 'object' && opt !== null) ? (opt.label ?? opt.name ?? opt.value) : opt;
                            const isSelected = val === value;

                            return (
                                <div
                                    key={val ?? idx}
                                    onClick={() => handleSelect(val)}
                                    className={`px-3.5 py-2.5 rounded-lg text-sm cursor-pointer transition-colors font-medium flex items-center justify-between ${
                                        isSelected
                                            ? 'bg-primary text-white font-semibold'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className="whitespace-nowrap">{label}</span>
                                    {isSelected && (
                                        <span className="material-symbols-outlined text-base shrink-0 ml-2">check</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
