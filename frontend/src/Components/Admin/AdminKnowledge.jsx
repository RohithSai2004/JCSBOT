import React, { useState, useEffect, useRef } from 'react';
import { Trash2, FileText, UploadCloud, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/apiClient';

const AdminKnowledge = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');
    const fileInputRef = useRef(null);

    const fetchKnowledgeDocuments = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/admin/knowledge/documents');
            setDocuments(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError('Failed to fetch knowledge base documents.');
            console.error('Error fetching documents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKnowledgeDocuments();
    }, []);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            handleUpload(file);
        }
    };

    const handleUpload = async (file) => {
        setUploading(true);
        setUploadError('');
        setUploadSuccess('');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await apiClient.post('/admin/knowledge/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadSuccess(`Successfully uploaded "${response.data.filename}"`);
            fetchKnowledgeDocuments();
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'File upload failed.';
            setUploadError(errorMsg);
            console.error('Upload error:', errorMsg, err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async (fileHash, filename) => {
        if (!window.confirm(`Are you sure you want to delete "${filename}" from the knowledge base?`)) return;
        try {
            await apiClient.delete(`/admin/knowledge/document/${fileHash}`);
            setDocuments(prevDocs => prevDocs.filter(doc => doc.file_hash !== fileHash));
        } catch (err) {
            setError('Failed to delete document.');
            console.error('Delete error:', err);
        }
    };

    return (
        <div className="p-6">
            <motion.div 
                className="max-w-5xl mx-auto" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-extrabold mb-4">Knowledge Base Management</h1>
                <p className="text-muted-foreground mb-8">
                    Upload and manage documents that power the company FAQ bot. Supported formats: PDF, TXT
                </p>
                
                {/* File Upload Section */}
                <div className="bg-card rounded-lg shadow-sm border p-6 mb-8">
                    <h2 className="text-lg font-semibold mb-3">Upload New Document</h2>
                    <div 
                        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">
                            Drag & drop a file here or click to select
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileChange}
                            className="hidden"
                            id="knowledge-upload"
                            accept=".pdf,.txt"
                            disabled={uploading}
                        />
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }} 
                            disabled={uploading} 
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 inline" size={16} />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <UploadCloud size={16} className="mr-2 inline" />
                                    Select File
                                </>
                            )}
                        </button>
                    </div>
                    {uploadError && (
                        <div className="mt-3 text-sm text-destructive flex items-center gap-2">
                            <AlertCircle size={16} />
                            {uploadError}
                        </div>
                    )}
                    {uploadSuccess && (
                        <div className="mt-3 text-sm text-green-600 flex items-center gap-2">
                            <CheckCircle size={16} />
                            {uploadSuccess}
                        </div>
                    )}
                </div>
                
                <h2 className="text-xl font-bold mb-4">Managed Documents</h2>
                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    </div>
                ) : error ? (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                        {error}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence>
                            {documents.length > 0 ? (
                                documents.map((doc, i) => (
                                    <motion.div 
                                        key={doc.file_hash} 
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-card border rounded-lg p-4 flex justify-between items-center group hover:shadow-sm transition-shadow"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileText size={20} className="text-primary" />
                                            <div>
                                                <p className="font-semibold">{doc.filename}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Uploaded: {new Date(doc.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(doc.file_hash, doc.filename);
                                            }} 
                                            className="p-2 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                                            aria-label={`Delete ${doc.filename}`}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </motion.div>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    No knowledge base documents found.
                                </p>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default AdminKnowledge;