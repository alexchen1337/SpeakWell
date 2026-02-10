import axios from 'axios';
import { API_URL } from '@/config';

const API_BASE_URL = API_URL;

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  organization?: string;
  group?: string;
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let currentUserCache: { data: User; timestamp: number } | null = null;
let currentUserPromise: Promise<User> | null = null;
let isRefreshing = false;
const CACHE_DURATION = 5000;

export const authService = {
  getCurrentUser: async (): Promise<User> => {
    const now = Date.now();
    
    if (currentUserCache && (now - currentUserCache.timestamp) < CACHE_DURATION) {
      return currentUserCache.data;
    }

    if (currentUserPromise) {
      return currentUserPromise;
    }

    currentUserPromise = (async () => {
      try {
        const response = await axiosInstance.get('/auth/me');
        currentUserCache = {
          data: response.data,
          timestamp: Date.now()
        };
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401 && !isRefreshing) {
          isRefreshing = true;
          try {
            await authService.refreshToken();
            isRefreshing = false;
            const response = await axiosInstance.get('/auth/me');
            currentUserCache = {
              data: response.data,
              timestamp: Date.now()
            };
            return response.data;
          } catch {
            isRefreshing = false;
            throw error;
          }
        }
        throw error;
      } finally {
        currentUserPromise = null;
      }
    })();

    return currentUserPromise;
  },

  refreshToken: async (): Promise<void> => {
    currentUserCache = null;
    await axiosInstance.post('/auth/refresh');
  },

  logout: async (): Promise<void> => {
    currentUserCache = null;
    await axiosInstance.post('/auth/logout');
  },

  updateName: async (name: string): Promise<{ message: string; name: string }> => {
    currentUserCache = null;
    const response = await axiosInstance.patch('/auth/me/name', { name });
    return response.data;
  },

  updateRole: async (role: 'student' | 'instructor'): Promise<{ message: string; role: string }> => {
    currentUserCache = null;
    const response = await axiosInstance.patch('/auth/me/role', { role });
    return response.data;
  },

  login: async (email: string, password: string): Promise<void> => {
    currentUserCache = null;
    await axiosInstance.post('/auth/login', { email, password });
  },

  signup: async (email: string, password: string, name?: string): Promise<void> => {
    currentUserCache = null;
    await axiosInstance.post('/auth/signup', { email, password, name });
  },

  clearCache: () => {
    currentUserCache = null;
  }
};

export const authAPI = authService;

