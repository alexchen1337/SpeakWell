'use client';

import React, { useRef, useState } from 'react';
import { UploadingFile } from '@/types/audio';

interface AudioUploadProps {
  onFilesSelected: (files: File[]) => void;
  uploadingFiles: UploadingFile[];
  isUploading: boolean;
}

export default function AudioUpload({ onFilesSelected, uploadingFiles, isUploading }: AudioUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length > 0) {
      onFilesSelected(audioFiles);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length > 0) {
      onFilesSelected(audioFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="audio-upload">
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <svg className="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" />
        </svg>
        <h3>{isUploading ? 'Uploading' : 'Drop files here'}</h3>
        <p>{isUploading ? 'Please wait while your files are being processed' : 'or click to browse from your device'}</p>
        {!isUploading && <p className="upload-hint">MP3, WAV, OGG, M4A supported</p>}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={isUploading}
      />

      {uploadingFiles.length > 0 && (
        <div className="upload-progress-list">
          {uploadingFiles.map((file) => (
            <div key={file.id} className={`upload-progress-item ${file.status}`}>
              <div className="upload-file-info">
                <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <div className="file-details">
                  <span className="file-name">{file.file.name}</span>
                  <span className="file-size">{formatFileSize(file.file.size)}</span>
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
    </div>
  );
}
