// frontend/src/Components/DocumentHistory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import apiClient from '../api/apiClient';
import { Trash2, FileText, Search, Info, Loader2, Archive, FileUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DocumentHistory = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');

    const fetchDocuments = useCallback(async () => {
        console.log("DocumentHistory: Starting fetchDocuments...");
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.get('/documents');
            console.log("DocumentHistory: API response received:", response.data);
            setDocuments(Array.isArray(response.data) ? response.data : []); // Ensure it's an array
        } catch (err) {
            console.error('DocumentHistory: Error fetching documents:', err);
            setError(err.response?.data?.detail || 'Failed to fetch documents. Please try again.');
            setDocuments([]);
        } finally {
            console.log("DocumentHistory: Finished fetchDocuments. Setting loading to false.");
            setLoading(false);
        }
    }, []); // No dependencies, called once on mount by auth check

    useEffect(() => {
        console.log("DocumentHistory: Auth useEffect triggered.");
        const token = localStorage.getItem('token');
        const storedUsername = localStorage.getItem('username');
        if (token && storedUsername) {
            console.log("DocumentHistory: User authenticated. Fetching documents.");
            setIsLoggedIn(true);
            setUsername(storedUsername);
            fetchDocuments();
        } else {
            console.log("DocumentHistory: User not authenticated. Redirecting to login.");
            setIsLoggedIn(false);
            navigate('/login');
        }
    }, [navigate, fetchDocuments]); // Added fetchDocuments to dependency array

    const handleDelete = async (fileHash, filename) => {
        // ... (delete logic as before)
        if (!window.confirm(`Are you sure you want to delete "${filename}"? This action is permanent and will also remove associated chat history and embeddings.`)) {
            return;
        }
        try {
            await apiClient.delete(`/documents/${fileHash}`);
            setDocuments(prevDocs => prevDocs.filter(doc => doc.file_hash !== fileHash));
        } catch (err) {
            setError('Failed to delete document. Please try again.');
        }
    };

    const handleLogout = () => { /* ... as before ... */ };

    const filteredDocuments = documents.filter(doc =>
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const pageTitle = "Document Hub";
    console.log("DocumentHistory: Rendering. Loading:", loading, "Error:", error, "Docs count:", documents.length, "Filtered count:", filteredDocuments.length);

    return (
        <div className="flex h-screen bg-transparent">
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
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
                    <motion.div 
                        className="max-w-5xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="mb-8 text-center sm:text-left">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-light-foreground dark:text-dark-foreground mb-2">
                                {pageTitle}
                            </h1>
                            <p className="text-light-muted-foreground dark:text-dark-muted-foreground text-sm sm:text-base">
                                Manage and review your uploaded documents.
                            </p>
                        </div>

                        <div className="relative mb-6 sm:mb-8">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search size={20} className="text-light-muted-foreground dark:text-dark-muted-foreground" />
                            </span>
                            <input
                                type="text"
                                placeholder="Search documents by name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-field pl-12 pr-4 w-full !rounded-full shadow-lg"
                            />
                        </div>
                        
                        {error && !loading && (
                            <motion.div 
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                className="card bg-light-destructive/10 dark:bg-dark-destructive/20 border-light-destructive/30 dark:border-dark-destructive/30 text-light-destructive dark:text-dark-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-6"
                            >
                                <Info size={18} /> {error}
                            </motion.div>
                        )}

                        {loading && (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <Loader2 size={48} className="animate-spin text-light-primary dark:text-dark-primary mb-4" />
                                <p className="text-lg text-light-muted-foreground dark:text-dark-muted-foreground">Loading your documents...</p>
                            </div>
                        )}

                        {!loading && !error && documents.length > 0 && filteredDocuments.length === 0 && searchTerm && (
                             <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                className="card text-center py-12 sm:py-16 px-6"
                            >
                                <Search size={64} className="mx-auto text-light-muted-foreground/70 dark:text-dark-muted-foreground/50 mb-6" />
                                <h3 className="text-2xl font-semibold text-card-foreground dark:text-dark-card-foreground mb-3">
                                    No Documents Found
                                </h3>
                                <p className="text-light-muted-foreground dark:text-dark-muted-foreground mb-8 max-w-md mx-auto">
                                    No documents match your search for "{searchTerm}". Try a different term.
                                </p>
                                <button onClick={() => setSearchTerm('')} className="btn-secondary text-sm">
                                    Clear Search
                                </button>
                            </motion.div>
                        )}

                        {!loading && !error && documents.length === 0 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                className="card text-center py-12 sm:py-16 px-6"
                            >
                                <Archive size={64} className="mx-auto text-light-muted-foreground/70 dark:text-dark-muted-foreground/50 mb-6" />
                                <h3 className="text-2xl font-semibold text-card-foreground dark:text-dark-card-foreground mb-3">
                                    Your Document Hub is Empty
                                </h3>
                                <p className="text-light-muted-foreground dark:text-dark-muted-foreground mb-8 max-w-md mx-auto">
                                    Upload documents in the chat to see them listed here. They'll be ready for summarization, Q&A, and more!
                                </p>
                                <button onClick={() => navigate('/')} className="btn-primary flex items-center gap-2 mx-auto">
                                    <FileUp size={18}/> Upload First Document
                                </button>
                            </motion.div>
                        )}

                        {!loading && !error && filteredDocuments.length > 0 && (
                            <div className="space-y-4">
                                <AnimatePresence>
                                    {filteredDocuments.map((doc, index) => (
                                        <motion.div 
                                            key={doc.file_hash}
                                            layout
                                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.98, transition: {duration: 0.2} }}
                                            transition={{ duration: 0.3, delay: index * 0.05 }}
                                            className="card p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-light-primary dark:hover:border-dark-primary transition-all duration-150 ease-in-out group hover:shadow-xl"
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className={`flex-shrink-0 p-3.5 rounded-xl group-hover:scale-105 transition-transform duration-200 ${index % 2 === 0 ? 'bg-light-primary/10 dark:bg-dark-primary/10' : 'bg-light-accent/5 dark:bg-dark-accent/10'}`}>
                                                    <FileText size={24} className={`${index % 2 === 0 ? 'text-light-primary dark:text-dark-primary' : 'text-light-accent dark:text-dark-accent'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-base text-card-foreground dark:text-dark-card-foreground truncate group-hover:text-light-primary dark:group-hover:text-dark-primary transition-colors" title={doc.filename}>
                                                        {doc.filename}
                                                    </h3>
                                                    <p className="text-xs text-light-muted-foreground dark:text-dark-muted-foreground mt-1">
                                                        Uploaded: {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} at {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(doc.file_hash, doc.filename)}
                                                className="btn-ghost p-2 text-light-muted-foreground dark:text-dark-muted-foreground hover:text-light-destructive dark:hover:text-dark-destructive hover:bg-light-destructive/10 dark:hover:bg-dark-destructive/10 rounded-lg transition-colors mt-2 sm:mt-0 ml-auto sm:ml-0 opacity-60 group-hover:opacity-100 focus:opacity-100"
                                                title="Delete document"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </motion.div>
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

export default DocumentHistory;
