'use client';

import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { AudioFile, SortOption } from '@/types/audio';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface AudioCardProps {
  audio: AudioFile;
  isSelected: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  onSelect: (audio: AudioFile) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
}

const AudioCard = memo(function AudioCard({
  audio,
  isSelected,
  isDeleting,
  isRenaming,
  onSelect,
  onDelete,
  onRename,
}: AudioCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(audio.title);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);

  const handleClick = useCallback(() => {
    if (!isDeleting && !isEditing) {
      onSelect(audio);
    }
  }, [isDeleting, isEditing, onSelect, audio]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(audio.id);
  }, [onDelete, audio.id]);

  const handleRenameClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(audio.title);
  }, [audio.title]);

  const handleRenameSubmit = useCallback(async () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== audio.title) {
      setPendingTitle(trimmed);
      setIsEditing(false);
      await onRename(audio.id, trimmed);
      setPendingTitle(null);
    } else {
      setIsEditing(false);
    }
  }, [editTitle, audio.title, audio.id, onRename]);

  const handleRenameCancel = useCallback(() => {
    setIsEditing(false);
    setEditTitle(audio.title);
  }, [audio.title]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameSubmit, handleRenameCancel]);

  return (
    <div
      className={`file-card ${isSelected ? 'selected' : ''} ${isDeleting ? 'deleting' : ''}`}
      onClick={handleClick}
    >
      {isDeleting ? (
        <div className="card-deleting">
          <div className="delete-spinner-card"></div>
          <span>Deleting...</span>
        </div>
      ) : (
        <>
          <div className="file-card-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="file-card-content">
            {isEditing ? (
              <div className="file-card-edit" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleRenameSubmit}
                  autoFocus
                  className="file-card-input"
                />
              </div>
            ) : (
              <div className="file-card-title-wrapper">
                <h3 className="file-card-title">{pendingTitle || audio.title}</h3>
                {isRenaming && (
                  <span className="renaming-indicator">
                    <span className="spinner-tiny"></span>
                  </span>
                )}
              </div>
            )}
            <div className="file-card-meta">
              <span className="meta-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {formatSize(audio.size)}
              </span>
            </div>
          </div>
          <div className="file-card-actions">
            <button
              className="file-card-action"
              onClick={handleRenameClick}
              title="Rename file"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
            <button
              className="file-card-action delete"
              onClick={handleDelete}
              title="Delete file"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
});

interface AudioListProps {
  audioFiles: AudioFile[];
  selectedAudioId?: string | null;
  onSelectAudio: (audio: AudioFile) => void;
  onDeleteAudio: (id: string) => void;
  onRenameAudio: (id: string, newTitle: string) => Promise<void>;
  deletingIds?: string[];
  renamingIds?: string[];
}

export default function AudioList({
  audioFiles,
  selectedAudioId,
  onSelectAudio,
  onDeleteAudio,
  onRenameAudio,
  deletingIds = [],
  renamingIds = [],
}: AudioListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filteredAndSortedAudio = useMemo(() => {
    let filtered = audioFiles.filter(audio =>
      audio.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

  const paginatedAudio = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredAndSortedAudio.slice(start, end);
  }, [filteredAndSortedAudio, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedAudio.length / itemsPerPage);

  // Reset to page 1 when search/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  return (
    <div className="audio-list-new">
      <div className="list-controls-new">
        <div className="search-wrapper">
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input-new"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="sort-select-new"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="alphabetical">A-Z</option>
          <option value="largest">Largest File</option>
          <option value="smallest">Smallest File</option>
        </select>
      </div>

      {filteredAndSortedAudio.length === 0 ? (
        <div className="empty-search">
          <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p>No files match your search</p>
        </div>
      ) : (
        <>
          <div className="pagination-info-top">
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndSortedAudio.length)}-{Math.min(currentPage * itemsPerPage, filteredAndSortedAudio.length)} of {filteredAndSortedAudio.length}
          </div>
          
          <div className="files-grid">
            {paginatedAudio.map((audio) => (
              <AudioCard
                key={audio.id}
                audio={audio}
                isSelected={selectedAudioId === audio.id}
                isDeleting={deletingIds.includes(audio.id)}
                isRenaming={renamingIds.includes(audio.id)}
                onSelect={onSelectAudio}
                onDelete={onDeleteAudio}
                onRename={onRenameAudio}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              
              <div className="pagination-pages">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
