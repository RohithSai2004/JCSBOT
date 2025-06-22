import React, { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";
import { Users, AlertTriangle, Loader, Trash2, ShieldAlert } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for the confirmation modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Fetch users when the component mounts
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/admin/users");
      setUsers(response.data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Could not load user data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };
  
  // Function to open the confirmation modal
  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setDeleteError('');
    setIsModalOpen(true);
  };
  
  // Function to close the modal
  const closeDeleteModal = () => {
    setIsModalOpen(false);
    setUserToDelete(null);
  };

  // Function to handle the actual user deletion
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      // Call the new backend endpoint
      await apiClient.delete(`/admin/users/${userToDelete.username}`);
      // Remove the user from the list in the UI for an instant update
      setUsers(users.filter(u => u.username !== userToDelete.username));
      closeDeleteModal();
    } catch (err) {
      console.error("Failed to delete user:", err);
      setDeleteError(err.response?.data?.detail || "An error occurred during deletion.");
    }
  };

  // --- Main Component Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader className="animate-spin" /> <p className="ml-2">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 bg-red-900/50 p-4 rounded-lg flex items-center gap-2">
        <AlertTriangle /> {error}
      </div>
    );
  }

  return (
    <>
      {/* This parent div provides the self-contained dark background */}
      <div className="bg-gray-800/50 text-gray-200 p-6 rounded-lg border border-gray-700">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Users /> Manage Users
        </h1>
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-left">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-300">Username</th>
                <th className="px-4 py-3 font-semibold text-gray-300">Email</th>
                <th className="px-4 py-3 font-semibold text-gray-300">Admin</th>
                <th className="px-4 py-3 font-semibold text-gray-300">Created At</th>
                <th className="px-4 py-3 font-semibold text-gray-300 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.username} className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{user.username}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                      user.is_admin ? 'bg-green-500/20 text-green-300' : 'bg-gray-600/50 text-gray-300'
                    }`}>
                      {user.is_admin ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{new Date(user.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => openDeleteModal(user)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-2 rounded-md transition-colors"
                      aria-label={`Delete user ${user.username}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Confirmation Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                <ShieldAlert className="h-6 w-6 text-red-400" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-white">Delete User Account</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-400">
                    Are you sure you want to delete the user <strong className="text-white">{userToDelete?.username}</strong>? This action will permanently remove all of their documents and chat history. This cannot be undone.
                  </p>
                </div>
              </div>
            </div>
             {deleteError && (
              <p className="text-sm text-red-400 mt-4 text-center sm:text-left sm:ml-14">{deleteError}</p>
            )}
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                onClick={handleDeleteUser}
              >
                Confirm Delete
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-200 hover:bg-gray-600 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                onClick={closeDeleteModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminUsers;
