import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/Login';
import Signup from './Components/Signup';
import Dashboard from './Components/Dashboard';
import SessionList from './Components/SessionList';
import DocumentHistory from './Components/DocumentHistory';
import CodeAudit from './Components/CodeAudit';
import CodeGen from './Components/CodeGen';
import Landing from './Components/Landing/Landing';
import About from './Components/Landing/About';
import { ThemeProvider } from './contexts/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';

function App() {
  return (
     <ThemeProvider>
    <BrowserRouter>

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Landing />} />
        <Route path="/chat/:sessionId" element={<Dashboard />} />
        <Route path="/sessions" element={<SessionList />} />
        <Route path="/documents" element={<DocumentHistory />} />
        <Route path="/code-audit" element={<CodeAudit />} />
        <Route path ="/Landing" element={<Landing />} />
        <Route path="/about" element={<About />} />

        <Route path="/code-generation" element={<CodeGen />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
