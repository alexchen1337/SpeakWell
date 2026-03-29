'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';

const HERO_BARS = [
  22, 38, 52, 34, 68, 48, 82, 56, 72, 44, 90, 62, 76, 40, 58, 85, 50, 66, 36, 78, 54, 88, 46, 70, 32, 60, 94, 42, 74, 48, 64, 38,
];

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
      if (data.requires_confirmation) {
        setMessage(data.message);
        return;
      }

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
    <div className="landing-root auth-page">
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-bg-grid" />
        <div className="landing-bg-orb landing-bg-orb-1" />
        <div className="landing-bg-orb landing-bg-orb-2" />
        <div className="landing-bg-orb landing-bg-orb-3" />
      </div>

      <div className="auth-split">
        <aside className="auth-hero">
          <div className="auth-hero-glow" aria-hidden="true" />
          <motion.div
            className="auth-hero-inner"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="auth-hero-visual" aria-hidden="true">
              <svg className="auth-hero-ring" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="160" cy="160" r="148" stroke="rgba(255,130,0,0.12)" strokeWidth="1" />
                <circle cx="160" cy="160" r="118" stroke="rgba(255,130,0,0.18)" strokeWidth="1" />
                <circle cx="160" cy="160" r="88" stroke="rgba(255,244,239,0.06)" strokeWidth="1" />
              </svg>
              <div className="auth-hero-bars">
                {HERO_BARS.map((h, i) => (
                  <span
                    key={i}
                    className="auth-hero-bar"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.04}s` }}
                  />
                ))}
              </div>
            </div>

            <div className="auth-hero-copy">
              <p className="auth-hero-tagline">
                <span className="auth-hero-tagline-white">Master the </span>
                <span className="auth-hero-tagline-accent">Art of Speech</span>
                <span className="auth-hero-tagline-white"> with SpeakWell</span>
              </p>
            </div>
          </motion.div>
        </aside>

        <div className="auth-panel">
          <div className="auth-panel-top">
            <Link href="/" className="auth-panel-link">
              Home
            </Link>
          </div>

          <main className="auth-main">
            <motion.div
              className="auth-card"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="auth-card-header">
                <h1 className="auth-card-title">{isSignup ? 'Create your account' : 'Sign in'}</h1>
                <p className="auth-card-subtitle">
                  {isSignup
                    ? 'Upload audio, get rubric scoring and AI feedback.'
                    : 'Continue to your library and analytics.'}
                </p>
              </div>

              {error && <div className="auth-alert auth-alert--error">{error}</div>}
              {message && <div className="auth-alert auth-alert--success">{message}</div>}

              <form onSubmit={handleSubmit} className="auth-form">
                {isSignup && (
                  <div className="auth-field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="auth-input"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div className="auth-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@example.com"
                    required
                    className={`auth-input${emailTouched && emailError ? ' auth-input--error' : ''}`}
                    autoComplete="email"
                  />
                  {emailTouched && emailError && <span className="auth-field-error">{emailError}</span>}
                </div>

                <div className="auth-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="auth-input"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                  />
                </div>

                <button type="submit" disabled={loading} className="auth-submit">
                  {loading ? (
                    <span className="auth-spinner" aria-hidden="true" />
                  ) : (
                    <>
                      {isSignup ? 'Create account' : 'Sign in'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <div className="auth-toggle">
                <span>{isSignup ? 'Already have an account?' : 'New to SpeakWell?'}</span>
                <button type="button" onClick={handleToggle}>
                  {isSignup ? 'Sign in' : 'Create an account'}
                </button>
              </div>

              <p className="auth-footer-note">
                By continuing, you agree to our{' '}
                <Link href="/terms">Terms of Service</Link>.
              </p>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
