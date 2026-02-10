'use client';

import { useState, useEffect } from 'react';
import { Rubric, RubricCriterionRequest } from '@/types/grading';
import './RubricEditorModal.css';

interface RubricEditorModalProps {
  rubric?: Rubric;
  onSave: (name: string, description: string, criteria: RubricCriterionRequest[]) => Promise<void>;
  onCancel: () => void;
}

interface FieldErrors {
  [key: string]: string;
}

export default function RubricEditorModal({ rubric, onSave, onCancel }: RubricEditorModalProps) {
  const [name, setName] = useState(rubric?.name || '');
  const [description, setDescription] = useState(rubric?.description || '');
  const [criteria, setCriteria] = useState<RubricCriterionRequest[]>(
    rubric?.criteria.map(c => ({
      name: c.name,
      description: c.description,
      maxScore: c.maxScore,
      weight: c.weight,
    })) || [
      { name: '', description: '', maxScore: 5, weight: 1 }
    ]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [weightWarning, setWeightWarning] = useState<string | null>(null);
  // Store raw string values for decimal inputs to preserve decimal points while typing
  const [maxScoreInputs, setMaxScoreInputs] = useState<{ [key: number]: string }>({});
  const [weightInputs, setWeightInputs] = useState<{ [key: number]: string }>({});
  
  // Initialize input strings from initial criteria (only on mount)
  useEffect(() => {
    const maxScoreStrings: { [key: number]: string } = {};
    const weightStrings: { [key: number]: string } = {};
    criteria.forEach((c, idx) => {
      maxScoreStrings[idx] = String(c.maxScore);
      weightStrings[idx] = String(c.weight);
    });
    setMaxScoreInputs(maxScoreStrings);
    setWeightInputs(weightStrings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleAddCriterion = () => {
    const newIndex = criteria.length;
    setCriteria([...criteria, { name: '', description: '', maxScore: 5, weight: 1 }]);
    setMaxScoreInputs(prev => ({ ...prev, [newIndex]: '5' }));
    setWeightInputs(prev => ({ ...prev, [newIndex]: '1' }));
  };

  const handleRemoveCriterion = (index: number) => {
    if (criteria.length > 1) {
      setCriteria(criteria.filter((_, i) => i !== index));
      // Clean up input strings
      setMaxScoreInputs(prev => {
        const next = { ...prev };
        delete next[index];
        // Reindex remaining entries
        const reindexed: { [key: number]: string } = {};
        Object.keys(next).forEach(key => {
          const oldIdx = parseInt(key);
          if (oldIdx > index) {
            reindexed[oldIdx - 1] = next[oldIdx];
          } else if (oldIdx < index) {
            reindexed[oldIdx] = next[oldIdx];
          }
        });
        return reindexed;
      });
      setWeightInputs(prev => {
        const next = { ...prev };
        delete next[index];
        const reindexed: { [key: number]: string } = {};
        Object.keys(next).forEach(key => {
          const oldIdx = parseInt(key);
          if (oldIdx > index) {
            reindexed[oldIdx - 1] = next[oldIdx];
          } else if (oldIdx < index) {
            reindexed[oldIdx] = next[oldIdx];
          }
        });
        return reindexed;
      });
    }
  };

  const handleCriterionChange = (index: number, field: keyof RubricCriterionRequest, value: string | number) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
    
    // Clear field error when user starts typing
    const errorKey = `${index}-${field}`;
    if (fieldErrors[errorKey]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
    
    // Validate weights when weight changes
    if (field === 'weight') {
      validateWeights(updated);
    }
  };
  
  const validateWeights = (criteriaList: RubricCriterionRequest[]) => {
    const totalWeight = criteriaList.reduce((sum, c) => sum + (c.weight || 0), 0);
    
    // Common weight totals: 1.0, 10.0, 100.0, or number of criteria
    const commonTotals = [1.0, 10.0, 100.0, criteriaList.length];
    const isCommonTotal = commonTotals.some(total => Math.abs(totalWeight - total) < 0.01);
    
    if (totalWeight <= 0) {
      setWeightWarning('Total weight must be greater than 0');
    } else if (!isCommonTotal && criteriaList.length > 0) {
      setWeightWarning(`Total weight is ${totalWeight.toFixed(2)}. Common values are 1.0, 10.0, 100.0, or ${criteriaList.length} (number of criteria).`);
    } else {
      setWeightWarning(null);
    }
  };
  
  useEffect(() => {
    // Validate weights when criteria count changes (e.g., adding/removing criteria)
    validateWeights(criteria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria.length]);

  const validatePositiveNumber = (value: number, index: number, field: 'maxScore' | 'weight'): boolean => {
    const errorKey = `${index}-${field}`;
    if (isNaN(value) || value <= 0) {
      setFieldErrors(prev => ({ ...prev, [errorKey]: 'Input must be a positive number' }));
      return false;
    }
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!name.trim()) {
      setError('Rubric name is required');
      return;
    }

    if (criteria.length === 0) {
      setError('At least one criterion is required');
      return;
    }

    let hasErrors = false;
    const newFieldErrors: FieldErrors = {};

    for (let i = 0; i < criteria.length; i++) {
      const criterion = criteria[i];
      if (!criterion.name.trim() || !criterion.description.trim()) {
        setError('All criterion fields must be filled');
        return;
      }
      if (isNaN(criterion.maxScore) || criterion.maxScore <= 0) {
        newFieldErrors[`${i}-maxScore`] = 'Input must be a positive number';
        hasErrors = true;
      }
      if (isNaN(criterion.weight) || criterion.weight <= 0) {
        newFieldErrors[`${i}-weight`] = 'Input must be a positive number';
        hasErrors = true;
      }
    }

    if (hasErrors) {
      setFieldErrors(newFieldErrors);
      return;
    }
    
    // Validate total weight
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight <= 0) {
      setError('Total weight must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      await onSave(name, description, criteria);
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
        } else {
          errorMessage = JSON.stringify(detail);
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{rubric ? 'Edit Rubric' : 'Create Rubric'}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="rubric-form">
          <div className="form-group">
            <label htmlFor="rubric-name">Rubric Name</label>
            <input
              id="rubric-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Technical Presentation Rubric"
              maxLength={255}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="rubric-description">Description (Optional)</label>
            <textarea
              id="rubric-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of when to use this rubric..."
              rows={3}
            />
          </div>

          <div className="criteria-section">
            <div className="criteria-header">
              <h3>Criteria</h3>
              <button type="button" className="btn-secondary" onClick={handleAddCriterion}>
                + Add Criterion
              </button>
            </div>

            <div className="criteria-list">
              {criteria.map((criterion, index) => (
                <div key={index} className="criterion-card">
                  <div className="criterion-header">
                    <span className="criterion-number">#{index + 1}</span>
                    {criteria.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => handleRemoveCriterion(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor={`criterion-name-${index}`}>Name</label>
                    <input
                      id={`criterion-name-${index}`}
                      type="text"
                      value={criterion.name}
                      onChange={(e) => handleCriterionChange(index, 'name', e.target.value)}
                      placeholder="e.g., Technical Content"
                      maxLength={255}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor={`criterion-description-${index}`}>Description</label>
                    <textarea
                      id={`criterion-description-${index}`}
                      value={criterion.description}
                      onChange={(e) => handleCriterionChange(index, 'description', e.target.value)}
                      placeholder="What should be evaluated for this criterion..."
                      rows={2}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor={`criterion-maxscore-${index}`}>Max Score</label>
                      <input
                        id={`criterion-maxscore-${index}`}
                        type="text"
                        inputMode="decimal"
                        value={maxScoreInputs[index] ?? String(criterion.maxScore)}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow empty string, numbers, and decimal point
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            // Store the raw string value
                            setMaxScoreInputs(prev => ({ ...prev, [index]: val }));
                            // Update the numeric value for validation
                            const numValue = val === '' || val === '.' ? 0 : parseFloat(val);
                            if (!isNaN(numValue)) {
                              handleCriterionChange(index, 'maxScore', numValue);
                            }
                          }
                        }}
                        onBlur={() => {
                          // Ensure we have a valid number on blur
                          const currentInput = maxScoreInputs[index] ?? String(criterion.maxScore);
                          const numValue = currentInput === '' || currentInput === '.' ? 0 : parseFloat(currentInput);
                          if (isNaN(numValue) || numValue <= 0) {
                            // Reset to previous valid value
                            setMaxScoreInputs(prev => ({ ...prev, [index]: String(criterion.maxScore) }));
                          } else {
                            // Normalize the display (remove trailing decimal if whole number)
                            const normalized = numValue % 1 === 0 ? String(numValue) : String(numValue);
                            setMaxScoreInputs(prev => ({ ...prev, [index]: normalized }));
                            handleCriterionChange(index, 'maxScore', numValue);
                          }
                          validatePositiveNumber(criterion.maxScore, index, 'maxScore');
                        }}
                        className={fieldErrors[`${index}-maxScore`] ? 'input-error' : ''}
                        placeholder="e.g., 10.0"
                        required
                      />
                      {fieldErrors[`${index}-maxScore`] && (
                        <span className="field-error">{fieldErrors[`${index}-maxScore`]}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor={`criterion-weight-${index}`}>Weight</label>
                      <input
                        id={`criterion-weight-${index}`}
                        type="text"
                        inputMode="decimal"
                        value={weightInputs[index] ?? String(criterion.weight)}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow empty string, numbers, and decimal point
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            // Store the raw string value
                            setWeightInputs(prev => ({ ...prev, [index]: val }));
                            // Update the numeric value for validation
                            const numValue = val === '' || val === '.' ? 0 : parseFloat(val);
                            if (!isNaN(numValue)) {
                              handleCriterionChange(index, 'weight', numValue);
                            }
                          }
                        }}
                        onBlur={() => {
                          // Ensure we have a valid number on blur
                          const currentInput = weightInputs[index] ?? String(criterion.weight);
                          const numValue = currentInput === '' || currentInput === '.' ? 0 : parseFloat(currentInput);
                          if (isNaN(numValue) || numValue <= 0) {
                            // Reset to previous valid value
                            setWeightInputs(prev => ({ ...prev, [index]: String(criterion.weight) }));
                          } else {
                            // Normalize the display (remove trailing decimal if whole number)
                            const normalized = numValue % 1 === 0 ? String(numValue) : String(numValue);
                            setWeightInputs(prev => ({ ...prev, [index]: normalized }));
                            handleCriterionChange(index, 'weight', numValue);
                          }
                          validatePositiveNumber(criterion.weight, index, 'weight');
                          validateWeights(criteria);
                        }}
                        className={fieldErrors[`${index}-weight`] ? 'input-error' : ''}
                        placeholder="e.g., 1.0"
                        required
                      />
                      {fieldErrors[`${index}-weight`] && (
                        <span className="field-error">{fieldErrors[`${index}-weight`]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Weight validation summary */}
            <div className="weight-summary">
              <div className="weight-total">
                <strong>Total Weight:</strong> {criteria.reduce((sum, c) => sum + (c.weight || 0), 0).toFixed(2)}
              </div>
              {weightWarning && (
                <div className="weight-warning">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ width: '16px', height: '16px', flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{weightWarning}</span>
                </div>
              )}
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (rubric ? 'Update Rubric' : 'Create Rubric')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
