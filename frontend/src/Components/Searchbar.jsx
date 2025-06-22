// frontend/src/Components/Searchbar.jsx
import { useNavigate, useParams } from "react-router-dom";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ChatDisplay from "./ChatDisplay";
import { api } from "../api/apiClient";
import SearchInput from "./SearchInput";

const Searchbar = ({ initialMessage: propInitialMessage, initialResponse: propInitialResponse, selectedTask: propInitialTask }) => {
  const navigate = useNavigate();
  const { sessionId: sessionIdFromParams } = useParams();

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(propInitialTask || "general conversation");
  const [currentSessionId, setCurrentSessionId] = useState(sessionIdFromParams || api.generateSessionId());
  const [activeDocuments, setActiveDocuments] = useState([]);
  
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Reset chat state without changing session
  const resetChatState = useCallback(() => {
    setMessages(propInitialMessage ? [propInitialMessage] : []);
    if (propInitialMessage && propInitialResponse) {
      setMessages(prev => [...prev, propInitialResponse]);
    }
    setUploadedFiles([]);
    setActiveDocuments([]);
    setQuery("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [propInitialMessage, propInitialResponse]);

  // Create a completely new chat session
  const forceNewSession = useCallback(() => {
    const newSessionId = api.generateSessionId();
    setCurrentSessionId(newSessionId);
    resetChatState();
    navigate(`/chat/${newSessionId}`, { replace: true });
  }, [navigate, resetChatState]);

  // Load session data when sessionId changes
  const loadSessionData = useCallback(async (sid) => {
    if (!sid) {
      console.log("No session ID provided, starting new chat");
      resetChatState();
      return;
    }

    console.log(`Loading session data for: ${sid}`);
    setIsLoading(true);
    setMessages([]);

    try {
      const response = await api.getSession(sid);
      console.log("Session data response:", response.data);

      if (response.data?.chat_history?.length > 0) {
        const formattedMessages = response.data.chat_history.flatMap((msg, index) => {
          const userMsg = {
            text: msg.prompt,
            isUser: true,
            timestamp: new Date(msg.timestamp),
            files: msg.document_metadata?.original_files || [],
            id: `user-${msg.timestamp}-${index}`
          };
          const botMsg = {
            text: msg.response,
            isUser: false,
            timestamp: new Date(msg.timestamp),
            id: `bot-${msg.timestamp}-${index}`
          };
          return [userMsg, botMsg];
        });
        setMessages(formattedMessages);
        setActiveDocuments(response.data.active_documents || []);
      } else {
        console.log("No chat history found, starting fresh session");
        resetChatState();
      }
    } catch (error) {
      console.error(`Error loading session ${sid}:`, error);
      // On error, start a new session
      forceNewSession();
    } finally {
      setIsLoading(false);
    }
  }, [resetChatState, forceNewSession]);

  // Handle session initialization and changes
  useEffect(() => {
    const initializeSession = async () => {
      if (sessionIdFromParams) {
        console.log(`Initializing with session from URL: ${sessionIdFromParams}`);
        setCurrentSessionId(sessionIdFromParams);
        await loadSessionData(sessionIdFromParams);
      } else {
        // If no session ID in URL, create a new one
        console.log('No session ID in URL, creating new session');
        forceNewSession();
      }
    };

    // Only run this effect when sessionIdFromParams changes
    // We use a small timeout to ensure the component is mounted
    const timer = setTimeout(initializeSession, 100);
    
    return () => clearTimeout(timer);
  }, [sessionIdFromParams]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handle chat message submission
  const handleSubmit = useCallback(async (queryToSend) => {
    if ((!queryToSend || !queryToSend.trim()) && uploadedFiles.length === 0) {
      return;
    }

    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Create user message object
    const userMessage = {
      text: queryToSend || "[File Upload]",
      isUser: true,
      timestamp: new Date(),
      files: uploadedFiles.map(file => ({
        name: file.name,
        type: file.type,
        url: file.url
      })),
      id: `user-${Date.now()}`
    };

    // Add placeholder for bot response
    const botPlaceholderId = `bot-${Date.now()}`;
    setMessages(prevMessages => [
      ...prevMessages,
      userMessage,
      { 
        text: "",
        isUser: false,
        timestamp: new Date(),
        isStreaming: true,
        id: botPlaceholderId 
      }
    ]);
    setIsLoading(true);

    // Prepare form data
    const formData = new FormData();
    formData.append("prompt", queryToSend || "");
    formData.append("session_id", currentSessionId);
    formData.append("task", selectedTask);
    
    // Add files if any
    uploadedFiles.forEach(file => {
      if (file.rawFile) {
        formData.append("files", file.rawFile);
      }
    });

    try {
      // Get the response as a stream
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to send message');
      }
      
      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let sessionIdFromBackend = currentSessionId;
      let activeDocsFromBackend = [...activeDocuments];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6)); // Remove 'data: ' prefix
                
                if (data.chunk) {
                  // Update the streaming response
                  fullResponse += data.chunk;
                  setMessages(prevMessages =>
                    prevMessages.map(msg =>
                      msg.id === botPlaceholderId
                        ? { ...msg, text: fullResponse }
                        : msg
                    )
                  );
                } else if (data.session_id) {
                  // Update session info from backend
                  sessionIdFromBackend = data.session_id;
                  activeDocsFromBackend = data.active_documents || [];
                  
                  // Update local state
                  setCurrentSessionId(sessionIdFromBackend);
                  setActiveDocuments(activeDocsFromBackend);
                  
                  // Update URL without page reload
                  const newUrl = new URL(window.location);
                  newUrl.searchParams.set('session', sessionIdFromBackend);
                  window.history.pushState({}, '', newUrl);
                  
                  console.log('Updated session ID from backend:', sessionIdFromBackend);
                } else if (data.done) {
                  // Stream complete
                  break;
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e, 'Line:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Finalize the message with the complete response
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === botPlaceholderId
            ? {
                ...msg,
                text: fullResponse,
                isStreaming: false,
                timestamp: new Date()
              }
            : msg
        )
      );

      // Update the URL with the final session ID if it changed
      if (sessionIdFromBackend !== currentSessionId) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('session', sessionIdFromBackend);
        window.history.replaceState({}, '', newUrl);
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Error sending message:", error);
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === botPlaceholderId
              ? {
                  ...msg,
                  text: `Error: ${error.message}`,
                  isStreaming: false,
                  error: true
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      setUploadedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [currentSessionId, selectedTask, uploadedFiles, activeDocuments]);

  // Handle file changes
  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const previews = files.map((file) => ({
      name: file.name,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      type: file.type,
      rawFile: file,
    }));
    
    setUploadedFiles(prev => [...prev, ...previews]);
    
    // Update task based on number of files
    if (files.length > 0) {
      if (selectedTask === "general conversation") {
        setSelectedTask(files.length === 1 ? "file Q&A" : "comparison");
      }
    }
  }, [selectedTask]);

  // Handle file upload button click
  const handleFileUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset to allow re-uploading the same file
      fileInputRef.current.click();
    }
  }, []);

  // Remove a file from the upload list
  const removeFile = useCallback((index) => {
    setUploadedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      
      // Update task if needed
      if (newFiles.length === 0 && selectedTask !== "general conversation") {
        setSelectedTask("general conversation");
      } else if (newFiles.length === 1 && selectedTask === "comparison") {
        setSelectedTask("file Q&A");
      }
      
      return newFiles;
    });
  }, [selectedTask]);

  // Clear the current conversation and start a new one
  const clearConversation = useCallback(() => {
    forceNewSession();
  }, [forceNewSession]);

  // Memoize search input props to prevent unnecessary re-renders
  const searchInputProps = useMemo(() => ({
    query,
    setQuery,
    handleSubmit,
    isLoading,
    uploadedFiles,
    handleFileUploadClick,
    fileInputRef,
    handleFileChange,
    removeFile,
    selectedTask,
    setSelectedTask,
    clearConversation,
    messages,
  }), [
    query,
    handleSubmit,
    isLoading,
    uploadedFiles,
    handleFileUploadClick,
    handleFileChange,
    removeFile,
    selectedTask,
    clearConversation,
    messages,
  ]);

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <ChatDisplay 
          messages={messages} 
          isLoading={isLoading && messages.length === 0}
          onPromptSuggestionClick={(promptText) => {
            setQuery(promptText);
          }}
          forceNewSession={forceNewSession}
        />
      </div>
      <SearchInput {...searchInputProps} />
    </div>
  );
};

export default React.memo(Searchbar);
