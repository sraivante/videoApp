import React from 'react';

function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">VideoApp</div>
      <div className="navbar-user">
        <span>{user.name || user.email}</span>
        <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  );
}

export default Navbar;
