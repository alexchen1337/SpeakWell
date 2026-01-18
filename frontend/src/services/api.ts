import axios from 'axios';
import { AudioFile, TranscriptResponse } from '@/types/audio';
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

  getAllAudio: async (): Promise<AudioFile[]> => {
    const response = await axiosInstance.get('/api/audio');
    return response.data;
  },

  getAudio: async (id: string): Promise<AudioFile> => {
    const response = await axiosInstance.get(`/api/audio/${id}`);
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

