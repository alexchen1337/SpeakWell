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
      router.push('/library');
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
    router.push('/library');
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
      <main className="player-container">
        <div className="player-header-bar">
          <div className="skeleton-line" style={{ height: '36px', width: '160px', borderRadius: '2px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            <div className="skeleton-line" style={{ width: '24px', height: '24px', flexShrink: 0 }}></div>
            <div className="skeleton-line" style={{ height: '1.5rem', flex: 1, maxWidth: '400px' }}></div>
          </div>
          <div className="skeleton-line" style={{ height: '30px', width: '70px', borderRadius: '2px' }}></div>
        </div>
        <div className="player-layout">
          <div className="player-panel">
            <div className="player-section-header">
              <div className="skeleton-line" style={{ height: '1.125rem', width: '140px' }}></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="skeleton-line" style={{ height: '140px', width: '100%', borderRadius: '2px' }}></div>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div className="skeleton-line" style={{ height: '48px', width: '48px', borderRadius: '2px' }}></div>
                <div className="skeleton-line" style={{ height: '0.75rem', width: '120px' }}></div>
              </div>
            </div>
          </div>
          <div className="transcript-panel">
            <div className="transcript-section-header">
              <div className="skeleton-line" style={{ height: '1.125rem', width: '120px' }}></div>
            </div>
            <div className="transcript-container-new">
              <div className="transcript-controls">
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="skeleton-line" style={{ height: '30px', width: '80px', borderRadius: '2px' }}></div>
                  <div className="skeleton-line" style={{ height: '30px', width: '60px', borderRadius: '2px' }}></div>
                </div>
                <div className="skeleton-line" style={{ height: '36px', width: '140px', borderRadius: '2px' }}></div>
              </div>
              <div className="transcript-content-new">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '900px', margin: '0 auto' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="skeleton-line" style={{ height: '1.05rem', width: skeletonWidths[i - 1] ? `${skeletonWidths[i - 1]}%` : '85%' }}></div>
                  ))}
                </div>
              </div>
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
    <main className="player-container">
      <div className="player-header-bar">
        <button onClick={handleBack} className="back-button-new">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back to Library</span>
        </button>
        <div className="player-title-bar">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <h1>{audio.title}</h1>
        </div>
        <div className="player-file-size">
          {(audio.size / (1024 * 1024)).toFixed(1)} MB
        </div>
      </div>

      <div className="player-layout">
        <div className="player-panel">
          <div className="player-section-header">
            <h2>Audio Player</h2>
          </div>
          <AudioPlayer 
            ref={audioPlayerRef}
            audio={audio} 
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        <div className="transcript-panel">
          <div className="transcript-section-header">
            <h2>Transcript</h2>
            {transcriptStatus === 'completed' && (
              <div className="transcript-badge">
                {transcriptWords.length} words
              </div>
            )}
          </div>
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
