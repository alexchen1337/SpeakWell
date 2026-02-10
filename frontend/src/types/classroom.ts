export interface Classroom {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  instructorId: string;
  instructorName: string | null;
  instructorEmail: string;
  studentCount: number;
  createdAt: string;
}

export interface Student {
  id: string;
  email: string;
  name: string | null;
  enrolledAt: string;
}

export interface ClassPresentation {
  id: string;
  filename: string;
  status: string;
  duration: number | null;
  fileSize: number | null;
  uploadedAt: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string;
  transcriptId: string | null;
  latestGradingId: string | null;
  latestGradingStatus: string | null;
  latestGradingScore: number | null;
  gradedByUserId: string | null;
  gradedByRole: string | null;
  // Grading context fields
  sourceType: string | null;
  contextType: string | null;
  isOfficial: boolean | null;
}

export interface ClassGrading {
  id: string;
  transcriptId: string;
  audioFileId: string;
  presentationTitle: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string;
  rubricId: string | null;
  rubricName: string | null;
  status: string;
  overallScore: number | null;
  pacingScore: number | null;
  clarityScore: number | null;
  gradedByUserId: string | null;
  gradedByName: string | null;
  gradedByRole: string | null;
  // Grading context fields
  sourceType: string;
  contextType: string;
  isOfficial: boolean;
  createdAt: string;
}

export interface ClassStats {
  totalPresentations: number;
  gradedPresentations: number;
  officialGradings: number;
  averageScore: number | null;
  scoreDistribution: {
    '80-100': number;
    '60-79': number;
    '40-59': number;
    '0-39': number;
  };
}

export interface CreateClassRequest {
  name: string;
  description?: string;
}

export interface JoinClassRequest {
  join_code: string;
}
