// src/api/apiClient.js - API integration layer

import axios from "axios";

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE_URL = "/api";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // REMOVED: Default Content-Type header. 
  // Axios will now correctly set 'application/json' for regular objects
  // and 'multipart/form-data' for FormData objects (like in your signup form) automatically.
  withCredentials: true, // Important for CORS with credentials
});

// Add a request interceptor to include the Authorization header if a token exists
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Redirect to login, but avoid doing so if we are already on the login page
      if (window.location.pathname !== '/login') {
         window.location.href = '/login?sessionExpired=true';
      }
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const api = {
  // Chat endpoint
  sendMessage: async (formData, options = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          // No Content-Type needed here, browser sets it for FormData
        },
        body: formData,
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = '';
      let sessionInfo = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.chunk) {
                responseText += data.chunk;
                if (options.onChunk) {
                  options.onChunk(data.chunk);
                }
              }
              
              if (data.done) {
                sessionInfo = {
                  session_id: data.session_id,
                  active_documents: data.active_documents
                };
              }
              
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      return {
        response: responseText,
        ...sessionInfo
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error; // Let the caller handle abort
      }
      throw new Error(error.message || 'Failed to send message');
    }
  },

  // Session management endpoints
  getSession: async (sessionId) => {
    const response = await apiClient.get(`/session/${sessionId}`);
    return response.data;
  },

  endSession: async (sessionId) => {
    const response = await apiClient.delete(`/session/${sessionId}`);
    return response.data;
  },

  // Document management endpoints
  listDocuments: async () => {
    const response = await apiClient.get("/documents");
    return response.data;
  },

  getDocument: async (fileHash) => {
    const response = await apiClient.get(`/documents/${fileHash}`);
    return response.data;
  },

  deleteDocument: async (fileHash) => {
    const response = await apiClient.delete(`/documents/${fileHash}`);
    return response.data;
  },

  // User memory endpoints
  getUserMemory: async (userId, limit = 10) => {
    const response = await apiClient.get(`/memory/${userId}?limit=${limit}`);
    return response.data;
  },

  clearUserMemory: async (userId) => {
    const response = await apiClient.delete(`/memory/${userId}`);
    return response.data;
  },
};

export default apiClient;
