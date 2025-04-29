// src/components/Navbar.js
import { useNavigate } from "react-router-dom";

const Navbar = ({ isLoggedIn, username, handleLogout, toggleSidebar }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white shadow-sm px-6 py-4 border-b">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left side: Logo */}
        <div className="flex items-center space-x-2">
          <h2 className="text-2xl font-bold text-gray-800">JCS Assistant</h2>
        </div>

        {/* Right side: Buttons */}
        <div className="flex items-center space-x-4">
          {isLoggedIn ? (
            <>
              <span className="text-gray-700 font-medium">{username}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition"
              >
                Sign Up
              </button>
            </>
          )}

          {/* Mobile menu toggle button */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
