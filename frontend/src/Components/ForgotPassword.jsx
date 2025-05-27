import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import Navbar from './Navbar';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/users/forgot-password', { email });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />

      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <h2 className="text-3xl font-bold text-center text-indigo-600 mb-6">Forgot Password</h2>
          <form onSubmit={handleSubmit}>
            {message && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 mb-4 rounded">
                {message}
              </div>
            )}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 mb-4 rounded">
                {error}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2" htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                placeholder="Enter your email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition duration-300"
            >
              {loading ? 'Sending...' : 'Request Reset Link'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-600 mt-6">
            Remember your password?
            <a href="/login" className="text-indigo-500 font-semibold ml-1 hover:underline">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 