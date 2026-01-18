export interface AudioFile {
  id: string;
  title: string;
  filename: string;
  url: string;
  duration: number | null;
  uploadedAt: Date;
  size: number;
  status?: 'uploaded' | 'processing' | 'completed' | 'failed';
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  deceptionConfidence?: 'medium' | 'high' | null;
}

export interface Transcript {
  id: string;
  text: string;
  words: TranscriptWord[];
  createdAt: string;
}

export interface TranscriptResponse {
  audio_id: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  transcript: Transcript | null;
}

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export type SortOption = 'newest' | 'oldest' | 'longest' | 'shortest' | 'alphabetical' | 'largest' | 'smallest';

export interface FilterOptions {
  sortBy: SortOption;
  searchQuery: string;
}

