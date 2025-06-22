// src/api/apiClient.js - API integration layer

import axios from "axios";

// Helper function to check if a string is a valid UUID
function isValidUUID(str) {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to generate a UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const API_BASE_URL = "/api";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor to include the Authorization header if a token exists
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

// Response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?sessionExpired=true';
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to process SSE stream
async function processSSEStream(reader, onChunk) {
  const decoder = new TextDecoder();
  let responseText = '';
  let sessionInfo = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      
      try {
        const data = JSON.parse(line.slice(6));
        
        if (data.chunk) {
          responseText += data.chunk;
          onChunk?.(data.chunk);
        }
        
        if (data.session_id) {
          sessionInfo = {
            session_id: data.session_id,
            active_documents: data.active_documents || []
          };
          console.log(`Received session ID from server: ${data.session_id}`);
        }
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        if (data.done) {
          return { responseText, sessionInfo };
        }
      } catch (e) {
        console.error('Error parsing SSE data:', e, line);
      }
    }
  }
  
  return { responseText, sessionInfo };
}

// API endpoints
export const api = {
  // Generate a new valid session ID
  generateSessionId: () => {
    const sessionId = generateUUID();
    console.log(`Generated new session ID: ${sessionId}`);
    return sessionId;
  },
  
  // Chat endpoint
  sendMessage: async (formData, options = {}) => {
    // Create a copy of formData to avoid mutating the original
    const formDataCopy = new FormData(formData);
    
    // Get the session ID from formData if it exists
    let sessionId = formDataCopy.get('session_id');
    
    // If no session ID in formData or it's not a valid UUID, generate a new one
    if (!sessionId || !isValidUUID(sessionId)) {
      sessionId = generateUUID();
      if (formDataCopy.has('session_id')) {
        formDataCopy.set('session_id', sessionId);
      } else {
        formDataCopy.append('session_id', sessionId);
      }
      console.log(`Generated new session ID: ${sessionId}`);
    } else {
      console.log(`Using existing session ID: ${sessionId}`);
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formDataCopy,
        signal: options.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const { responseText, sessionInfo } = await processSSEStream(
        reader, 
        options.onChunk
      );

      // Always use the server-provided session ID if available
      const finalSessionId = sessionInfo?.session_id || sessionId;
      if (sessionInfo?.session_id) {
        console.log(`Using server-provided session ID: ${sessionInfo.session_id}`);
      }

      return {
        response: responseText,
        session_id: finalSessionId,
        active_documents: sessionInfo?.active_documents || []
      };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error('Error in sendMessage:', error);
      throw new Error(error.message || 'Failed to send message');
    }
  },

  // FAQ Chat endpoint
  sendFaqMessage: async (prompt, options = {}) => {
    try {
      const response = await fetch(`${API_BASE_URL}/faq-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const { responseText } = await processSSEStream(reader, options.onChunk);
      
      return { response: responseText };
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error('Error in sendFaqMessage:', error);
      throw new Error(error.message || 'Failed to send FAQ message');
    }
  },

  // Session management
  getSession: (sessionId) => apiClient.get(`/session/${sessionId}`),
  endSession: (sessionId) => apiClient.post(`/session/${sessionId}/end`),

  // Document management
  listDocuments: () => apiClient.get('/documents'),
  // Document management
  getDocument: async (fileHash) => {
    const response = await apiClient.get(`/documents/${fileHash}`);
    return response.data;
  },
  
  deleteDocument: async (fileHash) => {
    const response = await apiClient.delete(`/documents/${fileHash}`);
    return response.data;
  },

  // User memory
  getUserMemory: async (userId, limit = 10) => {
    const response = await apiClient.get(`/memory/${userId}?limit=${limit}`);
    return response.data;
  },

  clearUserMemory: async (userId) => {
    const response = await apiClient.delete(`/memory/${userId}`);
    return response.data;
  }
};

export default apiClient;