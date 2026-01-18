'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { audioAPI, transcriptAPI } from '@/services/api';
import AudioPlayer, { AudioPlayerHandle } from '@/components/AudioPlayer';
import TranscriptView from '@/components/TranscriptView';
import { TranscriptWord } from '@/types/audio';

interface StoredAudioFile {
  id: string;
  title: string;
  url: string;
  duration: number | null;
  size: number;
}

export default function PlayerPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [audio, setAudio] = useState<StoredAudioFile | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [transcriptWords, setTranscriptWords] = useState<TranscriptWord[]>([]);
  const [transcriptStatus, setTranscriptStatus] = useState<'uploaded' | 'processing' | 'completed' | 'failed'>('uploaded');
  const [currentTime, setCurrentTime] = useState(0);
  const [skeletonWidths, setSkeletonWidths] = useState<number[]>([]);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isAuthenticated) {
      loadAudioFile();
    }
  }, [router, isAuthenticated, loading]);

  const loadTranscript = useCallback(async (audioId: string) => {
    try {
      const response = await transcriptAPI.getTranscript(audioId);
      setTranscriptStatus(response.status);
      
      if (response.transcript) {
        setTranscriptWords(response.transcript.words);
      }
      
      return response.status;
    } catch {
      return null;
    }
  }, []);

  const startPolling = useCallback((audioId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      const status = await loadTranscript(audioId);
      if (status === 'completed' || status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }, 3000);
  }, [loadTranscript]);

  const loadAudioFile = async () => {
    try {
      setLoadingAudio(true);
      setError(null);
      
      const storedAudio = localStorage.getItem('currentAudio');
      if (!storedAudio) {
        router.push('/');
        return;
      }

      const audioData = JSON.parse(storedAudio);
      
      const freshAudio = await audioAPI.getAudio(audioData.id);
      
      if (!freshAudio.url) {
        throw new Error('Audio URL not available');
      }
      
      setAudio({
        id: freshAudio.id,
        title: freshAudio.title,
        url: freshAudio.url,
        duration: freshAudio.duration,
        size: freshAudio.size,
      });

      const status = await loadTranscript(freshAudio.id);
      if (status === 'uploaded' || status === 'processing') {
        startPolling(freshAudio.id);
      }
    } catch (err: any) {
      const errorMsg = err.response?.status === 404 
        ? 'Audio file not found. It may have been deleted.'
        : 'Failed to load audio file. Please try again.';
      setError(errorMsg);
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleWordClick = (time: number) => {
    audioPlayerRef.current?.seekTo(time);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleRetryTranscription = async () => {
    if (!audio) return;
    
    try {
      await transcriptAPI.retryTranscription(audio.id);
      setTranscriptStatus('processing');
      setTranscriptWords([]);
      startPolling(audio.id);
    } catch {
      // silent fail
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  useEffect(() => {
    // Generate skeleton widths only on client side to avoid hydration mismatch
    if (typeof window !== 'undefined') {
      setSkeletonWidths([1, 2, 3, 4, 5].map(() => 60 + Math.random() * 30));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  if (loading || loadingAudio) {
    return (
      <main className="app-container">
        <div className="skeleton-header">
          <div className="skeleton-line" style={{ height: '40px', width: '140px', marginBottom: 0 }}></div>
        </div>
        <div className="player-page-grid">
          <div className="player-main">
            <div className="skeleton-line" style={{ height: '24px', width: '200px', marginBottom: '1rem' }}></div>
            <div className="skeleton-line" style={{ height: '120px', width: '100%', marginBottom: '1rem' }}></div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="skeleton-line" style={{ height: '44px', width: '44px', borderRadius: '50%' }}></div>
              <div className="skeleton-line" style={{ height: '16px', width: '100px' }}></div>
            </div>
          </div>
          <div className="transcription-section">
            <div className="skeleton-line" style={{ height: '20px', width: '120px', marginBottom: '1rem' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton-line" style={{ height: '16px', width: skeletonWidths[i - 1] ? `${skeletonWidths[i - 1]}%` : '75%' }}></div>
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

  if (error) {
    return (
      <main className="app-container">
        <header className="app-header">
          <button onClick={handleBack} className="back-button">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to library
          </button>
        </header>
        <div className="error-state-page">
          <svg className="error-icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h2>File not found</h2>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!audio) {
    return null;
  }

  return (
    <main className="app-container">
      <header className="app-header">
        <button onClick={handleBack} className="back-button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to library
        </button>
      </header>

      <div className="player-page-grid">
        <div className="player-main">
          <AudioPlayer 
            ref={audioPlayerRef}
            audio={audio} 
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        <div className="transcription-section">
          <TranscriptView
            words={transcriptWords}
            currentTime={currentTime}
            onWordClick={handleWordClick}
            status={transcriptStatus}
            onRetry={handleRetryTranscription}
          />
        </div>
      </div>
    </main>
  );
}
