'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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

  const validateEmail = (v: string) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setEmail(v);
    if (v.length > 0) {
      setEmailTouched(true);
      setEmailError(validateEmail(v) ? '' : 'Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const body = isSignup
        ? { email, password, name: name || undefined }
        : { email, password };

      const response = await fetch(`${API_URL}${isSignup ? '/auth/signup' : '/auth/login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Authentication failed');
      if (data.requires_confirmation) { setMessage(data.message); return; }

      await refreshAuth();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    setIsSignup(!isSignup);
    setError('');
    setMessage('');
    setEmailError('');
    setEmailTouched(false);
  };

  return (
    <div className="split-auth">

      {/* ── Background layers ── */}
      <div className="split-auth__bg-image" aria-hidden="true" />
      <div className="split-auth__grain" aria-hidden="true" />

      {/* ── Ascending squares decoration ── */}
      <svg className="split-auth__squares" viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">

        {/* Row 1 — y≈750, 18px, densest */}
        <rect x="22"  y="750" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'0.0s',animationDuration:'2.8s'} as React.CSSProperties} />
        <rect x="116" y="740" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'0.4s',animationDuration:'3.5s'} as React.CSSProperties} />
        <rect x="212" y="753" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'1.1s',animationDuration:'2.5s'} as React.CSSProperties} />
        <rect x="308" y="744" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'0.7s',animationDuration:'4.0s'} as React.CSSProperties} />
        <rect x="404" y="756" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'1.8s',animationDuration:'3.2s'} as React.CSSProperties} />
        <rect x="500" y="742" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'0.2s',animationDuration:'2.9s'} as React.CSSProperties} />
        <rect x="596" y="751" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'1.4s',animationDuration:'3.7s'} as React.CSSProperties} />
        <rect x="692" y="745" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'0.6s',animationDuration:'2.6s'} as React.CSSProperties} />
        <rect x="788" y="753" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'2.1s',animationDuration:'4.2s'} as React.CSSProperties} />
        <rect x="884" y="741" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'0.9s',animationDuration:'3.0s'} as React.CSSProperties} />
        <rect x="980" y="750" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'1.6s',animationDuration:'2.7s'} as React.CSSProperties} />
        <rect x="1076" y="743" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'0.3s',animationDuration:'3.8s'} as React.CSSProperties} />
        <rect x="1162" y="752" width="18" height="18" rx="3" fill="#000" className="sq" style={{animationDelay:'1.2s',animationDuration:'3.1s'} as React.CSSProperties} />

        {/* Row 2 — y≈645, 14px */}
        <rect x="60"  y="647" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'2.3s',animationDuration:'3.4s'} as React.CSSProperties} />
        <rect x="178" y="638" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'0.5s',animationDuration:'2.8s'} as React.CSSProperties} />
        <rect x="298" y="651" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'1.7s',animationDuration:'4.1s'} as React.CSSProperties} />
        <rect x="420" y="641" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'0.1s',animationDuration:'3.3s'} as React.CSSProperties} />
        <rect x="544" y="649" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'2.6s',animationDuration:'2.6s'} as React.CSSProperties} />
        <rect x="668" y="637" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'0.8s',animationDuration:'3.9s'} as React.CSSProperties} />
        <rect x="792" y="646" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'1.3s',animationDuration:'2.9s'} as React.CSSProperties} />
        <rect x="916" y="639" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'2.0s',animationDuration:'3.6s'} as React.CSSProperties} />
        <rect x="1032" y="648" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'0.4s',animationDuration:'4.3s'} as React.CSSProperties} />
        <rect x="1140" y="640" width="14" height="14" rx="3" fill="#000" className="sq" style={{animationDelay:'1.9s',animationDuration:'3.0s'} as React.CSSProperties} />

        {/* Row 3 — y≈540, 12px */}
        <rect x="40"  y="542" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'0.6s',animationDuration:'3.2s'} as React.CSSProperties} />
        <rect x="178" y="532" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'2.4s',animationDuration:'2.7s'} as React.CSSProperties} />
        <rect x="320" y="546" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'1.0s',animationDuration:'4.0s'} as React.CSSProperties} />
        <rect x="464" y="536" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'0.2s',animationDuration:'3.5s'} as React.CSSProperties} />
        <rect x="614" y="543" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'1.8s',animationDuration:'2.9s'} as React.CSSProperties} />
        <rect x="768" y="533" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'3.1s',animationDuration:'3.8s'} as React.CSSProperties} />
        <rect x="922" y="542" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'0.7s',animationDuration:'3.1s'} as React.CSSProperties} />
        <rect x="1068" y="535" width="12" height="12" rx="2.5" fill="#000" className="sq" style={{animationDelay:'2.2s',animationDuration:'4.4s'} as React.CSSProperties} />

        {/* Row 4 — y≈432, 10px */}
        <rect x="95"  y="434" width="10" height="10" rx="2" fill="#000" className="sq" style={{animationDelay:'1.5s',animationDuration:'3.6s'} as React.CSSProperties} />
        <rect x="258" y="422" width="10" height="10" rx="2" fill="#000" className="sq" style={{animationDelay:'0.3s',animationDuration:'2.8s'} as React.CSSProperties} />
        <rect x="430" y="436" width="10" height="10" rx="2" fill="#000" className="sq" style={{animationDelay:'2.7s',animationDuration:'4.1s'} as React.CSSProperties} />
        <rect x="608" y="426" width="10" height="10" rx="2" fill="#000" className="sq" style={{animationDelay:'0.9s',animationDuration:'3.3s'} as React.CSSProperties} />
        <rect x="790" y="435" width="10" height="10" rx="2" fill="#000" className="sq" style={{animationDelay:'1.4s',animationDuration:'2.6s'} as React.CSSProperties} />
        <rect x="968" y="424" width="10" height="10" rx="2" fill="#000" className="sq" style={{animationDelay:'3.3s',animationDuration:'3.9s'} as React.CSSProperties} />
        <rect x="1130" y="432" width="10" height="10" rx="2" fill="#000" className="sq" style={{animationDelay:'0.5s',animationDuration:'3.0s'} as React.CSSProperties} />

        {/* Row 5 — y≈328, 8px */}
        <rect x="130" y="330" width="8" height="8" rx="2" fill="#000" className="sq" style={{animationDelay:'1.1s',animationDuration:'3.7s'} as React.CSSProperties} />
        <rect x="330" y="320" width="8" height="8" rx="2" fill="#000" className="sq" style={{animationDelay:'2.8s',animationDuration:'2.9s'} as React.CSSProperties} />
        <rect x="540" y="332" width="8" height="8" rx="2" fill="#000" className="sq" style={{animationDelay:'0.4s',animationDuration:'4.2s'} as React.CSSProperties} />
        <rect x="755" y="322" width="8" height="8" rx="2" fill="#000" className="sq" style={{animationDelay:'1.9s',animationDuration:'3.4s'} as React.CSSProperties} />
        <rect x="960" y="330" width="8" height="8" rx="2" fill="#000" className="sq" style={{animationDelay:'3.5s',animationDuration:'2.7s'} as React.CSSProperties} />

        {/* Row 6 — y≈225, 7px */}
        <rect x="185" y="227" width="7" height="7" rx="1.5" fill="#000" className="sq" style={{animationDelay:'0.8s',animationDuration:'3.8s'} as React.CSSProperties} />
        <rect x="440" y="218" width="7" height="7" rx="1.5" fill="#000" className="sq" style={{animationDelay:'2.5s',animationDuration:'3.2s'} as React.CSSProperties} />
        <rect x="700" y="224" width="7" height="7" rx="1.5" fill="#000" className="sq" style={{animationDelay:'1.2s',animationDuration:'4.5s'} as React.CSSProperties} />
        <rect x="960" y="216" width="7" height="7" rx="1.5" fill="#000" className="sq" style={{animationDelay:'3.8s',animationDuration:'3.1s'} as React.CSSProperties} />

        {/* Row 7 — y≈128, 6px */}
        <rect x="260" y="130" width="6" height="6" rx="1.5" fill="#000" className="sq" style={{animationDelay:'1.6s',animationDuration:'3.9s'} as React.CSSProperties} />
        <rect x="600" y="122" width="6" height="6" rx="1.5" fill="#000" className="sq" style={{animationDelay:'0.2s',animationDuration:'4.6s'} as React.CSSProperties} />
        <rect x="940" y="128" width="6" height="6" rx="1.5" fill="#000" className="sq" style={{animationDelay:'2.9s',animationDuration:'3.3s'} as React.CSSProperties} />

        {/* Row 8 — y≈45, 5px, sparsest */}
        <rect x="380" y="47" width="5" height="5" rx="1" fill="#000" className="sq" style={{animationDelay:'1.0s',animationDuration:'4.8s'} as React.CSSProperties} />
        <rect x="800" y="42" width="5" height="5" rx="1" fill="#000" className="sq" style={{animationDelay:'3.2s',animationDuration:'4.0s'} as React.CSSProperties} />
      </svg>

      {/* ── Form panel ── */}
      <div className="split-auth__left">
        <div className="split-auth__card">

          {/* Logo */}
          <div className="split-auth__logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8200"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>SpeakWell</span>
          </div>

          {/* Header */}
          <div className="split-auth__header">
            <h1>{isSignup ? 'Create your account.' : 'Welcome back.'}</h1>
            <p>{isSignup ? 'Start grading every word.' : 'Sign in to your account to continue.'}</p>
          </div>

          {error && <div className="split-auth__alert split-auth__alert--error">{error}</div>}
          {message && <div className="split-auth__alert split-auth__alert--success">{message}</div>}

          {/* Form */}
          <form onSubmit={handleSubmit} className="split-auth__form">
            {isSignup && (
              <div className="split-auth__field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="split-auth__input"
                />
              </div>
            )}

            <div className="split-auth__field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                required
                className={`split-auth__input${emailTouched && emailError ? ' split-auth__input--error' : ''}`}
              />
              {emailTouched && emailError && (
                <span className="split-auth__field-error">{emailError}</span>
              )}
            </div>

            <div className="split-auth__field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="split-auth__input"
              />
            </div>

            <button type="submit" disabled={loading} className="split-auth__submit">
              {loading ? (
                <span className="split-auth__spinner" />
              ) : (
                <>
                  {isSignup ? 'Create account' : 'Sign in'}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Toggle */}
          <div className="split-auth__toggle">
            <span>{isSignup ? 'Already have an account?' : 'New to SpeakWell?'}</span>
            <button type="button" onClick={handleToggle}>
              {isSignup ? 'Sign in' : 'Create an account →'}
            </button>
          </div>

          {/* Footer */}
          <p className="split-auth__footer">
            By continuing, you agree to our <Link href="/terms">Terms of Service</Link>.
          </p>

          {/* Back to home */}
          <Link href="/" className="split-auth__back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>

        </div>
      </div>

    </div>
  );
}
