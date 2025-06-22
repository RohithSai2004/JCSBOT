import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AnimatePresence } from 'framer-motion';

// --- Page & Layout Imports ---
import Login from './Components/Login';
import Signup from './Components/Signup';
import Dashboard from './Components/Dashboard';
import SessionList from './Components/SessionList';
import DocumentHistory from './Components/DocumentHistory';
import CodeAudit from './Components/CodeAudit';
import CodeGen from './Components/CodeGen';
import Landing from './Components/Landing/Landing';
import About from './Components/Landing/About';
import CompanyFAQ from './Components/CompanyFAQ';

// --- Admin Component Imports ---
import AdminPanel from './Components/AdminPanel';
import AdminUsers from './Components/Admin/AdminUsers';
import AdminUsage from './Components/Admin/AdminUsage';
import AdminKnowledge from './Components/Admin/AdminKnowledge';
import AdminDashboard from './Components/Admin/AdminDashboard';

// --- Security ---
// Import the guard component from its own file
import ProtectedRoute from './Components/ProtectedRoute';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AnimatePresence mode="wait">
          <Routes>
            {/* --- Public Routes --- */}
            {/* Landing page is now the default route */}
            <Route path="/" element={<Landing />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* --- Standard Authenticated Routes --- */}
            {/* Dashboard is now at /dashboard instead of / */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/chat/:sessionId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute><SessionList /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentHistory /></ProtectedRoute>} />
            <Route path="/code-audit" element={<ProtectedRoute><CodeAudit /></ProtectedRoute>} />
            <Route path="/code-generation" element={<ProtectedRoute><CodeGen /></ProtectedRoute>} />
            <Route path="/company-faq" element={<ProtectedRoute><CompanyFAQ /></ProtectedRoute>} />
            
            {/* --- SECURE ADMIN ROUTING --- */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminPanel />
                </ProtectedRoute>
              } 
            >
              <Route index element={<AdminDashboard />} /> 
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="usage" element={<AdminUsage />} />
              <Route path="knowledge" element={<AdminKnowledge />} />
            </Route>
            
          </Routes>
        </AnimatePresence>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;