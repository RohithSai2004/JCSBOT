import React, { useEffect, useState, useMemo, useCallback } from "react";
import { 
    BarChart2, AlertTriangle, Loader, DollarSign, FileText, MessageSquare, 
    BrainCircuit, ScanLine, FileType, Trash2, Clock, MessageSquareText, Hash, 
    Layers, Activity, FileSearch, RefreshCw, Search, AlertTriangle as AlertTriangleIcon, 
    FileInput, FileOutput
} from 'lucide-react';

// Import the actual API client
import apiClient from "../../api/apiClient";

// --- Helper Components & Functions ---

const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    } catch (e) {
        return 'Invalid date';
    }
};

const StatCard = ({ title, value, icon, color, isCurrency = true, size = 'normal' }) => {
    const valueSize = size === 'small' ? 'text-lg' : 'text-xl';
    const iconSize = size === 'small' ? 'p-2' : 'p-3';
    const titleSize = size === 'small' ? 'text-xs' : 'text-sm';
    
    return (
        <div className={`bg-gray-800/60 p-3 rounded-lg border ${color.border} flex items-center shadow-lg h-full`}>
            <div className={`${iconSize} rounded-full mr-3 ${color.bg}`}>
                {React.cloneElement(icon, { size: size === 'small' ? 16 : 20 })}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`${titleSize} text-gray-400 font-medium truncate`} title={title}>{title}</p>
                <p className={`${valueSize} font-bold text-white truncate`} title={isCurrency ? `$${Number(value).toFixed(4)}` : Number(value).toLocaleString()}>
                    {isCurrency ? '$' : ''}{isCurrency ? Number(value).toFixed(4) : Number(value).toLocaleString()}
                </p>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 font-medium text-sm rounded-md transition-colors ${
            active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700/80 hover:text-white'
        }`}
    >
        {children}
    </button>
);


// --- Main AdminUsage Component ---

const AdminUsage = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [usageData, setUsageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [includeHistorical, setIncludeHistorical] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState({});
    const [isResetting, setIsResetting] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetStatus, setResetStatus] = useState({ success: null, message: '' });

    const fetchUsage = useCallback(async (isHistorical) => {
        setLoading(true);
        setError(null);
        if (isHistorical) {
            setIsCalculating(true);
        }
        
        try {
            const response = await apiClient.get("/admin/usage", {
                params: { include_historical: isHistorical },
                headers: { 'Cache-Control': 'no-cache' }
            });
            setUsageData(response.data || []);
        } catch (err) {
            console.error("Failed to fetch usage stats:", err);
            setError("Could not load usage statistics. Please try again later.");
        } finally {
            setLoading(false);
            setIsCalculating(false);
        }
    }, []);

    useEffect(() => {
        fetchUsage(includeHistorical);
    }, [fetchUsage, includeHistorical]);

    const handleUserSelect = (userId) => {
        setSelectedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    const handleSelectAll = (isChecked) => {
        const newSelectedUsers = {};
        if (isChecked) {
            filteredByTimeRange.forEach(user => newSelectedUsers[user.user_id] = true);
        }
        setSelectedUsers(newSelectedUsers);
    };

    const resetUserData = async () => {
        const usernamesToReset = Object.entries(selectedUsers)
            .filter(([, isSelected]) => isSelected)
            .map(([userId]) => usageData.find(u => u.user_id === userId)?.username)
            .filter(Boolean);

        if (usernamesToReset.length === 0) return;

        setIsResetting(true);
        setResetStatus({ success: null, message: '' });

        try {
            await apiClient.post('/admin/reset-user-data', { usernames: usernamesToReset });
            setResetStatus({ 
                success: true, 
                message: `Successfully reset data for ${usernamesToReset.length} user(s).` 
            });
            await fetchUsage(includeHistorical);
            setSelectedUsers({});
        } catch (err) {
            console.error('Error resetting user data:', err);
            setResetStatus({ 
                success: false, 
                message: err.response?.data?.detail || 'Failed to reset user data. Please try again.' 
            });
        } finally {
            setIsResetting(false);
            setTimeout(() => setResetConfirmOpen(false), 2000);
        }
    };

    const filteredByTimeRange = useMemo(() => {
        let data = usageData;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(user => user.username.toLowerCase().includes(query));
        }

        if (timeRange === 'all') return data;
        
        const now = new Date();
        let startDate;
        
        switch(timeRange) {
            case 'today': startDate = new Date(now.setHours(0, 0, 0, 0)); break;
            case 'week': startDate = new Date(new Date().setDate(now.getDate() - 7)); break;
            case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            default: return data;
        }
        
        return data.filter(user => user.last_activity && new Date(user.last_activity) >= startDate);
    }, [usageData, searchQuery, timeRange]);

    const platformTotals = useMemo(() => {
        return usageData.reduce((acc, user) => {
            acc.total_cost += user.total_cost;
            acc.ocr_docs += user.ocr_docs;
            acc.text_docs += user.text_docs;
            acc.total_pages += user.total_pages;
            acc.chat_sessions += user.chat_sessions;
            acc.ocr_cost += user.ocr_cost;
            acc.text_processing_cost += user.text_processing_cost;
            acc.embedding_cost += user.embedding_cost;
            acc.chat_input_cost += user.chat_input_cost;
            acc.chat_output_cost += user.chat_output_cost;
            acc.deleted_docs += user.deleted_ocr_docs + user.deleted_text_docs;
            acc.chat_messages += user.chat_messages;
            acc.chat_input_tokens += user.chat_input_tokens;
            acc.chat_output_tokens += user.chat_output_tokens;
            return acc;
        }, {
            total_cost: 0, ocr_docs: 0, text_docs: 0, total_pages: 0, chat_sessions: 0,
            ocr_cost: 0, text_processing_cost: 0, embedding_cost: 0,
            chat_input_cost: 0, chat_output_cost: 0, deleted_docs: 0,
            chat_messages: 0, chat_input_tokens: 0, chat_output_tokens: 0,
        });
    }, [usageData]);

    if (loading && !usageData.length) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <Loader className="animate-spin h-12 w-12 mb-4" />
                <p className="text-lg">Loading Detailed Usage Analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto text-red-400" />
                <h3 className="font-semibold text-lg mt-3">Error Loading Data</h3>
                <p className="mt-1 text-red-300 text-sm">{error}</p>
                <button
                    onClick={() => fetchUsage(includeHistorical)}
                    className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md"
                >
                    Retry
                </button>
            </div>
        );
    }

    const numSelected = Object.keys(selectedUsers).filter(k => selectedUsers[k]).length;
    const isAllSelected = filteredByTimeRange.length > 0 && numSelected === filteredByTimeRange.length;

    return (
        <div className="bg-gray-900/70 text-gray-200 p-4 sm:p-6 rounded-lg border border-gray-700/50 shadow-2xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3"><BarChart2 className="h-6 w-6 text-blue-400" /> Usage Analytics</h1>
                    <p className="text-sm text-gray-400 mt-1">Comprehensive usage and cost tracking across the platform.</p>
                </div>
                <div className="flex mt-4 md:mt-0 space-x-1 bg-gray-800/60 p-1 rounded-lg">
                    <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
                    <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>Documents</TabButton>
                    <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>Chat</TabButton>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-4 items-center mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                 <div className="relative flex-grow min-w-[200px]">
                    <Search className="h-4 w-4 text-gray-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
                    <input type="text" className="w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md bg-gray-700" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <select className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-2 cursor-pointer" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        <option value="all">All Time</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">This Month</option>
                    </select>
                </div>
                <label className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input type="checkbox" className="sr-only" checked={includeHistorical} onChange={(e) => setIncludeHistorical(e.target.checked)} disabled={isCalculating} />
                        <div className={`block w-11 h-6 rounded-full transition-colors ${includeHistorical ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${includeHistorical ? 'translate-x-full' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-medium">{isCalculating ? 'Calculating...' : 'Include Historical'}</div>
                </label>
                <button onClick={() => setResetConfirmOpen(true)} disabled={isResetting || numSelected === 0} className="ml-auto px-4 py-2 text-sm font-medium rounded-md flex items-center transition-all bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isResetting ? 'animate-spin' : ''}`} />{isResetting ? 'Resetting...' : `Reset (${numSelected})`}
                </button>
            </div>
            
            {/* Modal */}
            {resetConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full shadow-xl border border-gray-700">
                        <div className="flex items-center mb-4"><AlertTriangleIcon className="h-6 w-6 text-yellow-400 mr-3" /><h3 className="text-lg font-medium">Confirm Data Reset</h3></div>
                        {!resetStatus.message ? (
                        <>
                            <p className="text-gray-300 mb-6">Reset all data for <strong>{numSelected} selected user(s)</strong>? This is irreversible.</p>
                            <div className="flex justify-end space-x-3">
                                <button onClick={() => setResetConfirmOpen(false)} className="px-4 py-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
                                <button onClick={resetUserData} className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">Confirm & Reset</button>
                            </div>
                        </>
                        ) : (
                             <div className={`p-3 rounded-md text-sm ${resetStatus.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>{resetStatus.message}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard title="Total Cost" value={platformTotals.total_cost} icon={<DollarSign/>} color={{border:'border-green-500/30',bg:'bg-green-500/20'}}/>
                            <StatCard title="Total Documents" value={platformTotals.ocr_docs + platformTotals.text_docs} icon={<FileText/>} color={{border:'border-blue-500/30',bg:'bg-blue-500/20'}} isCurrency={false}/>
                            <StatCard title="Total Pages" value={platformTotals.total_pages} icon={<Layers/>} color={{border:'border-yellow-500/30',bg:'bg-yellow-500/20'}} isCurrency={false}/>
                            <StatCard title="Chat Sessions" value={platformTotals.chat_sessions} icon={<MessageSquare/>} color={{border:'border-purple-500/30',bg:'bg-purple-500/20'}} isCurrency={false}/>
                        </div>
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                             <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><DollarSign className="h-5 w-5"/> Cost Breakdown</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <StatCard title="OCR" value={platformTotals.ocr_cost} icon={<ScanLine/>} color={{border:'border-orange-500/30',bg:'bg-orange-500/20'}} size="small"/>
                                <StatCard title="Text Processing" value={platformTotals.text_processing_cost} icon={<FileType/>} color={{border:'border-amber-500/30',bg:'bg-amber-500/20'}} size="small"/>
                                <StatCard title="Embeddings" value={platformTotals.embedding_cost} icon={<BrainCircuit/>} color={{border:'border-pink-500/30',bg:'bg-pink-500/20'}} size="small"/>
                                <StatCard title="Chat Input" value={platformTotals.chat_input_cost} icon={<FileInput/>} color={{border:'border-sky-500/30',bg:'bg-sky-500/20'}} size="small"/>
                                <StatCard title="Chat Output" value={platformTotals.chat_output_cost} icon={<FileOutput/>} color={{border:'border-indigo-500/30',bg:'bg-indigo-500/20'}} size="small"/>
                             </div>
                        </div>
                    </div>
                )}
                {['documents', 'chat', 'overview'].includes(activeTab) && (
                     <div className={`bg-gray-800/50 p-4 mt-6 rounded-lg border border-gray-700/50 ${activeTab === 'overview' ? '' : 'hidden'}`}>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Activity className="h-5 w-5"/> User Activity</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                        <th className="p-2 w-12"><input type="checkbox" onChange={e=>handleSelectAll(e.target.checked)} checked={isAllSelected} /></th>
                                        <th className="p-2 font-medium">User</th>
                                        <th className="p-2 font-medium text-center">Docs (Active/Del)</th>
                                        <th className="p-2 font-medium text-center">Chat Sessions</th>
                                        <th className="p-2 font-medium text-right">Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/50">
                                    {filteredByTimeRange.map(user => (
                                        <tr key={user.user_id} className={`transition-colors ${selectedUsers[user.user_id] ? 'bg-blue-900/30' : 'hover:bg-gray-800'}`}>
                                            <td className="px-3 py-3"><input type="checkbox" checked={!!selectedUsers[user.user_id]} onChange={() => handleUserSelect(user.user_id)} /></td>
                                            <td className="p-2"><div className="font-medium">{user.username}</div><div className="text-xs text-gray-400">{formatDate(user.last_activity)}</div></td>
                                            <td className="p-2 text-center">{user.ocr_docs + user.text_docs} / <span className="text-red-400/80">{user.deleted_ocr_docs + user.deleted_text_docs}</span></td>
                                            <td className="p-2 text-center">{user.chat_sessions}</td>
                                            <td className="p-2 text-right font-mono">${user.total_cost.toFixed(4)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUsage;
