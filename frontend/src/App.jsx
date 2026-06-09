import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import CheckStatus from './pages/CheckStatus';

import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AssetDetails from './pages/AssetDetails';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isAdminRoute = ['/admin', '/tickets', '/assets', '/assets/add', '/users', '/settings'].includes(location.pathname);
  const shouldHideHeaderFooter = isLoginPage || isAdminRoute;

  return (
    <AuthProvider>
      <div className="font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200 flex flex-col">
        {!shouldHideHeaderFooter && <Header />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/status" element={<CheckStatus />} />
          <Route path="/login" element={<Login />} />
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
        </Routes>
        {!shouldHideHeaderFooter && <Footer />}
      </div>
    </AuthProvider>
  );
}

export default App;
