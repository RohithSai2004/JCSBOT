// frontend/src/Components/SessionList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday, parseISO } from 'date-fns'; // Added parseISO
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import apiClient from '../api/apiClient';
import { PlusCircle, Trash2, MessageSquareText, FileText as FileIconLucide, Loader2, ArchiveX, Info } from 'lucide-react';
import {  AnimatePresence } from 'framer-motion';

const SessionList = () => {
    const navigate = useNavigate();
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
            setSessions(Array.isArray(response.data?.sessions) ? response.data.sessions : []);
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
         e.stopPropagation(); 
        if (!window.confirm(`Are you sure you want to delete the conversation starting with "${sessionPreview || 'Untitled Conversation'}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await apiClient.delete(`/session/${sessionId}`);
            setSessions(prevSessions => prevSessions.filter(s => s.session_id !== sessionId));
        } catch (err) {
            console.error("Error deleting session:", err);
            setError(err.response?.data?.detail ||'Failed to delete session.');
        }
    };

    const formatDateHeading = (dateString) => {
        if (!dateString) return 'Unknown Date';
        try {
            const date = parseISO(dateString); // Use parseISO for ISO strings from backend
            if (isNaN(date.getTime())) {
                 console.warn("Invalid date string received for heading:", dateString);
                 return 'Invalid Date';
            }
            if (isToday(date)) return 'Today';
            if (isYesterday(date)) return 'Yesterday';
            return format(date, 'MMMM d, yyyy'); // Corrected format string
        } catch (e) {
            console.error("Error formatting date heading:", e, "Original string:", dateString);
            return "Error in date";
        }
    };
    
    const handleLogout = () => { 
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
      if (a === 'Today') return -1; if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1; if (b === 'Yesterday') return 1;
      if (a === 'Invalid Date' || a === 'Unknown Date') return 1;
      if (b === 'Invalid Date' || b === 'Unknown Date') return -1;
      try {
        // Assuming dateKey is 'MMMM d, yyyy' for older dates
        // This comparison might need adjustment if dateKeys are not directly comparable
        // For simplicity, if backend sorts, this might not be strictly needed beyond Today/Yesterday
        return parseISO(sessions.find(s => formatDateHeading(s.last_activity) === b).last_activity) - parseISO(sessions.find(s => formatDateHeading(s.last_activity) === a).last_activity);
      } catch (e) {
        return 0;
      }
    });

    const pageTitle = "Chat History";
    // console.log("SessionList: Rendering. Loading:", loading, "Error:", error, "Sessions count:", sessions.length);


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
                        {/* ... (header and button) ... */}
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
                                onClick={() => navigate('/')}
                                className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 text-sm sm:text-base"
                            >
                                <PlusCircle size={18} /> New Conversation
                            </button>
                        </div>

                        {/* ... (loading, error, no sessions messages) ... */}
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Loader2 size={48} className="animate-spin text-light-primary dark:text-dark-primary mb-4" />
                                <p className="text-lg text-light-muted-foreground dark:text-dark-muted-foreground">Loading conversations...</p>
                            </div>
                        )}
                        {/* ... (rest of the conditional rendering) ... */}

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
                                            {groupedSessions[dateKey].map((session, index) => {
                                                const sessionDate = session.last_activity ? parseISO(session.last_activity) : new Date();
                                                let displayTime;
                                                if (isToday(sessionDate) || isYesterday(sessionDate)) {
                                                    displayTime = format(sessionDate, 'p'); // Just time for today/yesterday
                                                } else {
                                                    displayTime = format(sessionDate, 'MMM d, p'); // Date and time for older entries
                                                }

                                                return (
                                                    <motion.div
                                                        key={session.session_id}
                                                        // ... (other motion props)
                                                        layout
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: 20, transition: {duration: 0.2} }}
                                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                                        onClick={() => openSession(session.session_id)}
                                                        className="card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-light-primary dark:hover:border-dark-primary cursor-pointer transition-all duration-150 ease-in-out group hover:shadow-xl"
                                                    >
                                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                                            {/* ... (icon) ... */}
                                                            <div className={`flex-shrink-0 p-3 rounded-xl group-hover:scale-105 transition-transform duration-200 ${index % 2 === 0 ? 'bg-light-primary/10 dark:bg-dark-primary/10' : 'bg-light-accent/5 dark:bg-dark-accent/10'}`}>
                                                                <MessageSquareText size={22} className={`${index % 2 === 0 ? 'text-light-primary dark:text-dark-primary' : 'text-light-accent dark:text-dark-accent'}`} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-semibold text-base text-card-foreground dark:text-dark-card-foreground group-hover:text-light-primary dark:group-hover:text-dark-primary transition-colors truncate" title={session.preview || "Untitled Conversation"}>
                                                                    {session.preview || "Untitled Conversation"}
                                                                </p>
                                                                <div className="flex items-center gap-3 mt-1 text-xs text-light-muted-foreground dark:text-dark-muted-foreground">
                                                                    {/* MODIFIED PART FOR DISPLAYING TIME/DATE */}
                                                                    <span>{displayTime}</span>
                                                                    {session.document_count > 0 && (
                                                                        <span className="flex items-center gap-1">
                                                                            <FileIconLucide size={12} />
                                                                            {session.document_count} doc{session.document_count !== 1 ? 's' : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* ... (delete button) ... */}
                                                        <button
                                                            onClick={(e) => deleteSession(session.session_id, session.preview, e)}
                                                            className="btn-ghost p-2 text-light-muted-foreground dark:text-dark-muted-foreground hover:text-light-destructive dark:hover:text-dark-destructive hover:bg-light-destructive/10 dark:hover:bg-dark-destructive/10 rounded-lg transition-colors mt-2 sm:mt-0 ml-auto sm:ml-0 opacity-60 group-hover:opacity-100 focus:opacity-100"
                                                            aria-label="Delete session"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </motion.div>
                                                );
                                            })}
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