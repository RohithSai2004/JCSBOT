// frontend/src/Components/SessionList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { format, isToday, isYesterday } from 'date-fns';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import apiClient from '../api/apiClient';
import { PlusCircle, Trash2, MessageSquareText, FileText as FileIconLucide, Loader2, ArchiveX, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SessionList = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');

    const loadSessions = useCallback(async () => {
        console.log("SessionList: Starting loadSessions...");
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.get('/sessions');
            console.log("SessionList: API response received:", response.data);
            setSessions(Array.isArray(response.data.sessions) ? response.data.sessions : []);
        } catch (err) {
            console.error("SessionList: Error loading sessions:", err);
            setError(err.response?.data?.detail || 'Failed to load chat sessions.');
            setSessions([]);
        } finally {
            console.log("SessionList: Finished loadSessions. Setting loading to false.");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        console.log("SessionList: Auth useEffect triggered.");
        const token = localStorage.getItem('token');
        const storedUsername = localStorage.getItem('username');
        if (token && storedUsername) {
            console.log("SessionList: User authenticated. Loading sessions.");
            setIsLoggedIn(true);
            setUsername(storedUsername);
            loadSessions();
        } else {
            console.log("SessionList: User not authenticated. Redirecting to login.");
            setIsLoggedIn(false);
            navigate('/login');
        }
    }, [navigate, loadSessions]);

    const openSession = (sessionId) => {
        navigate(`/chat/${sessionId}`);
    };

    const deleteSession = async (sessionId, sessionPreview, e) => {
        // ... (delete logic as before)
         e.stopPropagation(); 
        if (!window.confirm(`Are you sure you want to delete the conversation starting with "${sessionPreview || 'Untitled Conversation'}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await apiClient.delete(`/session/${sessionId}`);
            setSessions(prevSessions => prevSessions.filter(s => s.session_id !== sessionId));
        } catch (err) {
            console.error("Error deleting session:", err);
            setError('Failed to delete session.');
        }
    };

    const formatDateHeading = (dateString) => { /* ... as before ... */ };
    const handleLogout = () => { /* ... as before ... */ };

    const groupedSessions = sessions.reduce((groups, session) => {
        const dateKey = formatDateHeading(session.last_activity);
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(session);
        return groups;
    }, {});

    const sortedGroupKeys = Object.keys(groupedSessions).sort((a, b) => {
      if (a === 'Today') return -1; if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1; if (b === 'Yesterday') return 1;
      // For other dates, sort them chronologically (most recent first)
      // This requires parsing them back to dates if they are formatted strings
      // For simplicity, if not Today/Yesterday, the original order (which is by last_activity desc from backend) might be fine
      // Or, implement a more robust date parsing for sorting here if needed.
      // Assuming backend sorts correctly, this might be sufficient.
      return 0; 
    });

    const pageTitle = "Chat History";
    console.log("SessionList: Rendering. Loading:", loading, "Error:", error, "Sessions count:", sessions.length);


    return (
        <div className="flex h-screen bg-transparent">
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
                <Navbar
                    isLoggedIn={isLoggedIn} username={username}
                    handleLogout={handleLogout} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
                    <motion.div 
                        className="max-w-4xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-extrabold text-light-foreground dark:text-dark-foreground">
                                    {pageTitle}
                                </h1>
                                <p className="text-light-muted-foreground dark:text-dark-muted-foreground text-sm sm:text-base mt-1">
                                    Review and continue your past conversations.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/chat')} // Navigates to / which should start a new session
                                className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 text-sm sm:text-base"
                            >
                                <PlusCircle size={18} /> New Conversation
                            </button>
                        </div>

                        {loading && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Loader2 size={48} className="animate-spin text-light-primary dark:text-dark-primary mb-4" />
                                <p className="text-lg text-light-muted-foreground dark:text-dark-muted-foreground">Loading conversations...</p>
                            </div>
                        )}
                        {error && !loading && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                className="card bg-light-destructive/10 dark:bg-dark-destructive/20 border-light-destructive/30 dark:border-dark-destructive/30 text-light-destructive dark:text-dark-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-6"
                            >
                                <Info size={18} /> {error}
                            </motion.div>
                        )}
                        {!loading && !error && sessions.length === 0 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                className="card text-center py-12 sm:py-16 px-6"
                            >
                                <ArchiveX size={64} className="mx-auto text-light-muted-foreground/70 dark:text-dark-muted-foreground/50 mb-6" />
                                <h3 className="text-2xl font-semibold text-card-foreground dark:text-dark-card-foreground mb-3">
                                    No Conversations Yet
                                </h3>
                                <p className="text-light-muted-foreground dark:text-dark-muted-foreground mb-8 max-w-md mx-auto">
                                    Your chat history is empty. Start a new conversation to see it listed here.
                                </p>
                                <button onClick={() => navigate('/chat')} className="btn-primary mx-auto flex items-center gap-2">
                                    <PlusCircle size={20} /> Start New Chat
                                </button>
                            </motion.div>
                        )}

                        {!loading && !error && sessions.length > 0 && (
                            <div className="space-y-8">
                                <AnimatePresence>
                                {sortedGroupKeys.map(dateKey => (
                                    <motion.section 
                                        key={dateKey}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <h2 className="text-sm font-semibold text-light-muted-foreground dark:text-dark-muted-foreground mb-3 uppercase tracking-wider pb-2 border-b border-light-border dark:border-dark-border">
                                            {dateKey}
                                        </h2>
                                        <div className="space-y-3">
                                            {groupedSessions[dateKey].map((session, index) => (
                                                <motion.div
                                                    key={session.session_id}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20, transition: {duration: 0.2} }}
                                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                                    onClick={() => openSession(session.session_id)}
                                                    className="card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-light-primary dark:hover:border-dark-primary cursor-pointer transition-all duration-150 ease-in-out group hover:shadow-xl"
                                                >
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <div className={`flex-shrink-0 p-3 rounded-xl group-hover:scale-105 transition-transform duration-200 ${index % 2 === 0 ? 'bg-light-primary/10 dark:bg-dark-primary/10' : 'bg-light-accent/5 dark:bg-dark-accent/10'}`}>
                                                            <MessageSquareText size={22} className={`${index % 2 === 0 ? 'text-light-primary dark:text-dark-primary' : 'text-light-accent dark:text-dark-accent'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-base text-card-foreground dark:text-dark-card-foreground group-hover:text-light-primary dark:group-hover:text-dark-primary transition-colors truncate" title={session.preview || "Untitled Conversation"}>
                                                                {session.preview || "Untitled Conversation"}
                                                            </p>
                                                            <div className="flex items-center gap-3 mt-1 text-xs text-light-muted-foreground dark:text-dark-muted-foreground">
                                                                <span>{format(new Date(session.last_activity), 'p')}</span>
                                                                {session.document_count > 0 && (
                                                                    <span className="flex items-center gap-1">
                                                                        <FileIconLucide size={12} />
                                                                        {session.document_count} doc{session.document_count !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => deleteSession(session.session_id, session.preview, e)}
                                                        className="btn-ghost p-2 text-light-muted-foreground dark:text-dark-muted-foreground hover:text-light-destructive dark:hover:text-dark-destructive hover:bg-light-destructive/10 dark:hover:bg-dark-destructive/10 rounded-lg transition-colors mt-2 sm:mt-0 ml-auto sm:ml-0 opacity-60 group-hover:opacity-100 focus:opacity-100"
                                                        aria-label="Delete session"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.section>
                                ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default SessionList;
