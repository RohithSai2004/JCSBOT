import React, { useRef, useState, useEffect } from "react";
import { FaMicrophone, FaArrowUp, FaPlus, FaFileAlt, FaTrash } from "react-icons/fa";
import { api } from "../api/apiClient"; // Import the API client

const Searchbar = () => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState("general conversation");
  const [userId, setUserId] = useState("default_user");
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // On component mount, generate a random user ID if not set
  useEffect(() => {
    if (userId === "default_user") {
      setUserId(`user_${Math.random().toString(36).substring(2, 9)}`);
    }
    
    // You could also load previous conversation history here
    // loadUserHistory(userId);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() && uploadedFiles.length === 0) return;
    
    // Add user message
    setMessages((prev) => [...prev, { text: query, isUser: true }]);
    
    // Prepare form data for API request
    const formData = new FormData();
    formData.append("prompt", query);
    formData.append("user_id", userId);
    formData.append("task", selectedTask);
    
    // Add files to form data if present
    uploadedFiles.forEach(file => {
      if (file.rawFile) {
        formData.append("files", file.rawFile);
      }
    });
    
    setIsLoading(true);
    
    try {
      // Use the API client instead of direct axios call
      const response = await api.sendMessage(formData);
      
      // Handle response
      if (response.error) {
        setMessages((prev) => [...prev, { 
          text: `Error: ${response.error}`, 
          isUser: false 
        }]);
      } else {
        setMessages((prev) => [...prev, { 
          text: response.response, 
          isUser: false 
        }]);
      }
    } catch (error) {
      console.error("Error communicating with backend:", error);
      setMessages((prev) => [...prev, { 
        text: `Sorry, there was an error processing your request: ${error.response?.data?.error || error.message}`, 
        isUser: false 
      }]);
    } finally {
      setIsLoading(false);
      setQuery("");
      // Clear files after submission
      setUploadedFiles([]);
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => ({
      name: file.name,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      type: file.type,
      rawFile: file, // Store the actual file object for upload
    }));
    setUploadedFiles((prev) => [...prev, ...previews]);
    
    // If files are added, suggest document-related tasks
    if (files.length > 0 && selectedTask === "general conversation") {
      if (files.length === 1) {
        setSelectedTask("file Q&A");
      } else if (files.length > 1) {
        setSelectedTask("comparison");
      }
    }
  };

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Messages Display Area */}
      <div className="flex-1 overflow-y-auto p-4 pt-20">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 my-10">
              Start a conversation or upload documents to begin.
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`p-4 rounded-xl shadow-sm max-w-[80%] ${
                  msg.isUser 
                    ? 'bg-blue-100 rounded-br-none' 
                    : 'bg-gray-100 rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="p-4 rounded-xl shadow-sm bg-gray-100 rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Search Bar - centered */}
      <div className="w-full p-4 sticky bottom-5 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4 p-4 rounded-3xl border border-gray-300 shadow-xl bg-white">
            {/* Task Selection */}
            {uploadedFiles.length > 0 && (
              <div className="flex gap-2 pb-2">
                <select
                  value={selectedTask}
                  onChange={(e) => setSelectedTask(e.target.value)}
                  className="px-3 py-1 text-sm bg-gray-100 rounded-lg outline-none"
                >
                  <option value="file Q&A">File Q&A</option>
                  <option value="summarization">Summarization</option>
                  {uploadedFiles.length > 1 && (
                    <option value="comparison">Comparison</option>
                  )}
                  <option value="data analysis and forecast">Analysis & Forecast</option>
                </select>
                <span className="text-sm text-gray-500 flex items-center">
                  {selectedTask === "file Q&A" && "Ask questions about the document"}
                  {selectedTask === "summarization" && "Summarize the document"}
                  {selectedTask === "comparison" && "Compare the documents"}
                  {selectedTask === "data analysis and forecast" && "Analyze and forecast data"}
                </span>
              </div>
            )}
            
            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={uploadedFiles.length > 0 
                  ? selectedTask === "summarization" 
                    ? "Add specific instructions or just press send..." 
                    : "Ask about the document..."
                  : "Ask anything..."
                }
                className="flex-1 px-4 py-2 bg-transparent outline-none"
                disabled={isLoading}
              />
            </form>

            {/* File Previews */}
            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="border rounded-xl p-2 bg-gray-50 shadow-sm flex flex-col items-center"
                  >
                    <div className="flex justify-end w-full">
                      <button 
                        onClick={() => removeFile(index)} 
                        className="text-red-500 hover:text-red-700"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                    {file.url ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="max-h-20 object-contain rounded-md"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <FaFileAlt className="text-xl" />
                        <span className="truncate max-w-[100px]">{file.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Icons Row */}
            <div className="flex justify-between items-center">
              {/* Left: Plus Button */}
              <div>
                <button
                  type="button"
                  onClick={handleFileUploadClick}
                  className="rounded-full p-3 bg-gray-100 hover:bg-gray-200 shadow"
                  disabled={isLoading}
                >
                  <FaPlus className="w-4 h-4 text-gray-700" />
                </button>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isLoading}
                  accept=".pdf,.txt,.docx" // Only accept supported file types
                />
              </div>

              {/* Right: Mic + Send Button */}
              <div className="flex gap-2">
                <button 
                  className="rounded-full p-3 bg-gray-100 hover:bg-gray-200 shadow"
                  disabled={isLoading}
                >
                  <FaMicrophone className="w-4 h-4 text-gray-700" />
                </button>
                <button
                  onClick={handleSubmit}
                  className={`rounded-full p-3 ${
                    isLoading 
                      ? 'bg-gray-400' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white shadow`}
                  disabled={isLoading}
                >
                  <FaArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Searchbar;