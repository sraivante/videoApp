import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Settings from './Settings';

function Navbar({ user, onLogout }) {
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  // Close the burger menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close the burger menu when clicking outside of it
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left" ref={menuRef}>
          <button
            className={`burger-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="Menu"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <button
            className="home-btn"
            onClick={() => navigate('/dashboard')}
            title="Home"
            aria-label="Home"
          >
            &#127968;
          </button>
          <div className="navbar-brand">VideoApp</div>
          <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
            <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link to="/videos" className={`nav-link ${location.pathname === '/videos' ? 'active' : ''}`}>
              My Videos
            </Link>
          </div>
        </div>
        <div className="navbar-user">
          <span>{user.name || user.email}</span>
          <button
            className="settings-icon-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Settings"
          >
            &#9881;
          </button>
        </div>
      </nav>
      {showSettings && (
        <Settings
          user={user}
          onLogout={onLogout}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

export default Navbar;
