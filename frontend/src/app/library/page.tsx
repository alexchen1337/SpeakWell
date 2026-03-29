'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { AudioFile, UploadingFile } from '@/types/audio';
import { audioAPI } from '@/services/api';
import Button from '@/components/ui/Button';

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'largest' | 'smallest';

const ITEMS_PER_PAGE = 10;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return Math.abs(h);
}

function MiniWaveform({ seed, active }: { seed: string; active: boolean }) {
  const bars = useMemo(() => {
    let h = hashString(seed);
    return Array.from({ length: 14 }, () => {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      return 6 + (h % 23);
    });
  }, [seed]);

  return (
    <div className={`library-b-waveform ${active ? 'library-b-waveform--active' : ''}`} aria-hidden>
      {bars.map((height, i) => (
        <span key={i} style={{ height: `${height}px` }} />
      ))}
    </div>
  );
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatShortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const formatDuration = (seconds: number | null) => {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

function extensionFromName(name: string): string {
  const i = name.lastIndexOf('.');
  if (i === -1) return '';
  return name.slice(i + 1).toUpperCase();
}

function formatMetaLine(audio: AudioFile): string {
  const ext = extensionFromName(audio.filename || audio.title) || 'AUDIO';
  const rate = ['WAV', 'OGG'].includes(ext) ? '48 kHz' : '44.1 kHz';
  return `${ext} · ${rate}`;
}

export default function LibraryPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
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
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string } }; message?: string };
        const errorMessage = err.response?.data?.detail || err.message || 'Upload failed';

        setUploadingFiles((prev) => prev.map((f) => ({ ...f, status: 'error' as const, error: errorMessage })));
        showNotification('error', errorMessage);

        setTimeout(() => {
          setUploadingFiles([]);
        }, 5000);
      } finally {
        setIsUploading(false);
      }
    },
    [showNotification],
  );

  const openAudioInPlayer = useCallback(
    (audio: AudioFile) => {
      localStorage.setItem(
        'currentAudio',
        JSON.stringify({
          id: audio.id,
          title: audio.title,
          duration: audio.duration,
          size: audio.size,
        }),
      );
      router.push('/player');
    },
    [router],
  );

  const handleRowMainClick = useCallback(
    (audio: AudioFile) => {
      if (selectedId === audio.id) {
        openAudioInPlayer(audio);
      } else {
        setSelectedId(audio.id);
      }
    },
    [selectedId, openAudioInPlayer],
  );

  const handleRenameAudio = useCallback(
    async (id: string, newTitle: string) => {
      setRenamingIds((prev) => [...prev, id]);
      try {
        const updatedAudio = await audioAPI.updateAudio(id, newTitle);
        setAudioFiles((prev) => prev.map((audio) => (audio.id === id ? { ...audio, title: updatedAudio.title } : audio)));
        showNotification('success', 'Presentation renamed successfully');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string } } };
        const errorMessage = err.response?.data?.detail || 'Failed to rename presentation';
        showNotification('error', errorMessage);
        throw error;
      } finally {
        setRenamingIds((prev) => prev.filter((renamingId) => renamingId !== id));
      }
    },
    [showNotification],
  );

  const handleDeleteAudio = useCallback(
    async (id: string, title: string) => {
      const ok = await confirm({
        title: 'Delete presentation',
        message: `Delete "${title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        variant: 'danger',
      });
      if (!ok) return;

      setDeletingIds((prev) => [...prev, id]);
      try {
        await audioAPI.deleteAudio(id);
        setAudioFiles((prev) => prev.filter((audio) => audio.id !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
        showNotification('success', 'Presentation deleted successfully');
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string } } };
        const errorMessage = err.response?.data?.detail || 'Failed to delete presentation';
        showNotification('error', errorMessage);
      } finally {
        setDeletingIds((prev) => prev.filter((deletingId) => deletingId !== id));
      }
    },
    [confirm, showNotification],
  );

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
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string } } };
        const errorMessage = err.response?.data?.detail || 'Failed to rename';
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

  const totalDurationSeconds = useMemo(
    () => audioFiles.reduce((sum, f) => sum + (f.duration ?? 0), 0),
    [audioFiles],
  );

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

  useEffect(() => {
    if (paginatedAudio.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && paginatedAudio.some((a) => a.id === prev)) return prev;
      return null;
    });
  }, [paginatedAudio]);

  const triggerUpload = () => fileInputRef.current?.click();

  const onDropUpload = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []).filter((file) => file.type.startsWith('audio/'));
    if (files.length > 0) handleFilesSelected(files);
  };

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="library-b app-container">
      <input
        ref={fileInputRef}
        type="file"
        className="library-b-file-input"
        accept="audio/*"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith('audio/'));
          if (files.length > 0) handleFilesSelected(files);
          e.target.value = '';
        }}
        disabled={isUploading}
      />

      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button type="button" onClick={() => setNotification(null)} className="notification-close" aria-label="Dismiss notification">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="library-b-body">
        <main className="library-b-main">
          <div className="library-b-toolbar">
            <label className="library-b-search">
              <span className="library-b-search-icon" aria-hidden>
                ⌕
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name…"
                autoComplete="off"
              />
            </label>
            <div className="library-b-toolbar-actions">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="library-b-sort" aria-label="Sort">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="alphabetical">A–Z</option>
                <option value="largest">Largest</option>
                <option value="smallest">Smallest</option>
              </select>
              <button type="button" className="library-b-upload-btn" onClick={triggerUpload} disabled={isUploading}>
                Upload
              </button>
            </div>
          </div>

          {loadingFiles ? (
            <div className="library-b-loading">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="library-b-skel-row" />
              ))}
            </div>
          ) : filteredAndSortedAudio.length === 0 ? (
            <div className="library-b-empty">
              <p>No matching files</p>
              <span>Try another search or upload audio.</span>
            </div>
          ) : (
            <>
              <div className="library-b-thead" role="row">
                <span role="columnheader">＃</span>
                <span role="columnheader">Name</span>
                <span role="columnheader">Waveform</span>
                <span role="columnheader">Duration</span>
                <span role="columnheader">Size</span>
                <span role="columnheader">Date</span>
                <span role="columnheader" className="library-b-th-actions">
                  {' '}
                </span>
              </div>
              <div className="library-b-tbody">
                {paginatedAudio.map((audio, index) => {
                  const isRenaming = renamingIds.includes(audio.id);
                  const isDeleting = deletingIds.includes(audio.id);
                  const rowIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  const isSelected = selectedId === audio.id;
                  const activeWave = isSelected;

                  const rowMain = (
                    <>
                      <span className="library-b-cell library-b-cell-num">{String(rowIndex).padStart(2, '0')}</span>
                      <div className="library-b-cell library-b-cell-name">
                        {editingId === audio.id ? (
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => saveInlineRename(audio)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineRename(audio);
                              if (e.key === 'Escape') cancelInlineRename();
                            }}
                            className="library-b-inline-input"
                            autoFocus
                          />
                        ) : (
                          <>
                            <span className="library-b-title">{audio.title}</span>
                            <span className="library-b-meta">{formatMetaLine(audio)}</span>
                            {isRenaming && <span className="library-b-renaming">Renaming…</span>}
                          </>
                        )}
                      </div>
                      <div className="library-b-cell library-b-cell-wave">
                        <MiniWaveform seed={audio.id} active={activeWave} />
                      </div>
                      <span className="library-b-cell">{formatDuration(audio.duration)}</span>
                      <span className="library-b-cell">{formatSize(audio.size)}</span>
                      <span className="library-b-cell">{formatShortDate(audio.uploadedAt)}</span>
                    </>
                  );

                  return (
                    <div key={audio.id} role="row" className={`library-b-row ${isSelected ? 'is-selected' : ''} ${isDeleting ? 'is-deleting' : ''}`}>
                      {editingId === audio.id ? (
                        <div className="library-b-row-main library-b-row-main--edit">{rowMain}</div>
                      ) : (
                        <button
                          type="button"
                          className="library-b-row-main"
                          onClick={() => handleRowMainClick(audio)}
                          disabled={isDeleting}
                          aria-label={isSelected ? `Open ${audio.title}` : `Select ${audio.title}`}
                        >
                          {rowMain}
                        </button>
                      )}
                      <div className="library-b-cell library-b-cell-actions">
                        <button
                          type="button"
                          className="library-b-mini"
                          onClick={(e) => {
                            e.stopPropagation();
                            startInlineRename(audio);
                          }}
                          disabled={isDeleting || isRenaming}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="library-b-mini library-b-mini-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAudio(audio.id, audio.title);
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="library-b-pagination">
                  <button type="button" className="library-b-page-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button type="button" className="library-b-page-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="library-b-rail">
          <section className="library-b-rail-block">
            <h2 className="library-b-rail-title">Upload queue</h2>
            <label
              className={`library-b-drop ${isUploading ? 'is-busy' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropUpload}
            >
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
              <span className="library-b-drop-icon" aria-hidden>
                ↑
              </span>
              <span className="library-b-drop-strong">Drop to upload</span>
              <span className="library-b-drop-sub">MP3, WAV, OGG, M4A</span>
            </label>

            <ul className="library-b-queue">
              {uploadingFiles.length === 0 ? (
                <li className="library-b-queue-empty">No active uploads.</li>
              ) : (
                uploadingFiles.map((file) => (
                  <li key={file.id} className={`library-b-queue-item ${file.status}`}>
                    <div className="library-b-queue-text">
                      <p>{file.file.name}</p>
                      <span>{formatSize(file.file.size)}</span>
                    </div>
                    <div className="library-b-queue-meta">{file.status === 'uploading' ? `${file.progress}%` : file.status}</div>
                    {file.status === 'uploading' && (
                      <div className="library-b-progress">
                        <div style={{ width: `${file.progress}%` }} />
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="library-b-rail-block">
            <h2 className="library-b-rail-title">Library stats</h2>
            <dl className="library-b-stats">
              <div>
                <dt>Files</dt>
                <dd>{audioFiles.length}</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>{totalSizeMb.toFixed(1)} MB</dd>
              </div>
              <div>
                <dt>Total duration</dt>
                <dd>{formatDuration(totalDurationSeconds || null)}</dd>
              </div>
            </dl>
          </section>

          <section className="library-b-pro-tip">
            <h3>Pro tip</h3>
            <p>Click a row to select it, then click again to open the transcript viewer and grading pane.</p>
          </section>
        </aside>
      </div>

      {showRenameModal && uploadedFilesToRename.length > 0 && (
        <div className="modal-overlay" onClick={handleRenameModalCancel}>
          <div className="modal-content rename-modal library-rename-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Name your presentation</h2>
              <button type="button" className="modal-close" onClick={handleRenameModalCancel}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {uploadedFilesToRename.length > 1 && (
                <p className="library-rename-step" aria-live="polite">
                  <span className="library-rename-step-badge">
                    {renamingIndex + 1} / {uploadedFilesToRename.length}
                  </span>
                </p>
              )}
              <p className="rename-modal-subtitle library-rename-lead">
                {uploadedFilesToRename.length > 1
                  ? 'Title each upload for your library. You can rename later.'
                  : 'Pick a clear title—you can change it anytime.'}
              </p>

              {uploadedFilesToRename[renamingIndex] && (
                <div className="library-rename-source" title={uploadedFilesToRename[renamingIndex].filename}>
                  <span className="library-rename-source-label">Source file</span>
                  <span className="library-rename-source-name">{uploadedFilesToRename[renamingIndex].filename}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="rename-input">Display name</label>
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
                  placeholder="e.g. Week 3 pitch rehearsal"
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
    </div>
  );
}
