'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { gradingAPI, classesAPI } from '@/services/api';
import { Grading } from '@/types/grading';
import { Classroom } from '@/types/classroom';

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
        rafRef.current = null;
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
      <div className="dash-empty-chart">
        <p>No score trend yet</p>
        <span>Complete a few gradings to unlock trend insights.</span>
      </div>
    );
  }

  const WIDTH = 600;
  const HEIGHT = 140;
  const PADDING_X = 24;
  const PADDING_Y = 16;
  const bottomY = HEIGHT - PADDING_Y;

  const points = data.map((grading, index) => {
    const score = Math.max(0, Math.min(100, grading.overallScore ?? 0));
    const x =
      data.length === 1
        ? WIDTH / 2
        : PADDING_X + (index / (data.length - 1)) * (WIDTH - PADDING_X * 2);
    const y = PADDING_Y + (1 - score / 100) * (HEIGHT - PADDING_Y * 2);
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
    <svg className="score-trend-svg" viewBox="0 0 600 140" role="img" aria-label="Score trend chart">
      <defs>
        <linearGradient id="scoreTrendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 130, 0, 0.25)" />
          <stop offset="100%" stopColor="rgba(255, 130, 0, 0)" />
        </linearGradient>
      </defs>

      {[75, 50, 25].map((level) => {
        const y = PADDING_Y + (1 - level / 100) * (HEIGHT - PADDING_Y * 2);
        return (
          <g key={level}>
            <line
              x1={PADDING_X}
              y1={y}
              x2={WIDTH - PADDING_X}
              y2={y}
              stroke="var(--color-border-default)"
              strokeDasharray="4 6"
              strokeOpacity="0.7"
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

      <path d={areaPath} fill="url(#scoreTrendArea)" />
      <path
        d={linePath}
        className={`score-trend-line${isDrawn ? ' is-drawn' : ''}`}
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

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();

  const [gradings, setGradings] = useState<Grading[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [mounted, setMounted] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);

      const classesPromise =
        user?.role === 'instructor'
          ? classesAPI.listTeaching()
          : user?.role === 'student'
          ? classesAPI.listEnrolled()
          : Promise.resolve([] as Classroom[]);

      const [gradingsData, classesData] = await Promise.all([
        gradingAPI.listAll().catch((error: unknown) => {
          console.error('Failed to load gradings:', error);
          return [] as Grading[];
        }),
        classesPromise.catch((error: unknown) => {
          console.error('Failed to load classes:', error);
          return [] as Classroom[];
        }),
      ]);

      setGradings(gradingsData);
      setClasses(classesData);
    } finally {
      setLoadingData(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const {
    totalGraded,
    avgScore,
    bestScore,
    trendDirection,
    scoreTrend,
    streak,
    criterionAverages,
    recentGradings,
  } = useMemo(() => {
    const completedGradings = gradings.filter(
      (grading) => grading.status === 'completed' && grading.overallScore !== null
    );

    const sortedAsc = [...completedGradings].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const totalGraded = completedGradings.length;

    const avgScore =
      totalGraded > 0
        ? completedGradings.reduce((sum, grading) => sum + (grading.overallScore ?? 0), 0) / totalGraded
        : null;

    const bestScore =
      totalGraded > 0
        ? Math.max(...completedGradings.map((grading) => grading.overallScore ?? 0))
        : null;

    const lastSix = sortedAsc.slice(-6);
    let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';

    if (lastSix.length === 6) {
      const priorAvg = lastSix.slice(0, 3).reduce((sum, grading) => sum + (grading.overallScore ?? 0), 0) / 3;
      const latestAvg = lastSix.slice(3).reduce((sum, grading) => sum + (grading.overallScore ?? 0), 0) / 3;

      if (latestAvg > priorAvg + 1) trendDirection = 'up';
      else if (latestAvg < priorAvg - 1) trendDirection = 'down';
    }

    const scoreTrend = sortedAsc.slice(-10);

    const completedDaySet = new Set(
      completedGradings.map((grading) => new Date(grading.createdAt).toLocaleDateString('en-CA'))
    );

    let streak = 0;
    for (let i = 0; i < 3650; i += 1) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateKey = checkDate.toLocaleDateString('en-CA');

      if (completedDaySet.has(dateKey)) {
        streak += 1;
      } else {
        break;
      }
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

    const recentGradings = [...completedGradings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    return {
      totalGraded,
      avgScore,
      bestScore,
      trendDirection,
      scoreTrend,
      streak,
      criterionAverages,
      recentGradings,
    };
  }, [gradings]);

  useEffect(() => {
    if (loadingData) {
      setMounted(false);
      return;
    }

    const timeout = window.setTimeout(() => setMounted(true), 80);
    return () => window.clearTimeout(timeout);
  }, [loadingData]);

  const animatedTotal = useCountUp(loadingData ? null : totalGraded);
  const animatedAvg = useCountUp(loadingData ? null : avgScore);
  const animatedBest = useCountUp(loadingData ? null : bestScore);
  const animatedStreak = useCountUp(loadingData ? null : streak);

  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
      ? 'Good afternoon'
      : 'Good evening';

  const firstName = user?.name?.split(' ')[0] || 'there';
  const classesHeading = user?.role === 'instructor' ? 'Your Classrooms' : 'Your Classes';

  if (loading || !isAuthenticated) return null;

  return (
    <main className="home-dashboard">
      <div className="dashboard-hero">
        {user?.role && <span className="hero-role-badge">{user.role}</span>}
        <h1>
          {greeting}, <span className="hero-name-accent">{firstName}</span>
        </h1>
        <p>Practice your presentations</p>
      </div>

      <div className="dashboard-content">
        {loadingData ? (
          <div className="dash-stats-row">
            {[1, 2, 3, 4].map((card) => (
              <div key={card} className="dash-stat-card" style={{ pointerEvents: 'none' }}>
                <div className="skeleton-line" style={{ width: '44px', height: '44px', borderRadius: '10px' }} />
                <div className="skeleton-line" style={{ width: '52px', height: '40px' }} />
                <div className="skeleton-line" style={{ width: '110px', height: '12px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-stats-row">
            <div className="dash-stat-card">
              <div className="dash-stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2.5 5H6.5A2.5 2.5 0 014 18.5v-13A2.5 2.5 0 016.5 3h7.172a2.5 2.5 0 011.768.732l2.828 2.828A2.5 2.5 0 0119 8.328V18.5a2.5 2.5 0 01-2.5 2.5z"
                  />
                </svg>
              </div>
              <div className="dash-stat-value">{Math.round(animatedTotal)}</div>
              <div className="dash-stat-label">Total Gradings</div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l4-4 3 3 5-6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5v14h14" />
                </svg>
              </div>
              <div className="dash-stat-value">{avgScore === null ? '--' : `${Math.round(animatedAvg)}%`}</div>
              <div className="dash-stat-label">Avg Score</div>
              {avgScore !== null && (
                <span
                  className={`trend-badge${
                    trendDirection === 'up' ? ' trend-up' : trendDirection === 'down' ? ' trend-down' : ''
                  }`}
                >
                  {trendDirection === 'up' ? 'Trending Up' : trendDirection === 'down' ? 'Trending Down' : 'Stable'}
                </span>
              )}
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
                  />
                </svg>
              </div>
              <div className="dash-stat-value">{bestScore === null ? '--' : `${Math.round(animatedBest)}%`}</div>
              <div className="dash-stat-label">Best Score</div>
            </div>

            <div className="dash-stat-card">
              <div className="dash-stat-icon" aria-hidden>
                🔥
              </div>
              <div className="dash-stat-value">
                {streak === 0
                  ? 'No streak'
                  : `${Math.round(animatedStreak)} day${Math.round(animatedStreak) === 1 ? '' : 's'}`}
              </div>
              <div className="dash-stat-label">Current Streak</div>
            </div>
          </div>
        )}

        <div className="charts-row">
          {loadingData ? (
            <>
              <div className="chart-card">
                <div className="chart-card-header">
                  <div>
                    <div className="skeleton-line" style={{ width: '150px', height: '18px', marginBottom: '8px' }} />
                    <div className="skeleton-line" style={{ width: '180px', height: '13px' }} />
                  </div>
                </div>
                <div className="skeleton-line" style={{ width: '100%', height: '140px', borderRadius: '16px' }} />
              </div>

              <div className="chart-card">
                <div className="chart-card-header">
                  <div className="skeleton-line" style={{ width: '220px', height: '18px' }} />
                </div>
                <div className="skeleton-line" style={{ width: '100%', height: '140px', borderRadius: '16px' }} />
              </div>
            </>
          ) : (
            <>
              <div className="chart-card">
                <header className="chart-card-header">
                  <div>
                    <h3>Score Over Time</h3>
                    <p>Last 10 completed gradings</p>
                  </div>
                </header>
                <ScoreTrendChart data={scoreTrend} />
              </div>

              <div className="chart-card">
                <header className="chart-card-header">
                  <div>
                    <h3>Performance by Criterion</h3>
                    <p>Average score percentages</p>
                  </div>
                </header>
                {criterionAverages.length === 0 ? (
                  <div className="dash-empty-chart">
                    <p>No criterion data yet</p>
                    <span>Complete a grading with rubric criteria to see this breakdown.</span>
                  </div>
                ) : (
                  <div className="criteria-panel">
                    {criterionAverages.map((criterion, index) => (
                      <div key={criterion.name} className="criterion-row">
                        <span className="criterion-label">{criterion.name}</span>
                        <div className="criterion-bar-track">
                          <div
                            className="criterion-bar-fill"
                            style={{
                              width: mounted ? `${Math.max(0, Math.min(criterion.avg, 100))}%` : '0%',
                              transitionDelay: `${index * 80}ms`,
                            }}
                          />
                        </div>
                        <span className="criterion-pct">{Math.round(criterion.avg)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="dashboard-section">
          <div className="section-header-dash">
            <h2>Recent Gradings</h2>
            {!loadingData && (
              <button className="view-all-btn" onClick={() => router.push('/analytics')}>
                View All
              </button>
            )}
          </div>

          {loadingData ? (
            <div className="recent-gradings-grid">
              {[1, 2, 3].map((card) => (
                <div key={card} className="grading-dash-card" style={{ pointerEvents: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div className="skeleton-line" style={{ width: '72px', height: '72px', borderRadius: '9999px' }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-line" style={{ width: '75%', height: '16px', marginBottom: '8px' }} />
                      <div className="skeleton-line" style={{ width: '45%', height: '12px', marginBottom: '6px' }} />
                      <div className="skeleton-line" style={{ width: '60%', height: '12px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentGradings.length === 0 ? (
            <div className="empty-recent">
              <p>No gradings yet</p>
              <span>Complete a grading to see your latest performance snapshots.</span>
            </div>
          ) : (
            <div className="recent-gradings-grid">
              {recentGradings.map((grading, index) => {
                const score = Math.max(0, Math.min(100, Math.round(grading.overallScore ?? 0)));
                return (
                  <div
                    key={grading.id}
                    className="grading-dash-card"
                    onClick={() => router.push('/analytics')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div className="dash-score-ring">
                        <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="50" cy="50" r="45" className="dash-ring-bg" />
                          <circle
                            cx="50"
                            cy="50"
                            r="45"
                            className={`dash-ring-fill dash-ring-${getScoreColor(score)}`}
                            strokeDasharray={`${score * 2.83} 283`}
                          />
                        </svg>
                        <div className="dash-score-number">
                          {score}
                          <span className="dash-score-unit">%</span>
                        </div>
                      </div>

                      <div className="grading-dash-meta">
                        <h4 className="grading-dash-title">
                          {grading.presentationTitle || grading.rubricName || 'Untitled Grading'}
                        </h4>
                        <p className="grading-dash-date">{new Date(grading.createdAt).toLocaleDateString()}</p>
                        <p className="grading-dash-rubric">{grading.rubricName || 'Custom rubric'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {loadingData ? (
          <div className="dashboard-section">
            <div className="section-header-dash">
              <h2>{classesHeading}</h2>
            </div>
            <div className="classes-dash-grid">
              {[1, 2, 3].map((card) => (
                <div key={card} className="class-dash-card" style={{ pointerEvents: 'none' }}>
                  <div className="skeleton-line" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-line" style={{ width: '72%', height: '16px', marginBottom: '8px' }} />
                    <div className="skeleton-line" style={{ width: '56%', height: '12px', marginBottom: '6px' }} />
                    <div className="skeleton-line" style={{ width: '38%', height: '12px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          classes.length > 0 && (
            <div className="dashboard-section">
              <div className="section-header-dash">
                <h2>{classesHeading}</h2>
                <button className="view-all-btn" onClick={() => router.push('/classes')}>
                  Manage →
                </button>
              </div>

              <div className="classes-dash-grid">
                {classes.slice(0, 3).map((classroom, index) => (
                  <div
                    key={classroom.id}
                    className="class-dash-card"
                    onClick={() => router.push('/classes')}
                  >
                    <div className="class-dash-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 19.5h15m-15 0a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5h15A1.5 1.5 0 0121 6v12a1.5 1.5 0 01-1.5 1.5m-15 0V9.75m15 9.75V9.75M9 7.5h6"
                        />
                      </svg>
                    </div>

                    <div className="class-dash-content">
                      <h4>{classroom.name}</h4>
                      {user?.role === 'instructor' ? (
                        <p>
                          {classroom.studentCount}{' '}
                          {classroom.studentCount === 1 ? 'student enrolled' : 'students enrolled'}
                        </p>
                      ) : (
                        <p>Instructor: {classroom.instructorName || classroom.instructorEmail}</p>
                      )}
                      {user?.role === 'instructor' && <span>Code: {classroom.joinCode}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}
