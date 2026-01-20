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
  createdAt: string;
}

export interface CreateClassRequest {
  name: string;
  description?: string;
}

export interface JoinClassRequest {
  join_code: string;
}
