'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { AudioFile, UploadingFile } from '@/types/audio';
import { audioAPI } from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Panel from '@/components/ui/Panel';

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'largest' | 'smallest';

const ITEMS_PER_PAGE = 10;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function LibraryPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [renamingIds, setRenamingIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [uploadedFilesToRename, setUploadedFilesToRename] = useState<AudioFile[]>([]);
  const [renamingIndex, setRenamingIndex] = useState(0);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const loadAudioFiles = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const files = await audioAPI.getAllAudio();
      setAudioFiles(files.map((f) => ({ ...f, uploadedAt: new Date(f.uploadedAt) })));
    } catch {
      showNotification('error', 'Failed to load audio files');
    } finally {
      setLoadingFiles(false);
    }
  }, [showNotification]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newUploadingFiles: UploadingFile[] = files.map((file) => ({
      id: uuidv4(),
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(newUploadingFiles);
    setIsUploading(true);

    try {
      const uploadedFiles = await audioAPI.uploadAudio(files, (fileIndex, progress) => {
        setUploadingFiles((prev) => prev.map((f, i) => (i === fileIndex ? { ...f, progress } : f)));
      });

      setUploadingFiles((prev) => prev.map((f) => ({ ...f, status: 'success' as const, progress: 100 })));

      const newAudioFiles = uploadedFiles.map((f) => ({ ...f, uploadedAt: new Date(f.uploadedAt) }));
      setAudioFiles((prev) => [...newAudioFiles, ...prev]);

      setUploadedFilesToRename(newAudioFiles);
      setRenamingIndex(0);
      setRenameValue(newAudioFiles[0]?.title || '');
      setShowRenameModal(true);

      setTimeout(() => {
        setUploadingFiles([]);
      }, 500);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Upload failed';

      setUploadingFiles((prev) => prev.map((f) => ({ ...f, status: 'error' as const, error: errorMessage })));
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
    setRenamingIds((prev) => [...prev, id]);
    try {
      const updatedAudio = await audioAPI.updateAudio(id, newTitle);
      setAudioFiles((prev) => prev.map((audio) => (audio.id === id ? { ...audio, title: updatedAudio.title } : audio)));
      showNotification('success', 'Presentation renamed successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to rename presentation';
      showNotification('error', errorMessage);
      throw error;
    } finally {
      setRenamingIds((prev) => prev.filter((renamingId) => renamingId !== id));
    }
  }, [showNotification]);

  const handleDeleteAudio = useCallback(async (id: string) => {
    setDeletingIds((prev) => [...prev, id]);
    try {
      await audioAPI.deleteAudio(id);
      setAudioFiles((prev) => prev.filter((audio) => audio.id !== id));
      showNotification('success', 'Presentation deleted successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to delete presentation';
      showNotification('error', errorMessage);
    } finally {
      setDeletingIds((prev) => prev.filter((deletingId) => deletingId !== id));
    }
  }, [showNotification]);

  const handleRenameModalSave = useCallback(async () => {
    const currentFile = uploadedFilesToRename[renamingIndex];
    if (!currentFile || !renameValue.trim()) return;

    setRenameError('');
    const trimmedName = renameValue.trim();

    const isDuplicate = audioFiles.some((f) => f.id !== currentFile.id && f.title.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      setRenameError('A presentation with this name already exists');
      return;
    }

    if (trimmedName !== currentFile.title) {
      try {
        await handleRenameAudio(currentFile.id, trimmedName);
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail || 'Failed to rename';
        setRenameError(errorMessage);
        return;
      }
    }

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

  const filteredAndSortedAudio = useMemo(() => {
    const filtered = audioFiles.filter((audio) => audio.title.toLowerCase().includes(searchQuery.toLowerCase()));

    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'largest':
        filtered.sort((a, b) => b.size - a.size);
        break;
      case 'smallest':
        filtered.sort((a, b) => a.size - b.size);
        break;
    }

    return filtered;
  }, [audioFiles, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedAudio.length / ITEMS_PER_PAGE));
  const paginatedAudio = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedAudio.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedAudio, currentPage]);

  const totalSizeMb = useMemo(() => audioFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024), [audioFiles]);

  const startInlineRename = (audio: AudioFile) => {
    setEditingId(audio.id);
    setEditTitle(audio.title);
  };

  const cancelInlineRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const saveInlineRename = async (audio: AudioFile) => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === audio.title) {
      cancelInlineRename();
      return;
    }

    try {
      await handleRenameAudio(audio.id, trimmed);
      cancelInlineRename();
    } catch {
      // Keep input open so user can retry.
    }
  };

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <main className="library-shell app-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="notification-close" aria-label="Dismiss notification">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <header className="library-topbar">
        <div>
          <p className="library-kicker">Studio Console</p>
          <h1>Presentation Library</h1>
          <p className="library-subtitle">Manage uploads, clean naming, and jump into transcript + grading in one click.</p>
        </div>
        <div className="library-metrics">
          <Badge variant="accent">{audioFiles.length} files</Badge>
          <Badge variant="neutral">{totalSizeMb.toFixed(1)} MB total</Badge>
        </div>
      </header>

      <div className="library-grid">
        <Panel className="library-main-panel">
          <div className="library-toolbar">
            <div className="library-search-wrap">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search presentations"
                className="library-search"
              />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="library-sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="alphabetical">A-Z</option>
              <option value="largest">Largest</option>
              <option value="smallest">Smallest</option>
            </select>
          </div>

          {loadingFiles ? (
            <div className="library-loading-state">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="library-row-skeleton">
                  <div className="skeleton-line" style={{ height: '14px', width: '22%' }}></div>
                  <div className="skeleton-line" style={{ height: '14px', width: '14%' }}></div>
                  <div className="skeleton-line" style={{ height: '14px', width: '14%' }}></div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedAudio.length === 0 ? (
            <div className="library-empty-state">
              <h3>No matching presentations</h3>
              <p>Try adjusting your search query or upload a new file.</p>
            </div>
          ) : (
            <>
              <div className="library-table-head" role="presentation">
                <span>Name</span>
                <span>Uploaded</span>
                <span>Size</span>
                <span>Actions</span>
              </div>
              <div className="library-table-body">
                {paginatedAudio.map((audio) => {
                  const isRenaming = renamingIds.includes(audio.id);
                  const isDeleting = deletingIds.includes(audio.id);

                  return (
                    <div key={audio.id} className={`library-row ${isDeleting ? 'is-deleting' : ''}`}>
                      <button className="library-row-main" onClick={() => handleSelectAudio(audio)} disabled={isDeleting}>
                        <span className="library-row-icon" aria-hidden="true">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </span>
                        <span className="library-row-title-wrap">
                          {editingId === audio.id ? (
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => saveInlineRename(audio)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineRename(audio);
                                if (e.key === 'Escape') cancelInlineRename();
                              }}
                              className="library-inline-input"
                              autoFocus
                            />
                          ) : (
                            <>
                              <span className="library-row-title">{audio.title}</span>
                              {isRenaming && <Badge variant="warning">Renaming...</Badge>}
                            </>
                          )}
                        </span>
                      </button>
                      <span className="library-row-cell">{formatDate(audio.uploadedAt)}</span>
                      <span className="library-row-cell">{formatSize(audio.size)}</span>
                      <div className="library-row-actions">
                        <Button variant="ghost" size="sm" onClick={() => startInlineRename(audio)} disabled={isDeleting || isRenaming}>
                          Rename
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteAudio(audio.id)} disabled={isDeleting}>
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="library-pagination">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    Previous
                  </Button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </Panel>

        <aside className="library-rail">
          <Panel className="library-upload-panel">
            <div className="library-panel-head">
              <h2>Upload Queue</h2>
              <Badge variant={isUploading ? 'warning' : 'neutral'}>{isUploading ? 'Uploading' : 'Idle'}</Badge>
            </div>
            <label className={`library-upload-dropzone ${isUploading ? 'is-uploading' : ''}`}>
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith('audio/'));
                  if (files.length > 0) handleFilesSelected(files);
                  e.target.value = '';
                }}
                disabled={isUploading}
              />
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" />
              </svg>
              <strong>{isUploading ? 'Processing files' : 'Upload audio files'}</strong>
              <span>MP3, WAV, OGG, M4A</span>
            </label>

            <div className="library-queue-list">
              {uploadingFiles.length === 0 ? (
                <p className="library-queue-empty">No active uploads.</p>
              ) : (
                uploadingFiles.map((file) => (
                  <div key={file.id} className={`library-queue-item ${file.status}`}>
                    <div>
                      <p>{file.file.name}</p>
                      <span>{formatSize(file.file.size)}</span>
                    </div>
                    <div className="library-queue-meta">
                      {file.status === 'uploading' ? `${file.progress}%` : file.status}
                    </div>
                    {file.status === 'uploading' && (
                      <div className="library-progress-track">
                        <div className="library-progress-fill" style={{ width: `${file.progress}%` }} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <h3 className="library-tip-title">Workflow Tip</h3>
            <p className="library-tip-text">
              Keep file names consistent before grading. A good pattern is `course-week-topic-speaker`.
            </p>
            <code className="library-tip-code">eng101-week4-pitch-alex.mp3</code>
          </Panel>
        </aside>
      </div>

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
              <Button variant="secondary" onClick={handleRenameModalSkip}>
                {renamingIndex < uploadedFilesToRename.length - 1 ? 'Skip' : 'Skip All'}
              </Button>
              <Button variant="primary" onClick={handleRenameModalSave} disabled={!renameValue.trim()}>
                {renamingIndex < uploadedFilesToRename.length - 1 ? 'Save & Next' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
