import { BsChatSquareText } from "react-icons/bs";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaHome, FaFileAlt, FaHistory, FaCog, FaSignOutAlt } from "react-icons/fa";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  // Function to check if a path is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-white shadow-lg z-40 transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center p-6 border-b">
            <div className="flex items-center">
              <BsChatSquareText className="h-6 w-6 mr-2 text-indigo-600" />
              <h1 className="text-xl font-bold text-gray-800">JCS Assistant</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/" 
                  className={`flex items-center p-3 rounded-lg ${
                    isActive('/') 
                      ? 'bg-indigo-100 text-indigo-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FaHome className="mr-3" />
                  <span>Home</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/documents" 
                  className={`flex items-center p-3 rounded-lg ${
                    isActive('/documents') 
                      ? 'bg-indigo-100 text-indigo-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FaFileAlt className="mr-3" />
                  <span>Documents</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/sessions" 
                  className={`flex items-center p-3 rounded-lg ${
                    isActive('/sessions') 
                      ? 'bg-indigo-100 text-indigo-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FaHistory className="mr-3" />
                  <span>Chat History</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Bottom section */}
          <div className="p-4 border-t">
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/settings" 
                  className={`flex items-center p-3 rounded-lg ${
                    isActive('/settings') 
                      ? 'bg-indigo-100 text-indigo-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FaCog className="mr-3" />
                  <span>Settings</span>
                </Link>
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center p-3 rounded-lg text-red-600 hover:bg-red-50"
                >
                  <FaSignOutAlt className="mr-3" />
                  <span>Logout</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Overlay to close sidebar on mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
};

export default Sidebar;