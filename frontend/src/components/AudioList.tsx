'use client';

import React, { useState, useMemo, memo, useCallback } from 'react';
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
  onSelect: (audio: AudioFile) => void;
  onDelete: (id: string) => void;
}

const AudioCard = memo(function AudioCard({
  audio,
  isSelected,
  isDeleting,
  onSelect,
  onDelete,
}: AudioCardProps) {
  const handleClick = useCallback(() => {
    if (!isDeleting) {
      onSelect(audio);
    }
  }, [isDeleting, onSelect, audio]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(audio.id);
  }, [onDelete, audio.id]);

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
            <h3 className="file-card-title">{audio.title}</h3>
            <div className="file-card-meta">
              <span className="meta-item">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {formatSize(audio.size)}
              </span>
            </div>
          </div>
          <button
            className="file-card-delete"
            onClick={handleDelete}
            title="Delete file"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
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
        <div className="files-grid">
          {filteredAndSortedAudio.map((audio) => (
            <AudioCard
              key={audio.id}
              audio={audio}
              isSelected={selectedAudioId === audio.id}
              isDeleting={deletingIds.includes(audio.id)}
              onSelect={onSelectAudio}
              onDelete={onDeleteAudio}
            />
          ))}
        </div>
      )}
    </div>
  );
}
