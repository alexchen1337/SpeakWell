'use client';

import { useState } from 'react';
import { Rubric } from '@/types/grading';
import './RubricSelectorModal.css';

interface RubricSelectorModalProps {
  rubrics: Rubric[];
  onSelect: (rubricId: string) => void;
  onCancel: () => void;
}

export default function RubricSelectorModal({ rubrics, onSelect, onCancel }: RubricSelectorModalProps) {
  const [selectedRubricId, setSelectedRubricId] = useState<string | null>(
    rubrics.find(r => r.rubricType === 'built_in')?.id || null
  );

  const builtInRubrics = rubrics.filter(r => r.rubricType === 'built_in');
  const customRubrics = rubrics.filter(r => r.rubricType === 'custom');

  const handleCardClick = (rubricId: string) => {
    setSelectedRubricId(rubricId);
  };

  const handleGrade = () => {
    if (selectedRubricId) {
      onSelect(selectedRubricId);
    }
  };

  const selectedRubric = rubrics.find(r => r.id === selectedRubricId);

  return (
    <div className="rubric-selector-overlay" onClick={onCancel}>
      <div className="rubric-selector-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-icon" onClick={onCancel} aria-label="Close">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="rubric-selector-header">
          <div className="rubric-selector-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <h2>Choose Your Grading Rubric</h2>
          <p>Select a rubric to evaluate this presentation</p>
        </div>

        <div className="rubric-selector-content">
          {builtInRubrics.length > 0 && (
            <div className="rubric-section">
              <div className="section-label">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recommended
              </div>
              <div className="rubric-grid">
                {builtInRubrics.map(rubric => (
                  <div
                    key={rubric.id}
                    className={`rubric-card ${selectedRubricId === rubric.id ? 'selected' : ''}`}
                    onClick={() => handleCardClick(rubric.id)}
                  >
                    <div className="rubric-card-header">
                      <div className="rubric-card-check">
                        {selectedRubricId === rubric.id && (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="rubric-card-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </div>
                    </div>
                    <h3>{rubric.name}</h3>
                    {rubric.description && <p className="rubric-card-desc">{rubric.description}</p>}
                    <div className="rubric-card-footer">
                      <span className="criteria-badge">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {rubric.criteria.length} {rubric.criteria.length === 1 ? 'criterion' : 'criteria'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customRubrics.length > 0 && (
            <div className="rubric-section">
              <div className="section-label">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Your Custom Rubrics
              </div>
              <div className="rubric-grid">
                {customRubrics.map(rubric => (
                  <div
                    key={rubric.id}
                    className={`rubric-card ${selectedRubricId === rubric.id ? 'selected' : ''}`}
                    onClick={() => handleCardClick(rubric.id)}
                  >
                    <div className="rubric-card-header">
                      <div className="rubric-card-check">
                        {selectedRubricId === rubric.id && (
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="rubric-card-icon custom">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                    </div>
                    <h3>{rubric.name}</h3>
                    {rubric.description && <p className="rubric-card-desc">{rubric.description}</p>}
                    <div className="rubric-card-footer">
                      <span className="criteria-badge">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {rubric.criteria.length} {rubric.criteria.length === 1 ? 'criterion' : 'criteria'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rubrics.length === 0 && (
            <div className="empty-state-new">
              <div className="empty-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3>No Rubrics Available</h3>
              <p>Create a custom rubric in your profile to start grading presentations.</p>
            </div>
          )}
        </div>

        {/* Footer with Grade button */}
        <div className="rubric-selector-footer">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn-grade" 
            onClick={handleGrade}
            disabled={!selectedRubricId}
          >
            Grade Presentation
          </button>
        </div>
      </div>
    </div>
  );
}
