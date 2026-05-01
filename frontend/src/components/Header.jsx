import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header({
  search,
  onSearchChange,
  onOpenSignUp,
  onOpenSignIn,
}) {
  const { user, logout } = useAuth();
  const isAuthenticated = Boolean(user);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="landing-header">
      <div className="menu-btn">---</div>

      <div className="search-wrap">
        <input
          className="search-input"
          type="text"
          placeholder="Search"
          value={search || ""}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>

      <div className="header-actions">
        <button className="lang-btn">🌐 en</button>

        {!isAuthenticated ? (
          <div className="auth-actions-group">
            <button className="auth-btn" onClick={onOpenSignUp}>
              Sign Up
            </button>
            <button className="auth-btn" onClick={onOpenSignIn}>
              Sign In
            </button>
          </div>
        ) : (
          <div className="avatar-menu-wrapper">
            <button
              className="profile-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {user?.displayName?.[0] || "👤"}
            </button>

            {menuOpen && (
              <div className="account-dropdown">
                <Link to="/profile">Profile</Link>
                <button onClick={logout}>Logout</button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}