import React, { useEffect, useState } from 'react';

const AdminDebug = () => {
  const [adminStatus, setAdminStatus] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    // Get current values
    const isAdmin = localStorage.getItem('is_admin');
    const currentToken = localStorage.getItem('token');
    const currentUsername = localStorage.getItem('username');
    
    setAdminStatus(isAdmin);
    setToken(currentToken ? currentToken.substring(0, 20) + '...' : 'Not set');
    setUsername(currentUsername || 'Not set');
    
    // Listen for storage changes
    const handleStorageChange = () => {
      setAdminStatus(localStorage.getItem('is_admin'));
      const updatedToken = localStorage.getItem('token');
      setToken(updatedToken ? updatedToken.substring(0, 20) + '...' : 'Not set');
      setUsername(localStorage.getItem('username') || 'Not set');
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const forceAdmin = () => {
    localStorage.setItem('is_admin', 'true');
    setAdminStatus('true');
    console.log("Forced admin status to true");
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50 border border-gray-200 dark:border-gray-700">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div className="text-sm space-y-1">
        <p><span className="font-medium">Admin:</span> {adminStatus || 'Not set'}</p>
        <p><span className="font-medium">Username:</span> {username}</p>
        <p><span className="font-medium">Token:</span> {token}</p>
      </div>
      <button 
        onClick={forceAdmin}
        className="mt-2 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
      >
        Force Admin
      </button>
    </div>
  );
};

export default AdminDebug;