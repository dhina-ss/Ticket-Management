import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import CheckStatus from './pages/CheckStatus';

import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AssetDetails from './pages/AssetDetails';
import Courier from './pages/Courier';
import PettyCash from './pages/PettyCash';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const RedirectToBackend = ({ path }) => {
  React.useEffect(() => {
    window.location.href = path;
  }, [path]);
  return null;
};

function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isDashboardRoute = location.pathname === '/';
  const isAdminRoute = ['/admin', '/tickets', '/assets', '/assets/add', '/admin-assets', '/admin-assets/add', '/users', '/settings', '/courier', '/petty-cash'].includes(location.pathname);
  const shouldHideHeaderFooter = isLoginPage || isDashboardRoute || isAdminRoute;

  // Mobile check
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

  return (
    <AuthProvider>
      <div className="font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200 flex flex-col">
        {!shouldHideHeaderFooter && <Header />}
        <Routes>
          <Route path="/" element={
            isMobile ? (
              <Navigate to="/raise-ticket" replace />
            ) : (
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            )
          } />
          <Route path="/status" element={<CheckStatus />} />
          <Route path="/login" element={<Login />} />
          <Route path="/raise-ticket" element={<Home />} />
          <Route path="/asset/:assetId" element={<AssetDetails />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/tickets" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/assets" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/assets/add" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin-assets" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin-assets/add" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/courier" element={
            <ProtectedRoute>
              <Courier />
            </ProtectedRoute>
          } />
          <Route path="/petty-cash" element={
            <ProtectedRoute>
              <PettyCash />
            </ProtectedRoute>
          } />
        </Routes>
        {!shouldHideHeaderFooter && <Footer />}
      </div>
    </AuthProvider>
  );
}

export default App;
