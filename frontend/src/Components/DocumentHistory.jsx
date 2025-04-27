import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTrash, FaFileAlt } from 'react-icons/fa';

const DocumentHistory = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Please login to view documents');
                setLoading(false);
                return;
            }

            const response = await axios.get('http://localhost:8000/documents', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
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
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:8000/documents/${fileHash}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setDocuments(documents.filter(doc => doc.file_hash !== fileHash));
        } catch (err) {
            setError('Failed to delete document');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Document History</h2>
            
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {documents.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                    <FaFileAlt className="mx-auto h-12 w-12 mb-4" />
                    <p>No documents found</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {documents.map((doc) => (
                        <div key={doc.file_hash} className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center">
                            <div className="flex items-center">
                                <FaFileAlt className="text-blue-500 mr-3" />
                                <div>
                                    <h3 className="font-semibold">{doc.filename}</h3>
                                    <p className="text-sm text-gray-500">
                                        Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(doc.file_hash)}
                                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100"
                                title="Delete document"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DocumentHistory; 