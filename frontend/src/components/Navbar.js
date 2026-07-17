import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Settings from './Settings';

function Navbar({ user, onLogout }) {
  const [showSettings, setShowSettings] = useState(false);
  const location = useLocation();

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <div className="navbar-brand">VideoApp</div>
          <div className="navbar-links">
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
