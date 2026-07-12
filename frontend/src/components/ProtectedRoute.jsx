import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        if (location.pathname === '/') {
            return <Navigate to="/login" replace />;
        }
        return <Navigate to="/" replace />;
    }

    // Enforce menu permission checks based on user.allowed_menus
    if (user && user.email !== 'admin@support.com') {
        const path = location.pathname.toLowerCase();
        
        // Users and Settings are strictly restricted to admin@support.com
        if (path.startsWith('/users') || path.startsWith('/settings')) {
            return <Navigate to="/" replace />;
        }

        const allowedMenus = (user.allowed_menus || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        let requiredMenu = null;
        if (path === '/tickets') {
            requiredMenu = 'tickets';
        } else if (path.startsWith('/assets')) {
            requiredMenu = 'it assets';
        } else if (path.startsWith('/admin-assets')) {
            requiredMenu = 'admin assets';
        } else if (path.startsWith('/courier')) {
            requiredMenu = 'courier';
        } else if (path.startsWith('/petty-cash')) {
            requiredMenu = 'petty cash';
        }

        if (requiredMenu && !allowedMenus.includes(requiredMenu)) {
            return <Navigate to="/" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
