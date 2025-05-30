// frontend/src/Components/Signup.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { UserPlus, User, Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import Logo from "../Assets/jaijcs.jpg";
import { useTheme } from '../contexts/ThemeContext';

const Signup = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', confirmPassword: '', full_name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
    }
    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('username', formData.username);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('full_name', formData.full_name);
      await apiClient.post('/register', formDataToSend, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login?registered=true');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Username or email might already be taken.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-8 selection:bg-primary/30 selection:text-primary-foreground">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-1/3 -right-1/4 w-1/2 h-1/2 bg-accent/30 dark:bg-dark-accent/20 rounded-full filter blur-3xl opacity-50 animate-pulse-subtle animation-delay-1000"></div>
        <div className="absolute -bottom-1/3 -left-1/4 w-1/2 h-1/2 bg-primary/30 dark:bg-dark-primary/20 rounded-full filter blur-3xl opacity-50 animate-pulse-subtle animation-delay-3000"></div>
      </div>
      <div className="relative z-10 w-full max-w-md">
        <Link to="/landing" className="flex justify-center items-center gap-3 mb-8 group">
            <img src={Logo} alt="JCS AI Logo" className="h-14 w-14 object-contain rounded-2xl shadow-lg transition-all duration-300 group-hover:scale-110" />
            <span className="text-3xl font-bold text-foreground dark:text-dark-foreground group-hover:text-primary dark:group-hover:text-dark-primary transition-colors">JAI Assistant</span>
        </Link>
        <div className="bg-card dark:bg-dark-card p-8 sm:p-10 rounded-xl shadow-2xl border border-border dark:border-dark-border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-card-foreground dark:text-dark-card-foreground mb-1">Create an Account</h1>
            <p className="text-muted-foreground dark:text-dark-muted-foreground">Get started with your intelligent assistant.</p>
          </div>

          {error && (
            <div className="mb-4 bg-destructive/10 dark:bg-dark-destructive/20 border border-destructive/30 dark:border-dark-destructive/30 text-destructive dark:text-dark-destructive px-4 py-2.5 rounded-md text-sm flex items-center gap-2">
              <AlertCircle size={18}/> {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-success/10 dark:bg-success/20 border border-success/30 dark:border-success/30 text-success dark:text-success/90 px-4 py-2.5 rounded-md text-sm flex items-center gap-2">
              <CheckCircle2 size={18}/> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1.5">Full Name</label>
              <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><User size={18} className="text-muted-foreground dark:text-dark-muted-foreground/70" /></span>
                  <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required
                      className="input-field pl-10" placeholder="Your Full Name" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1.5">Username</label>
               <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><UserCircle size={18} className="text-muted-foreground dark:text-dark-muted-foreground/70" /></span>
                  <input type="text" name="username" value={formData.username} onChange={handleChange} required
                      className="input-field pl-10" placeholder="Choose a unique username" />
              </div>
            </div>
             <div>
              <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1.5">Email</label>
              <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail size={18} className="text-muted-foreground dark:text-dark-muted-foreground/70" /></span>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required
                      className="input-field pl-10" placeholder="your.email@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Lock size={18} className="text-muted-foreground dark:text-dark-muted-foreground/70" /></span>
                  <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} required minLength={6}
                      className="input-field pl-10 pr-10" placeholder="Create a strong password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground dark:text-dark-muted-foreground/80 hover:text-primary dark:hover:text-dark-primary">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground dark:text-dark-muted-foreground mb-1.5">Confirm Password</label>
              <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Lock size={18} className="text-muted-foreground dark:text-dark-muted-foreground/70" /></span>
                  <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required
                      className="input-field pl-10 pr-10" placeholder="Re-type your password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground dark:text-dark-muted-foreground/80 hover:text-primary dark:hover:text-dark-primary">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading || success}
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2.5 mt-2 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <> <div className="animate-spin h-5 w-5 border-2 border-t-transparent border-current rounded-full"></div> Creating Account...</>
              ) : ( <><UserPlus size={20} /> Sign Up</> )}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground dark:text-dark-muted-foreground mt-8">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary dark:text-dark-primary hover:underline">
              Log In
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
export default Signup;
