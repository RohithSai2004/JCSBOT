// rohithsai2004/jcsbot/JCSBOT-c968a16baaf78ba3a848fd197258c78786a45076/frontend/src/Components/SessionList.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns'; // Import more specific functions
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { PlusCircle, Trash2, MessageSquare, FileText as FileIconLucide, Loader2 } from 'lucide-react'; // Icons
import apiClient from '../api/apiClient';

const SessionList = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Manage sidebar state locally or lift up
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
            const response = await apiClient.get('/sessions');
            setSessions(response.data.sessions || []);
            setError('');
        } catch (err) {
            console.error("Error loading sessions:", err);
            setError(err.response?.data?.detail || 'Failed to load chat sessions. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const openSession = (sessionId) => {
        navigate(`/chat/${sessionId}`);
    };

    const deleteSession = async (sessionId, e) => {
        e.stopPropagation(); 
        if (!window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }
        try {
            await apiClient.delete(`/session/${sessionId}`);
            setSessions(prevSessions => prevSessions.filter(s => s.session_id !== sessionId));
        } catch (err) {
            console.error("Error deleting session:", err);
            setError('Failed to delete session. Please try again.');
        }
    };

    const formatDateHeading = (dateString) => {
        const date = new Date(dateString);
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'MMMM d, yyyy'); // More descriptive
    };

    const handleLogout = () => { // Ensure this function is correctly passed or defined if Navbar handles it
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setIsLoggedIn(false);
        setUsername('');
        navigate('/login');
    };

    const groupedSessions = sessions.reduce((groups, session) => {
        const dateKey = formatDateHeading(session.last_activity);
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(session);
        return groups;
    }, {});

    const sortedGroupKeys = Object.keys(groupedSessions).sort((a, b) => {
      // Custom sort logic for "Today", "Yesterday", then dates
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      return new Date(b) - new Date(a); // Sort dates descending
    });


    return (
        <div className="flex h-screen bg-neutral-100">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
            <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
                <Navbar
                    isLoggedIn={isLoggedIn}
                    username={username}
                    handleLogout={handleLogout}
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800">Your Conversations</h1>
                            <button
                                onClick={() => navigate('/chat')} // Navigate to new chat
                                className="bg-primary text-white font-medium px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-offset-2 flex items-center gap-2 text-sm sm:text-base"
                            >
                                <PlusCircle size={18} /> New Chat
                            </button>
                        </div>

                        {loading && (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 size={32} className="animate-spin text-primary" />
                                <p className="ml-2 text-neutral-600">Loading sessions...</p>
                            </div>
                        )}

                        {error && !loading && (
                             <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-md text-sm text-center">
                                {error}
                            </div>
                        )}
                        
                        {!loading && !error && sessions.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-neutral-200">
                                <MessageSquare size={48} className="mx-auto text-neutral-400 mb-4" />
                                <h3 className="text-xl font-semibold text-neutral-700">No Conversations Yet</h3>
                                <p className="text-neutral-500 mt-1 mb-6">Start a new chat to see your conversations here.</p>
                                <button
                                    onClick={() => navigate('/chat')}
                                    className="bg-primary text-white font-medium px-5 py-2.5 rounded-lg hover:bg-primary-dark transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-offset-2 flex items-center gap-2 mx-auto"
                                >
                                    <PlusCircle size={20} /> Start New Chat
                                </button>
                            </div>
                        )}

                        {!loading && !error && sessions.length > 0 && (
                            <div className="space-y-6">
                                {sortedGroupKeys.map(dateKey => (
                                    <section key={dateKey}>
                                        <h2 className="text-sm font-semibold text-neutral-500 mb-2 uppercase tracking-wider">{dateKey}</h2>
                                        <div className="space-y-3">
                                            {groupedSessions[dateKey].map(session => (
                                                <div
                                                    key={session.session_id}
                                                    onClick={() => openSession(session.session_id)}
                                                    className="bg-white p-4 rounded-lg shadow-subtle border border-neutral-200 hover:shadow-md hover:border-primary/50 cursor-pointer transition-all group"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-medium text-neutral-800 group-hover:text-primary transition-colors truncate mr-4 flex-1">
                                                            {session.preview || "Untitled Conversation"}
                                                        </p>
                                                        <button
                                                            onClick={(e) => deleteSession(session.session_id, e)}
                                                            className="text-neutral-400 hover:text-danger p-1 rounded-full hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                                            aria-label="Delete session"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2 text-xs text-neutral-500">
                                                        <span>{format(new Date(session.last_activity), 'p')}</span> {/* p for time */}
                                                        {session.document_count > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <FileIconLucide size={14} />
                                                                {session.document_count} doc{session.document_count !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SessionList;