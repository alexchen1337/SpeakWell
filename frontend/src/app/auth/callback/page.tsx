'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const success = searchParams.get('success');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Authentication failed: ${errorParam}`);
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      if (success === 'true') {
        try {
          await refreshAuth();
          router.push('/');
        } catch (err) {
          setError('Failed to load user information');
          setTimeout(() => router.push('/login'), 3000);
        }
      } else {
        setError('Invalid callback');
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, router, refreshAuth]);

  if (error) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div style={{ textAlign: 'center' }}>
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <h2 className="callback-title">Authentication error</h2>
              <p className="callback-message">{error}</p>
              <p className="callback-hint">Redirecting to login</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div style={{ textAlign: 'center' }}>
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
            <h2 className="callback-title">Authenticating</h2>
            <p className="callback-message">Verifying your credentials</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div style={{ textAlign: 'center' }}>
              <div className="spinner-container">
                <div className="spinner"></div>
              </div>
              <h2 className="callback-title">Loading</h2>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
