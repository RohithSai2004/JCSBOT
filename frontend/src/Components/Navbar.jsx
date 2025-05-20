import { useNavigate } from "react-router-dom";
import Logo from "../Assets/jaijcs.jpg";

const Navbar = ({ isLoggedIn, username, handleLogout, toggleSidebar }) => {
  const navigate = useNavigate();

  const currentHour = new Date().getHours();
  let greeting = "Hello";
  if (currentHour < 12) greeting = "Good Morning";
  else if (currentHour < 18) greeting = "Good Afternoon";
  else greeting = "Good Evening";

  return (
    <div className="bg-white shadow-sm px-4 sm:px-6 py-3 border-b w-full">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-center justify-between gap-2 md:gap-0">
        
        {/* Top Row (Mobile: flex-row, Medium+: separate sections) */}
        <div className="flex w-full items-center justify-between md:justify-start md:w-auto pl-7 md:pl-0 sm:pl-0 md:ml-10">
          {/* Left: Logo */}
          <img
  src={Logo}
  alt="JCS AI Logo"
  className="h-8 sm:h-10 md:h-16 object-contain rounded-xl"
/>

          {/* Right (Mobile only): Username & Logout */}
          {isLoggedIn && (
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-gray-700 font-medium text-xs sm:text-sm">
                {username}
              </span>
              <button
                onClick={handleLogout}
                className="px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Center: Tagline (only visible on md and up) */}
        <div className="hidden md:flex flex-grow justify-center px-2">
          <p className="text-xs sm:text-sm md:text-base text-gray-600 font-medium text-center">
            Empowering Conversations with AI — Your Smart Chatbot Companion
          </p>
        </div>

        {/* Right Side (Desktop): Greeting & Buttons */}
        <div className="hidden md:flex items-center justify-end gap-2 text-xs sm:text-sm w-full md:w-auto">
          {isLoggedIn ? (
            <>
              <span className="text-gray-700 font-medium">
                {greeting}, {username}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="px-3 sm:px-4 py-2 rounded-lg font-semibold text-gray-700 hover:bg-gray-100"
              >
                Login
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="px-3 sm:px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        {/* Mobile Sidebar Toggle */}
       
      </div>
    </div>
  );
};

export default Navbar;
