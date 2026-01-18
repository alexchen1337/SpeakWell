'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailError, setEmailError] = useState('');
  const router = useRouter();
  const { refreshAuth } = useAuth();

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Handle email change with validation
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    // Only show validation after user has typed something
    if (value.length > 0) {
      setEmailTouched(true);
      if (!validateEmail(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const endpoint = isSignup ? '/auth/signup' : '/auth/login';

    try {
      const body = isSignup 
        ? { email, password, name: name || undefined }
        : { email, password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (data.requires_confirmation) {
        setMessage(data.message);
        return;
      }

      await refreshAuth();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-brand">
          <h1 className="brand-name">SpeakWell</h1>
        </div>

        <div className="login-card">
          <div className="login-header">
            <h2>{isSignup ? 'Create account' : 'Welcome back'}</h2>
            <p>{isSignup ? 'Sign up to get started' : 'Sign in to continue to your workspace'}</p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {isSignup && (
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="form-input"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                required
                className={`form-input ${emailTouched && emailError ? 'input-error' : ''}`}
              />
              {emailTouched && emailError && (
                <span className="field-error">{emailError}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="form-input"
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                isSignup ? 'Sign up' : 'Sign in'
              )}
            </button>
          </form>

          <div className="auth-switch">
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
                setMessage('');
                setEmailError('');
                setEmailTouched(false);
              }}
              className="switch-btn"
            >
              {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="login-footer">
          Secure authentication via Supabase
        </p>
      </div>
    </div>
  );
}
