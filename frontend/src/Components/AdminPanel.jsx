import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet, NavLink } from 'react-router-dom';
import { Users, BarChart2, BookOpen, LogOut, Home, FileText, History, Settings, Shield } from 'lucide-react';
import { BsChatSquareText } from "react-icons/bs";

const AdminPanel = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear(); // Clears token, username, and is_admin
        navigate('/'); // Navigate to landing page after logout
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            {/* Sidebar Navigation */}
            <aside className="w-64 flex-shrink-0 bg-base-200 shadow-lg flex flex-col">
                <div 
                    className="h-[69px] flex items-center justify-between p-4 border-b border-base-300/70 cursor-pointer"
                    onClick={() => navigate('/dashboard')}
                >
                    <div className="flex items-center gap-2">
                        <BsChatSquareText className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-bold">JCS Assistant</h1>
                    </div>
                </div>
                
                {/* Main Navigation */}
                <div className="flex-1 p-3 space-y-1.5">
                    <NavLink 
                        to="/dashboard" 
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md hover:bg-primary-dark' 
                                : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                            }`
                        }
                    >
                        <Home size={18} className="mr-3" />
                        Home
                    </NavLink>
                    
                    <NavLink 
                        to="/documents" 
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md hover:bg-primary-dark' 
                                : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                            }`
                        }
                    >
                        <FileText size={18} className="mr-3" />
                        Documents
                    </NavLink>
                    
                    <NavLink 
                        to="/sessions" 
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md hover:bg-primary-dark' 
                                : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                            }`
                        }
                    >
                        <History size={18} className="mr-3" />
                        Chat History
                    </NavLink>
                </div>
                
                {/* Admin Section */}
                <div className="p-3 border-t border-base-300/70">
                    <h3 className="px-3 py-2 text-xs font-semibold uppercase text-neutral-400">Administration</h3>
                    
                    <NavLink 
                        to="/admin/users" 
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md hover:bg-primary-dark' 
                                : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                            }`
                        }
                    >
                        <Users size={18} className="mr-3" />
                        User Management
                    </NavLink>
                    
                    <NavLink 
                        to="/admin/usage" 
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md hover:bg-primary-dark' 
                                : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                            }`
                        }
                    >
                        <BarChart2 size={18} className="mr-3" />
                        Usage Reports
                    </NavLink>
                    
                    <NavLink 
                        to="/admin/knowledge" 
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md hover:bg-primary-dark' 
                                : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                            }`
                        }
                    >
                        <BookOpen size={18} className="mr-3" />
                        Knowledge Base
                    </NavLink>
                </div>
                
                {/* Bottom Section */}
                <div className="p-3 border-t border-base-300/70 space-y-1.5">
                    <NavLink 
                        to="/settings" 
                        className={({ isActive }) => 
                            `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md hover:bg-primary-dark' 
                                : 'text-neutral-300 hover:bg-base-300/70 hover:text-primary'
                            }`
                        }
                    >
                        <Settings size={18} className="mr-3" />
                        Settings
                    </NavLink>
                    
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/20 hover:text-danger/80 transition-colors group"
                    >
                        <LogOut size={18} className="mr-3 text-danger/80 group-hover:text-danger" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-6 overflow-y-auto">
                {/* The Outlet is the placeholder where child route components render */}
                <Outlet />
            </main>
        </div>
    );
};

export default AdminPanel;