import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const Chat = () => {
    const navigate = useNavigate();
    const { sessionId } = useParams();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentSessionId, setCurrentSessionId] = useState(sessionId || '');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        if (sessionId) {
            setCurrentSessionId(sessionId);
            loadSessionChat(sessionId);
        } else {
            setMessages([]);
        }
    }, [navigate, sessionId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadSessionChat = async (sid) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:8000/session/${sid}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.data.chat_history) {
                const formattedMessages = response.data.chat_history.map(msg => [
                    {
                        isUser: true,
                        text: msg.prompt,
                        timestamp: msg.timestamp
                    },
                    {
                        isUser: false,
                        text: msg.response,
                        timestamp: msg.timestamp
                    }
                ]).flat();
                
                setMessages(formattedMessages);
            }
        } catch (err) {
            console.error('Error loading session:', err);
            setError('Failed to load chat session');
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() && !file) return;

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('prompt', input);
            if (file) {
                formData.append('files', file);
            }
            if (currentSessionId) {
                formData.append('session_id', currentSessionId);
            }

            const response = await axios.post('http://localhost:8000/chat', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const timestamp = new Date().toISOString();
            setMessages(prev => [...prev, 
                { isUser: true, text: input, timestamp },
                { isUser: false, text: response.data.response, timestamp }
            ]);
            setInput('');
            setFile(null);

            // Update session ID if this was a new session
            if (!currentSessionId && response.data.session_id) {
                setCurrentSessionId(response.data.session_id);
                navigate(`/chat/${response.data.session_id}`, { replace: true });
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to send message');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/login');
    };

    return (
        <div className="flex flex-col h-screen">
            <div className="bg-indigo-600 p-4 flex justify-between items-center">
                <h1 className="text-white text-xl font-bold">JCSBOT Chat</h1>
                <div className="flex items-center space-x-4">
                    <span className="text-white">Welcome, {localStorage.getItem('username')}</span>
                    <button
                        onClick={handleLogout}
                        className="bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50"
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`mb-4 p-4 rounded-lg ${
                            message.isUser ? 'bg-indigo-100 ml-auto' : 'bg-gray-100'
                        } max-w-2xl`}
                    >
                        <p className="text-gray-800">{message.text}</p>
                        <div className="text-xs text-gray-500 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mx-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="p-4 border-t">
                <div className="flex space-x-4">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={loading}
                    />
                    <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="bg-gray-200 px-4 py-2 rounded-md cursor-pointer hover:bg-gray-300"
                    >
                        Upload File
                    </label>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {loading ? 'Sending...' : 'Send'}
                    </button>
                </div>
                {file && (
                    <div className="mt-2 text-sm text-gray-600">
                        Selected file: {file.name}
                        <button
                            type="button"
                            onClick={() => setFile(null)}
                            className="ml-2 text-red-600 hover:text-red-800"
                        >
                            Remove
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default Chat; 