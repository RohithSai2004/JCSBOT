import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import AdminUsers from './AdminUsers';
import AdminUsage from './AdminUsage';
import AdminKnowledge from './AdminKnowledge';
import { Users, BarChart2, Database, Shield } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  
  // Redirect non-admin users
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-primary dark:text-dark-primary" size={28} />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>
      
      <div className="bg-card dark:bg-dark-card rounded-xl shadow-lg border border-border dark:border-dark-border overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Sidebar Navigation */}
          <div className="sm:w-64 bg-muted/30 dark:bg-dark-muted/20 p-4">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'users'
                    ? 'bg-primary/10 dark:bg-dark-primary/20 text-primary dark:text-dark-primary font-medium'
                    : 'hover:bg-muted dark:hover:bg-dark-muted/40'
                }`}
              >
                <Users size={18} />
                <span>User Management</span>
              </button>
              
              <button
                onClick={() => setActiveTab('usage')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'usage'
                    ? 'bg-primary/10 dark:bg-dark-primary/20 text-primary dark:text-dark-primary font-medium'
                    : 'hover:bg-muted dark:hover:bg-dark-muted/40'
                }`}
              >
                <BarChart2 size={18} />
                <span>Usage Reports</span>
              </button>
              
              <button
                onClick={() => setActiveTab('knowledge')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'knowledge'
                    ? 'bg-primary/10 dark:bg-dark-primary/20 text-primary dark:text-dark-primary font-medium'
                    : 'hover:bg-muted dark:hover:bg-dark-muted/40'
                }`}
              >
                <Database size={18} />
                <span>Knowledge Base</span>
              </button>
            </nav>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 p-6">
            {activeTab === 'users' && <AdminUsers />}
            {activeTab === 'usage' && <AdminUsage />}
            {activeTab === 'knowledge' && <AdminKnowledge />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;