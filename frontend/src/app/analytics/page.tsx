'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { gradingAPI, rubricAPI } from '@/services/api';
import { Grading, Rubric } from '@/types/grading';
import GradingResultsModal from '@/components/GradingResultsModal';
import RubricEditorModal from '@/components/RubricEditorModal';

type FilterType = 'all' | 'practice' | 'class';

function useCountUp(target: number | null, duration = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const valueRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (target === null) {
      setValue(0);
      valueRef.current = 0;
      return;
    }

    const start = performance.now();
    const startValue = valueRef.current;
    const delta = target - startValue;

    if (delta === 0 || duration <= 0) {
      setValue(target);
      valueRef.current = target;
      return;
    }

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + delta * eased;
      setValue(nextValue);
      valueRef.current = nextValue;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return value;
}

function getScoreColor(score: number) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'needs-work';
}

function ScoreTrendChart({ data }: { data: Grading[] }) {
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    setIsDrawn(false);
    if (data.length === 0) return;

    const timeout = window.setTimeout(() => setIsDrawn(true), 50);
    return () => window.clearTimeout(timeout);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="analytics-fire-empty-chart">
        <p>No trend data yet</p>
        <span>Complete graded presentations to see your score trajectory.</span>
      </div>
    );
  }

  const width = 600;
  const height = 140;
  const paddingX = 24;
  const paddingY = 16;
  const bottomY = height - paddingY;

  const points = data.map((grading, index) => {
    const score = Math.max(0, Math.min(100, grading.overallScore ?? 0));
    const x =
      data.length === 1
        ? width / 2
        : paddingX + (index / (data.length - 1)) * (width - paddingX * 2);
    const y = paddingY + (1 - score / 100) * (height - paddingY * 2);
    return { x, y };
  });

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;

  return (
    <svg className="analytics-fire-trend-svg" viewBox="0 0 600 140" role="img" aria-label="Score trend chart">
      <defs>
        <linearGradient id="analyticsFireTrendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 130, 0, 0.26)" />
          <stop offset="100%" stopColor="rgba(255, 130, 0, 0)" />
        </linearGradient>
      </defs>

      {[75, 50, 25].map((level) => {
        const y = paddingY + (1 - level / 100) * (height - paddingY * 2);
        return (
          <g key={level}>
            <line
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="var(--color-border-default)"
              strokeDasharray="4 6"
              strokeOpacity="0.75"
            />
            <text
              x={6}
              y={y + 4}
              fill="var(--color-text-tertiary)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {level}%
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#analyticsFireTrendArea)" />
      <path
        d={linePath}
        className={`analytics-fire-trend-line${isDrawn ? ' is-drawn' : ''}`}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="var(--color-accent)"
          stroke="var(--color-bg-elevated)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const confirm = useConfirm();

  const [gradings, setGradings] = useState<Grading[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedGrading, setSelectedGrading] = useState<Grading | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [showRubricEditor, setShowRubricEditor] = useState(false);
  const [showRubricsPanel, setShowRubricsPanel] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSuccess, setRubricSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const data = await gradingAPI.listAll();
      setGradings(data);
    } catch (err) {
      console.error('Failed to load gradings:', err);
      setGradings([]);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadRubrics = useCallback(async () => {
    try {
      setLoadingRubrics(true);
      const data = await rubricAPI.list();
      setRubrics(data);
    } catch (err) {
      console.error('Failed to load rubrics:', err);
      setRubrics([]);
    } finally {
      setLoadingRubrics(false);
    }
  }, []);

  const handleCreateRubric = useCallback(() => {
    setEditingRubric(null);
    setShowRubricEditor(true);
    setRubricError(null);
    setRubricSuccess(null);
  }, []);

  const handleEditRubric = useCallback((rubric: Rubric) => {
    setEditingRubric(rubric);
    setShowRubricEditor(true);
    setRubricError(null);
    setRubricSuccess(null);
  }, []);

  const handleSaveRubric = useCallback(
    async (name: string, description: string, criteria: any[]) => {
      const data = { name, description, criteria };
      try {
        if (editingRubric) {
          await rubricAPI.update(editingRubric.id, data);
          setRubricSuccess('Rubric updated successfully');
        } else {
          await rubricAPI.create(data);
          setRubricSuccess('Rubric created successfully');
        }
        await loadRubrics();
        setShowRubricEditor(false);
        setTimeout(() => setRubricSuccess(null), 3000);
      } catch (err: any) {
        let errorMessage = 'Failed to save rubric';
        if (err?.response?.data?.detail) {
          const detail = err.response.data.detail;
          if (Array.isArray(detail)) {
            errorMessage = detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
          } else if (typeof detail === 'string') {
            errorMessage = detail;
          }
        }

        setRubricError(errorMessage);
        throw err;
      }
    },
    [editingRubric, loadRubrics]
  );

  const handleDeleteRubric = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: 'Delete rubric',
        message: 'Are you sure you want to delete this rubric?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        variant: 'danger',
      });
      if (!ok) return;

      try {
        await rubricAPI.delete(id);
        setRubrics((prev) => prev.filter((rubric) => rubric.id !== id));
        setRubricSuccess('Rubric deleted successfully');
        setTimeout(() => setRubricSuccess(null), 3000);
      } catch (err: any) {
        setRubricError(err.response?.data?.detail || 'Failed to delete rubric');
      }
    },
    [confirm],
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      loadRubrics();
    }
  }, [isAuthenticated, loadData, loadRubrics]);

  const handleViewGrading = (grading: Grading) => {
    setSelectedGrading(grading);
    setShowModal(true);
  };

  const handleDeleteGrading = async (gradingId: string) => {
    try {
      await gradingAPI.delete(gradingId);
      setGradings((prev) => prev.filter((grading) => grading.id !== gradingId));
      if (selectedGrading?.id === gradingId) {
        setShowModal(false);
        setSelectedGrading(null);
      }
    } catch (err) {
      console.error('Failed to delete grading:', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'instructor' && activeFilter === 'class') {
      setActiveFilter('all');
    }
  }, [user?.role, activeFilter]);

  const filteredGradings = useMemo(() => {
    if (activeFilter === 'all') return gradings;
    if (activeFilter === 'practice') return gradings.filter((grading) => grading.contextType === 'practice');
    if (activeFilter === 'class') return gradings.filter((grading) => grading.contextType === 'class');
    return gradings;
  }, [gradings, activeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const {
    completedGradings,
    processingGradings,
    avgScore,
    bestScore,
    trendDirection,
    trendSeries,
    criterionAverages,
    recentCompleted,
    officialCount,
  } = useMemo(() => {
    const completedGradings = filteredGradings.filter(
      (grading) => grading.status === 'completed' && grading.overallScore !== null
    );
    const processingGradings = filteredGradings.filter((grading) => grading.status === 'processing');

    const avgScore =
      completedGradings.length > 0
        ? completedGradings.reduce((sum, grading) => sum + (grading.overallScore ?? 0), 0) / completedGradings.length
        : null;

    const bestScore =
      completedGradings.length > 0
        ? Math.max(...completedGradings.map((grading) => grading.overallScore ?? 0))
        : null;

    const trendSeries = [...completedGradings]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-10);

    const lastSix = trendSeries.slice(-6);
    let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';

    if (lastSix.length === 6) {
      const priorAvg = lastSix.slice(0, 3).reduce((sum, grading) => sum + (grading.overallScore ?? 0), 0) / 3;
      const latestAvg = lastSix.slice(3).reduce((sum, grading) => sum + (grading.overallScore ?? 0), 0) / 3;
      if (latestAvg > priorAvg + 1) trendDirection = 'up';
      else if (latestAvg < priorAvg - 1) trendDirection = 'down';
    }

    const criterionMap = new Map<string, { total: number; count: number }>();
    completedGradings.forEach((grading) => {
      grading.detailedResults?.criterion_scores?.forEach((criterion) => {
        if (!criterion.criterion_name || criterion.max_score <= 0) return;
        const percent = (criterion.score / criterion.max_score) * 100;
        if (!Number.isFinite(percent)) return;

        const existing = criterionMap.get(criterion.criterion_name) ?? { total: 0, count: 0 };
        criterionMap.set(criterion.criterion_name, {
          total: existing.total + percent,
          count: existing.count + 1,
        });
      });
    });

    const criterionAverages = [...criterionMap.entries()]
      .map(([name, value]) => ({ name, avg: value.total / value.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);

    const recentCompleted = [...completedGradings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    const officialCount = completedGradings.filter((grading) => grading.isOfficial).length;

    return {
      completedGradings,
      processingGradings,
      avgScore,
      bestScore,
      trendDirection,
      trendSeries,
      criterionAverages,
      recentCompleted,
      officialCount,
    };
  }, [filteredGradings]);

  useEffect(() => {
    if (loadingData) {
      setMounted(false);
      return;
    }

    const timeout = window.setTimeout(() => setMounted(true), 80);
    return () => window.clearTimeout(timeout);
  }, [loadingData]);

  const animatedTotal = useCountUp(loadingData ? null : filteredGradings.length);
  const animatedCompleted = useCountUp(loadingData ? null : completedGradings.length);
  const animatedAvg = useCountUp(loadingData ? null : avgScore);
  const animatedBest = useCountUp(loadingData ? null : bestScore);

  const paginatedGradings = filteredGradings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredGradings.length / itemsPerPage);

  const getSourceBadge = (grading: Grading) => {
    if (grading.sourceType === 'instructor') {
      return { label: 'Instructor', className: 'badge-instructor' };
    }
    return { label: 'Self', className: 'badge-self' };
  };

  const getContextBadge = (grading: Grading) => {
    if (grading.contextType === 'class') {
      return {
        label: grading.contextName ? `Class: ${grading.contextName}` : 'Class',
        className: 'badge-class',
      };
    }
    return { label: 'Practice', className: 'badge-practice' };
  };

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <main className="app-container studio-analytics analytics-fire-page studio-surface">
      <header className="app-header analytics-fire-header">
        <h1>Analytics Dashboard</h1>
        <p>
          {user?.role === 'instructor'
            ? 'Track grading quality, progression, and rubric-driven performance signals.'
            : 'Track your speaking progress and identify exactly where to improve next.'}
        </p>
      </header>

      <div className="analytics-content">
        <section className="analytics-fire-insights">
          {loadingData ? (
            <>
              <div className="analytics-fire-stats-grid">
                {[1, 2, 3, 4].map((card) => (
                  <div key={card} className="analytics-fire-stat-card" style={{ pointerEvents: 'none' }}>
                    <div className="skeleton-line" style={{ width: '38px', height: '38px', borderRadius: '8px' }} />
                    <div className="skeleton-line" style={{ width: '52px', height: '36px' }} />
                    <div className="skeleton-line" style={{ width: '120px', height: '12px' }} />
                  </div>
                ))}
              </div>

              <div className="analytics-fire-chart-grid">
                {[1, 2].map((card) => (
                  <div key={card} className="analytics-fire-card">
                    <div className="skeleton-line" style={{ width: '180px', height: '16px', marginBottom: '10px' }} />
                    <div className="skeleton-line" style={{ width: '100%', height: '140px', borderRadius: '12px' }} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="analytics-fire-stats-grid">
                <div className="analytics-fire-stat-card">
                  <div className="analytics-fire-stat-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2.5 5H6.5A2.5 2.5 0 014 18.5v-13A2.5 2.5 0 016.5 3h7.172a2.5 2.5 0 011.768.732l2.828 2.828A2.5 2.5 0 0119 8.328V18.5a2.5 2.5 0 01-2.5 2.5z" />
                    </svg>
                  </div>
                  <div className="analytics-fire-stat-value">{Math.round(animatedTotal)}</div>
                  <div className="analytics-fire-stat-label">Filtered Gradings</div>
                </div>

                <div className="analytics-fire-stat-card">
                  <div className="analytics-fire-stat-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="analytics-fire-stat-value">{Math.round(animatedCompleted)}</div>
                  <div className="analytics-fire-stat-label">Completed</div>
                </div>

                <div className="analytics-fire-stat-card">
                  <div className="analytics-fire-stat-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l4-4 3 3 5-6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5v14h14" />
                    </svg>
                  </div>
                  <div className="analytics-fire-stat-value">{avgScore === null ? '--' : `${Math.round(animatedAvg)}%`}</div>
                  <div className="analytics-fire-stat-label">Average Score</div>
                  {avgScore !== null && (
                    <span
                      className={`analytics-fire-trend-badge${
                        trendDirection === 'up'
                          ? ' trend-up'
                          : trendDirection === 'down'
                          ? ' trend-down'
                          : ''
                      }`}
                    >
                      {trendDirection === 'up'
                        ? 'Trending Up'
                        : trendDirection === 'down'
                        ? 'Trending Down'
                        : 'Stable'}
                    </span>
                  )}
                </div>

                <div className="analytics-fire-stat-card">
                  <div className="analytics-fire-stat-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172" />
                    </svg>
                  </div>
                  <div className="analytics-fire-stat-value">{bestScore === null ? '--' : `${Math.round(animatedBest)}%`}</div>
                  <div className="analytics-fire-stat-label">Best Score</div>
                  <span className="analytics-fire-subtle">{officialCount} official</span>
                </div>
              </div>

              <div className="analytics-fire-chart-grid">
                <div className="analytics-fire-card">
                  <header className="analytics-fire-card-header">
                    <h3>Score Over Time</h3>
                    <p>Last 10 completed gradings</p>
                  </header>
                  <ScoreTrendChart data={trendSeries} />
                </div>

                <div className="analytics-fire-card">
                  <header className="analytics-fire-card-header">
                    <h3>Performance by Criterion</h3>
                    <p>Top rubric dimensions</p>
                  </header>

                  {criterionAverages.length === 0 ? (
                    <div className="analytics-fire-empty-chart">
                      <p>No criterion breakdown yet</p>
                      <span>Use a rubric with criterion scoring to populate this view.</span>
                    </div>
                  ) : (
                    <div className="analytics-fire-criteria-panel">
                      {criterionAverages.map((criterion, index) => (
                        <div key={criterion.name} className="analytics-fire-criterion-row">
                          <span className="analytics-fire-criterion-label">{criterion.name}</span>
                          <div className="analytics-fire-criterion-track">
                            <div
                              className="analytics-fire-criterion-fill"
                              style={{
                                width: mounted ? `${Math.max(0, Math.min(criterion.avg, 100))}%` : '0%',
                                transitionDelay: `${index * 80}ms`,
                              }}
                            />
                          </div>
                          <span className="analytics-fire-criterion-pct">{Math.round(criterion.avg)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <div className="filter-pills">
          <button
            className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-pill ${activeFilter === 'practice' ? 'active' : ''}`}
            onClick={() => setActiveFilter('practice')}
          >
            Practice
          </button>
          {user?.role !== 'instructor' && (
            <button
              className={`filter-pill ${activeFilter === 'class' ? 'active' : ''}`}
              onClick={() => setActiveFilter('class')}
            >
              Class Assignments
            </button>
          )}
        </div>

        {rubricError && <div className="error-message" style={{ marginBottom: '1rem' }}>{rubricError}</div>}
        {rubricSuccess && <div className="success-message" style={{ marginBottom: '1rem' }}>{rubricSuccess}</div>}

        {recentCompleted.length > 0 && !loadingData && (
          <div className="analytics-fire-recent-strip">
            {recentCompleted.map((grading) => {
              const score = Math.max(0, Math.min(100, Math.round(grading.overallScore ?? 0)));
              return (
                <button
                  key={grading.id}
                  className="analytics-fire-recent-pill"
                  onClick={() => handleViewGrading(grading)}
                >
                  <span className={`analytics-fire-dot ${getScoreColor(score)}`} />
                  <span className="analytics-fire-recent-title">
                    {grading.presentationTitle || grading.rubricName || 'Untitled'}
                  </span>
                  <span className="analytics-fire-recent-score">{score}%</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="gradings-section">
          <div className="section-header-with-pagination">
            <div className="section-header-left">
              <h2>
                {activeFilter === 'all'
                  ? 'All Gradings'
                  : activeFilter === 'practice'
                  ? 'Practice Gradings'
                  : 'Class Gradings'}
              </h2>
              <div className="section-header-actions">
                <button className="btn-secondary btn-small" onClick={() => setShowRubricsPanel(true)}>
                  View Rubrics
                </button>
                <button className="btn-primary btn-small" onClick={handleCreateRubric}>
                  Create Rubric
                </button>
              </div>
            </div>
            {filteredGradings.length > 0 && (
              <div className="pagination-info">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredGradings.length)}-
                {Math.min(currentPage * itemsPerPage, filteredGradings.length)} of {filteredGradings.length}
              </div>
            )}
          </div>
        </div>

        {loadingData ? (
          <div className="gradings-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="grading-card">
                <div className="skeleton-line" style={{ width: '70%', height: '20px', marginBottom: '0.75rem' }} />
                <div className="skeleton-line" style={{ width: '45%', height: '14px', marginBottom: '1rem' }} />
                <div
                  className="skeleton-line"
                  style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '0.75rem' }}
                />
                <div className="skeleton-line" style={{ width: '55%', height: '13px' }} />
              </div>
            ))}
          </div>
        ) : filteredGradings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                />
              </svg>
            </div>
            <h2>
              {activeFilter === 'all'
                ? 'No Gradings Yet'
                : activeFilter === 'practice'
                ? 'No Practice Gradings'
                : 'No Class Gradings'}
            </h2>
            <p>
              {activeFilter === 'all'
                ? 'Grade a practice presentation or class assignment to populate analytics.'
                : activeFilter === 'practice'
                ? 'Practice gradings will appear here after self-grading.'
                : 'Class gradings appear here once instructor reviews are complete.'}
            </p>
            <button className="btn-primary" onClick={() => router.push('/library')}>
              Go to Library
            </button>
          </div>
        ) : (
          <>
            <div className="gradings-grid">
              {paginatedGradings.map((grading) => {
                const sourceBadge = getSourceBadge(grading);
                const contextBadge = getContextBadge(grading);

                return (
                  <div
                    key={grading.id}
                    className={`grading-card ${grading.status}`}
                    onClick={() => grading.status === 'completed' && handleViewGrading(grading)}
                  >
                    <div className="grading-card-header">
                      <h3>{grading.presentationTitle || 'Untitled Presentation'}</h3>
                      {grading.status === 'processing' && (
                        <span className="status-badge processing">
                          <span className="spinner-tiny"></span>
                          Processing
                        </span>
                      )}
                      {grading.status === 'failed' && <span className="status-badge failed">Failed</span>}
                    </div>

                    <div className="grading-badges">
                      <span className={`grading-badge ${sourceBadge.className}`}>{sourceBadge.label}</span>
                      <span className={`grading-badge ${contextBadge.className}`}>{contextBadge.label}</span>
                    </div>

                    <div className="grading-card-rubric">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span>{grading.rubricName || 'Unknown Rubric'}</span>
                    </div>

                    {grading.status === 'completed' && grading.overallScore != null && (
                      <div className="grading-card-score">
                        <div className={`score-circle ${getScoreColor(grading.overallScore)}`}>
                          <span className="score-number">{grading.overallScore.toFixed(0)}</span>
                        </div>
                        <div className="score-breakdown">
                          {grading.pacingScore != null && (
                            <div className="score-item">
                              <span className="score-label">Pacing</span>
                              <span className="score-val">{grading.pacingScore.toFixed(0)}</span>
                            </div>
                          )}
                          {grading.clarityScore != null && (
                            <div className="score-item">
                              <span className="score-label">Clarity</span>
                              <span className="score-val">{grading.clarityScore.toFixed(0)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grading-card-footer">
                      <span className="grading-date">
                        {new Date(grading.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {grading.status === 'completed' && <span className="view-link">View Details →</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredGradings.length > itemsPerPage && (
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <div className="pagination-pages">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && selectedGrading && (
        <GradingResultsModal
          gradings={[selectedGrading]}
          onClose={() => {
            setShowModal(false);
            setSelectedGrading(null);
          }}
          onDelete={handleDeleteGrading}
          currentUserId={user?.id}
        />
      )}

      {showRubricEditor && (
        <RubricEditorModal
          rubric={editingRubric || undefined}
          onSave={handleSaveRubric}
          onCancel={() => {
            setShowRubricEditor(false);
            setEditingRubric(null);
            setRubricError(null);
          }}
        />
      )}

      {showRubricsPanel && (
        <div className="modal-overlay" onClick={() => setShowRubricsPanel(false)}>
          <div className="modal-content rubrics-panel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Grading Rubrics</h2>
              <button className="modal-close" onClick={() => setShowRubricsPanel(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {loadingRubrics ? (
                <div className="rubric-list">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rubric-item skeleton">
                      <div className="skeleton-line" style={{ width: '60%', height: '20px' }}></div>
                      <div
                        className="skeleton-line"
                        style={{ width: '40%', height: '16px', marginTop: '8px' }}
                      ></div>
                    </div>
                  ))}
                </div>
              ) : rubrics.filter((rubric) => rubric.rubricType === 'custom').length === 0 ? (
                <div className="empty-rubrics">
                  <p>No custom rubrics yet. Create one to start grading presentations.</p>
                </div>
              ) : (
                <div className="rubric-list">
                  {rubrics
                    .filter((rubric) => rubric.rubricType === 'custom')
                    .map((rubric) => (
                      <div key={rubric.id} className="rubric-item">
                        <div className="rubric-info">
                          <h3>{rubric.name}</h3>
                          {rubric.description && <p>{rubric.description}</p>}
                          <span className="criteria-count">
                            {rubric.criteria.length} {rubric.criteria.length === 1 ? 'criterion' : 'criteria'}
                          </span>
                        </div>
                        <div className="rubric-actions">
                          <button
                            className="btn-secondary btn-small"
                            onClick={() => {
                              setShowRubricsPanel(false);
                              handleEditRubric(rubric);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-secondary btn-small btn-danger"
                            onClick={() => handleDeleteRubric(rubric.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
