import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/Login';
import Signup from './Components/Signup';
import Dashboard from './components/Dashboard';
import SessionList from './components/SessionList';
import DocumentHistory from './components/DocumentHistory';
import CodeAudit from './components/CodeAudit';
import CodeGen from './components/CodeGen';
import { ThemeProvider } from './contexts/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';

function App() {
  return (
     <ThemeProvider>
    <BrowserRouter>

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat/:sessionId" element={<Dashboard />} />
        <Route path="/sessions" element={<SessionList />} />
        <Route path="/documents" element={<DocumentHistory />} />
        <Route path="/code-audit" element={<CodeAudit />} />
        
        <Route path="/code-generation" element={<CodeGen />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
