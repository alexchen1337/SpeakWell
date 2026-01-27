'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { gradingAPI, rubricAPI } from '@/services/api';
import { Grading, Rubric } from '@/types/grading';
import GradingResultsModal from '@/components/GradingResultsModal';
import RubricEditorModal from '@/components/RubricEditorModal';

type FilterType = 'all' | 'practice' | 'class';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [gradings, setGradings] = useState<Grading[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedGrading, setSelectedGrading] = useState<Grading | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Rubric management state
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [showRubricEditor, setShowRubricEditor] = useState(false);
  const [showRubricsPanel, setShowRubricsPanel] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSuccess, setRubricSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      const data = await gradingAPI.listAll();
      setGradings(data);
    } catch (err) {
      console.error('Failed to load gradings:', err);
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

  const handleSaveRubric = useCallback(async (name: string, description: string, criteria: any[]) => {
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
      // Handle different error formats
      let errorMessage = 'Failed to save rubric';
      
      if (err?.response?.data?.detail) {
        const detail = err.response.data.detail;
        // If detail is an array of validation errors
        if (Array.isArray(detail)) {
          errorMessage = detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      }
      
      setRubricError(errorMessage);
      throw err; // Re-throw so modal can handle it
    }
  }, [editingRubric, loadRubrics]);

  const handleDeleteRubric = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this rubric?')) return;
    
    try {
      await rubricAPI.delete(id);
      setRubrics(prev => prev.filter(r => r.id !== id));
      setRubricSuccess('Rubric deleted successfully');
      setTimeout(() => setRubricSuccess(null), 3000);
    } catch (err: any) {
      setRubricError(err.response?.data?.detail || 'Failed to delete rubric');
    }
  }, []);

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
      setGradings(prev => prev.filter(g => g.id !== gradingId));
      if (selectedGrading?.id === gradingId) {
        setShowModal(false);
        setSelectedGrading(null);
      }
    } catch (err) {
      console.error('Failed to delete grading:', err);
    }
  };

  // Filter gradings based on active filter - must be before early returns
  const filteredGradings = useMemo(() => {
    if (activeFilter === 'all') return gradings;
    if (activeFilter === 'practice') return gradings.filter(g => g.contextType === 'practice');
    if (activeFilter === 'class') return gradings.filter(g => g.contextType === 'class');
    return gradings;
  }, [gradings, activeFilter]);

  // Reset to page 1 when filter changes - must be before early returns
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  // Computed values
  const completedGradings = filteredGradings.filter(g => g.status === 'completed');
  const processingGradings = filteredGradings.filter(g => g.status === 'processing');

  const avgScore = completedGradings.length > 0
    ? completedGradings.reduce((sum, g) => sum + (g.overallScore || 0), 0) / completedGradings.length
    : 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'needs-work';
  };

  // Get badge label for grading source
  const getSourceBadge = (grading: Grading) => {
    if (grading.sourceType === 'instructor') {
      return { label: 'Instructor', className: 'badge-instructor' };
    }
    return { label: 'Self', className: 'badge-self' };
  };

  // Get badge label for grading context
  const getContextBadge = (grading: Grading) => {
    if (grading.contextType === 'class') {
      return { 
        label: grading.contextName ? `Class: ${grading.contextName}` : 'Class', 
        className: 'badge-class' 
      };
    }
    return { label: 'Practice', className: 'badge-practice' };
  };

  // Early returns for loading/auth states - must be AFTER all hooks
  if (loading || loadingData) {
    return (
      <main className="app-container">
        <div className="analytics-skeleton">
          <div className="skeleton-header">
            <div className="skeleton-line" style={{ width: '200px', height: '32px' }}></div>
            <div className="skeleton-line" style={{ width: '300px', height: '20px', marginTop: '8px' }}></div>
          </div>
          <div className="gradings-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="grading-card skeleton-card">
                <div className="skeleton-line" style={{ width: '60%', height: '20px' }}></div>
                <div className="skeleton-line" style={{ width: '40%', height: '16px', marginTop: '8px' }}></div>
                <div className="skeleton-line" style={{ width: '80px', height: '40px', marginTop: '16px' }}></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="app-container">
      <header className="app-header">
        <h1>Analytics Dashboard</h1>
        <p>
          {user?.role === 'instructor' 
            ? 'View your speaking practice gradings and performance insights'
            : 'View your presentation gradings and performance insights'}
        </p>
      </header>

      <div className="analytics-content">
        {/* Filter Pills */}
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
          <button
            className={`filter-pill ${activeFilter === 'class' ? 'active' : ''}`}
            onClick={() => setActiveFilter('class')}
          >
            Class Assignments
          </button>
        </div>

        {/* Stats Overview */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Gradings</div>
              <div className="stat-value">{gradings.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon success">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-label">Completed</div>
              <div className="stat-value">{completedGradings.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon accent">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-label">Avg Score</div>
              <div className="stat-value">{avgScore.toFixed(0)}%</div>
            </div>
          </div>

          {processingGradings.length > 0 && (
            <div className="stat-card">
              <div className="stat-icon processing">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-label">Processing</div>
                <div className="stat-value">{processingGradings.length}</div>
              </div>
            </div>
          )}
        </div>

        {rubricError && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>{rubricError}</div>
        )}
        {rubricSuccess && (
          <div className="success-message" style={{ marginBottom: '1rem' }}>{rubricSuccess}</div>
        )}

        {/* Gradings List */}
        <div className="gradings-section">
          <div className="section-header-with-pagination">
            <div className="section-header-left">
              <h2>
                {activeFilter === 'all' ? 'All Gradings' : 
                 activeFilter === 'practice' ? 'Practice Gradings' : 'Class Gradings'}
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
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredGradings.length)}-{Math.min(currentPage * itemsPerPage, filteredGradings.length)} of {filteredGradings.length}
              </div>
            )}
          </div>
        </div>

        {filteredGradings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h2>
              {activeFilter === 'all' ? 'No Gradings Yet' : 
               activeFilter === 'practice' ? 'No Practice Gradings' : 'No Class Gradings'}
            </h2>
            <p>
              {activeFilter === 'all' 
                ? 'Grade a practice presentation or a class assignment to see analytics here'
                : activeFilter === 'practice'
                ? 'Practice gradings will appear here when you grade your own presentations'
                : 'Class gradings will appear here when instructors grade your submissions'}
            </p>
            <button className="btn-primary" onClick={() => router.push('/library')}>
              Go to Library
            </button>
          </div>
        ) : (
          <>
            <div className="gradings-grid">
              {filteredGradings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(grading => {
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
                      {grading.status === 'failed' && (
                        <span className="status-badge failed">Failed</span>
                      )}
                    </div>

                    {/* Grading Context Badges */}
                    <div className="grading-badges">
                      <span className={`grading-badge ${sourceBadge.className}`}>
                        {sourceBadge.label}
                      </span>
                      <span className={`grading-badge ${contextBadge.className}`}>
                        {contextBadge.label}
                      </span>
                    </div>

                    <div className="grading-card-rubric">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                          year: 'numeric'
                        })}
                      </span>
                      {grading.status === 'completed' && (
                        <span className="view-link">View Details →</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Pagination Controls */}
            {filteredGradings.length > itemsPerPage && (
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                
                <div className="pagination-pages">
                  {Array.from({ length: Math.ceil(filteredGradings.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
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
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredGradings.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(filteredGradings.length / itemsPerPage)}
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
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rubric-item skeleton">
                      <div className="skeleton-line" style={{ width: '60%', height: '20px' }}></div>
                      <div className="skeleton-line" style={{ width: '40%', height: '16px', marginTop: '8px' }}></div>
                    </div>
                  ))}
                </div>
              ) : rubrics.filter(r => r.rubricType === 'custom').length === 0 ? (
                <div className="empty-rubrics">
                  <p>No custom rubrics yet. Create one to start grading presentations.</p>
                </div>
              ) : (
                <div className="rubric-list">
                  {rubrics.filter(r => r.rubricType === 'custom').map(rubric => (
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
