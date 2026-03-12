import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        // Redirect to login if user is not authenticated
        // replace: true prevents pushing the redirect onto the history stack
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
