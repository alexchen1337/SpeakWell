'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { authService } from '@/services/auth';
import { rubricAPI } from '@/services/api';
import { Rubric, RubricCriterionRequest } from '@/types/grading';
import RubricEditorModal from '@/components/RubricEditorModal';
import { toast } from 'sonner';
import '@/styles/profile.css';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout, refreshUser } = useAuth();
  const confirm = useConfirm();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Rubric management state
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loadingRubrics, setLoadingRubrics] = useState(true);
  const [showRubricEditor, setShowRubricEditor] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | undefined>();
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricSuccess, setRubricSuccess] = useState<string | null>(null);

  const loadRubrics = useCallback(async () => {
    try {
      setLoadingRubrics(true);
      const data = await rubricAPI.list();
      setRubrics(data);
    } catch {
      setRubricError('Failed to load rubrics');
    } finally {
      setLoadingRubrics(false);
    }
  }, []);

  // Filter to show only custom rubrics
  const customRubrics = rubrics.filter(r => r.rubricType === 'custom');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRubrics();
    }
  }, [isAuthenticated, loadRubrics]);

  const handleCreateRubric = () => {
    setEditingRubric(undefined);
    setShowRubricEditor(true);
    setRubricError(null);
  };

  const handleEditRubric = (rubric: Rubric) => {
    setEditingRubric(rubric);
    setShowRubricEditor(true);
    setRubricError(null);
  };

  const handleSaveRubric = async (name: string, description: string, criteria: RubricCriterionRequest[]) => {
    try {
      if (editingRubric) {
        await rubricAPI.update(editingRubric.id, { name, description, criteria });
        setRubricSuccess('Rubric updated successfully');
      } else {
        await rubricAPI.create({ name, description, criteria });
        setRubricSuccess('Rubric created successfully');
      }
      setShowRubricEditor(false);
      setEditingRubric(undefined);
      await loadRubrics();
      setTimeout(() => setRubricSuccess(null), 3000);
    } catch (err: any) {
      throw new Error(err.response?.data?.detail || 'Failed to save rubric');
    }
  };

  const handleDeleteRubric = async (rubricId: string) => {
    const ok = await confirm({
      title: 'Delete rubric',
      message: 'Are you sure you want to delete this rubric?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await rubricAPI.delete(rubricId);
      setRubricSuccess('Rubric deleted successfully');
      await loadRubrics();
      setTimeout(() => setRubricSuccess(null), 3000);
    } catch (err: any) {
      setRubricError(err.response?.data?.detail || 'Failed to delete rubric');
    }
  };

  if (loading || !isAuthenticated || !user) {
    return null;
  }

  const handleEditName = () => {
    setNewName(user.name || '');
    setIsEditingName(true);
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setNewName('');
    setError(null);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      await authService.updateName(newName.trim());
      await refreshUser();
      setSuccess('Name updated successfully');
      setIsEditingName(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update name');
    } finally {
      setUpdating(false);
    }
  };

  const handleRoleChange = async (newRole: 'student' | 'instructor') => {
    if (newRole === user.role) return;

    setUpdatingRole(true);

    try {
      await authService.updateRole(newRole);
      await refreshUser();
      toast.success(`Role updated to ${newRole}`, { duration: 1500 });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  return (
    <main className="profile-page studio-surface">
      <div className="profile-stack">
      <div className="profile-hero">
        <div className="profile-hero-content">
          <div className="profile-avatar-ring">
            <div className="profile-avatar-large">
              <img
                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user.email)}`}
                alt="Profile"
              />
            </div>
          </div>
          <div className="profile-hero-text">
            <h1>{user.name}</h1>
            <span className="profile-email">{user.email}</span>
            {user.role && (
              <span className="profile-role-pill">
                {user.role === 'instructor' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/></svg>
                )}
                {user.role}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="profile-body">
        {(error || success) && (
          <div className={`profile-toast ${error ? 'profile-toast--error' : 'profile-toast--success'}`}>
            {error || success}
          </div>
        )}

        <section className="profile-section">
          <div className="profile-section-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Account
          </div>
          <div className="profile-fields">
            <div className="profile-field">
              <label>Email</label>
              <p>{user.email}</p>
            </div>
            <div className="profile-field">
              <label>Name</label>
              {isEditingName ? (
                <div className="name-edit-container">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="name-edit-input"
                    placeholder="Enter your name"
                    autoFocus
                    disabled={updating}
                  />
                  <div className="name-edit-actions">
                    <button
                      onClick={handleSaveName}
                      className="btn-save"
                      disabled={updating || !newName.trim()}
                    >
                      {updating ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="btn-cancel"
                      disabled={updating}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="name-display-container">
                  <p>{user.name}</p>
                  <button onClick={handleEditName} className="btn-edit-name">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div className="profile-field">
              <label>Role</label>
              <div className="role-toggle-group">
                <button
                  className={`role-toggle-btn ${user.role === 'student' ? 'active' : ''}`}
                  onClick={() => handleRoleChange('student')}
                  disabled={updatingRole}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5"/></svg>
                  Student
                </button>
                <button
                  className={`role-toggle-btn ${user.role === 'instructor' ? 'active' : ''}`}
                  onClick={() => handleRoleChange('instructor')}
                  disabled={updatingRole}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  Instructor
                </button>
              </div>
            </div>
            {user.organization && (
              <div className="profile-field">
                <label>Organization</label>
                <p>{user.organization}</p>
              </div>
            )}
            {user.group && (
              <div className="profile-field">
                <label>Group</label>
                <p>{user.group}</p>
              </div>
            )}
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Custom Rubrics
          </div>

          {rubricError && (
            <div className="profile-toast profile-toast--error">{rubricError}</div>
          )}
          {rubricSuccess && (
            <div className="profile-toast profile-toast--success">{rubricSuccess}</div>
          )}

          {loadingRubrics ? (
            <div className="rubric-list">
              {[1, 2].map(i => (
                <div key={i} className="rubric-item skeleton">
                  <div className="skeleton-line" style={{ height: '20px', width: '60%', marginBottom: '0.5rem' }} />
                  <div className="skeleton-line" style={{ height: '14px', width: '80%', marginBottom: '0.5rem' }} />
                  <div className="skeleton-line" style={{ height: '12px', width: '40%' }} />
                </div>
              ))}
            </div>
          ) : customRubrics.length === 0 ? (
            <div className="profile-empty-rubrics">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <p>No custom rubrics yet</p>
              <button onClick={handleCreateRubric} className="btn-primary btn-small">
                + Create your first rubric
              </button>
            </div>
          ) : (
            <>
              <div className="rubric-list">
                {customRubrics.map(rubric => (
                  <div key={rubric.id} className="rubric-item">
                    <div className="rubric-info">
                      <h3>{rubric.name}</h3>
                      {rubric.description && <p>{rubric.description}</p>}
                      <span className="criteria-count">{rubric.criteria.length} criteria</span>
                    </div>
                    <div className="rubric-actions">
                      <button onClick={() => handleEditRubric(rubric)} className="btn-edit">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteRubric(rubric.id)} className="btn-danger btn-small">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleCreateRubric} className="profile-add-rubric-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New rubric
              </button>
            </>
          )}
        </section>

        <div className="profile-footer">
          <button onClick={() => router.push('/')} className="btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to library
          </button>
          <button onClick={logout} className="profile-signout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
      </div>

      {showRubricEditor && (
        <RubricEditorModal
          rubric={editingRubric}
          onSave={handleSaveRubric}
          onCancel={() => {
            setShowRubricEditor(false);
            setEditingRubric(undefined);
          }}
        />
      )}
    </main>
  );
}
