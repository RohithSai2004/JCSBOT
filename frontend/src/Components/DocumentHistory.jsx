import React, { useState, useEffect } from 'react';
import { FaTrash, FaFileAlt, FaSearch } from 'react-icons/fa';
import Navbar from './Navbar';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';

const DocumentHistory = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUsername = localStorage.getItem('username');
        if (token && storedUsername) {
            setIsLoggedIn(true);
            setUsername(storedUsername);
            fetchDocuments();
        } else {
            setIsLoggedIn(false);
            navigate('/login');
        }
    }, [navigate]);

    const fetchDocuments = async () => {
        try {
            const response = await apiClient.get('/documents');
            setDocuments(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching documents:', err);
            setError(err.response?.data?.detail || 'Failed to fetch documents. Please try again later.');
            setLoading(false);
        }
    };

    const handleDelete = async (fileHash) => {
        if (!window.confirm('Are you sure you want to delete this document? This will also delete all associated chat history and embeddings.')) {
            return;
        }

        try {
            await apiClient.delete(`/documents/${fileHash}`);
            setDocuments(documents.filter(doc => doc.file_hash !== fileHash));
        } catch (err) {
            setError('Failed to delete document');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setIsLoggedIn(false);
        setUsername('');
        navigate('/login');
    };

    // Filter documents based on search term
    const filteredDocuments = documents.filter(doc => 
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

                {/* Document History Content */}
                <div className="p-6 h-[calc(100vh-80px)] overflow-y-auto">
                    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
                        <h2 className="text-2xl font-bold mb-6">Document History</h2>
                        
                        {/* Search bar */}
                        <div className="relative mb-6">
                            <input
                                type="text"
                                placeholder="Search documents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full py-3 px-4 pl-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : filteredDocuments.length === 0 ? (
                            <div className="text-center text-gray-500 py-10">
                                <FaFileAlt className="mx-auto h-12 w-12 mb-4 text-gray-400" />
                                <p className="text-lg">No documents found</p>
                                {searchTerm && <p className="mt-2">Try adjusting your search</p>}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredDocuments.map((doc) => (
                                    <div key={doc.file_hash} className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex justify-between items-center hover:shadow-md transition-shadow">
                                        <div className="flex items-center">
                                            <div className="bg-blue-100 p-3 rounded-lg mr-4">
                                                <FaFileAlt className="text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-800">{doc.filename}</h3>
                                                <p className="text-sm text-gray-500">
                                                    Uploaded: {new Date(doc.created_at).toLocaleDateString()} at {new Date(doc.created_at).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(doc.file_hash)}
                                            className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition-colors"
                                            title="Delete document"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentHistory;