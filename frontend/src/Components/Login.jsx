// frontend/src/Components/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { LogIn, User, Lock, Eye, EyeOff, AlertCircle, Zap } from 'lucide-react';
import Logo from "../Assets/jaijcs.jpg"; // Make sure to import your logo
import { useTheme } from '../contexts/ThemeContext';

// Function to decode JWT token
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decoding token:", error);
    return {};
  }
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');

  useEffect(() => {
    if (searchParams.get('sessionExpired') === 'true') {
      setDisplayMessage('Your session has expired. Please log in again.');
    }
    if (searchParams.get('unauthorized') === 'true') {
      setDisplayMessage('Please log in to access this page.');
    }
    if (searchParams.get('registered') === 'true') {
        setDisplayMessage('Registration successful! Please log in.');
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDisplayMessage('');
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('username', formData.username);
      formDataToSend.append('password', formData.password);
      
      const response = await apiClient.post('/token', formDataToSend, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = response.data.access_token;
      
      // Store the token and username
      localStorage.setItem('token', token);
      localStorage.setItem('username', formData.username);
      
      // Decode the JWT token to get the admin status
      const decodedToken = decodeJWT(token);
      console.log("Decoded token:", decodedToken);
      
      // Set the admin status based on the decoded token
      const isAdmin = decodedToken.is_admin === true;
      localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
      
      console.log("Admin status set to:", isAdmin ? 'true' : 'false');
      
      // Navigate to the dashboard after successful login
      navigate('/dashboard');
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 selection:bg-primary/30 selection:text-primary-foreground">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/30 dark:bg-dark-primary/20 rounded-full filter blur-3xl opacity-50 animate-pulse-subtle"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/30 dark:bg-dark-accent/20 rounded-full filter blur-3xl opacity-50 animate-pulse-subtle animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Link to="/landing" className="flex justify-center items-center gap-3 mb-8 group">
            <img src={Logo} alt="JCS AI Logo" className="h-14 w-14 object-contain rounded-2xl shadow-lg transition-all duration-300 group-hover:scale-110" />
            <span className="text-3xl font-bold text-foreground dark:text-dark-foreground group-hover:text-primary dark:group-hover:text-dark-primary transition-colors">JAi Assistant</span>
        </Link>
        
        <div className="bg-card dark:bg-dark-card p-8 sm:p-10 rounded-xl shadow-2xl border border-border dark:border-dark-border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-card-foreground dark:text-dark-card-foreground mb-1">Welcome Back</h1>
            <p className="text-muted-foreground dark:text-dark-muted-foreground">Sign in to continue your journey.</p>
          </div>

          {displayMessage && (
            <div className={`mb-4 border px-4 py-2.5 rounded-md text-sm flex items-center gap-2 ${
                searchParams.get('registered') === 'true' 
                ? 'bg-success/10 border-success/30 text-success dark:text-success/80' 
                : 'bg-primary/10 dark:bg-dark-primary/20 border-primary/30 dark:border-dark-primary/30 text-primary dark:text-dark-primary'
            }`}>
              <Zap size={18} /> {displayMessage}
            </div>
          )}
          {error && (
            <div className="mb-4 bg-destructive/10 dark:bg-dark-destructive/20 border border-destructive/30 dark:border-dark-destructive/30 text-destructive dark:text-dark-destructive px-4 py-2.5 rounded-md text-sm flex items-center gap-2">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User size={18} className="text-muted-foreground dark:text-dark-muted-foreground/70" />
                </span>
                <input
                  type="text" name="username" value={formData.username} onChange={handleChange} required
                  className="input-field pl-10" 
                  placeholder="your_username"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-muted-foreground dark:text-dark-muted-foreground/70" />
                </span>
                <input
                  type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground dark:text-dark-muted-foreground/80 hover:text-primary dark:hover:text-dark-primary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <label className="flex items-center text-muted-foreground dark:text-dark-muted-foreground hover:text-foreground dark:hover:text-dark-foreground cursor-pointer">
                <input type="checkbox" className="h-4 w-4 text-primary dark:text-dark-primary bg-card dark:bg-dark-card border-border dark:border-dark-border rounded focus:ring-ring dark:focus:ring-dark-ring focus:ring-offset-background dark:focus:ring-offset-dark-background mr-2" />
                Remember me
              </label>
              <Link to="/forgot-password" className="font-medium text-primary dark:text-dark-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <button
              type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2.5 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <> <div className="animate-spin h-5 w-5 border-2 border-t-transparent border-current rounded-full"></div> Processing...</>
              ) : ( <><LogIn size={20} /> Sign In</> )}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground dark:text-dark-muted-foreground mt-8">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary dark:text-dark-primary hover:underline">
              Create one now
            </Link>
          </p>
        </div>
      </div>
      <footer className="text-center py-6 text-xs text-muted-foreground dark:text-dark-muted-foreground/70 mt-auto">
        © {new Date().getFullYear()} JCS Assistant. All rights reserved.
      </footer>
    </div>
  );
};
export default Login;