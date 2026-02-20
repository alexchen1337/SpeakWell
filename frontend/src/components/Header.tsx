'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Library', href: '/library' },
  { label: 'Classes', href: '/classes' },
  { label: 'Search', href: '/search' },
  { label: 'Analytics', href: '/analytics' },
];

export default function Header() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname === '/' || pathname === '/login' || pathname.startsWith('/auth/')) {
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

  const handleLogoClick = () => {
    if (isAuthenticated) {
      router.push('/dashboard');
      return;
    }
    router.push('/');
  };

  const isActive = (href: string) =>
    href === '/classes'
      ? pathname === '/classes' || pathname.startsWith('/classes/')
      : pathname === href;

  return (
    <motion.header
      className="site-header"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="header-container">
        <motion.div
          className="header-logo"
          onClick={handleLogoClick}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{ cursor: 'pointer' }}
        >
          <span className="logo-text">SpeakWell</span>
        </motion.div>

        {isAuthenticated && (
          <nav className="header-nav">
            {NAV_LINKS.map((link, i) => (
              <motion.button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i + 0.1, duration: 0.3 }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                style={{ position: 'relative' }}
              >
                {link.label}
                {isActive(link.href) && (
                  <motion.span
                    layoutId="nav-underline"
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      left: '12px',
                      right: '12px',
                      height: '2px',
                      background: 'var(--color-accent)',
                      borderRadius: '2px',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </nav>
        )}

        <motion.div
          className="header-actions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          {isAuthenticated && user && (
            <motion.button
              onClick={() => router.push('/profile')}
              className="profile-button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="user-avatar">
                <img
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user.email)}`}
                  alt=""
                />
              </div>
              <div className="user-details">
                <div className="user-email">{user.email}</div>
              </div>
            </motion.button>
          )}

          <motion.button
            onClick={handleAuthAction}
            className="auth-button"
            whileHover={{ scale: 1.03, boxShadow: '0 4px 20px rgba(255, 130, 0, 0.3)' }}
            whileTap={{ scale: 0.97 }}
          >
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
          </motion.button>
        </motion.div>
      </div>
    </motion.header>
  );
}
