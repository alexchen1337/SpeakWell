'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import AudioUpload from '@/components/AudioUpload';
import AudioList from '@/components/AudioList';
import { AudioFile, UploadingFile } from '@/types/audio';
import { audioAPI } from '@/services/api';

export default function LibraryPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const loadAudioFiles = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const files = await audioAPI.getAllAudio();
      setAudioFiles(files.map(f => ({
        ...f,
        uploadedAt: new Date(f.uploadedAt)
      })));
    } catch (error: any) {
      showNotification('error', 'Failed to load audio files');
    } finally {
      setLoadingFiles(false);
    }
  }, [showNotification]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newUploadingFiles: UploadingFile[] = files.map(file => ({
      id: uuidv4(),
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(newUploadingFiles);
    setIsUploading(true);

    try {
      const uploadedFiles = await audioAPI.uploadAudio(files, (fileIndex, progress) => {
        setUploadingFiles(prev => prev.map((f, i) => 
          i === fileIndex ? { ...f, progress } : f
        ));
      });

      setUploadingFiles(prev => prev.map(f => ({ ...f, status: 'success' as const, progress: 100 })));
      
      const newAudioFiles = uploadedFiles.map(f => ({
        ...f,
        uploadedAt: new Date(f.uploadedAt)
      }));
      
      setAudioFiles(prev => [...newAudioFiles, ...prev]);
      showNotification('success', `Successfully uploaded ${files.length} file${files.length > 1 ? 's' : ''}`);

      setTimeout(() => {
        setUploadingFiles([]);
      }, 2000);

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Upload failed';
      
      setUploadingFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const, 
        error: errorMessage 
      })));

      showNotification('error', errorMessage);

      setTimeout(() => {
        setUploadingFiles([]);
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  }, [showNotification]);

  const handleSelectAudio = useCallback((audio: AudioFile) => {
    localStorage.setItem('currentAudio', JSON.stringify({
      id: audio.id,
      title: audio.title,
      duration: audio.duration,
      size: audio.size,
    }));
    router.push('/player');
  }, [router]);

  const handleDeleteAudio = useCallback(async (id: string) => {
    setDeletingIds(prev => [...prev, id]);
    
    try {
      await audioAPI.deleteAudio(id);
      setAudioFiles(prev => prev.filter(audio => audio.id !== id));
      showNotification('success', 'Audio file deleted successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to delete audio file';
      showNotification('error', errorMessage);
    } finally {
      setDeletingIds(prev => prev.filter(deletingId => deletingId !== id));
    }
  }, [showNotification]);

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

  if (loading || loadingFiles) {
    return (
      <main className="library-page">
        <div className="library-header">
          <div className="skeleton-line" style={{ height: '2.5rem', width: '220px', marginBottom: '0.75rem', margin: '0 auto 0.75rem' }}></div>
          <div className="skeleton-line" style={{ height: '1.125rem', width: '420px', maxWidth: '90%', margin: '0 auto' }}></div>
        </div>
        <div className="library-content">
          <div className="library-section-new">
            <div className="section-header">
              <div className="skeleton-line" style={{ height: '1.5rem', width: '160px' }}></div>
              <div className="section-header-actions">
                <div className="skeleton-line" style={{ height: '30px', width: '70px', borderRadius: '2px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-default)' }}></div>
                <div className="skeleton-line" style={{ height: '38px', width: '95px', borderRadius: '2px', background: 'var(--color-accent)', opacity: 0.3 }}></div>
              </div>
            </div>
            <div className="files-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="file-card" style={{ pointerEvents: 'none', cursor: 'default' }}>
                  <div className="skeleton-line" style={{ height: '56px', width: '56px', borderRadius: '4px', marginBottom: '1.25rem', background: 'var(--color-accent-subtle)' }}></div>
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-line" style={{ height: '1rem', width: '80%', marginBottom: '0.75rem' }}></div>
                    <div className="skeleton-line" style={{ height: '0.8125rem', width: '40%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="library-page">
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="notification-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="library-header">
        <h1>Audio Library</h1>
        <p>Upload and manage your audio files for transcription</p>
      </div>

      <div className="library-content">
        {uploadingFiles.length > 0 && (
          <div className="upload-progress-section">
            {uploadingFiles.map((file) => (
              <div key={file.id} className={`upload-progress-item ${file.status}`}>
                <div className="upload-file-info">
                  <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <div className="file-details">
                    <span className="file-name">{file.file.name}</span>
                    <span className="file-size">{((file.file.size) / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                  {file.status === 'success' && (
                    <svg className="status-icon success" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {file.status === 'error' && (
                    <svg className="status-icon error" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
                
                {file.status === 'uploading' && (
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${file.progress}%` }}></div>
                  </div>
                )}
                
                {file.status === 'error' && file.error && (
                  <div className="error-info">
                    <span className="error-message">{file.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="library-section-new">
          <div className="section-header">
            <h2>Presentations</h2>
            <div className="section-header-actions">
              <span className="file-count">{audioFiles.length} {audioFiles.length === 1 ? 'file' : 'files'}</span>
              <label className="upload-button-small">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const audioFile = files.find(file => file.type.startsWith('audio/'));
                    if (audioFile) {
                      handleFilesSelected([audioFile]);
                    }
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                  disabled={isUploading}
                />
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Upload
              </label>
            </div>
          </div>
          
          {audioFiles.length === 0 ? (
            <div className="empty-library">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <h3>No audio files yet</h3>
              <p>Upload your first file to get started with transcription and analysis</p>
            </div>
          ) : (
            <AudioList
              audioFiles={audioFiles}
              selectedAudioId={null}
              onSelectAudio={handleSelectAudio}
              onDeleteAudio={handleDeleteAudio}
              deletingIds={deletingIds}
            />
          )}
        </div>
      </div>
    </main>
  );
}

