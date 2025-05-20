import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/apiClient";
import apiClient from "../api/apiClient";
import ChatDisplay from "./ChatDisplay";
import SearchInput from "./SearchInput";

function generateSessionId() {
  return "session_" + Math.random().toString(36).substring(2, 15);
}

const Searchbar = () => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState("general conversation");
  const [sessionId] = useState(() => generateSessionId());
  const [activeDocuments, setActiveDocuments] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadSessionDocuments();
    // eslint-disable-next-line
  }, [sessionId]);

  const loadSessionDocuments = async () => {
    try {
      const response = await apiClient.get(`/session/${sessionId}`);
      setActiveDocuments(response.data.active_documents || []);
    } catch (error) {
      console.error("Error loading session documents:", error);
    }
  };

  const handleSubmit = async (queryToSend) => {
    if (!queryToSend.trim() && uploadedFiles.length === 0) return;
    const newMessage = { text: queryToSend, isUser: true, timestamp: new Date() };
    setMessages((prev) => [...prev, newMessage]);

    const formData = new FormData();
    formData.append("prompt", queryToSend);
    formData.append("session_id", sessionId);
    formData.append("task", selectedTask);
    uploadedFiles.forEach(file => {
      if (file.rawFile) {
        formData.append("files", file.rawFile);
      }
    });
    setIsLoading(true);
    try {
      const response = await api.sendMessage(formData);
      if (response.error) {
        setMessages((prev) => [
          ...prev,
          {
            text: `Error: ${response.error}`,
            isUser: false,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            text: response.response,
            isUser: false,
            timestamp: new Date(),
          },
        ]);
        if (uploadedFiles.length > 0) {
          loadSessionDocuments();
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: `Sorry, there was an error: ${
            error.response?.data?.error || error.message
          }`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setQuery("");
      setUploadedFiles([]);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({
      name: file.name,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      type: file.type,
      rawFile: file,
    }));
    setUploadedFiles((prev) => [...prev, ...previews]);
    if (files.length > 0 && selectedTask === "general conversation") {
      setSelectedTask(files.length === 1 ? "file Q&A" : "comparison");
    }
  };

  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearConversation = async () => {
    setMessages([]);
    setActiveDocuments([]);
    setUploadedFiles([]);
    // Optionally, you could generate a new sessionId here if you want "+ New Chat" to start a new session without reload
    // setSessionId(generateSessionId());
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#ffe9e9] via-[#fff4e6] via-35%  to-[#e8f0ff]">
      <ChatDisplay messages={messages} isLoading={isLoading} />
      <div className="flex justify-center">
  <SearchInput
    query={query}
    setQuery={setQuery}
    handleSubmit={handleSubmit}
    isLoading={isLoading}
    uploadedFiles={uploadedFiles}
    handleFileUploadClick={handleFileUploadClick}
    fileInputRef={fileInputRef}
    handleFileChange={handleFileChange}
    removeFile={removeFile}
    selectedTask={selectedTask}
    setSelectedTask={setSelectedTask}
    setUploadedFiles={setUploadedFiles}
    clearConversation={clearConversation}
    messages={messages}
  />
</div>
    </div>
  );
};

export default Searchbar;
