import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ChatDisplay from "./ChatDisplay";
import { api } from "../api/apiClient";
import apiClient from "../api/apiClient";
import SearchInput from "./SearchInput";
import debounce from 'lodash/debounce';

// Function to generate a random session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const Searchbar = ({ sessionId, initialMessage, initialResponse, selectedTask: initialTask }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(initialTask || "general conversation");
  const [currentSessionId, setCurrentSessionId] = useState(sessionId || generateSessionId());
  const [activeDocuments, setActiveDocuments] = useState([]);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Memoize the loadSessionData function
  const loadSessionData = useCallback(async (sid) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/session/${sid}`);
      
      if (response.data.chat_history && response.data.chat_history.length > 0) {
        // Process messages in chunks to avoid UI blocking
        const chunkSize = 50;
        const formattedMessages = [];
        
        for (let i = 0; i < response.data.chat_history.length; i += chunkSize) {
          const chunk = response.data.chat_history.slice(i, i + chunkSize);
          const chunkMessages = chunk.map(msg => ({
            text: msg.prompt,
            isUser: true,
            timestamp: new Date(msg.timestamp)
          })).flatMap((userMsg, j) => {
            const botMsg = chunk[j] ? {
              text: chunk[j].response,
              isUser: false,
              timestamp: new Date(chunk[j].timestamp)
            } : null;
            return botMsg ? [userMsg, botMsg] : [userMsg];
          });
          
          formattedMessages.push(...chunkMessages);
          
          // Update state in chunks to keep UI responsive
          if (i === 0) {
            setMessages(chunkMessages);
          } else {
            setMessages(prev => [...prev, ...chunkMessages]);
          }
          
          // Allow UI to update between chunks
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        setActiveDocuments(response.data.active_documents || []);
        
        // If task type is available in the response, set it
        if (response.data.task) {
          setSelectedTask(response.data.task);
        }
      }
    } catch (error) {
      console.error("Error loading session data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced query update
  const debouncedSetQuery = useMemo(
    () => debounce((value) => setQuery(value), 100),
    []
  );

  useEffect(() => {
    // Handle initial messages if provided
    if (initialMessage && initialResponse) {
      setMessages([initialMessage, initialResponse]);
    }
    
    if (sessionId) {
      setCurrentSessionId(sessionId);
      loadSessionData(sessionId);
    } else {
      setCurrentSessionId(generateSessionId());
      // Only reset messages if we don't have initial messages
      if (!initialMessage && !initialResponse) {
        setMessages([]);
      }
      setActiveDocuments([]);
      setUploadedFiles([]);
    }
  }, [sessionId, loadSessionData, initialMessage, initialResponse]);

  // Cleanup function for abort controller
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = useCallback(async (queryToSend) => {
    if (!queryToSend.trim() && uploadedFiles.length === 0) return;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Create message with file information
    const newMessage = { 
      text: queryToSend,
      isUser: true, 
      timestamp: new Date(),
      files: uploadedFiles.map(file => ({
        name: file.name,
        type: file.type,
        url: file.url
      }))
    };
    
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("prompt", queryToSend);
    formData.append("session_id", currentSessionId);
    formData.append("task", selectedTask);
    
    uploadedFiles.forEach(file => {
      if (file.rawFile) {
        formData.append("files", file.rawFile);
      }
    });

    try {
      // Add a placeholder message for the response
      const responseMessage = {
        text: "",
        isUser: false,
        timestamp: new Date(),
        isStreaming: true
      };
      setMessages(prev => [...prev, responseMessage]);

      const response = await api.sendMessage(formData, {
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          // Update the last message with the new chunk
          console.log('Received chunk:', chunk);
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && !lastMessage.isUser) {
              lastMessage.text += chunk;
              console.log('Updated last message with chunk:', lastMessage.text);
            }
            return newMessages;
          });
        }
      });
      
      console.log('sendMessage completed. Response:', response);
      if (response.error) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && !lastMessage.isUser) {
            lastMessage.text = `Error: ${response.error}`;
            lastMessage.isStreaming = false;
          }
          return newMessages;
        });
      } else {
        // Update the final message
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && !lastMessage.isUser) {
            lastMessage.text = response.response;
            lastMessage.isStreaming = false;
          }
          return newMessages;
        });
        
        if (currentSessionId && !window.location.pathname.includes(currentSessionId)) {
          navigate(`/chat/${currentSessionId}`, { replace: true });
        }
        
        if (uploadedFiles.length > 0 || response.active_documents) {
          setActiveDocuments(response.active_documents || []);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      console.error("Error:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && !lastMessage.isUser) {
          lastMessage.text = `Sorry, there was an error: ${error.response?.data?.error || error.message}`;
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      setQuery("");  // Clear the query after submission
      setUploadedFiles([]);  // Clear uploaded files after sending
      abortControllerRef.current = null;
    }
  }, [currentSessionId, navigate, selectedTask, uploadedFiles]);

  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({
      name: file.name,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      type: file.type,
      rawFile: file,
    }));
    setUploadedFiles(prev => [...prev, ...previews]);
    if (files.length > 0 && selectedTask === "general conversation") {
      setSelectedTask(files.length === 1 ? "file Q&A" : "comparison");
    }
  }, [selectedTask]);

  const handleFileUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const removeFile = useCallback((index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearConversation = useCallback(async () => {
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setActiveDocuments([]);
    setUploadedFiles([]);
    
    // Update URL to remove session ID
    navigate('/', { replace: true });
  }, [navigate]);

  // Memoize the SearchInput props
  const searchInputProps = useMemo(() => ({
    query,
    setQuery: debouncedSetQuery,
    handleSubmit,
    isLoading,
    uploadedFiles,
    handleFileUploadClick,
    fileInputRef,
    handleFileChange,
    removeFile,
    selectedTask,
    setSelectedTask,
    setUploadedFiles,
    clearConversation,
    messages,
  }), [
    query,
    debouncedSetQuery,
    handleSubmit,
    isLoading,
    uploadedFiles,
    handleFileUploadClick,
    fileInputRef,
    handleFileChange,
    removeFile,
    selectedTask,
    setSelectedTask,
    setUploadedFiles,
    clearConversation,
    messages,
  ]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#ffe9e9] via-[#fff4e6] via-35% to-[#e8f0ff]">
      {/* This div will have the white background for the chat area */}
      {/* Adjusted height and content alignment to prevent excessive white space */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 flex flex-col">
        <ChatDisplay messages={messages} isLoading={isLoading} />
        <div ref={messagesEndRef} />
      </div>
      <div className="flex justify-center">
        <SearchInput {...searchInputProps} />
      </div>
    </div>
  );
};

export default React.memo(Searchbar);