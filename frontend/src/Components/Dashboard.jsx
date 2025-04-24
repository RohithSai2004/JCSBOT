import Sidebar from "./Sidebar";
import { useState } from "react";
import Searchbar from "./Searchbar"; // Import Searchbar component

const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main content wrapper */}
      <div
        className={`h-full transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "ml-64" : "ml-0"
        }`}
      >
        {/* Navbar */}
        <div className="flex items-center justify-between bg-white shadow px-6 py-2">
          {/* Left side: space for icon and logo */}
          <div className="flex items-center space-x-4">
            <div className="text-2xl font-bold ml-7 text-gray-800">JCSBot</div>
          </div>

          {/* Right side: Auth buttons */}
          <div className="space-x-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700">
              Login
            </button>
            <button className="px-4 py-2 border border-blue-600 text-blue-600 rounded-2xl hover:bg-blue-50">
              Sign Up
            </button>
          </div>
        </div>

        {/* Replace page content with Searchbar */}
        <Searchbar /> {/* Place Searchbar component here */}
      </div>
    </div>
  );
};

export default Dashboard;
