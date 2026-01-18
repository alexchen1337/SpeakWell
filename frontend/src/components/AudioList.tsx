'use client';

import React, { useState, useMemo } from 'react';
import { AudioFile, SortOption } from '@/types/audio';

interface AudioListProps {
  audioFiles: AudioFile[];
  selectedAudioId?: string | null;
  onSelectAudio: (audio: AudioFile) => void;
  onDeleteAudio: (id: string) => void;
  deletingIds?: string[];
}

export default function AudioList({
  audioFiles,
  selectedAudioId,
  onSelectAudio,
  onDeleteAudio,
  deletingIds = [],
}: AudioListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '--:--';
    if (seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      case 'longest':
        filtered.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'shortest':
        filtered.sort((a, b) => (a.duration || 0) - (b.duration || 0));
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

  return (
    <div className="audio-list">
      <div className="list-controls">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="sort-select"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="longest">Longest</option>
          <option value="shortest">Shortest</option>
          <option value="alphabetical">A-Z</option>
          <option value="largest">Largest</option>
          <option value="smallest">Smallest</option>
        </select>
      </div>

      <div className="list-items">
        {filteredAndSortedAudio.length === 0 ? (
          <div className="empty-state">
            <p>{searchQuery ? 'No files match your search' : 'No files uploaded yet'}</p>
          </div>
        ) : (
          filteredAndSortedAudio.map((audio) => {
            const isDeleting = deletingIds.includes(audio.id);
            return (
              <div
                key={audio.id}
                className={`audio-item ${selectedAudioId === audio.id ? 'selected' : ''} ${isDeleting ? 'deleting' : ''}`}
                onClick={() => !isDeleting && onSelectAudio(audio)}
                style={{ pointerEvents: isDeleting ? 'none' : 'auto' }}
              >
                <div className="audio-item-main">
                  {isDeleting ? (
                    <div className="delete-spinner"></div>
                  ) : (
                    <svg className="audio-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  )}
                  <div className="audio-info">
                    <h4>{audio.title}</h4>
                    <div className="audio-meta">
                      <span>{formatDuration(audio.duration)}</span>
                      <span>·</span>
                      <span>{formatSize(audio.size)}</span>
                    </div>
                  </div>
                </div>
                {!isDeleting && (
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAudio(audio.id);
                    }}
                    title="Delete"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
