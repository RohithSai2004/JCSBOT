// rohithsai2004/jcsbot/JCSBOT-c968a16baaf78ba3a848fd197258c78786a45076/frontend/src/Components/Searchbar.jsx
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ChatDisplay from "./ChatDisplay";
import { api } from "../api/apiClient";
import apiClient from "../api/apiClient";
import SearchInput from "./SearchInput";
// import debounce from 'lodash/debounce'; // Not used directly in this version of Searchbar

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

  const loadSessionData = useCallback(async (sid) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`/session/${sid}`);
      if (response.data.chat_history && response.data.chat_history.length > 0) {
        const formattedMessages = response.data.chat_history.map(msg => ({
          text: msg.prompt,
          isUser: true,
          timestamp: new Date(msg.timestamp),
          files: msg.document_metadata?.original_files || [], // Assuming files were stored this way
        })).flatMap((userMsg, j) => {
          const botMsgData = response.data.chat_history[j];
          const botMsg = botMsgData ? {
            text: botMsgData.response,
            isUser: false,
            timestamp: new Date(botMsgData.timestamp),
            // Potentially add bot-specific metadata if available
          } : null;
          return botMsg ? [userMsg, botMsg] : [userMsg];
        });
        setMessages(formattedMessages);
        setActiveDocuments(response.data.active_documents || []);
        if (response.data.task) setSelectedTask(response.data.task);
      } else {
        setMessages([]);
        setActiveDocuments([]);
      }
    } catch (error) {
      console.error("Error loading session data:", error);
      setMessages([]);
      setActiveDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let newMessages = [];
    if (initialMessage) {
        newMessages.push(initialMessage);
        if (initialResponse) {
            newMessages.push(initialResponse);
        }
    }

    if (sessionId) {
      if (sessionId !== currentSessionId || (initialMessage && messages.length === 0) ) {
        setCurrentSessionId(sessionId);
        if (newMessages.length > 0) {
            setMessages(newMessages); // Set initial messages if provided
            // If loading session data, decide if these initial messages should be overwritten or appended
            loadSessionData(sessionId); // This might overwrite, adjust if needed
        } else {
            loadSessionData(sessionId);
        }

      }
    } else {
      const newSid = generateSessionId();
      setCurrentSessionId(newSid);
      setMessages(newMessages.length > 0 ? newMessages : []);
      setActiveDocuments([]);
      setUploadedFiles([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, initialMessage, initialResponse]); // currentSessionId removed to prevent loop with navigate

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleSubmit = useCallback(async (queryToSend) => {
    if (!queryToSend.trim() && uploadedFiles.length === 0) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const userMessage = {
      text: queryToSend,
      isUser: true,
      timestamp: new Date(),
      files: uploadedFiles.map(file => ({ name: file.name, type: file.type, url: file.url }))
    };

    // Add user message and bot placeholder atomically
    setMessages(prevMessages => [
        ...prevMessages,
        userMessage,
        { text: "", isUser: false, timestamp: new Date(), isStreaming: true, id: `bot-${Date.now()}` } // Added unique id for targeting
    ]);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("prompt", queryToSend);
    formData.append("session_id", currentSessionId);
    formData.append("task", selectedTask);
    uploadedFiles.forEach(file => {
      if (file.rawFile) formData.append("files", file.rawFile);
    });

    let fullBotResponseText = ""; // Accumulate full response here

    try {
      const apiResponse = await api.sendMessage(formData, { // Renamed to apiResponse to avoid conflict
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          fullBotResponseText += chunk; // Accumulate chunk
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.isStreaming && !msg.isUser // Target the streaming bot message
                ? { ...msg, text: msg.text + chunk }
                : msg
            )
          );
        }
      });
      
      // Final update to the bot message after stream ends
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.isStreaming && !msg.isUser
            ? {
                ...msg,
                text: apiResponse.error ? `Error: ${apiResponse.error}` : apiResponse.response || fullBotResponseText, // Use accumulated or final
                isStreaming: false,
              }
            : msg
        )
      );

      if (apiResponse.session_id && apiResponse.session_id !== currentSessionId) {
        setCurrentSessionId(apiResponse.session_id); // Update currentSessionId state
        if (!sessionId || apiResponse.session_id !== sessionId) { // Update URL only if it's actually different
            navigate(`/chat/${apiResponse.session_id}`, { replace: true });
        }
      }
      if (apiResponse.active_documents) {
        setActiveDocuments(apiResponse.active_documents);
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Error sending message:", error);
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.isStreaming && !msg.isUser
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
  }, [currentSessionId, navigate, selectedTask, uploadedFiles, sessionId]); // Added sessionId to deps

  const handleFileChange = useCallback((e) => { /* ... your existing logic ... */
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

  const handleFileUploadClick = useCallback(() => { /* ... your existing logic ... */
    if (fileInputRef.current) fileInputRef.current.click();
  }, []);

  const removeFile = useCallback((index) => { /* ... your existing logic ... */
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

  const clearConversation = useCallback(async () => { /* ... your existing logic ... */
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

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex-1 overflow-y-auto">
        <ChatDisplay messages={messages} isLoading={isLoading && messages.length === 0} />
      </div>
      <SearchInput {...searchInputProps} />
    </div>
  );
};

export default React.memo(Searchbar);