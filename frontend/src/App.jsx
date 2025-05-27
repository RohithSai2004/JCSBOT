import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import SessionList from './components/SessionList';
import DocumentHistory from './components/DocumentHistory';
import CodeAudit from './components/CodeAudit';
import CodeGen from './components/CodeGen';

function App() {
  return (
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
  );
}

export default App;
