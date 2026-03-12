import React, { createContext, useState, useContext, useEffect } from 'react';

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

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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
