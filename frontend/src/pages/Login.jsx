import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

import logoImage from '../assets/logo.png';
import logoDarkImage from '../assets/logo1.png';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login, logout, isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);

    // Password Change State
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [tempUser, setTempUser] = useState(null);
    const [passwordError, setPasswordError] = useState('');

    // Forgot Password State
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotStep, setForgotStep] = useState(1);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotQuestion, setForgotQuestion] = useState('');
    const [forgotAnswer, setForgotAnswer] = useState('');
    const [resetUserId, setResetUserId] = useState(null);
    const [forgotError, setForgotError] = useState('');

    const securityQuestions = [
        "What was your childhood nickname?",
        "What was the name of your first school?",
        "What was the name of your first pet?"
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/api/login', { email, password });
            if (res.status === 200 && res.data.success) {
                if (res.data.user.is_first_login) {
                    setTempUser(res.data.user);
                    setShowPasswordChange(true);
                } else {
                    login(res.data.user);
                    navigate('/admin');
                }
            } else {
                setError(res.data.error || 'Invalid email or password');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Server error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        setPasswordError('');
        if (newPassword !== confirmPassword) {
            setPasswordError("Passwords don't match");
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            return;
        }
        if (!securityQuestion || !securityAnswer.trim()) {
            setPasswordError("Please select a security question and provide an answer");
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/api/change_password', {
                user_id: tempUser.id,
                new_password: newPassword,
                security_question: securityQuestion,
                security_answer: securityAnswer.trim()
            });
            if (res.status === 200 && res.data.success) {
                login({ ...tempUser, is_first_login: false });
                navigate('/admin');
            } else {
                setPasswordError(res.data.error || 'Failed to update password');
            }
        } catch (error) {
            setPasswordError(error.response?.data?.error || 'Server error');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordClick = (e) => {
        e.preventDefault();
        setForgotEmail(email);
        setForgotStep(1);
        setForgotQuestion('');
        setForgotAnswer('');
        setForgotError('');
        setShowForgotPassword(true);
    };

    const handleVerifySecurity = async () => {
        setForgotError('');
        if (!forgotEmail || !forgotQuestion || !forgotAnswer.trim()) {
            setForgotError("Please fill out all fields");
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/api/verify_security_answer', {
                email: forgotEmail,
                security_question: forgotQuestion,
                security_answer: forgotAnswer.trim()
            });
            if (res.status === 200 && res.data.success) {
                setResetUserId(res.data.user_id);
                setForgotStep(2);
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setForgotError(res.data.error || 'Invalid details');
            }
        } catch (error) {
            setForgotError(error.response?.data?.error || 'Server error');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        setForgotError('');
        if (newPassword !== confirmPassword) {
            setForgotError("Passwords don't match");
            return;
        }
        if (newPassword.length < 6) {
            setForgotError("Password must be at least 6 characters");
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/api/reset_password', {
                user_id: resetUserId,
                new_password: newPassword
            });
            if (res.status === 200 && res.data.success) {
                setForgotStep(3);
                setResetUserId(null);
            } else {
                setForgotError(res.data.error || 'Failed to reset password');
            }
        } catch (error) {
            setForgotError(error.response?.data?.error || 'Server error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 md:p-10 border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-center justify-center mb-8">
                        <img src={logoImage} alt="Logo" className="h-20 object-contain dark:hidden" />
                        <img src={logoDarkImage} alt="Logo" className="h-20 object-contain hidden dark:block" />
                    </div>
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Support Desk Admin</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Please enter your credentials to access the dashboard.</p>
                    </div>
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="email">Email Address <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                                <input
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                    id="email"
                                    name="email"
                                    placeholder="admin@support.com"
                                    required
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="password">Password <span className="text-red-500">*</span></label>
                                <a className="text-sm font-medium text-primary hover:text-primary/80 transition-colors" href="#" onClick={handleForgotPasswordClick}>Forgot password?</a>
                            </div>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                                <input
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                    id="password"
                                    name="password"
                                    placeholder="••••••"
                                    required
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            className="w-full py-4 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all focus:ring-4 focus:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                            type="submit"
                            disabled={loading}
                        >
                            {loading && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>
                <p className="mt-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    © 2026 Support Desk Systems. All rights reserved.
                </p>
            </div>

            {showPasswordChange && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md p-8 border border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Set Permanent Password</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Please create a new permanent password to continue.</p>

                        {passwordError && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
                                {passwordError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Security Question <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                                    value={securityQuestion}
                                    onChange={(e) => setSecurityQuestion(e.target.value)}
                                >
                                    <option value="" disabled>Select a question...</option>
                                    {securityQuestions.map((q, idx) => (
                                        <option key={idx} value={q}>{q}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Security Answer <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                    value={securityAnswer}
                                    onChange={(e) => setSecurityAnswer(e.target.value)}
                                    placeholder="Your answer"
                                />
                            </div>

                            <hr className="border-slate-100 dark:border-slate-800 my-4" />

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">New Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••"
                                />
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between gap-3">
                            <button
                                onClick={() => { setShowPasswordChange(false); setTempUser(null); }}
                                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordChange}
                                disabled={loading}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 disabled:opacity-60 cursor-pointer"
                            >
                                {loading ? 'Saving...' : 'Confirm Password'}
                            </button>
                        </div>
                    </div>

                </div>
            )}

            {showForgotPassword && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md p-8 border border-slate-100 dark:border-slate-800">
                        {forgotStep !== 3 && (
                            <>
                                <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
                                    {forgotStep === 1 ? 'Forgot Password' : 'Set New Password'}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                    {forgotStep === 1
                                        ? 'Verify your identity using your security question.'
                                        : 'Please create a new permanent password.'}
                                </p>
                            </>
                        )}

                        {forgotError && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">
                                {forgotError}
                            </div>
                        )}

                        {forgotStep === 1 && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email Address <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        value={forgotEmail}
                                        onChange={(e) => setForgotEmail(e.target.value)}
                                        placeholder="admin@support.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Security Question <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                                        value={forgotQuestion}
                                        onChange={(e) => setForgotQuestion(e.target.value)}
                                    >
                                        <option value="" disabled>Select a question...</option>
                                        {securityQuestions.map((q, idx) => (
                                            <option key={idx} value={q}>{q}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Security Answer <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        value={forgotAnswer}
                                        onChange={(e) => setForgotAnswer(e.target.value)}
                                        placeholder="Your answer"
                                    />
                                </div>
                            </div>
                        )}

                        {forgotStep === 2 && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">New Password <span className="text-red-500">*</span></label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Confirm Password <span className="text-red-500">*</span></label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••"
                                    />
                                </div>
                            </div>
                        )}

                        {forgotStep === 3 && (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-100/50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                                </div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Password Reset Successfully!</h4>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">You can now sign in with your new permanent password.</p>
                                <button
                                    onClick={() => { setShowForgotPassword(false); setForgotStep(1); }}
                                    className="w-full px-5 py-3.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 transition-colors cursor-pointer"
                                >
                                    Back to Sign In
                                </button>
                            </div>
                        )}

                        {forgotStep !== 3 && (
                            <div className="mt-8 flex justify-between gap-3">
                                <button
                                    onClick={() => setShowForgotPassword(false)}
                                    className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={forgotStep === 1 ? handleVerifySecurity : handleResetPassword}
                                    disabled={loading}
                                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 disabled:opacity-60 cursor-pointer"
                                >
                                    {loading ? (forgotStep === 1 ? 'Verifying...' : 'Saving...') : (forgotStep === 1 ? 'Verify' : 'Reset Password')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
