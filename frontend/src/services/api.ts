import axios from 'axios';
import { AudioFile, TranscriptResponse } from '@/types/audio';
import { Rubric, RubricCreateRequest, RubricUpdateRequest, Grading, GradingInitiateRequest } from '@/types/grading';
import { Classroom, Student, ClassPresentation, ClassGrading, CreateClassRequest, JoinClassRequest } from '@/types/classroom';
import { API_URL } from '@/config';

const API_BASE_URL = API_URL;

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const audioAPI = {
  uploadAudio: async (
    files: File[], 
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<AudioFile[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('audio', file));
    
    const response = await axiosInstance.post('/api/audio/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          files.forEach((_, index) => onProgress(index, progress));
        }
      },
    });
    return response.data;
  },

  uploadAudioToClass: async (
    files: File[],
    classId: string,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<AudioFile[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('audio', file));
    
    const response = await axiosInstance.post('/api/audio/upload', formData, {
      params: { class_id: classId },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          files.forEach((_, index) => onProgress(index, progress));
        }
      },
    });
    return response.data;
  },

  getAllAudio: async (): Promise<AudioFile[]> => {
    const response = await axiosInstance.get('/api/audio');
    return response.data;
  },

  getAudio: async (id: string): Promise<AudioFile> => {
    const response = await axiosInstance.get(`/api/audio/${id}`);
    return response.data;
  },

  updateAudio: async (id: string, title: string): Promise<AudioFile> => {
    const response = await axiosInstance.patch(`/api/audio/${id}`, null, {
      params: { title }
    });
    return response.data;
  },

  deleteAudio: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/audio/${id}`);
  },

  refreshAudioUrl: async (id: string): Promise<{ url: string }> => {
    const audio = await axiosInstance.get(`/api/audio/${id}`);
    return { url: audio.data.url };
  },
};

export const transcriptAPI = {
  getTranscript: async (audioId: string): Promise<TranscriptResponse> => {
    const response = await axiosInstance.get(`/api/transcripts/${audioId}`);
    return response.data;
  },

  retryTranscription: async (audioId: string): Promise<{ message: string; status: string }> => {
    const response = await axiosInstance.post(`/api/transcripts/${audioId}/retry`);
    return response.data;
  },
};

// Transform rubric request from camelCase to snake_case for backend
const transformRubricRequest = (data: RubricCreateRequest | RubricUpdateRequest) => ({
  name: data.name,
  description: data.description,
  criteria: data.criteria?.map(c => ({
    name: c.name,
    description: c.description,
    max_score: c.maxScore,
    weight: c.weight,
  })),
});

export const rubricAPI = {
  list: async (): Promise<Rubric[]> => {
    const response = await axiosInstance.get('/api/rubrics');
    return response.data;
  },

  get: async (id: string): Promise<Rubric> => {
    const response = await axiosInstance.get(`/api/rubrics/${id}`);
    return response.data;
  },

  create: async (data: RubricCreateRequest): Promise<Rubric> => {
    const response = await axiosInstance.post('/api/rubrics', transformRubricRequest(data));
    return response.data;
  },

  update: async (id: string, data: RubricUpdateRequest): Promise<Rubric> => {
    const response = await axiosInstance.put(`/api/rubrics/${id}`, transformRubricRequest(data));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/api/rubrics/${id}`);
  },
};

export const gradingAPI = {
  initiate: async (data: GradingInitiateRequest, replaceExisting: boolean = false): Promise<Grading> => {
    const response = await axiosInstance.post('/api/gradings', data, {
      params: { replace_existing: replaceExisting }
    });
    return response.data;
  },

  listAll: async (): Promise<Grading[]> => {
    const response = await axiosInstance.get('/api/gradings/all');
    return response.data;
  },

  list: async (transcriptId: string): Promise<Grading[]> => {
    const response = await axiosInstance.get(`/api/transcripts/${transcriptId}/gradings`);
    return response.data;
  },

  get: async (gradingId: string): Promise<Grading> => {
    const response = await axiosInstance.get(`/api/gradings/${gradingId}`);
    return response.data;
  },

  delete: async (gradingId: string): Promise<void> => {
    await axiosInstance.delete(`/api/gradings/${gradingId}`);
  },
};

export const classesAPI = {
  // Instructor endpoints
  create: async (data: CreateClassRequest): Promise<Classroom> => {
    const response = await axiosInstance.post('/api/classes', data);
    return response.data;
  },

  listTeaching: async (): Promise<Classroom[]> => {
    const response = await axiosInstance.get('/api/classes/teaching');
    return response.data;
  },

  getStudents: async (classId: string): Promise<Student[]> => {
    const response = await axiosInstance.get(`/api/classes/${classId}/students`);
    return response.data;
  },

  getGradings: async (classId: string): Promise<ClassGrading[]> => {
    const response = await axiosInstance.get(`/api/classes/${classId}/gradings`);
    return response.data;
  },

  deleteClass: async (classId: string): Promise<void> => {
    await axiosInstance.delete(`/api/classes/${classId}`);
  },

  // Student endpoints
  listEnrolled: async (): Promise<Classroom[]> => {
    const response = await axiosInstance.get('/api/classes/enrolled');
    return response.data;
  },

  join: async (data: JoinClassRequest): Promise<Classroom> => {
    const response = await axiosInstance.post('/api/classes/join', data);
    return response.data;
  },

  leave: async (classId: string): Promise<void> => {
    await axiosInstance.delete(`/api/classes/${classId}/enrollment`);
  },

  // Shared endpoints
  get: async (classId: string): Promise<Classroom> => {
    const response = await axiosInstance.get(`/api/classes/${classId}`);
    return response.data;
  },

  getPresentations: async (classId: string): Promise<ClassPresentation[]> => {
    const response = await axiosInstance.get(`/api/classes/${classId}/presentations`);
    return response.data;
  },
};

