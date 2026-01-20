'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname === '/login' || pathname.startsWith('/auth/')) {
    return null;
  }

  if (!mounted || loading) {
    return (
      <header className="site-header">
        <div className="header-container">
          <div className="header-logo">
            <span className="logo-text">SpeakWell</span>
          </div>
        </div>
      </header>
    );
  }

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
    } else {
      router.push('/login');
    }
  };

  const handleProfileClick = () => {
    router.push('/profile');
  };

  return (
    <header className="site-header">
      <div className="header-container">
        <div className="header-logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-text">SpeakWell</span>
        </div>

        {isAuthenticated && (
          <nav className="header-nav">
            <button 
              onClick={() => router.push('/library')} 
              className={`nav-link ${pathname === '/library' ? 'active' : ''}`}
            >
              Library
            </button>
            <button 
              onClick={() => router.push('/classes')} 
              className={`nav-link ${pathname === '/classes' || pathname.startsWith('/classes/') ? 'active' : ''}`}
            >
              Classes
            </button>
            <button 
              onClick={() => router.push('/search')} 
              className={`nav-link ${pathname === '/search' ? 'active' : ''}`}
            >
              Search
            </button>
            <button 
              onClick={() => router.push('/analytics')} 
              className={`nav-link ${pathname === '/analytics' ? 'active' : ''}`}
            >
              Analytics
            </button>
          </nav>
        )}

        <div className="header-actions">
          {isAuthenticated && user && (
            <button onClick={handleProfileClick} className="profile-button">
              <div className="user-avatar">
                <img 
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user.email)}`} 
                  alt="" 
                />
              </div>
              <div className="user-details">
                <div className="user-email">{user.email}</div>
              </div>
            </button>
          )}

          <button onClick={handleAuthAction} className="auth-button">
            {isAuthenticated ? (
              <>
                <svg className="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </>
            ) : (
              <>
                <svg className="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Sign in
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
