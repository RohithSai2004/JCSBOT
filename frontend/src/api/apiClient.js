// src/api/apiClient.js - API integration layer

import axios from "axios";

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE_URL = "/api";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
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
      window.location.href = '/login';
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
        throw error;
      }
      throw new Error(error.message || 'Failed to send message');
    }
  },

  // Session management endpoints
  getSession: async (sessionId) => {
    try {
      const response = await apiClient.get(`/session/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error("Session Error:", error.response?.data || error.message);
      throw error;
    }
  },

  endSession: async (sessionId) => {
    try {
      const response = await apiClient.delete(`/session/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error("Session Error:", error.response?.data || error.message);
      throw error;
    }
  },

  // Add this new method
  getSessions: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Sessions Error:", error.message);
      throw error;
    }
  },

  // Document management endpoints
  listDocuments: async () => {
    try {
      const response = await apiClient.get("/documents");
      return response.data;
    } catch (error) {
      console.error("Document Error:", error.response?.data || error.message);
      throw error;
    }
  },

  getDocument: async (fileHash) => {
    try {
      const response = await apiClient.get(`/documents/${fileHash}`);
      return response.data;
    } catch (error) {
      console.error("Document Error:", error.response?.data || error.message);
      throw error;
    }
  },

  deleteDocument: async (fileHash) => {
    try {
      const response = await apiClient.delete(`/documents/${fileHash}`);
      return response.data;
    } catch (error) {
      console.error("Document Error:", error.response?.data || error.message);
      throw error;
    }
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