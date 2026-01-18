'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import AudioUpload from '@/components/AudioUpload';
import AudioList from '@/components/AudioList';
import { AudioFile, UploadingFile } from '@/types/audio';
import { audioAPI } from '@/services/api';

export default function Home() {
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

  if (loading) {
    return (
      <main className="app-container">
        <div className="skeleton-header">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-subtitle"></div>
        </div>
        <div className="library-section">
          <div className="list-controls">
            <div className="skeleton-line" style={{ height: '38px', flex: 1 }}></div>
            <div className="skeleton-line" style={{ height: '38px', width: '120px' }}></div>
          </div>
          <div className="list-items">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="audio-item-skeleton">
                <div className="skeleton-line" style={{ width: '32px', height: '32px', borderRadius: '4px' }}></div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div className="skeleton-line" style={{ height: '16px', width: '60%' }}></div>
                  <div className="skeleton-line" style={{ height: '12px', width: '30%' }}></div>
                </div>
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

  return (
    <main className="app-container">
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

      <header className="app-header">
        <h1>Audio Library</h1>
        <p>Upload, manage, and analyze your audio files</p>
      </header>

      <AudioUpload 
        onFilesSelected={handleFilesSelected}
        uploadingFiles={uploadingFiles}
        isUploading={isUploading}
      />

      <div className="library-section">
        {loadingFiles ? (
          <>
            <div className="list-controls">
              <div className="skeleton-line" style={{ height: '38px', flex: 1 }}></div>
              <div className="skeleton-line" style={{ height: '38px', width: '120px' }}></div>
            </div>
            <div className="list-items">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="audio-item-skeleton">
                  <div className="skeleton-line" style={{ width: '32px', height: '32px', borderRadius: '4px' }}></div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div className="skeleton-line" style={{ height: '16px', width: '60%' }}></div>
                    <div className="skeleton-line" style={{ height: '12px', width: '30%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </>
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
    </main>
  );
}
