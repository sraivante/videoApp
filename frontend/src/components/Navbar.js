import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChangePassword from './ChangePassword';

function Navbar({ user, onLogout }) {
  const [showChangePassword, setShowChangePassword] = useState(false);
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
          <button className="btn btn-secondary btn-sm" onClick={() => setShowChangePassword(true)}>
            Change Password
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Logout</button>
        </div>
      </nav>
      {showChangePassword && <ChangePassword onClose={() => setShowChangePassword(false)} />}
    </>
  );
}

export default Navbar;
