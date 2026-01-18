'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useRouter } from 'next/navigation';

interface AudioPlayerProps {
  audio: {
    id: string;
    title: string;
    url: string;
    duration: number | null;
    size?: number;
  } | null;
  onTimeUpdate?: (time: number) => void;
}

export interface AudioPlayerHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ audio, onTimeUpdate }, ref) => {
  const router = useRouter();
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [error, setError] = useState<string | null>(null);
  const [waveformReady, setWaveformReady] = useState(false);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    if (!waveformRef.current) return;

    let ws: WaveSurfer | null = null;
    let cancelled = false;
    const container = waveformRef.current;

    const initWaveSurfer = async () => {
      const WaveSurferModule = await import('wavesurfer.js');
      const WaveSurfer = WaveSurferModule.default;

      if (cancelled || !container) return;

      ws = WaveSurfer.create({
        container,
        waveColor: 'rgba(153, 153, 153, 0.2)',
        progressColor: '#2563eb',
        cursorColor: '#2563eb',
        barWidth: 2,
        barRadius: 1,
        cursorWidth: 1,
        height: 80,
        barGap: 2,
        interact: true,
        hideScrollbar: true,
      });

      wavesurferRef.current = ws;
      setWaveformReady(true);

      ws.on('ready', () => {
        setDuration(ws!.getDuration());
        ws!.setVolume(0.7);
        setError(null);
      });

      ws.on('audioprocess', () => {
        const time = ws!.getCurrentTime();
        setCurrentTime(time);
        onTimeUpdateRef.current?.(time);
      });

      const handleSeekClick = () => {
        setTimeout(() => {
          if (wavesurferRef.current) {
            const time = wavesurferRef.current.getCurrentTime();
            setCurrentTime(time);
            onTimeUpdateRef.current?.(time);
          }
        }, 10);
      };

      container.addEventListener('click', handleSeekClick);

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));

      ws.on('error', (error) => {
        if (error.name !== 'AbortError') {
          setError('Failed to load audio file. The file may be missing or corrupted.');
        }
      });
    };

    initWaveSurfer();

    return () => {
      cancelled = true;
      if (ws) {
        try {
          if (ws.isPlaying()) {
            ws.pause();
          }
          ws.destroy();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!waveformReady) return;

    if (wavesurferRef.current && audio && audio.url) {
      setError(null);

      wavesurferRef.current.load(audio.url).catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Failed to load audio file. The file may be missing or corrupted.');
        }
      });
      setIsPlaying(false);
      setCurrentTime(0);
    } else if (audio && !audio.url) {
      setError('Audio URL is not available. Please try refreshing the page.');
    }
  }, [audio, waveformReady]);

  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(volume);
    }
  }, [volume]);

  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (wavesurferRef.current) {
        const duration = wavesurferRef.current.getDuration();
        if (duration > 0) {
          wavesurferRef.current.seekTo(time / duration);
          setCurrentTime(time);
          onTimeUpdateRef.current?.(time);
        }
      }
    },
    getCurrentTime: () => {
      return wavesurferRef.current?.getCurrentTime() ?? 0;
    }
  }), []);

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGoHome = () => {
    router.push('/');
  };

  if (error) {
    return (
      <div className="audio-player error-state">
        <div className="error-content">
          <svg className="error-icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h3 className="error-title">Unable to load audio</h3>
          <p className="error-message">{error}</p>
          <button onClick={handleGoHome} className="error-button">
            <svg className="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to library
          </button>
        </div>
      </div>
    );
  }

  if (!audio) {
    return (
      <div className="audio-player empty">
        <div className="empty-player">
          <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p>Select a file to play</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-player">
      <div className="player-header">
        <h3>{audio.title}</h3>
      </div>

      <div className="waveform-container" ref={waveformRef} />

      <div className="player-controls">
        <button className="play-btn" onClick={togglePlayPause}>
          {isPlaying ? (
            <svg fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v14.72a1 1 0 001.5.86l11.5-7.36a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z" />
            </svg>
          )}
        </button>

        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="volume-control">
          <svg className="volume-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
