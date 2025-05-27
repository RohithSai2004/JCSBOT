import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { FaPlus, FaTrash, FaFileAlt } from 'react-icons/fa';
import apiClient from '../api/apiClient'; // Import apiClient

const SessionList = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUsername = localStorage.getItem('username');
        if (token && storedUsername) {
            setIsLoggedIn(true);
            setUsername(storedUsername);
            loadSessions();
        } else {
            setIsLoggedIn(false);
            navigate('/login');
        }
    }, [navigate]);

    const loadSessions = async () => {
        try {
            setLoading(true);
            // Using apiClient instead of direct axios
            const response = await apiClient.get('/sessions');
            setSessions(response.data.sessions || []);
        } catch (err) {
            console.error("Error loading sessions:", err);
            setError('Failed to load chat sessions');
        } finally {
            setLoading(false);
        }
    };

    const openSession = (sessionId) => {
        navigate(`/chat/${sessionId}`);
    };

    const deleteSession = async (sessionId, e) => {
        e.stopPropagation(); // Prevent triggering the parent onClick
        if (!window.confirm('Are you sure you want to delete this conversation?')) {
            return;
        }
        
        try {
            // Using apiClient instead of direct axios
            await apiClient.delete(`/session/${sessionId}`);
            // Remove from UI
            setSessions(sessions.filter(s => s.session_id !== sessionId));
        } catch (err) {
            console.error("Error deleting session:", err);
            setError('Failed to delete session');
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return format(date, 'MMM d, yyyy');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/login');
    };

    // Group sessions by date
    const groupedSessions = sessions.reduce((groups, session) => {
        const dateKey = formatDate(session.last_activity);
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(session);
        return groups;
    }, {});

    if (loading) {
        return <div className="text-center text-gray-500 dark:text-gray-400">Loading sessions...</div>;
    }

    if (error) {
        return <div className="text-center text-red-500 dark:text-red-400">Error loading sessions: {error}</div>;
    }

    if (sessions.length === 0) {
        return <div className="text-center text-gray-500 dark:text-gray-400">No recent sessions found. Start a new conversation!</div>;
    }

    return (
        <div className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-[#ffe9e9] via-[#fff4e6] via-35% to-[#e8f0ff]">
            {/* Sidebar */}
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Main content */}
            <div
                className={`h-full transition-all duration-300 ease-in-out ${
                    isSidebarOpen ? "ml-64" : "ml-0"
                }`}
            >
                {/* Navbar */}
                <Navbar
                    isLoggedIn={isLoggedIn}
                    username={username}
                    handleLogout={handleLogout}
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />

                {/* Sessions List */}
                <div className="max-w-4xl mx-auto p-6 overflow-y-auto h-[calc(100%-80px)]">
                    <h1 className="text-2xl font-bold mb-6">Your Conversations</h1>
                    
                    {sessions.length === 0 ? (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                            <p>No conversations in the last 15 days</p>
                        </div>
                    ) : (
                        Object.entries(groupedSessions).map(([date, dateSessions]) => (
                            <div key={date} className="mb-6">
                                <h2 className="text-sm font-medium text-gray-500 mb-2">{date}</h2>
                                {dateSessions.map(session => (
                                    <div 
                                        key={session.session_id}
                                        onClick={() => openSession(session.session_id)}
                                        className="p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow mb-2"
                                    >
                                        <p className="font-medium truncate">{session.preview}</p>
                                        <div className="flex justify-between mt-2 text-sm text-gray-500">
                                            <span>{format(new Date(session.last_activity), 'h:mm a')}</span>
                                            {session.document_count > 0 && (
                                                <span>{session.document_count} document{session.document_count !== 1 ? 's' : ''}</span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={(e) => deleteSession(session.session_id, e)}
                                            className="text-red-500 hover:text-red-700 mt-2"
                                        >
                                            <FaTrash /> Delete
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                    
                    <button 
                        onClick={() => navigate('/chat')}
                        className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        New Conversation
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionList;
