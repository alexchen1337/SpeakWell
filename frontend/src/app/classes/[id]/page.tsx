'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { classesAPI, audioAPI } from '@/services/api';
import { Classroom, ClassPresentation, Student } from '@/types/classroom';

export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;
  const { user, isAuthenticated, loading } = useAuth();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [presentations, setPresentations] = useState<ClassPresentation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state for instructors
  const [activeTab, setActiveTab] = useState<'presentations' | 'students'>('presentations');

  const isInstructor = user?.role === 'instructor';

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const classData = await classesAPI.get(classId);
      setClassroom(classData);

      const presData = await classesAPI.getPresentations(classId);
      setPresentations(presData);

      if (isInstructor) {
        const studentsData = await classesAPI.getStudents(classId);
        setStudents(studentsData);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You do not have access to this class');
      } else if (err.response?.status === 404) {
        setError('Class not found');
      } else {
        setError(err.response?.data?.detail || 'Failed to load class data');
      }
    } finally {
      setLoadingData(false);
    }
  }, [classId, isInstructor]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && classId) {
      loadData();
    }
  }, [isAuthenticated, classId, loadData]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      await audioAPI.uploadAudioToClass(fileArray, classId, (_, progress) => {
        setUploadProgress(progress);
      });
      setSuccess('Upload successful! Your presentation is being processed.');
      setTimeout(() => setSuccess(null), 5000);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePresentationClick = (presentation: ClassPresentation) => {
    // Store in localStorage and navigate to player
    localStorage.setItem('currentAudio', JSON.stringify({
      id: presentation.id,
      title: presentation.filename,
      filename: presentation.filename,
    }));
    router.push('/player');
  };

  const handleLeaveClass = async () => {
    if (!confirm('Are you sure you want to leave this class?')) return;
    
    try {
      await classesAPI.leave(classId);
      router.push('/classes');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to leave class');
    }
  };

  const handleDeleteClass = async () => {
    if (!confirm('Are you sure you want to delete this class? This will remove all enrollments but not student submissions.')) return;
    
    try {
      await classesAPI.deleteClass(classId);
      router.push('/classes');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete class');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="status-badge status-completed">Ready</span>;
      case 'processing':
        return <span className="status-badge status-processing">Processing</span>;
      case 'failed':
        return <span className="status-badge status-failed">Failed</span>;
      default:
        return <span className="status-badge status-uploaded">Uploaded</span>;
    }
  };

  const getGradingBadge = (presentation: ClassPresentation) => {
    if (!presentation.latestGradingId) return null;
    
    if (presentation.latestGradingStatus === 'completed' && presentation.latestGradingScore !== null) {
      // Determine if graded by instructor (not by the student who owns it)
      const isGradedByInstructor = presentation.gradedByRole === 'instructor' && 
        presentation.gradedByUserId !== presentation.studentId;
      
      return (
        <span className="grading-badge grading-completed">
          {presentation.latestGradingScore.toFixed(1)}
          {isGradedByInstructor && <span className="graded-by-indicator"> (instructor)</span>}
        </span>
      );
    } else if (presentation.latestGradingStatus === 'processing') {
      return <span className="grading-badge grading-processing">Grading...</span>;
    }
    return null;
  };

  if (loading || loadingData) {
    return (
      <main className="app-container">
        <div className="class-detail-container">
          <div className="skeleton-line" style={{ height: '32px', width: '40%', marginBottom: '0.5rem' }}></div>
          <div className="skeleton-line" style={{ height: '20px', width: '60%', marginBottom: '2rem' }}></div>
          <div className="class-detail-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="presentation-card skeleton">
                <div className="skeleton-line" style={{ height: '20px', width: '70%', marginBottom: '0.5rem' }}></div>
                <div className="skeleton-line" style={{ height: '16px', width: '50%' }}></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (error && !classroom) {
    return (
      <main className="app-container">
        <div className="class-detail-container">
          <div className="error-card">
            <h2>Error</h2>
            <p>{error}</p>
            <button onClick={() => router.push('/classes')} className="btn-secondary">
              Back to Classes
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!classroom) {
    return null;
  }

  return (
    <main className="app-container">
      <div className="class-detail-container">
        <div className="class-detail-header">
          <button onClick={() => router.push('/classes')} className="back-button">
            ← Back to Classes
          </button>
          
          <div className="class-detail-title">
            <h1>{classroom.name}</h1>
            {classroom.description && <p>{classroom.description}</p>}
          </div>

          <div className="class-detail-meta">
            {isInstructor ? (
              <>
                <div className="meta-item">
                  <span className="meta-label">Join Code</span>
                  <span className="meta-value join-code">{classroom.joinCode}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Students</span>
                  <span className="meta-value">{classroom.studentCount}</span>
                </div>
              </>
            ) : (
              <div className="meta-item">
                <span className="meta-label">Instructor</span>
                <span className="meta-value">{classroom.instructorName || classroom.instructorEmail}</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
            <button onClick={() => setError(null)} className="alert-dismiss">×</button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        {/* Upload section for students */}
        {!isInstructor && (
          <div className="upload-section">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="audio/*"
              multiple
              style={{ display: 'none' }}
              disabled={uploading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary upload-btn"
              disabled={uploading}
            >
              {uploading ? `Uploading... ${uploadProgress}%` : '+ Upload Presentation'}
            </button>
            {uploading && (
              <div className="upload-progress-bar">
                <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            )}
          </div>
        )}

        {/* Tabs for instructors */}
        {isInstructor && (
          <div className="class-tabs-container">
            <div className="class-tabs">
              <button
                className={`tab-button ${activeTab === 'presentations' ? 'active' : ''}`}
                onClick={() => setActiveTab('presentations')}
            >
              Presentations ({presentations.length})
            </button>
            <button
              className={`tab-button ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              Students ({students.length})
            </button>
            </div>
            <button
              className="btn-refresh"
              onClick={loadData}
              disabled={loadingData}
              title="Refresh data"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        )}

        {/* Presentations tab/section */}
        {(activeTab === 'presentations' || !isInstructor) && (
          <div className="presentations-section">
            {presentations.length === 0 ? (
              <div className="empty-presentations">
                <div className="empty-icon">🎤</div>
                <h3>No presentations yet</h3>
                <p>
                  {isInstructor
                    ? 'Students have not uploaded any presentations yet.'
                    : 'Upload your first presentation using the button above.'}
                </p>
              </div>
            ) : (
              <div className="presentations-table-container">
                <table className="presentations-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      {isInstructor && <th>Student</th>}
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Grading</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentations.map(pres => (
                      <tr 
                        key={pres.id} 
                        onClick={() => handlePresentationClick(pres)}
                        className="presentation-row"
                      >
                        <td className="presentation-title">{pres.filename}</td>
                        {isInstructor && (
                          <td className="presentation-student">
                            {pres.studentName || pres.studentEmail}
                          </td>
                        )}
                        <td>{formatDuration(pres.duration)}</td>
                        <td>{getStatusBadge(pres.status)}</td>
                        <td>{getGradingBadge(pres) || '—'}</td>
                        <td className="presentation-date">{formatDate(pres.uploadedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Students tab (instructor only) */}
        {isInstructor && activeTab === 'students' && (
          <div className="students-section">
            {students.length === 0 ? (
              <div className="empty-students">
                <div className="empty-icon">👥</div>
                <h3>No students enrolled</h3>
                <p>Share the join code <strong>{classroom.joinCode}</strong> with your students.</p>
              </div>
            ) : (
              <div className="students-list">
                {students.map(student => (
                  <div key={student.id} className="student-card">
                    <div className="student-avatar">
                      <img 
                        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(student.email)}`}
                        alt={student.name || student.email}
                      />
                    </div>
                    <div className="student-info">
                      <span className="student-name">{student.name || 'Unnamed'}</span>
                      <span className="student-email">{student.email}</span>
                    </div>
                    <div className="student-meta">
                      <span className="enrolled-date">Joined {formatDate(student.enrolledAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="class-actions">
          {isInstructor ? (
            <button onClick={handleDeleteClass} className="btn-danger">
              Delete Class
            </button>
          ) : (
            <button onClick={handleLeaveClass} className="btn-danger-outline">
              Leave Class
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
