import React, { useRef, useState, useEffect } from "react";
import { FaMicrophone, FaPaperPlane, FaPlus, FaFileAlt, FaTrash, FaRobot, FaUser } from "react-icons/fa";
import { BsFileEarmarkText, BsFileEarmarkPdf, BsFileEarmarkImage } from "react-icons/bs";
import { api } from "../api/apiClient";
import apiClient from "../api/apiClient";

const Searchbar = () => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState("general conversation");
  const [userId, setUserId] = useState("default_user");
  const [activeDocuments, setActiveDocuments] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (userId === "default_user") {
      setUserId(`user_${Math.random().toString(36).substring(2, 9)}`);
    }
    // Load session documents when user ID is set
    loadSessionDocuments();
  }, [userId]);

  const loadSessionDocuments = async () => {
    try {
      const response = await apiClient.get(`/session/${userId}`);
      setActiveDocuments(response.data.active_documents || []);
    } catch (error) {
      console.error("Error loading session documents:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() && uploadedFiles.length === 0) return;
    
    // Add user message
    const newMessage = { text: query, isUser: true, timestamp: new Date() };
    setMessages((prev) => [...prev, newMessage]);
    
    const formData = new FormData();
    formData.append("prompt", query);
    formData.append("user_id", userId);
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
        setMessages((prev) => [...prev, { 
          text: `Error: ${response.error}`, 
          isUser: false,
          timestamp: new Date()
        }]);
      } else {
        setMessages((prev) => [...prev, { 
          text: response.response, 
          isUser: false,
          timestamp: new Date()
        }]);
        
        // Update active documents if new ones were processed
        if (uploadedFiles.length > 0) {
          loadSessionDocuments();
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [...prev, { 
        text: `Sorry, there was an error: ${error.response?.data?.error || error.message}`, 
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setQuery("");
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
      rawFile: file,
    }));
    setUploadedFiles((prev) => [...prev, ...previews]);
    
    if (files.length > 0 && selectedTask === "general conversation") {
      setSelectedTask(files.length === 1 ? "file Q&A" : "comparison");
    }
  };

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearConversation = async () => {
    try {
      await apiClient.delete(`/memory/${userId}`);
      setMessages([]);
      setActiveDocuments([]);
    } catch (error) {
      console.error("Error clearing conversation:", error);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes("pdf")) return <BsFileEarmarkPdf className="text-red-500" />;
    if (fileType.includes("image")) return <BsFileEarmarkImage className="text-blue-500" />;
    return <BsFileEarmarkText className="text-gray-500" />;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header with document info */}
      <div className="bg-white shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">JCS Document Assistant</h2>
          {activeDocuments.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Active documents:</span>
              <div className="flex space-x-1">
                {activeDocuments.slice(0, 3).map((doc, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {doc.filename}
                  </span>
                ))}
                {activeDocuments.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                    +{activeDocuments.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Display Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center mt-20">
              <div className="inline-block p-6 bg-white rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-xl font-medium text-gray-800 mb-2">Welcome to JCS Document Assistant</h3>
                <p className="text-gray-600 mb-4">Upload documents or ask questions to get started</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-blue-800">
                    <p className="font-medium">Summarize documents</p>
                    <p className="text-sm">Upload and ask for summaries</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-green-800">
                    <p className="font-medium">Ask questions</p>
                    <p className="text-sm">Get answers from your documents</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-purple-800">
                    <p className="font-medium">Compare files</p>
                    <p className="text-sm">Upload multiple to compare</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg text-yellow-800">
                    <p className="font-medium">General knowledge</p>
                    <p className="text-sm">Ask anything else</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`flex max-w-[85%] ${msg.isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}
                >
                  <div className={`rounded-full p-2 ${msg.isUser ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                    {msg.isUser ? <FaUser size={14} /> : <FaRobot size={14} />}
                  </div>
                  <div 
                    className={`p-4 rounded-xl ${msg.isUser ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white border border-gray-200 rounded-bl-none shadow-sm'}`}
                  >
                    {msg.text}
                    <div className={`text-xs mt-2 ${msg.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <div className="rounded-full p-2 bg-gray-100 text-gray-600">
                  <FaRobot size={14} />
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl rounded-bl-none shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="w-full p-4 sticky bottom-0 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          {/* Task Selection */}
          {uploadedFiles.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="px-4 py-2 text-sm bg-gray-100 rounded-lg outline-none border border-gray-300"
              >
                <option value="file Q&A">Ask about document</option>
                <option value="summarization">Summarize document</option>
                {uploadedFiles.length > 1 && (
                  <option value="comparison">Compare documents</option>
                )}
                <option value="data analysis and forecast">Analyze data</option>
              </select>
              <button 
                onClick={() => setUploadedFiles([])}
                className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <FaTrash size={12} /> Clear files
              </button>
            </div>
          )}

          {/* File Previews */}
          {uploadedFiles.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-3">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 border rounded-lg p-2 bg-gray-50 shadow-sm flex items-center gap-2"
                >
                  <div className="text-lg">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="text-sm max-w-[120px] truncate">
                    {file.name}
                  </div>
                  <button 
                    onClick={() => removeFile(index)} 
                    className="text-gray-400 hover:text-red-500 ml-1"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center bg-white border border-gray-300 rounded-full shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={handleFileUploadClick}
                className="p-3 text-gray-500 hover:text-blue-600"
                disabled={isLoading}
              >
                <FaPlus />
              </button>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading}
                accept=".pdf,.txt,.docx,.jpg,.jpeg,.png"
              />
              
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  uploadedFiles.length > 0 
                    ? selectedTask === "summarization" 
                      ? "Add specific instructions for summarization..." 
                      : "Ask about the document..."
                    : "Ask anything or upload documents..."
                }
                className="flex-1 px-4 py-3 bg-transparent outline-none"
                disabled={isLoading}
              />
              
              <div className="flex items-center pr-2">
                <button
                  type="button"
                  className="p-2 text-gray-500 hover:text-blue-600"
                  disabled={isLoading}
                >
                  <FaMicrophone />
                </button>
                <button
                  type="submit"
                  className={`p-2 rounded-full ${
                    isLoading 
                      ? 'bg-gray-300 text-gray-500' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={isLoading}
                >
                  <FaPaperPlane />
                </button>
              </div>
            </div>
          </form>

          {/* Clear conversation button */}
          {messages.length > 0 && (
            <div className="flex justify-center mt-3">
              <button
                onClick={clearConversation}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <FaTrash size={12} /> Clear conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Searchbar;