'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth';
import { rubricAPI } from '@/services/api';
import { Rubric, RubricCriterionRequest } from '@/types/grading';
import RubricEditorModal from '@/components/RubricEditorModal';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout, refreshUser } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [updating, setUpdating] = useState(false);
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
    if (!confirm('Are you sure you want to delete this rubric?')) return;
    
    try {
      await rubricAPI.delete(rubricId);
      setRubricSuccess('Rubric deleted successfully');
      await loadRubrics();
      setTimeout(() => setRubricSuccess(null), 3000);
    } catch (err: any) {
      setRubricError(err.response?.data?.detail || 'Failed to delete rubric');
    }
  };

  if (loading) {
    return (
      <main className="app-container">
        <div className="profile-container">
          <div className="profile-header">
            <div className="skeleton-line" style={{ width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 1rem' }}></div>
            <div className="skeleton-line" style={{ height: '28px', width: '160px', margin: '0 auto 0.25rem' }}></div>
            <div className="skeleton-line" style={{ height: '20px', width: '200px', margin: '0 auto' }}></div>
          </div>
          <div className="profile-card">
            <div className="skeleton-line" style={{ height: '20px', width: '120px', marginBottom: '1rem' }}></div>
            <div className="profile-info-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i}>
                  <div className="skeleton-line" style={{ height: '14px', width: '60px', marginBottom: '0.375rem' }}></div>
                  <div className="skeleton-line" style={{ height: '18px', width: '100%' }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
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

  return (
    <main className="app-container">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar-large">
            <img 
              src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user.email)}`} 
              alt="Profile" 
            />
          </div>
          <h1>{user.name}</h1>
          <p className="profile-email">{user.email}</p>
        </div>

        <div className="profile-card">
          <h2>Account details</h2>
          
          {error && (
            <div className="profile-message error-message-profile">
              {error}
            </div>
          )}
          
          {success && (
            <div className="profile-message success-message-profile">
              {success}
            </div>
          )}
          
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <label>Email</label>
              <p>{user.email}</p>
            </div>
            <div className="profile-info-item">
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
            {user.role && (
              <div className="profile-info-item">
                <label>Role</label>
                <p>{user.role}</p>
              </div>
            )}
            {user.organization && (
              <div className="profile-info-item">
                <label>Organization</label>
                <p>{user.organization}</p>
              </div>
            )}
            {user.group && (
              <div className="profile-info-item">
                <label>Group</label>
                <p>{user.group}</p>
              </div>
            )}
          </div>
        </div>

        {/* Custom Rubrics Section */}
        <div className="profile-card">
          <div className="rubric-section-header">
            <h2>Custom Grading Rubrics</h2>
            <button onClick={handleCreateRubric} className="btn-primary btn-small">
              + Create Rubric
            </button>
          </div>
          
          {rubricError && (
            <div className="profile-message error-message-profile">
              {rubricError}
            </div>
          )}
          
          {rubricSuccess && (
            <div className="profile-message success-message-profile">
              {rubricSuccess}
            </div>
          )}

          {loadingRubrics ? (
            <div className="rubric-list">
              {[1, 2].map(i => (
                <div key={i} className="rubric-item skeleton">
                  <div className="skeleton-line" style={{ height: '20px', width: '60%', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton-line" style={{ height: '14px', width: '80%', marginBottom: '0.5rem' }}></div>
                  <div className="skeleton-line" style={{ height: '12px', width: '40%' }}></div>
                </div>
              ))}
            </div>
          ) : customRubrics.length === 0 ? (
            <div className="empty-rubrics">
              <p>No custom rubrics yet. Create one to use for grading presentations.</p>
            </div>
          ) : (
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
          )}
        </div>

        <div className="profile-actions">
          <button onClick={() => router.push('/')} className="btn-secondary">
            Back to library
          </button>
          <button onClick={logout} className="btn-danger">
            Sign out
          </button>
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
