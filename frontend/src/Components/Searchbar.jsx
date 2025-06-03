// frontend/src/Components/Searchbar.jsx
import { useNavigate, useParams } from "react-router-dom"; // useParams to get sessionId
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ChatDisplay from "./ChatDisplay";
import { api } from "../api/apiClient"; // For streaming sendMessage
import apiClient from "../api/apiClient"; // For other axios requests
import SearchInput from "./SearchInput";

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const Searchbar = ({ initialMessage: propInitialMessage, initialResponse: propInitialResponse, selectedTask: propInitialTask }) => {
  const navigate = useNavigate();
  const { sessionId: sessionIdFromParams } = useParams(); // Get sessionId from URL

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(propInitialTask || "general conversation");
  
  // Initialize currentSessionId: prioritize URL, then generate new
  const [currentSessionId, setCurrentSessionId] = useState(sessionIdFromParams || generateSessionId());
  
  const [activeDocuments, setActiveDocuments] = useState([]);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const loadSessionData = useCallback(async (sid) => {
    if (!sid) {
      console.log("Searchbar: No session ID provided to loadSessionData. Resetting for new chat.");
      setMessages(propInitialMessage ? [propInitialMessage] : []);
      if (propInitialMessage && propInitialResponse) {
          setMessages(prev => [...prev, propInitialResponse]);
      }
      setActiveDocuments([]);
      setIsLoading(false);
      return;
    }

    console.log(`Searchbar: Attempting to load session data for SID: ${sid}`);
    setIsLoading(true);
    setMessages([]); // Clear previous messages before loading new session
    try {
      const response = await apiClient.get(`/session/${sid}`);
      console.log("Searchbar: API response for session data:", response.data);

      if (response.data && response.data.chat_history && response.data.chat_history.length > 0) {
        const formattedMessages = response.data.chat_history.flatMap((msg, index) => {
          const userMsg = {
            text: msg.prompt,
            isUser: true,
            timestamp: new Date(msg.timestamp),
            files: msg.document_metadata?.original_files || msg.files || [],
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
        console.log("Searchbar: Formatted messages for display:", formattedMessages);
        setMessages(formattedMessages);
        setActiveDocuments(response.data.active_documents || []);
        // Potentially set selectedTask based on last message or session metadata if available
        // For now, let's not override selectedTask here to keep it simple.
      } else {
        console.log("Searchbar: No chat history found or empty response for SID:", sid);
        // If history is empty, it's like a new chat in that session, so keep messages empty.
      }
    } catch (error) {
      console.error(`Searchbar: Error loading session data for SID ${sid}:`, error);
      // Optionally, display an error message in the chat UI
      setMessages([{
        text: `Error: Could not load session ${sid}. Please start a new chat or try again.`,
        isUser: false,
        timestamp: new Date(),
        id: `error-${Date.now()}`
      }]);
      setActiveDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [propInitialMessage, propInitialResponse]); // Dependencies for loadSessionData

  useEffect(() => {
    // This effect handles changes in sessionIdFromParams (from URL)
    console.log(`Searchbar: useEffect for sessionIdFromParams. URL SID: ${sessionIdFromParams}, Current SID: ${currentSessionId}`);
    
    if (sessionIdFromParams) {
      // If URL has a session ID, and it's different from current, or if messages are empty (e.g. direct nav)
      if (sessionIdFromParams !== currentSessionId || (messages.length === 0 && !isLoading) ) {
        console.log(`Searchbar: Loading data for session from URL: ${sessionIdFromParams}`);
        setCurrentSessionId(sessionIdFromParams);
        loadSessionData(sessionIdFromParams);
      }
    } else {
      // No sessionId in URL - this means it's a new chat (e.g. navigated to '/')
      console.log("Searchbar: No session ID in URL. Setting up for a new chat.");
      const newSid = generateSessionId();
      setCurrentSessionId(newSid);
      setMessages(propInitialMessage ? [propInitialMessage] : []);
       if (propInitialMessage && propInitialResponse) {
          setMessages(prev => [...prev, propInitialResponse]);
      }
      setActiveDocuments([]);
      setUploadedFiles([]); // Clear files for a truly new chat
      setSelectedTask(propInitialTask || "general conversation");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromParams, loadSessionData]); // Only re-run if sessionIdFromParams or loadSessionData changes

  useEffect(() => {
    // Cleanup for abort controller
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = useCallback(async (queryToSend) => {
    if (!queryToSend.trim() && uploadedFiles.length === 0) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage = {
      text: queryToSend,
      isUser: true,
      timestamp: new Date(),
      files: uploadedFiles.map(file => ({ name: file.name, type: file.type, url: file.url })),
      id: `user-${Date.now()}`
    };

    const botPlaceholderId = `bot-${Date.now()}`;
    setMessages(prevMessages => [
        ...prevMessages,
        userMessage,
        { text: "", isUser: false, timestamp: new Date(), isStreaming: true, id: botPlaceholderId }
    ]);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("prompt", queryToSend);
    // Ensure currentSessionId is up-to-date before sending
    const sessionToSend = sessionIdFromParams || currentSessionId;
    formData.append("session_id", sessionToSend);
    formData.append("task", selectedTask);
    uploadedFiles.forEach(file => {
      if (file.rawFile) formData.append("files", file.rawFile);
    });

    let accumulatedResponse = "";

    try {
      const apiResponse = await api.sendMessage(formData, {
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          accumulatedResponse += chunk;
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === botPlaceholderId
                ? { ...msg, text: accumulatedResponse } // Update existing placeholder
                : msg
            )
          );
        }
      });
      
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === botPlaceholderId
            ? {
                ...msg,
                text: apiResponse.error ? `Error: ${apiResponse.error}` : apiResponse.response || accumulatedResponse,
                isStreaming: false,
              }
            : msg
        )
      );

      // Handle session ID update and navigation
      if (apiResponse.session_id) {
        if (apiResponse.session_id !== sessionToSend) { // If backend assigned a new SID or confirmed the one we sent
            setCurrentSessionId(apiResponse.session_id);
            if (!sessionIdFromParams || apiResponse.session_id !== sessionIdFromParams) {
                navigate(`/chat/${apiResponse.session_id}`, { replace: true });
            }
        }
      }
      if (apiResponse.active_documents) {
        setActiveDocuments(apiResponse.active_documents);
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Searchbar: Error sending message:", error);
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === botPlaceholderId
              ? {
                  ...msg,
                  text: `Sorry, an error occurred: ${error.message || "Failed to get response."}`,
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
      setUploadedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      abortControllerRef.current = null;
    }
  }, [currentSessionId, navigate, selectedTask, uploadedFiles, sessionIdFromParams]);

  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({
      name: file.name,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      type: file.type, rawFile: file,
    }));
    setUploadedFiles(prev => [...prev, ...previews]);
    if (files.length > 0 && selectedTask === "general conversation") {
      setSelectedTask(files.length === 1 ? "file Q&A" : "comparison");
    }
  }, [selectedTask]);

  const handleFileUploadClick = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  const removeFile = useCallback((index) => {
    setUploadedFiles(prev => {
        const newFiles = prev.filter((_, i) => i !== index);
        if (newFiles.length === 0 && selectedTask !== "general conversation") {
            setSelectedTask("general conversation");
        } else if (newFiles.length === 1 && selectedTask === "comparison") {
            setSelectedTask("file Q&A");
        }
        return newFiles;
    });
  }, [selectedTask]);

  const clearConversation = useCallback(async () => {
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setActiveDocuments([]);
    setUploadedFiles([]);
    setQuery(""); 
    setSelectedTask("general conversation");
    if (fileInputRef.current) fileInputRef.current.value = '';
    navigate('/', { replace: true });
  }, [navigate]);

  const searchInputProps = useMemo(() => ({
    query, setQuery,
    handleSubmit, isLoading, uploadedFiles,
    handleFileUploadClick, fileInputRef, handleFileChange, removeFile,
    selectedTask, setSelectedTask, setUploadedFiles,
    clearConversation, messages,
  }), [
    query, setQuery,
    handleSubmit, isLoading, uploadedFiles,
    handleFileUploadClick, fileInputRef, handleFileChange, removeFile,
    selectedTask, setSelectedTask, setUploadedFiles,
    clearConversation, messages,
  ]);

  // Pass activeDocuments and documentNames to Navbar if needed
  // For ChatDisplay, we pass messages and the loading state for the welcome screen
  return (
    <div className="flex flex-col h-full bg-transparent"> {/* Page gradient from index.css html tag */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <ChatDisplay 
            messages={messages} 
            isLoading={isLoading && messages.length === 0} // Only show main loading for empty welcome
            onPromptSuggestionClick={(promptText) => {
                setQuery(promptText);
                // Optionally auto-submit: handleSubmit(promptText);
            }}
        />
      </div>
      <SearchInput {...searchInputProps} />
    </div>
  );
};

export default React.memo(Searchbar);
