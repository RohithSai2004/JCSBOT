// rohithsai2004/jcsbot/JCSBOT-c968a16baaf78ba3a848fd197258c78786a45076/frontend/src/Components/Dashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar"
import Searchbar from "./Searchbar";
import Navbar from "./Navbar";
// Removed motion and other unused imports for this specific file

const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (token && storedUsername) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
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

  return (
    // Main container now uses flex and the body's dark background
    <div className="flex h-screen bg-base-100 text-content">
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      <div
        className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "md:ml-64" : "ml-0" // Ensure sidebar overlay works on mobile
        }`}
      >
        <Navbar
          isLoggedIn={isLoggedIn}
          username={username}
          handleLogout={handleLogout}
          toggleSidebar={toggleSidebar}
          // activeDocuments and documentNames would be passed from a state management solution
        />

        {/* Content area for the Searchbar/Chat */}
        <main className="flex-1 overflow-hidden"> {/* Changed to overflow-hidden as Searchbar will scroll */}
          <Searchbar // Searchbar itself will handle its internal scrolling
            sessionId={sessionId}
            initialMessage={location.state?.initialMessage}
            initialResponse={location.state?.initialResponse}
            selectedTask={location.state?.selectedTask}
          />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;