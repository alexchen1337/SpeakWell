'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { audioAPI } from '@/services/api';
import { AudioFile } from '@/types/audio';

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const files = await audioAPI.getAllAudio();
      setAudioFiles(files.map(f => ({
        ...f,
        uploadedAt: new Date(f.uploadedAt)
      })));
    } catch {
      // silent fail
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  if (loading || loadingData) {
    return (
      <main className="app-container">
        <div className="analytics-skeleton">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-subtitle"></div>
          </div>
          <div className="stats-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="stat-card skeleton-card">
                <div className="skeleton-line skeleton-label"></div>
                <div className="skeleton-line skeleton-value"></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const totalFiles = audioFiles.length;
  const totalDuration = audioFiles.reduce((sum, file) => sum + (file.duration || 0), 0);
  const totalSize = audioFiles.reduce((sum, file) => sum + file.size, 0);
  const completedFiles = audioFiles.filter(f => f.status === 'completed').length;
  const processingFiles = audioFiles.filter(f => f.status === 'processing').length;
  const failedFiles = audioFiles.filter(f => f.status === 'failed').length;

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const last30Days = audioFiles.filter(file => {
    const daysDiff = (Date.now() - file.uploadedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30;
  }).length;

  return (
    <main className="app-container">
      <header className="app-header">
        <h1>Analytics</h1>
        <p>Overview of your audio library</p>
      </header>

      <div className="analytics-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total files</div>
            <div className="stat-value">{totalFiles}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total duration</div>
            <div className="stat-value">{formatDuration(totalDuration)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total storage</div>
            <div className="stat-value">{formatSize(totalSize)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last 30 days</div>
            <div className="stat-value">{last30Days}</div>
          </div>
        </div>

        <div className="stats-section">
          <h2>Processing status</h2>
          <div className="status-stats">
            <div className="status-stat">
              <div className="status-indicator status-completed"></div>
              <div className="status-info">
                <div className="status-label">Completed</div>
                <div className="status-value">{completedFiles}</div>
              </div>
            </div>
            <div className="status-stat">
              <div className="status-indicator status-processing"></div>
              <div className="status-info">
                <div className="status-label">Processing</div>
                <div className="status-value">{processingFiles}</div>
              </div>
            </div>
            <div className="status-stat">
              <div className="status-indicator status-failed"></div>
              <div className="status-info">
                <div className="status-label">Failed</div>
                <div className="status-value">{failedFiles}</div>
              </div>
            </div>
          </div>
        </div>

        {totalFiles > 0 && (
          <div className="stats-section">
            <h2>Recent uploads</h2>
            <div className="recent-list">
              {audioFiles
                .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
                .slice(0, 5)
                .map(file => (
                  <div key={file.id} className="recent-item" onClick={() => {
                    localStorage.setItem('currentAudio', JSON.stringify({
                      id: file.id,
                      title: file.title,
                      duration: file.duration,
                      size: file.size,
                    }));
                    router.push('/player');
                  }}>
                    <div className="recent-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div className="recent-details">
                      <div className="recent-title">{file.title}</div>
                      <div className="recent-meta">
                        {new Date(file.uploadedAt).toLocaleDateString()} · {formatDuration(file.duration || 0)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

