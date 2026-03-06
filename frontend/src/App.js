import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import VideoList from './components/VideoList';
import Navbar from './components/Navbar';
import './App.css';

function AppContent({ user, onLogin, onLogout }) {
  const navigate = useNavigate();

  const handlePlayVideo = (video) => {
    navigate('/dashboard', { state: { playVideo: video } });
  };

  return (
    <div className="app">
      {user && <Navbar user={user} onLogout={onLogout} />}
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={onLogin} />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup onLogin={onLogin} />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/videos" element={user ? <VideoList user={user} onPlayVideo={handlePlayVideo} /> : <Navigate to="/" />} />
      </Routes>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const handleLogin = (userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <AppContent user={user} onLogin={handleLogin} onLogout={handleLogout} />
    </Router>
  );
}

export default App;
