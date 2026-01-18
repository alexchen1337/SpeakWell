'use client';

import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { TranscriptWord } from '@/types/audio';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface WordSpanProps {
  word: TranscriptWord;
  index: number;
  isActive: boolean;
  isPast: boolean;
  isLast: boolean;
  onWordClick: (time: number) => void;
  activeWordRef: React.RefObject<HTMLSpanElement | null>;
}

const WordSpan = memo(function WordSpan({
  word,
  index,
  isActive,
  isPast,
  isLast,
  onWordClick,
  activeWordRef,
}: WordSpanProps) {
  const handleClick = useCallback(() => {
    onWordClick(word.start);
  }, [onWordClick, word.start]);

  return (
    <React.Fragment>
      <span
        ref={isActive ? activeWordRef : null}
        className={`transcript-word-new ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
        onClick={handleClick}
        data-time={formatTime(word.start)}
      >
        {word.word}
      </span>
      {!isLast && ' '}
    </React.Fragment>
  );
});

interface TranscriptViewProps {
  words: TranscriptWord[];
  currentTime: number;
  onWordClick: (time: number) => void;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  onRetry?: () => void;
}

export default function TranscriptView({ 
  words, 
  currentTime, 
  onWordClick, 
  status,
  onRetry 
}: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const activeWordIndex = words.findIndex(
    (word, i) => currentTime >= word.start && (i === words.length - 1 || currentTime < words[i + 1].start)
  );

  useEffect(() => {
    if (autoScroll && activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const word = activeWordRef.current;
      const containerRect = container.getBoundingClientRect();
      const wordRect = word.getBoundingClientRect();
      
      const isVisible = wordRect.top >= containerRect.top && wordRect.bottom <= containerRect.bottom;
      
      if (!isVisible) {
        word.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeWordIndex, autoScroll]);

  const handleScroll = useCallback(() => {
    setAutoScroll(false);
  }, []);

  const handleWordClick = (time: number) => {
    setAutoScroll(true);
    onWordClick(time);
  };

  if (status === 'processing') {
    return (
      <div className="transcript-status">
        <div className="transcript-spinner"></div>
        <h3>Transcribing audio</h3>
        <p>This may take a few moments</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="transcript-status error">
        <svg className="transcript-error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h3>Transcription failed</h3>
        <p>Unable to process the audio file</p>
        {onRetry && (
          <button className="retry-btn" onClick={onRetry}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (status === 'uploaded' || words.length === 0) {
    return (
      <div className="transcript-status">
        <div className="transcript-spinner"></div>
        <h3>Preparing transcript</h3>
        <p>Transcription will begin shortly</p>
      </div>
    );
  }

  const currentWord = activeWordIndex >= 0 ? words[activeWordIndex] : null;

  return (
    <div className="transcript-container-new">
      <div className="transcript-controls">
        <div className="transcript-info">
          <span className="word-count">{words.length} words</span>
          {currentWord && (
            <span className="current-time">{formatTime(currentWord.start)}</span>
          )}
        </div>
        <button
          className={`auto-scroll-toggle ${autoScroll ? 'active' : ''}`}
          onClick={() => setAutoScroll(!autoScroll)}
          title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
          {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
        </button>
      </div>
      <div
        ref={containerRef}
        className="transcript-content-new"
        onScroll={handleScroll}
      >
        <div className="transcript-text-new">
          {words.map((word, index) => (
            <WordSpan
              key={`${index}-${word.start}`}
              word={word}
              index={index}
              isActive={index === activeWordIndex}
              isPast={index < activeWordIndex}
              isLast={index === words.length - 1}
              onWordClick={handleWordClick}
              activeWordRef={activeWordRef}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
