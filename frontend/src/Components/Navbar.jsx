import Logo from "../Assets/jaijcs.jpg";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FileText, X } from "lucide-react";

const Navbar = ({ isLoggedIn, username, handleLogout, toggleSidebar, activeDocuments = [], documentNames = {} }) => {
  const navigate = useNavigate();
  const [showDocuments, setShowDocuments] = useState(false);
  
  // Get time of day for greeting
  const currentHour = new Date().getHours();
  let greeting = "Good Morning";
  if (currentHour >= 12 && currentHour < 18) greeting = "Good Afternoon";
  else if (currentHour >= 18) greeting = "Good Evening";

  // Count active documents
  const documentCount = activeDocuments?.length || 0;

  return (
    <div className="bg-transparent py-4 px-6 flex items-center justify-between">
      {/* Left side - Logo and hamburger */}
      <div className="flex items-center">
        {/* Hamburger menu button */}
        <button 
          onClick={toggleSidebar}
          className="text-gray-700 mr-4 hover:bg-gray-200 p-2 rounded-md"
          aria-label="Toggle sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        {/* Logo */}
        <div 
          className="flex items-center cursor-pointer" 
          onClick={() => navigate('/')}
        >
          <div className="bg-white p-1 rounded-lg shadow-md">
            <img
              src={Logo || "https://via.placeholder.com/40"}
              alt="JCS AI Logo"
              className="h-10 w-10 object-contain rounded-md"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://via.placeholder.com/40";
              }}
            />
          </div>
          <span className="ml-2 text-xl font-bold text-gray-800">JAI</span>
        </div>
      </div>

      {/* Center - Tagline */}
      <div className="hidden md:block text-center text-gray-700 font-medium">
        Empowering Conversations with AI — Your Smart Chatbot Companion
      </div>

      {/* Right side - User info, documents, and auth buttons */}
      <div className="flex items-center">
        {isLoggedIn ? (
          <div className="flex items-center">
            {/* Document indicator */}
            {documentCount > 0 && (
              <button
                onClick={() => setShowDocuments(!showDocuments)}
                className="relative flex items-center mr-4 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md transition-colors"
              >
                <FileText size={18} className="mr-1.5" />
                <span className="font-medium">{documentCount} Document{documentCount !== 1 ? 's' : ''}</span>
                {showDocuments ? (
                  <X size={16} className="ml-1.5 text-blue-500" />
                ) : (
                  <span className="ml-1.5 text-xs">▼</span>
                )}
              </button>
            )}
            
            {/* Document dropdown */}
            {showDocuments && documentCount > 0 && (
              <div className="absolute top-16 right-32 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 w-72">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Documents</h3>
                <div className="max-h-60 overflow-y-auto">
                  {activeDocuments.map((docHash) => (
                    <div key={docHash} className="flex items-center py-2 border-b border-gray-100 last:border-0">
                      <FileText size={16} className="text-blue-600 mr-2 flex-shrink-0" />
                      <span className="text-sm text-gray-800 truncate">
                        {documentNames[docHash] || `Document ${docHash.substring(0, 8)}...`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* User greeting */}
            <div className="mr-4 text-indigo-700 font-medium">
              {greeting}, <span className="font-bold">{username}</span>
            </div>
            
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-2 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/login")}
              className="text-indigo-600 font-medium px-4 py-2 hover:bg-indigo-50 rounded-md transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-md transition-colors"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
      
      {/* Click outside handler for document dropdown */}
      {showDocuments && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDocuments(false)}
        ></div>
      )}
    </div>
  );
};

export default Navbar;