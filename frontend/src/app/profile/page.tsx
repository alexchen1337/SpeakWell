'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <main className="app-container">
        <div className="profile-container">
          <div className="profile-header">
            <div className="skeleton-line" style={{ width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 1rem' }}></div>
            <div className="skeleton-line" style={{ height: '28px', width: '160px', margin: '0 auto 0.25rem' }}></div>
            <div className="skeleton-line" style={{ height: '20px', width: '200px', margin: '0 auto' }}></div>
          </div>
          <div className="profile-card">
            <div className="skeleton-line" style={{ height: '20px', width: '120px', marginBottom: '1rem' }}></div>
            <div className="profile-info-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i}>
                  <div className="skeleton-line" style={{ height: '14px', width: '60px', marginBottom: '0.375rem' }}></div>
                  <div className="skeleton-line" style={{ height: '18px', width: '100%' }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <main className="app-container">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-large">
            <img 
              src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user.email)}`} 
              alt="Profile" 
            />
          </div>
          <h1>{user.name}</h1>
          <p className="profile-email">{user.email}</p>
        </div>

        <div className="profile-card">
          <h2>Account details</h2>
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <label>Email</label>
              <p>{user.email}</p>
            </div>
            <div className="profile-info-item">
              <label>Name</label>
              <p>{user.name}</p>
            </div>
            {user.role && (
              <div className="profile-info-item">
                <label>Role</label>
                <p>{user.role}</p>
              </div>
            )}
            {user.organization && (
              <div className="profile-info-item">
                <label>Organization</label>
                <p>{user.organization}</p>
              </div>
            )}
            {user.group && (
              <div className="profile-info-item">
                <label>Group</label>
                <p>{user.group}</p>
              </div>
            )}
          </div>
        </div>

        <div className="profile-actions">
          <button onClick={() => router.push('/')} className="btn-secondary">
            Back to library
          </button>
          <button onClick={logout} className="btn-danger">
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
