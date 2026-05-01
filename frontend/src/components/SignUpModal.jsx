import React, { useState } from "react";

export default function SignUpModal({
  isOpen,
  onClose,
  onOpenSignIn,
  onComplete,
}) {
  const [step, setStep] = useState("entry");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    country: "",
    agree: false,
  });

  if (!isOpen) return null;

  const stopPropagation = (e) => e.stopPropagation();

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    setStep("entry");
    setForm({
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
      country: "",
      agree: false,
    });
    onClose();
  };

  const handleBackToEntry = () => {
    setStep("entry");
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();

    if (
      !form.email ||
      !form.password ||
      !form.confirmPassword ||
      !form.displayName ||
      !form.country
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (!form.agree) {
      alert("You need to accept Terms & Privacy.");
      return;
    }

    onComplete?.();
  };

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal signup-modal" onClick={stopPropagation}>
        <button
          className="auth-modal-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ×
        </button>

        {step === "entry" && (
          <>
            <div className="auth-modal-logo">Judgify</div>
            <div className="auth-modal-subtitle">Compete. Judge. Organize.</div>
            <div className="auth-modal-caption">Get started instantly</div>

            <div className="social-auth-list">
              <button className="social-auth-btn" type="button">
                <span className="social-auth-icon google">G</span>
                <span>Continue with Google</span>
              </button>

              <button className="social-auth-btn" type="button">
                <span className="social-auth-icon github">◉</span>
                <span>Continue with GitHub</span>
              </button>

              <button className="social-auth-btn" type="button">
                <span className="social-auth-icon linkedin">in</span>
                <span>Continue with LinkedIn</span>
              </button>

              <button className="social-auth-btn" type="button">
                <span className="social-auth-icon facebook">f</span>
                <span>Continue with Facebook</span>
              </button>
            </div>

            <div className="auth-divider">
              <span>OR</span>
            </div>

            <button
              className="continue-email-btn"
              type="button"
              onClick={() => setStep("email")}
            >
              Continue with email →
            </button>

            <div className="auth-bottom-link">
              Already have an account?{" "}
              <button
                type="button"
                className="auth-link-btn"
                onClick={onOpenSignIn}
              >
                Log in
              </button>
            </div>
          </>
        )}

        {step === "email" && (
          <>
            <div className="auth-modal-logo">Judgify</div>

            <div className="email-signup-card">
              <div className="email-signup-title">
                Create your Judgify account
              </div>

              <form className="email-signup-form" onSubmit={handleCreateAccount}>
                <div className="form-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="Email"
                  />
                </div>

                <div className="form-field">
                  <label>Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="Password"
                  />
                </div>

                <div className="form-field">
                  <label>Confirm password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      handleChange("confirmPassword", e.target.value)
                    }
                    placeholder="Confirm password"
                  />
                </div>

                <div className="form-field">
                  <label>Display name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) =>
                      handleChange("displayName", e.target.value)
                    }
                    placeholder="Display name"
                  />
                </div>

                <div className="form-field">
                  <label>Country</label>
                  <select
                    value={form.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                  >
                    <option value="">Select country</option>
                    <option value="Ukraine">Ukraine</option>
                    <option value="Poland">Poland</option>
                    <option value="Germany">Germany</option>
                    <option value="Latvia">Latvia</option>
                    <option value="USA">USA</option>
                  </select>
                </div>

                <label className="terms-checkbox">
                  <input
                    type="checkbox"
                    checked={form.agree}
                    onChange={(e) => handleChange("agree", e.target.checked)}
                  />
                  <span>
                    I agree to{" "}
                    <button
                      type="button"
                      className="auth-link-btn inline-link"
                    >
                      Terms
                    </button>{" "}
                    &{" "}
                    <button
                      type="button"
                      className="auth-link-btn inline-link"
                    >
                      Privacy
                    </button>
                  </span>
                </label>

                <button type="submit" className="create-account-btn">
                  Create account
                </button>
              </form>

              <div className="email-signup-footer">
                <button
                  type="button"
                  className="back-btn"
                  onClick={handleBackToEntry}
                >
                  ← Back
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}