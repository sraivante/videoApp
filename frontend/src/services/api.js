import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  signin: (email, password) => api.post('/auth/signin', { email, password }),
  signup: (email, password, name) => api.post('/auth/signup', { email, password, name }),
};

export const videoAPI = {
  getMyVideos: () => api.get('/videos/my'),
  getSuggestions: () => api.get('/videos/suggestions'),
  upload: (formData, onProgress) =>
    api.post('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }),
  downloadYoutube: (url) => api.post('/videos/download-youtube', { url }),
  deleteVideo: (id) => api.delete(`/videos/${id}`),
  streamUrl: (fileName) => `${API_BASE}/videos/stream/${fileName}`,
  thumbnailUrl: (thumbnailName) => `${API_BASE}/videos/thumbnail/${thumbnailName}`,
};

export default api;
