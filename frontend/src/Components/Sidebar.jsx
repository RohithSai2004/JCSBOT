import { FaHome, FaFileAlt, FaHistory, FaCog, FaSignOutAlt, FaLightbulb } from "react-icons/fa";
import { BsChatSquareText } from "react-icons/bs";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <>
      {/* Sidebar Toggle Button */}
      <button
        onClick={toggleSidebar}
        className={`fixed top-4 left-4 z-50 p-2 rounded-full bg-white shadow-md ${
          isOpen ? 'left-64' : 'left-4'
        } transition-all duration-300`}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-blue-800 to-blue-600 text-white p-4 z-40 transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center p-4 mb-8">
            <div className="flex items-center">
              <BsChatSquareText className="h-6 w-6 mr-2" />
              <h1 className="text-xl font-bold">JCS Assistant</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1">
            <ul className="space-y-2">
              <li>
                <a href="#" className="flex items-center p-3 rounded-lg bg-blue-700">
                  <FaHome className="mr-3" />
                  <span>Home</span>
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center p-3 rounded-lg hover:bg-blue-700">
                  <FaFileAlt className="mr-3" />
                  <span>Documents</span>
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center p-3 rounded-lg hover:bg-blue-700">
                  <FaHistory className="mr-3" />
                  <span>History</span>
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center p-3 rounded-lg hover:bg-blue-700">
                  <FaLightbulb className="mr-3" />
                  <span>Insights</span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Bottom section */}
          <div className="mt-auto">
            <ul className="space-y-2">
              <li>
                <a href="#" className="flex items-center p-3 rounded-lg hover:bg-blue-700">
                  <FaCog className="mr-3" />
                  <span>Settings</span>
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center p-3 rounded-lg hover:bg-blue-700">
                  <FaSignOutAlt className="mr-3" />
                  <span>Logout</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;