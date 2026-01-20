'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { classesAPI } from '@/services/api';
import { Classroom } from '@/types/classroom';

export default function ClassesPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();

  const [teachingClasses, setTeachingClasses] = useState<Classroom[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<Classroom[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create class form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Join class form
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const loadClasses = useCallback(async () => {
    if (!user?.role) return;
    
    try {
      setLoadingClasses(true);
      setError(null);

      if (user.role === 'instructor') {
        const classes = await classesAPI.listTeaching();
        setTeachingClasses(classes);
      } else if (user.role === 'student') {
        const classes = await classesAPI.listEnrolled();
        setEnrolledClasses(classes);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load classes');
    } finally {
      setLoadingClasses(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      loadClasses();
    }
  }, [isAuthenticated, user?.role, loadClasses]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const newClass = await classesAPI.create({
        name: newClassName.trim(),
        description: newClassDescription.trim() || undefined,
      });
      setTeachingClasses([newClass, ...teachingClasses]);
      setNewClassName('');
      setNewClassDescription('');
      setShowCreateForm(false);
      setSuccess('Class created successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setError(null);

    try {
      const classroom = await classesAPI.join({ join_code: joinCode.trim() });
      setEnrolledClasses([classroom, ...enrolledClasses]);
      setJoinCode('');
      setSuccess(`Joined "${classroom.name}" successfully!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join class');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main className="app-container">
        <div className="classes-container">
          <div className="skeleton-line" style={{ height: '32px', width: '200px', marginBottom: '2rem' }}></div>
          <div className="classes-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="class-card skeleton">
                <div className="skeleton-line" style={{ height: '24px', width: '70%', marginBottom: '0.75rem' }}></div>
                <div className="skeleton-line" style={{ height: '16px', width: '50%', marginBottom: '0.5rem' }}></div>
                <div className="skeleton-line" style={{ height: '14px', width: '40%' }}></div>
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

  // Prompt to set role if not set
  if (!user.role) {
    return (
      <main className="app-container">
        <div className="classes-container">
          <div className="role-prompt-card">
            <h1>Welcome to Classes</h1>
            <p>Please set your role in your profile before using classes.</p>
            <button onClick={() => router.push('/profile')} className="btn-primary">
              Go to Profile
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isInstructor = user.role === 'instructor';
  const classes = isInstructor ? teachingClasses : enrolledClasses;

  return (
    <main className="app-container">
      <div className="classes-container">
        <div className="classes-header">
          <div>
            <h1>{isInstructor ? 'My Classes' : 'Enrolled Classes'}</h1>
            <p className="classes-subtitle">
              {isInstructor 
                ? 'Manage your classes and view student submissions'
                : 'View your enrolled classes and submit presentations'
              }
            </p>
          </div>
          {isInstructor && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn-primary"
            >
              + Create Class
            </button>
          )}
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

        {/* Create class form (instructor) */}
        {isInstructor && showCreateForm && (
          <div className="create-class-form">
            <h3>Create New Class</h3>
            <form onSubmit={handleCreateClass}>
              <div className="form-group">
                <label htmlFor="className">Class Name *</label>
                <input
                  type="text"
                  id="className"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Public Speaking 101"
                  required
                  disabled={creating}
                />
              </div>
              <div className="form-group">
                <label htmlFor="classDescription">Description (optional)</label>
                <textarea
                  id="classDescription"
                  value={newClassDescription}
                  onChange={(e) => setNewClassDescription(e.target.value)}
                  placeholder="Brief description of the class..."
                  rows={2}
                  disabled={creating}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={creating || !newClassName.trim()}>
                  {creating ? 'Creating...' : 'Create Class'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join class form (student) */}
        {!isInstructor && (
          <div className="join-class-section">
            <form onSubmit={handleJoinClass} className="join-class-form">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter join code"
                className="join-code-input"
                disabled={joining}
              />
              <button type="submit" className="btn-primary" disabled={joining || !joinCode.trim()}>
                {joining ? 'Joining...' : 'Join Class'}
              </button>
            </form>
          </div>
        )}

        {/* Classes list */}
        {loadingClasses ? (
          <div className="classes-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="class-card skeleton">
                <div className="skeleton-line" style={{ height: '24px', width: '70%', marginBottom: '0.75rem' }}></div>
                <div className="skeleton-line" style={{ height: '16px', width: '50%', marginBottom: '0.5rem' }}></div>
                <div className="skeleton-line" style={{ height: '14px', width: '40%' }}></div>
              </div>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="empty-classes">
            <div className="empty-icon">📚</div>
            <h3>{isInstructor ? 'No classes yet' : 'Not enrolled in any classes'}</h3>
            <p>
              {isInstructor 
                ? 'Create your first class to get started.'
                : 'Enter a join code above to enroll in a class.'
              }
            </p>
          </div>
        ) : (
          <div className="classes-grid">
            {classes.map(classroom => (
              <div
                key={classroom.id}
                className="class-card"
                onClick={() => router.push(`/classes/${classroom.id}`)}
              >
                <h3 className="class-name">{classroom.name}</h3>
                {classroom.description && (
                  <p className="class-description">{classroom.description}</p>
                )}
                <div className="class-meta">
                  {isInstructor ? (
                    <>
                      <span className="class-join-code">
                        Join Code: <strong>{classroom.joinCode}</strong>
                      </span>
                      <span className="class-student-count">
                        {classroom.studentCount} {classroom.studentCount === 1 ? 'student' : 'students'}
                      </span>
                    </>
                  ) : (
                    <span className="class-instructor">
                      Instructor: {classroom.instructorName || classroom.instructorEmail}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
