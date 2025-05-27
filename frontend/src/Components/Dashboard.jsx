import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Searchbar from "./Searchbar";
import Navbar from "./Navbar";
import { motion } from "framer-motion";
import { FaPlus, FaPaperPlane, FaMicrophone, FaFileAlt, FaTrash } from "react-icons/fa";
import { api } from "../api/apiClient";

// Import the color styles from ChatDisplay
const colorStyles = {
  sky: {
    bg: "bg-sky-100/40",
    text: "text-sky-900",
  },
  emerald: {
    bg: "bg-emerald-100/40",
    text: "text-emerald-900",
  },
  violet: {
    bg: "bg-violet-100/40",
    text: "text-violet-900",
  },
  amber: {
    bg: "bg-amber-100/40",
    text: "text-amber-900",
  },
};

const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams(); // Get sessionId from URL params

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (token && storedUsername) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
      // If there's a sessionId, don't show the welcome screen
      if (sessionId) {
        setShowWelcome(false);
      } else {
        setShowWelcome(true); // Show welcome screen if no sessionId
      }
    } else {
      setIsLoggedIn(false);
      navigate('/login');
    }
  }, [navigate, sessionId]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setUsername('');
    navigate('/login');
  };

  const handleTaskSelection = (task) => {
    console.log("Task selected:", task);
    // Example: navigate to chat with a predefined task
    // navigate('/chat', { state: { selectedTask: task } });
    setShowWelcome(false);
    // Optionally set initial query or state based on task
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Handle welcome screen form submission if needed
    if (query.trim() || uploadedFiles.length > 0) {
      // This part might be redundant if Searchbar handles submission,
      // but kept for completeness if welcome screen form is used.
      console.log("Welcome screen submission:", query, uploadedFiles);
      // Example: navigate to chat with initial message/files
      // navigate('/chat', { state: { initialMessage: { text: query, isUser: true }, uploadedFiles: uploadedFiles, selectedFiles: uploadedFiles.map(file => ({name: file.name, type: file.type})), selectedTask: 'general conversation' } });
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map(file => ({
        name: file.name,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        type: file.type,
        rawFile: file, // Store the raw file object
    }));
    setUploadedFiles(prev => [...prev, ...previews]);
  };

  const handleFileUploadClick = () => {
      if (fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const renderFilePreviews = () => {
      return uploadedFiles.map((file, index) => (
          <div key={index} className="flex-shrink-0 border rounded-xl px-3 py-2 bg-white shadow-md flex items-center gap-2 min-w-[160px]">
              <div className="p-2 bg-gray-100 rounded-full">
                  {file.type.includes('pdf') ? <FaFileAlt className="text-red-500" /> : file.type.includes('image') ? <img src={file.url} alt="preview" className="h-5 w-5 object-cover rounded-full"/> : <FaFileAlt className="text-gray-500" />}
              </div>
              <div className="text-sm max-w-[120px] truncate">
                  {file.name}
              </div>
              <button onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition">
                  <FaTrash size={12} />
              </button>
          </div>
      ));
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#ffe9e9] via-[#fff4e6] via-35% to-[#e8f0ff]">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      {/* Main Content Area */}
      <div
        className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? "ml-64" : "ml-0"}`}
      >
        {/* Navbar */}
        <Navbar
          isLoggedIn={isLoggedIn}
          username={username}
          handleLogout={handleLogout}
          toggleSidebar={toggleSidebar} // Pass toggleSidebar to Navbar
        />

        {/* Content below Navbar (Welcome or Chat) */}
        <div className="flex-1 overflow-y-auto">
          {/* Render Searchbar and conditionally show Welcome content inside it */}
          <Searchbar 
            sessionId={sessionId} 
            initialMessage={location.state?.initialMessage}
            initialResponse={location.state?.initialResponse}
            selectedTask={location.state?.selectedTask}
            showWelcome={showWelcome && !sessionId}
          />
        </div>
          
        {/* Search input at the bottom (only for welcome screen if needed) */}
            {/* This input might be redundant if Searchbar is used for input, review needed */}
            {/*
            {showWelcome && !sessionId && (
            <div className="w-full p-4 sticky bottom-0">
              <div className="max-w-4xl mx-auto px-4 sm:-px-6 lg:-px-8">
                {uploadedFiles.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-3 mb-3">
                    {renderFilePreviews()}
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="relative">
                  <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm overflow-hidden transition-all duration-200 max-w-3xl mx-auto">
                    <button
                      type="button"
                      onClick={handleFileUploadClick}
                      className="p-3 text-gray-500 hover:text-blue-600 transition"
                      disabled={isLoading}
                    >
                      <FaPlus />
                    </button>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={uploadedFiles.length > 0 ? "Ask about the document..." : "Ask anything or upload documents..."}
                      className="flex-1 px-4 py-3 bg-transparent outline-none dark:text-white"
                      disabled={isLoading}
                    />

                    <div className="flex items-center pr-2 gap-2">
                      <button
                        type="button"
                        className="p-2 text-gray-500 hover:text-blue-600 transition"
                        disabled={isLoading}
                      >
                        <FaMicrophone />
                      </button>
                      <button
                        type="submit"
                        className={`p-2 rounded-full transition ${
                          isLoading
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <div className="animate-spin h-4 w-4 border-2 border-t-transparent border-white rounded-full"></div>
                        ) : (
                          <FaPaperPlane />
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
            )}
            */}
      </div>
    </div>
  );
};

export default Dashboard;