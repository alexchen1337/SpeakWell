'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { audioAPI, transcriptAPI, rubricAPI, gradingAPI } from '@/services/api';
import AudioPlayer, { AudioPlayerHandle } from '@/components/AudioPlayer';
import TranscriptView from '@/components/TranscriptView';
import RubricSelectorModal from '@/components/RubricSelectorModal';
import GradingResultsModal from '@/components/GradingResultsModal';
import { TranscriptWord } from '@/types/audio';
import { Rubric, Grading } from '@/types/grading';

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
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [skeletonWidths, setSkeletonWidths] = useState<number[]>([]);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Grading state
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [gradings, setGradings] = useState<Grading[]>([]);
  const [showRubricSelector, setShowRubricSelector] = useState(false);
  const [showGradingResults, setShowGradingResults] = useState(false);
  const [gradingInProgress, setGradingInProgress] = useState(false);
  const gradingPollRef = useRef<NodeJS.Timeout | null>(null);

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
        setTranscriptId(response.transcript.id);
      }
      
      return { status: response.status, transcriptId: response.transcript?.id };
    } catch {
      return null;
    }
  }, []);

  const loadRubrics = useCallback(async () => {
    try {
      const data = await rubricAPI.list();
      setRubrics(data);
    } catch {
      // Silent fail - rubrics are optional
    }
  }, []);

  const loadGradings = useCallback(async (tId: string) => {
    try {
      const data = await gradingAPI.list(tId);
      setGradings(data);
      
      // Check if any grading is still processing
      const hasProcessing = data.some(g => g.status === 'processing');
      if (hasProcessing) {
        startGradingPolling(tId);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const startGradingPolling = useCallback((tId: string) => {
    if (gradingPollRef.current) {
      clearInterval(gradingPollRef.current);
    }
    
    gradingPollRef.current = setInterval(async () => {
      try {
        const data = await gradingAPI.list(tId);
        setGradings(data);
        
        // Stop polling if no grading is processing
        const hasProcessing = data.some(g => g.status === 'processing');
        if (!hasProcessing) {
          if (gradingPollRef.current) {
            clearInterval(gradingPollRef.current);
            gradingPollRef.current = null;
          }
          setGradingInProgress(false);
        }
      } catch {
        // Silent fail
      }
    }, 3000);
  }, []);

  const startPolling = useCallback((audioId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      const result = await loadTranscript(audioId);
      if (result?.status === 'completed' || result?.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        // Load gradings when transcript is complete
        if (result?.status === 'completed' && result?.transcriptId) {
          loadGradings(result.transcriptId);
        }
      }
    }, 3000);
  }, [loadTranscript, loadGradings]);

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

      // Load rubrics for grading
      loadRubrics();

      const result = await loadTranscript(freshAudio.id);
      if (result?.status === 'uploaded' || result?.status === 'processing') {
        startPolling(freshAudio.id);
      } else if (result?.status === 'completed' && result?.transcriptId) {
        // Load existing gradings if transcript is complete
        loadGradings(result.transcriptId);
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

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

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

  const handleInitiateGrading = async (rubricId: string) => {
    if (!transcriptId) return;
    
    try {
      setGradingInProgress(true);
      setShowRubricSelector(false);
      
      const newGrading = await gradingAPI.initiate({
        transcript_id: transcriptId,
        rubric_id: rubricId,
      });
      
      setGradings(prev => [...prev, newGrading]);
      startGradingPolling(transcriptId);
    } catch (err) {
      setGradingInProgress(false);
      console.error('Failed to initiate grading:', err);
    }
  };

  const handleDeleteGrading = useCallback(async (gradingId: string) => {
    try {
      await gradingAPI.delete(gradingId);
      setGradings(prev => {
        const updated = prev.filter(g => g.id !== gradingId);
        // Modal will auto-close via useEffect when gradings become empty
        return updated;
      });
    } catch (err) {
      console.error('Failed to delete grading:', err);
      throw err; // Re-throw so modal can handle it
    }
  }, []);


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
      if (gradingPollRef.current) {
        clearInterval(gradingPollRef.current);
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

  const completedGradings = gradings.filter(g => g.status === 'completed');
  const processingGradings = gradings.filter(g => g.status === 'processing');

  return (
    <main className="player-container">
      <div className="player-header-bar">
        <button onClick={handleBack} className="back-button-new">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back to Library</span>
        </button>
        <div className="player-header-actions">
          {transcriptStatus === 'completed' && (
            <>
              {processingGradings.length > 0 && (
                <div className="grading-status-badge">
                  <span className="spinner-small"></span>
                  Grading...
                </div>
              )}
              {completedGradings.length > 0 && (
                <button 
                  className="btn-secondary btn-small"
                  onClick={() => setShowGradingResults(true)}
                >
                  View Grading ({completedGradings.length})
                </button>
              )}
              <button 
                className="btn-primary btn-small"
                onClick={() => setShowRubricSelector(true)}
                disabled={gradingInProgress}
              >
                Grade Presentation
              </button>
            </>
          )}
          <div className="player-file-size">
            {(audio.size / (1024 * 1024)).toFixed(1)} MB
          </div>
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

      {showRubricSelector && (
        <RubricSelectorModal
          rubrics={rubrics}
          onSelect={handleInitiateGrading}
          onCancel={() => setShowRubricSelector(false)}
        />
      )}

      {showGradingResults && (
        <GradingResultsModal
          gradings={completedGradings}
          onClose={() => setShowGradingResults(false)}
          onDelete={handleDeleteGrading}
        />
      )}
    </main>
  );
}
