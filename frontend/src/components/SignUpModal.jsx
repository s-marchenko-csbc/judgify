import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const roleOptions = [
  { id: "organizer", labelKey: "roles.organizer", icon: "O" },
  { id: "participant", labelKey: "roles.participant", icon: "P" },
  { id: "viewer", labelKey: "roles.viewer", icon: "V" },
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
  const { t } = useLanguage();
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
      alert(t("auth.fillRequired"));
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert(t("auth.passwordsMismatch"));
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
        <button className="auth-modal-close" onClick={handleClose} aria-label={t("auth.close")}>
          x
        </button>

        <h2 className="signup-title">{t("auth.signUpTitle")}</h2>

        <form className="signup-form" onSubmit={handleCreateAccount}>
          <div className="signup-field">
            <label>{t("auth.username")}</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
            />
          </div>

          <div className="signup-field">
            <label>{t("auth.emailAddress")}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
            />
          </div>

          <div className="signup-field">
            <label>{t("auth.password")}</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder={t("auth.createPassword")}
              />
              <button
                type="button"
                className="password-eye-btn"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={t("auth.togglePassword")}
              >
                {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              </button>
            </div>
          </div>

          <div className="signup-field">
            <label>{t("auth.confirmPasswordLabel")}</label>
            <div className="password-input-wrap">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                placeholder={t("auth.confirmPassword")}
              />
              <button
                type="button"
                className="password-eye-btn"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={t("auth.togglePassword")}
              >
                {showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              </button>
            </div>
          </div>

          <div className="signup-role-block">
            <div className="signup-role-label">{t("auth.rolePrompt")}</div>
            <div className="signup-role-list" role="radiogroup" aria-label={t("auth.chooseRole")}>
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
                  <span className="signup-role-name">{t(role.labelKey)}</span>
                  <span className="signup-role-radio" />
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="signup-submit-btn">
            {t("header.signUp")}
          </button>
        </form>

        <div className="signup-bottom-link">
          {t("auth.alreadyHaveAccount")}{" "}
          <button type="button" className="auth-link-btn" onClick={switchToSignIn}>
            {t("auth.logIn")}
          </button>
        </div>
      </div>
    </div>
  );
}
