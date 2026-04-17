import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Initialize state from localStorage so it survives page reloads
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('isAuthenticated') === 'true';
    });
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('adminUser');
        try { return saved ? JSON.parse(saved) : null; } catch { return null; }
    });

    // Update localStorage whenever state changes
    useEffect(() => {
        localStorage.setItem('isAuthenticated', isAuthenticated);
        if (user) localStorage.setItem('adminUser', JSON.stringify(user));
        else localStorage.removeItem('adminUser');
    }, [isAuthenticated, user]);

    const login = (userData) => {
        setIsAuthenticated(true);
        if (userData) setUser(userData);
    };

    const logout = () => {
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('adminUser');
    };

    /**
     * Fetches fresh user data from the backend and updates the context + localStorage.
     * This ensures permission changes (e.g. can_send_mail) take effect without re-login.
     */
    const refreshUser = async () => {
        if (!user?.email) return;
        try {
            const res = await api.get(`/api/me?email=${encodeURIComponent(user.email)}`);
            if (res.status === 200 && res.data) {
                const fresh = res.data;
                // Merge fresh fields into the existing user (preserving anything not in /api/me)
                setUser(prev => ({ ...prev, ...fresh }));
            }
        } catch (err) {
            // Silently ignore — the stale session is still valid
            console.warn('refreshUser failed:', err);
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
