import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // Check if user is admin, redirect if not
  useEffect(() => {
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    if (!isAdmin) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p>Welcome to the admin dashboard. This area is under construction.</p>
      </div>
    </div>
  );
};

export default AdminDashboard;