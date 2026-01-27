export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
  orderIndex: number;
}

export interface Rubric {
  id: string;
  name: string;
  description: string | null;
  rubricType: 'built_in' | 'custom';
  createdAt: string;
  criteria: RubricCriterion[];
}

export interface CriterionScore {
  criterion_id: string;
  criterion_name: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface FillerWord {
  word: string;
  count: number;
}

export interface PacingSegment {
  start: number;
  end: number;
  wpm: number;
}

export interface GradingDetailedResults {
  criterion_scores: CriterionScore[];
  filler_words: FillerWord[];
  nonsensical_words: string[];
  pacing_timeline: PacingSegment[];
  ai_feedback: string;
}

export type GradingSourceType = 'self' | 'instructor';
export type GradingContextType = 'practice' | 'class';

export interface Grading {
  id: string;
  transcriptId: string;
  audioFileId: string | null;
  audioOwnerId: string | null;
  presentationTitle: string | null;
  rubricId: string | null;
  rubricName: string | null;
  status: 'processing' | 'completed' | 'failed';
  overallScore: number | null;
  maxPossibleScore: number | null;

  // Grading context fields
  sourceType: GradingSourceType;
  contextType: GradingContextType;
  contextId: string | null;  // class_id when contextType = "class"
  contextName: string | null;  // class name for display
  isOfficial: boolean;

  pacingWpmAvg: number | null;
  pacingWpmVariance: number | null;
  pacingPauseCount: number | null;
  pacingScore: number | null;

  clarityFillerWordCount: number | null;
  clarityFillerWordPercentage: number | null;
  clarityNonsensicalWordCount: number | null;
  clarityScore: number | null;

  detailedResults: GradingDetailedResults | null;
  gradedByUserId: string | null;
  gradedByName: string | null;
  gradedByRole: string | null;
  createdAt: string;
}

export interface RubricCriterionRequest {
  name: string;
  description: string;
  maxScore: number;
  weight: number;
}

export interface RubricCreateRequest {
  name: string;
  description?: string;
  criteria: RubricCriterionRequest[];
}

export interface RubricUpdateRequest {
  name?: string;
  description?: string;
  criteria?: RubricCriterionRequest[];
}

export interface GradingInitiateRequest {
  transcript_id: string;
  rubric_id: string;
  // Optional grading context fields
  source_type?: GradingSourceType;
  context_type?: GradingContextType;
  context_id?: string;
  is_official?: boolean;
}
