// src/api/apiClient.js - API integration layer

import axios from "axios";

// Base API URL - configure based on your environment
const API_BASE_URL = "http://localhost:8000";

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

// API endpoints
export const api = {
  // Chat endpoint
  sendMessage: async (formData) => {
    try {
      const response = await apiClient.post("/chat", formData, {
        headers: {
          "Content-Type": "multipart/form-data", // Override for multipart uploads
        },
      });
      return response.data;
    } catch (error) {
      console.error("API Error:", error.response?.data || error.message);
      throw error;
    }
  },

  // Document management endpoints
  listDocuments: async () => {
    const response = await apiClient.get("/api/core/documents");
    return response.data;
  },

  getDocument: async (fileHash) => {
    const response = await apiClient.get(`/api/core/document/${fileHash}`);
    return response.data;
  },

  deleteDocument: async (fileHash) => {
    const response = await apiClient.delete(`/api/core/document/${fileHash}`);
    return response.data;
  },

  // User memory endpoints
  getUserMemory: async (userId, limit = 10) => {
    const response = await apiClient.get(`/api/core/memory/${userId}?limit=${limit}`);
    return response.data;
  },

  clearUserMemory: async (userId) => {
    const response = await apiClient.delete(`/api/core/memory/${userId}`);
    return response.data;
  },
};

export default apiClient;