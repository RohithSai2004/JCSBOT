import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Components/Login';
import Signup from './Components/Signup';
import Dashboard from './Components/Dashboard';
import Chat from './Components/Chat';
import DocumentHistory from './Components/DocumentHistory';
import CodeAudit from './Components/CodeAudit';
import CodeGen from './Components/CodeGen';
import Landing from './Components/Landing/Landing';
import About from './Components/Landing/About';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/documents" element={<DocumentHistory />} />
                <Route path="/code-audit" element={<CodeAudit />} />
                <Route path="/code-generation" element={<CodeGen />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/about" element={<About />} />
            </Routes>
        </Router>
    );
}

export default App;
