'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { AudioFile } from '@/types/audio';
import { audioAPI } from '@/services/api';


export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const loadAudioFiles = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const files = await audioAPI.getAllAudio();
      setAudioFiles(files.map(f => ({
        ...f,
        uploadedAt: new Date(f.uploadedAt)
      })));
    } catch (error: unknown) {
      console.error('Failed to load audio files');
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAudioFiles();
    }
  }, [isAuthenticated, loadAudioFiles]);

  if (loading || !isAuthenticated) return null;

  const recentFiles = audioFiles.slice(0, 3);

  return (
    <main className="home-dashboard">
      <div className="dashboard-hero">
        <h1>Welcome to SpeakWell</h1>
        <p>Grade your Presentations</p>
      </div>

      <div className="dashboard-content">
        {/* Recent Presentations */}
        <div className="dashboard-section">
          <div className="section-header-dash">
            <h2>Recent Presentations</h2>
            {!loadingFiles && (
              <motion.button
                onClick={() => router.push('/library')}
                className="view-all-btn"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
              >
                View All
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            )}
          </div>

          {loadingFiles ? (
            <div className="recent-files">
              {[1, 2, 3].map(i => (
                <div key={i} className="recent-file-card" style={{ pointerEvents: 'none', cursor: 'default' }}>
                  <div className="skeleton-line" style={{ width: '48px', height: '48px', borderRadius: '8px', flexShrink: 0 }}></div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                    <div className="skeleton-line" style={{ height: '1rem', width: '65%' }}></div>
                    <div className="skeleton-line" style={{ height: '0.875rem', width: '35%' }}></div>
                  </div>
                  <div className="skeleton-line" style={{ width: '20px', height: '20px', flexShrink: 0 }}></div>
                </div>
              ))}
            </div>
          ) : recentFiles.length === 0 ? (
            <motion.div className="empty-recent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <p>No presentations yet</p>
              <span>Upload a file to see it listed here.</span>
            </motion.div>
          ) : (
            <motion.div className="recent-files" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              {recentFiles.map((file) => (
                <motion.div
                  key={file.id}
                  className="recent-file-card"
                  whileHover={{ x: 6 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    localStorage.setItem('currentAudio', JSON.stringify({
                      id: file.id,
                      title: file.title,
                      duration: file.duration,
                      size: file.size,
                    }));
                    router.push('/player');
                  }}
                >
                  <div className="recent-file-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div className="recent-file-info">
                    <h4>{file.title}</h4>
                    <p>{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <svg className="chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section">
          <div className="section-header-dash">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            {[
              {
                href: '/library',
                title: 'Upload Presentation',
                desc: 'Add a new audio file for analysis',
                icon: (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                ),
              },
              {
                href: '/library',
                title: 'View Presentations',
                desc: 'Browse and manage all your files',
                icon: (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                ),
              },
              {
                href: '/search',
                title: 'Search Transcripts',
                desc: 'Find content across all files',
                icon: (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
              },
            ].map((action) => (
              <motion.button
                key={action.href + action.title}
                onClick={() => router.push(action.href)}
                className="action-card"
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="action-icon">{action.icon}</div>
                <h3>{action.title}</h3>
                <p>{action.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
