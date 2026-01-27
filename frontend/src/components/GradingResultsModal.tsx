'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Grading } from '@/types/grading';
import './GradingResultsModal.css';

interface GradingResultsModalProps {
  gradings: Grading[];
  onClose: () => void;
  onDelete: (gradingId: string) => Promise<void> | void;
  currentUserId?: string;
}

type ViewTab = 'overview' | 'content' | 'delivery';

export default function GradingResultsModal({
  gradings,
  onClose,
  onDelete,
  currentUserId
}: GradingResultsModalProps) {
  const [selectedGradingIndex, setSelectedGradingIndex] = useState(0);
  const [activeView, setActiveView] = useState<ViewTab>('overview');
  const [isDeleting, setIsDeleting] = useState(false);

  // Memoized current grading to prevent unnecessary re-renders
  const currentGrading = useMemo(() => {
    if (gradings.length === 0) return null;
    // Ensure index is within bounds
    const safeIndex = Math.min(selectedGradingIndex, gradings.length - 1);
    return gradings[safeIndex];
  }, [gradings, selectedGradingIndex]);

  // Reset selected index if it goes out of bounds
  useEffect(() => {
    if (selectedGradingIndex >= gradings.length && gradings.length > 0) {
      setSelectedGradingIndex(gradings.length - 1);
    }
  }, [gradings.length, selectedGradingIndex]);

  // Close modal if no gradings left
  useEffect(() => {
    if (gradings.length === 0) {
      onClose();
    }
  }, [gradings.length, onClose]);

  const handleDelete = useCallback(async () => {
    if (!currentGrading || isDeleting) return;
    
    const confirmed = window.confirm('Delete this grading? This cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDelete(currentGrading.id);
    } finally {
      setIsDeleting(false);
    }
  }, [currentGrading, isDeleting, onDelete]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Early return for no grading
  if (!currentGrading) {
    return null;
  }

  const isProcessing = currentGrading.status === 'processing';
  const isFailed = currentGrading.status === 'failed';
  const isCompleted = currentGrading.status === 'completed';

  // Determine if user can delete this grading:
  // - Grading creator can delete their own grading
  // - Audio owner can ONLY delete self-gradings, NOT instructor/official gradings
  const isAudioOwner = currentUserId && currentGrading.audioOwnerId 
    ? currentUserId === currentGrading.audioOwnerId 
    : false;
  const isGradingCreator = currentUserId && currentGrading.gradedByUserId
    ? currentUserId === currentGrading.gradedByUserId
    : false;
  const isInstructorGrading = currentGrading.sourceType === 'instructor' || currentGrading.isOfficial;
  
  // Students (audio owners who didn't create the grading) cannot delete instructor gradings
  const canDelete = isGradingCreator || 
    (isAudioOwner && !isInstructorGrading) || 
    (!currentUserId && !isInstructorGrading); // default behavior for missing user info

  // Determine graded-by label based on sourceType
  const getGradedByLabel = () => {
    if (currentGrading.sourceType === 'instructor') {
      return currentGrading.gradedByName 
        ? `Graded by ${currentGrading.gradedByName} (Instructor)`
        : 'Graded by Instructor';
    }
    return 'Self-graded';
  };

  // Get context label
  const getContextLabel = () => {
    if (currentGrading.contextType === 'class') {
      return currentGrading.contextName || 'Class Assignment';
    }
    return 'Practice';
  };

  const gradedByLabel = getGradedByLabel();
  const contextLabel = getContextLabel();

  // Safe getters for scores
  const overallScore = currentGrading.overallScore ?? 0;
  const pacingScore = currentGrading.pacingScore ?? 0;
  const clarityScore = currentGrading.clarityScore ?? 0;
  const criterionScores = currentGrading.detailedResults?.criterion_scores ?? [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'needs-work';
  };

  return (
    <div className="grading-modal-overlay" onClick={onClose}>
      <div className="grading-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header with rubric selector */}
        <header className="grading-modal-header">
          <div className="grading-header-content">
            <h1>Grading Results</h1>
            {gradings.length > 1 && (
              <div className="grading-selector">
                <select
                  value={selectedGradingIndex}
                  onChange={(e) => setSelectedGradingIndex(Number(e.target.value))}
                  className="grading-select"
                >
                  {gradings.map((g, idx) => (
                    <option key={g.id} value={idx}>
                      {g.rubricName || `Grading ${idx + 1}`}
                    </option>
                  ))}
                </select>
                <svg className="select-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>
          <div className="grading-header-meta">
            {currentGrading.rubricName && gradings.length === 1 && (
              <p className="grading-rubric-name">Using: {currentGrading.rubricName}</p>
            )}
            <div className="grading-context-badges">
              <span className={`graded-by-badge ${currentGrading.sourceType === 'instructor' ? 'instructor' : 'self'}`}>
                {gradedByLabel}
              </span>
              <span className={`context-badge ${currentGrading.contextType === 'class' ? 'class' : 'practice'}`}>
                {contextLabel}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="grading-modal-body">
          {isProcessing && (
            <div className="grading-status-panel processing">
              <div className="status-spinner" />
              <h2>Analyzing Your Presentation</h2>
              <p>This usually takes 10-30 seconds...</p>
            </div>
          )}

          {isFailed && (
            <div className="grading-status-panel failed">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <h2>Grading Failed</h2>
              <p>Something went wrong. Please delete this grading and try again.</p>
            </div>
          )}

          {isCompleted && (
            <>
              {/* Score Overview */}
              <div className="score-overview">
                <div className={`main-score ${getScoreColor(overallScore)}`}>
                  <div className="score-ring">
                    <svg viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" className="ring-bg" />
                      <circle 
                        cx="50" cy="50" r="45" 
                        className="ring-fill"
                        strokeDasharray={`${overallScore * 2.83} 283`}
                      />
                    </svg>
                    <div className="score-number">
                      <span className="score-value">{overallScore.toFixed(0)}</span>
                      <span className="score-unit">%</span>
                    </div>
                  </div>
                  <div className="score-label">Overall Score</div>
                </div>

                <div className="sub-scores">
                  {pacingScore > 0 && (
                    <div className="sub-score-item">
                      <div className="sub-score-header">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Pacing</span>
                      </div>
                      <div className="sub-score-bar">
                        <div className="sub-score-fill" style={{ width: `${pacingScore}%` }} />
                      </div>
                      <span className="sub-score-value">{pacingScore.toFixed(0)}</span>
                    </div>
                  )}
                  {clarityScore > 0 && (
                    <div className="sub-score-item">
                      <div className="sub-score-header">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        <span>Clarity</span>
                      </div>
                      <div className="sub-score-bar">
                        <div className="sub-score-fill" style={{ width: `${clarityScore}%` }} />
                      </div>
                      <span className="sub-score-value">{clarityScore.toFixed(0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* View Tabs */}
              <nav className="view-tabs">
                <button
                  className={`view-tab ${activeView === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveView('overview')}
                >
                  Overview
                </button>
                {criterionScores.length > 0 && (
                  <button
                    className={`view-tab ${activeView === 'content' ? 'active' : ''}`}
                    onClick={() => setActiveView('content')}
                  >
                    Content ({criterionScores.length})
                  </button>
                )}
                {(pacingScore > 0 || clarityScore > 0) && (
                  <button
                    className={`view-tab ${activeView === 'delivery' ? 'active' : ''}`}
                    onClick={() => setActiveView('delivery')}
                  >
                    Delivery
                  </button>
                )}
              </nav>

              {/* Tab Content */}
              <div className="view-content">
                {activeView === 'overview' && (
                  <div className="overview-panel">
                    {currentGrading.detailedResults?.ai_feedback && (
                      <div className="feedback-card">
                        <h3>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                          </svg>
                          AI Feedback
                        </h3>
                        <p>{currentGrading.detailedResults.ai_feedback}</p>
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="quick-stats">
                      {currentGrading.pacingWpmAvg != null && (
                        <div className="stat-card">
                          <div className="stat-icon">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                          </div>
                          <div className="stat-content">
                            <span className="stat-value">{currentGrading.pacingWpmAvg.toFixed(0)}</span>
                            <span className="stat-label">Words/Min</span>
                          </div>
                        </div>
                      )}
                      {currentGrading.clarityFillerWordCount != null && (
                        <div className="stat-card">
                          <div className="stat-icon warning">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                            </svg>
                          </div>
                          <div className="stat-content">
                            <span className="stat-value">{currentGrading.clarityFillerWordCount}</span>
                            <span className="stat-label">Filler Words</span>
                          </div>
                        </div>
                      )}
                      {currentGrading.pacingPauseCount != null && (
                        <div className="stat-card">
                          <div className="stat-icon">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                            </svg>
                          </div>
                          <div className="stat-content">
                            <span className="stat-value">{currentGrading.pacingPauseCount}</span>
                            <span className="stat-label">Pauses</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeView === 'content' && criterionScores.length > 0 && (
                  <div className="content-panel">
                    {criterionScores.map((criterion, idx) => (
                      <div key={criterion.criterion_id || idx} className="criterion-card">
                        <div className="criterion-header">
                          <h4>{criterion.criterion_name}</h4>
                          <div className="criterion-score">
                            <span className="score-num">{criterion.score}</span>
                            <span className="score-max">/{criterion.max_score}</span>
                          </div>
                        </div>
                        <div className="criterion-bar">
                          <div 
                            className="criterion-fill" 
                            style={{ width: `${(criterion.score / criterion.max_score) * 100}%` }}
                          />
                        </div>
                        {criterion.feedback && (
                          <p className="criterion-feedback">{criterion.feedback}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeView === 'delivery' && (
                  <div className="delivery-panel">
                    {/* Pacing Section */}
                    {currentGrading.pacingScore != null && (
                      <div className="delivery-section">
                        <h3>Pacing Analysis</h3>
                        <div className="metrics-row">
                          <div className="metric">
                            <span className="metric-value">{currentGrading.pacingWpmAvg?.toFixed(0) ?? '-'}</span>
                            <span className="metric-label">Avg WPM</span>
                          </div>
                          <div className="metric">
                            <span className="metric-value">{currentGrading.pacingWpmVariance?.toFixed(0) ?? '-'}</span>
                            <span className="metric-label">Variance</span>
                          </div>
                          <div className="metric">
                            <span className="metric-value">{currentGrading.pacingPauseCount ?? '-'}</span>
                            <span className="metric-label">Pauses</span>
                          </div>
                        </div>
                        
                        {/* WPM Timeline */}
                        {currentGrading.detailedResults?.pacing_timeline && 
                         currentGrading.detailedResults.pacing_timeline.length > 0 && (
                          <div className="timeline-container">
                            <div className="timeline-bars">
                              {currentGrading.detailedResults.pacing_timeline.map((seg, idx) => {
                                const maxWpm = Math.max(
                                  ...currentGrading.detailedResults!.pacing_timeline.map(s => s.wpm), 
                                  200
                                );
                                const height = (seg.wpm / maxWpm) * 100;
                                const color = seg.wpm < 100 ? 'var(--color-warning)' :
                                             seg.wpm > 200 ? 'var(--color-error)' :
                                             seg.wpm < 130 || seg.wpm > 170 ? 'var(--color-accent)' :
                                             'var(--color-success)';
                                return (
                                  <div 
                                    key={idx} 
                                    className="timeline-bar" 
                                    style={{ height: `${height}%`, backgroundColor: color }}
                                    title={`${seg.wpm} WPM`}
                                  />
                                );
                              })}
                            </div>
                            <div className="timeline-legend">
                              <span><i style={{background: 'var(--color-success)'}} /> Ideal</span>
                              <span><i style={{background: 'var(--color-accent)'}} /> OK</span>
                              <span><i style={{background: 'var(--color-warning)'}} /> Slow</span>
                              <span><i style={{background: 'var(--color-error)'}} /> Fast</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clarity Section */}
                    {currentGrading.clarityScore != null && (
                      <div className="delivery-section">
                        <h3>Clarity Analysis</h3>
                        <div className="metrics-row">
                          <div className="metric">
                            <span className="metric-value">{currentGrading.clarityFillerWordCount ?? 0}</span>
                            <span className="metric-label">Filler Words</span>
                          </div>
                          <div className="metric">
                            <span className="metric-value">
                              {currentGrading.clarityFillerWordPercentage?.toFixed(1) ?? '0'}%
                            </span>
                            <span className="metric-label">Filler %</span>
                          </div>
                          <div className="metric">
                            <span className="metric-value">{currentGrading.clarityNonsensicalWordCount ?? 0}</span>
                            <span className="metric-label">Errors</span>
                          </div>
                        </div>

                        {/* Filler Words Breakdown */}
                        {currentGrading.detailedResults?.filler_words && 
                         currentGrading.detailedResults.filler_words.length > 0 && (
                          <div className="filler-breakdown">
                            <h4>Filler Words Used</h4>
                            <div className="filler-tags">
                              {currentGrading.detailedResults.filler_words.slice(0, 8).map((f, idx) => (
                                <span key={idx} className="filler-tag">
                                  &ldquo;{f.word}&rdquo; <strong>{f.count}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="grading-modal-footer">
          <button className="footer-btn secondary" onClick={onClose}>
            Close
          </button>
          <div className="footer-actions">
            {isCompleted && canDelete && (
              <button 
                className="footer-btn danger" 
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
