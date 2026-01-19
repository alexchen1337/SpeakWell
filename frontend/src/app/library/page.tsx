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
  const [renamingIds, setRenamingIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [uploadedFilesToRename, setUploadedFilesToRename] = useState<AudioFile[]>([]);
  const [renamingIndex, setRenamingIndex] = useState(0);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

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
      
      // Show rename modal immediately
      setUploadedFilesToRename(newAudioFiles);
      setRenamingIndex(0);
      setRenameValue(newAudioFiles[0]?.title || '');
      setShowRenameModal(true);

      // Clear upload progress after showing modal
      setTimeout(() => {
        setUploadingFiles([]);
      }, 500);

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

  const handleRenameAudio = useCallback(async (id: string, newTitle: string) => {
    setRenamingIds(prev => [...prev, id]);
    
    try {
      const updatedAudio = await audioAPI.updateAudio(id, newTitle);
      setAudioFiles(prev => prev.map(audio => 
        audio.id === id ? { ...audio, title: updatedAudio.title } : audio
      ));
      showNotification('success', 'Presentation renamed successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to rename presentation';
      showNotification('error', errorMessage);
      throw error; // Re-throw so callers can handle it
    } finally {
      setRenamingIds(prev => prev.filter(renamingId => renamingId !== id));
    }
  }, [showNotification]);

  const handleDeleteAudio = useCallback(async (id: string) => {
    setDeletingIds(prev => [...prev, id]);
    
    try {
      await audioAPI.deleteAudio(id);
      setAudioFiles(prev => prev.filter(audio => audio.id !== id));
      showNotification('success', 'Presentation deleted successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to delete presentation';
      showNotification('error', errorMessage);
    } finally {
      setDeletingIds(prev => prev.filter(deletingId => deletingId !== id));
    }
  }, [showNotification]);

  const handleRenameModalSave = useCallback(async () => {
    const currentFile = uploadedFilesToRename[renamingIndex];
    if (!currentFile || !renameValue.trim()) return;
    
    setRenameError('');
    const trimmedName = renameValue.trim();
    
    // Check for duplicate name client-side (excluding current file)
    const isDuplicate = audioFiles.some(
      f => f.id !== currentFile.id && f.title.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (isDuplicate) {
      setRenameError('A presentation with this name already exists');
      return;
    }

    // Only rename if the value changed
    if (trimmedName !== currentFile.title) {
      try {
        await handleRenameAudio(currentFile.id, trimmedName);
      } catch (error: any) {
        // Show inline error if it's a duplicate error from backend
        const errorMessage = error.response?.data?.detail || 'Failed to rename';
        setRenameError(errorMessage);
        return;
      }
    }
    
    // Move to next file or close modal
    if (renamingIndex < uploadedFilesToRename.length - 1) {
      const nextIndex = renamingIndex + 1;
      setRenamingIndex(nextIndex);
      setRenameValue(uploadedFilesToRename[nextIndex].title);
      setRenameError('');
    } else {
      setShowRenameModal(false);
      setUploadedFilesToRename([]);
      setRenamingIndex(0);
      setRenameError('');
      showNotification('success', `Successfully uploaded ${uploadedFilesToRename.length} file${uploadedFilesToRename.length > 1 ? 's' : ''}`);
    }
  }, [uploadedFilesToRename, renamingIndex, renameValue, audioFiles, handleRenameAudio, showNotification]);

  const handleRenameModalSkip = useCallback(() => {
    setRenameError('');
    if (renamingIndex < uploadedFilesToRename.length - 1) {
      const nextIndex = renamingIndex + 1;
      setRenamingIndex(nextIndex);
      setRenameValue(uploadedFilesToRename[nextIndex].title);
    } else {
      setShowRenameModal(false);
      setUploadedFilesToRename([]);
      setRenamingIndex(0);
      showNotification('success', `Successfully uploaded ${uploadedFilesToRename.length} file${uploadedFilesToRename.length > 1 ? 's' : ''}`);
    }
  }, [uploadedFilesToRename, renamingIndex, showNotification]);

  const handleRenameModalCancel = useCallback(() => {
    setShowRenameModal(false);
    setUploadedFilesToRename([]);
    setRenamingIndex(0);
    setRenameError('');
    showNotification('success', `Successfully uploaded ${uploadedFilesToRename.length} file${uploadedFilesToRename.length > 1 ? 's' : ''}`);
  }, [uploadedFilesToRename.length, showNotification]);

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
        <h1>Presentation Library</h1>
        <p>Upload and manage your presentations for transcription and analysis</p>
      </div>

      <div className="library-content">
        <div className="library-section-new">
          <div className="section-header">
            <h2>Presentations</h2>
            <div className="section-header-actions">
              <span className="file-count">{audioFiles.length} {audioFiles.length === 1 ? 'file' : 'files'}</span>
              <label className="upload-button-small">
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
                    if (audioFiles.length > 0) {
                      handleFilesSelected(audioFiles);
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
          
          {audioFiles.length === 0 && uploadingFiles.length === 0 ? (
            <div className="empty-library">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <h3>No presentations yet</h3>
              <p>Upload your first presentation to get started with transcription and analysis</p>
            </div>
          ) : (
            <>
              {uploadingFiles.length > 0 && (
                <div className="files-grid" style={{ marginBottom: audioFiles.length > 0 ? '2rem' : '0' }}>
                  {uploadingFiles.map((file) => (
                    <div key={file.id} className={`file-card uploading-card ${file.status}`}>
                      <div className="file-card-icon skeleton-pulse">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div className="file-card-content">
                        <h3 className="file-card-title">{file.file.name}</h3>
                        <div className="file-card-meta">
                          <span className="meta-item">
                            {file.status === 'uploading' && `${file.progress}%`}
                            {file.status === 'success' && 'Complete'}
                            {file.status === 'error' && 'Failed'}
                          </span>
                        </div>
                        {file.status === 'uploading' && (
                          <div className="progress-bar-container" style={{ marginTop: '0.5rem' }}>
                            <div className="progress-bar" style={{ width: `${file.progress}%` }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {audioFiles.length > 0 && (
                <AudioList
                  audioFiles={audioFiles}
                  selectedAudioId={null}
                  onSelectAudio={handleSelectAudio}
                  onDeleteAudio={handleDeleteAudio}
                  onRenameAudio={handleRenameAudio}
                  deletingIds={deletingIds}
                  renamingIds={renamingIds}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {showRenameModal && uploadedFilesToRename.length > 0 && (
        <div className="modal-overlay" onClick={handleRenameModalCancel}>
          <div className="modal-content rename-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Name Your Presentation</h2>
              <button className="modal-close" onClick={handleRenameModalCancel}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <p className="rename-modal-subtitle">
                {uploadedFilesToRename.length > 1 
                  ? `File ${renamingIndex + 1} of ${uploadedFilesToRename.length}`
                  : 'Give your presentation a memorable name'}
              </p>
              
              <div className="form-group">
                <label htmlFor="rename-input">Presentation Name</label>
                <input
                  id="rename-input"
                  type="text"
                  className={`form-input ${renameError ? 'input-error' : ''}`}
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    if (renameError) setRenameError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameModalSave();
                    } else if (e.key === 'Escape') {
                      handleRenameModalCancel();
                    }
                  }}
                  placeholder="Enter presentation name"
                  autoFocus
                />
                {renameError && <span className="field-error">{renameError}</span>}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleRenameModalSkip}>
                {renamingIndex < uploadedFilesToRename.length - 1 ? 'Skip' : 'Skip All'}
              </button>
              <button 
                className="btn-primary" 
                onClick={handleRenameModalSave}
                disabled={!renameValue.trim()}
              >
                {renamingIndex < uploadedFilesToRename.length - 1 ? 'Save & Next' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

