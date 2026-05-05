import React, { useState } from "react";

const roleOptions = [
  { id: "organizer", label: "Organizer", icon: "♛" },
  { id: "participant", label: "Participant", icon: "☷" },
  { id: "viewer", label: "Viewer", icon: "◉" },
];

const initialForm = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  primaryRole: "participant",
};

export default function SignUpModal({
  isOpen,
  onClose,
  onOpenSignIn,
  onComplete,
}) {
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setForm(initialForm);
    onClose?.();
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();

    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      alert("Please fill in all required fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    onComplete?.({
      username: form.username,
      email: form.email,
      displayName: form.username,
      primaryRole: form.primaryRole,
    });
  };

  const switchToSignIn = () => {
    setForm(initialForm);
    onOpenSignIn?.();
  };

  return (
    <div className="auth-modal-overlay signup-screen" onClick={handleClose}>
      <div className="auth-modal signup-panel" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={handleClose} aria-label="Close">
          ×
        </button>

        <h2 className="signup-title">Sign Up</h2>

        <form className="signup-form" onSubmit={handleCreateAccount}>
          <div className="signup-field">
            <label>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
              placeholder="Enter your username"
            />
          </div>

          <div className="signup-field">
            <label>Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="Enter your email address"
            />
          </div>

          <div className="signup-field">
            <label>Password</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder="Create your password"
              />
              <button
                type="button"
                className="password-eye-btn"
                onClick={() => setShowPassword((value) => !value)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? "◉" : "◌"}
              </button>
            </div>
          </div>

          <div className="signup-field">
            <label>Confirm your password</label>
            <div className="password-input-wrap">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                placeholder="Confirm your password"
              />
              <button
                type="button"
                className="password-eye-btn"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label="Toggle password visibility"
              >
                {showConfirmPassword ? "◉" : "◌"}
              </button>
            </div>
          </div>

          <div className="signup-role-block">
            <div className="signup-role-label">I want to join as:</div>
            <div className="signup-role-list" role="radiogroup" aria-label="Choose account role">
              {roleOptions.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`signup-role-card ${form.primaryRole === role.id ? "active" : ""}`}
                  onClick={() => handleChange("primaryRole", role.id)}
                  role="radio"
                  aria-checked={form.primaryRole === role.id}
                >
                  <span className="signup-role-icon">{role.icon}</span>
                  <span className="signup-role-name">{role.label}</span>
                  <span className="signup-role-radio" />
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="signup-submit-btn">
            Sign Up
          </button>
        </form>

        <div className="signup-bottom-link">
          Already have an account?{" "}
          <button type="button" className="auth-link-btn" onClick={switchToSignIn}>
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}
