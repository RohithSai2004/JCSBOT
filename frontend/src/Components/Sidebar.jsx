import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BsChatSquareText } from "react-icons/bs";
import { Home, FileText, History, Settings, LogOut, X, Users, BarChart2, BookOpen, Menu } from "lucide-react";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Check localStorage to see if the current user is an admin
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  const handleLogout = () => {
    localStorage.clear(); // Clears all user data for a clean logout
    navigate('/'); // Navigate to landing page after logout
  };

  // Helper function to determine if a navigation link is active
  const isActive = (path) => {
    // Make the 'Home' link active for the dashboard path
    if (path === '/dashboard') return location.pathname === '/dashboard';
    // For other links, check if the current path starts with the link's path
    return location.pathname.startsWith(path);
  };

  // Navigation items available to all authenticated users
  const navItems = [
    { path: '/dashboard', label: 'Home', icon: Home },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/sessions', label: 'Chat History', icon: History },
    { path: '/company-faq', label: 'Company FAQ', icon: BookOpen },
  ];

  // Navigation items that are ONLY visible to admins
  const adminNavItems = [
    { path: '/admin/users', label: 'User Management', icon: Users },
    { path: '/admin/usage', label: 'Usage Reports', icon: BarChart2 },
    { path: '/admin/knowledge', label: 'Knowledge Base', icon: BookOpen },
  ];

  return (
    <>
      <div
        className={`fixed top-0 left-0 h-full bg-base-200 shadow-2xl z-[60] transition-transform duration-300 ease-in-out transform ${
          isOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-base-300/70 h-[69px]">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={() => navigate('/dashboard')}
            >
              <BsChatSquareText className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">JCS Assistant</h1>
            </div>
            <button onClick={toggleSidebar} className="text-neutral-400 hover:text-primary md:hidden" aria-label="Close sidebar">
              <X size={20} />
            </button>
          </div>

          {/* Main Navigation for All Users */}
          <nav className="p-3 space-y-1.5">
            {navItems.map(item => (
              <NavLink key={item.path} to={item.path} onClick={isOpen && window.innerWidth < 768 ? toggleSidebar : undefined}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium group transition-colors ${
                    isActive ? 'bg-primary text-white' : 'hover:bg-base-300/70'
                  }`
                }
              >
                <item.icon size={18} className="mr-3" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* --- ADMIN SECTION (Conditional Rendering) --- */}
          {/* This entire block will only appear if the user is an admin */}
          {isAdmin && (
            <div className="flex-grow p-3 border-t border-base-300/70">
              <h3 className="px-3 pt-2 pb-1 text-xs font-semibold uppercase text-neutral-400">Administration</h3>
              <div className="space-y-1.5">
                {adminNavItems.map(item => (
                  <NavLink key={item.path} to={item.path} onClick={isOpen && window.innerWidth < 768 ? toggleSidebar : undefined}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium group transition-colors ${
                        isActive ? 'bg-primary text-white' : 'hover:bg-base-300/70'
                      }`
                    }
                  >
                    <item.icon size={18} className="mr-3" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="p-3 mt-auto border-t border-base-300/70 space-y-1.5">
            <button onClick={handleLogout} className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/20">
              <LogOut size={18} className="mr-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      {/* Overlay for mobile view when sidebar is open */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={toggleSidebar}></div>}
    </>
  );
};

export default Sidebar;