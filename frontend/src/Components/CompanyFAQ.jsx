// Create a new file: /frontend/src/Components/CompanyFAQ.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import ChatDisplay from "./ChatDisplay";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { api } from "../api/apiClient";
import { Send, BookOpen, Trash2 } from "lucide-react";

const CompanyFAQ = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const abortControllerRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUsername = localStorage.getItem('username');
        if (token && storedUsername) {
            setIsLoggedIn(true);
            setUsername(storedUsername);
            // Set an initial welcome message
            setMessages([{
                id: 'welcome-1',
                text: "Welcome to the Company FAQ! Ask me anything about our products, policies, or internal processes.",
                isUser: false,
                timestamp: new Date()
            }]);
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => { /* Standard logout logic */ };

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const queryToSend = query.trim();
        if (!queryToSend) return;

        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        const userMessage = { id: `user-${Date.now()}`, text: queryToSend, isUser: true, timestamp: new Date() };
        const botPlaceholderId = `bot-${Date.now()}`;
        setMessages(prev => [...prev, userMessage, { id: botPlaceholderId, text: "", isUser: false, timestamp: new Date(), isStreaming: true }]);
        setIsLoading(true);
        setQuery("");

        try {
            // Use the API client to send the FAQ message
            await api.sendFaqMessage(queryToSend, {
                signal: abortControllerRef.current.signal,
                onChunk: (chunk) => {
                    setMessages(prev => {
                        const currentMessage = prev.find(msg => msg.id === botPlaceholderId);
                        if (!currentMessage) return prev;
                        
                        return prev.map(msg => 
                            msg.id === botPlaceholderId 
                                ? { ...msg, text: msg.text + chunk }
                                : msg
                        );
                    });
                }
            });
            
            // Mark streaming as complete
            setMessages(prev => prev.map(msg => 
                msg.id === botPlaceholderId 
                    ? { ...msg, isStreaming: false } 
                    : msg
            ));
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('FAQ Chat Error:', error);
                setMessages(prev => prev.map(msg =>
                    msg.id === botPlaceholderId 
                        ? { ...msg, text: `Error: ${error.message || 'Failed to get response'}` } 
                        : msg
                ));
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [query]);

    const clearConversation = () => {
        setMessages([{
            id: 'welcome-1',
            text: "Welcome to the Company FAQ! Ask me anything about our products, policies, or internal processes.",
            isUser: false,
            timestamp: new Date()
        }]);
    };

    return (
        <div className="flex h-screen bg-transparent">
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
                <Navbar isLoggedIn={isLoggedIn} username={username} handleLogout={handleLogout} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <ChatDisplay messages={messages} isLoading={isLoading && messages.length <= 1} />
                    <div className="p-4 bg-background/80 dark:bg-dark-background/80 backdrop-blur-md">
                         <div className="max-w-3xl mx-auto">
                            <form onSubmit={handleSubmit} className="relative">
                                <div className="flex items-center bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-full shadow-lg overflow-hidden focus-within:ring-2 focus-within:ring-light-ring dark:focus-within:ring-dark-ring">
                                    <BookOpen size={20} className="text-muted-foreground dark:text-dark-muted-foreground mx-4" />
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Ask a question about the company..."
                                        className="flex-1 py-3 bg-transparent outline-none text-foreground dark:text-dark-foreground"
                                        disabled={isLoading}
                                    />
                                    <div className="pr-2.5">
                                        <button type="submit" className="btn-primary p-2.5 rounded-full" disabled={isLoading || !query.trim()}>
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            </form>
                            {messages.length > 1 && (
                                <div className="flex justify-center mt-2.5">
                                    <button onClick={clearConversation} className="text-xs text-muted-foreground dark:text-dark-muted-foreground hover:text-destructive dark:hover:text-dark-destructive transition-colors flex items-center gap-1">
                                        <Trash2 size={13} /> Clear conversation
                                    </button>
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyFAQ;