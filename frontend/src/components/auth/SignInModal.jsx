import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

export default function SignInModal({ isOpen, onClose, onOpenSignUp, onComplete }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      alert(t("auth.enterEmailPassword"));
      return;
    }

    setBusy(true);
    setError("");
    try {
      const email = form.email.trim().toLowerCase();
      await onComplete?.({
        email,
        password: form.password,
      });
      onClose?.();
    } catch (submitError) {
      setError(submitError?.message || t("auth.signInFailed", { defaultValue: "Could not sign in." }));
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async (role = "organizer") => {
    setBusy(true);
    setError("");
    try {
      const demoUsers = {
        organizer: {
          accountKey: "demo:organizer",
          email: "demo@example.com",
          username: "demo_organizer",
          displayName: "Organizer Demo",
          primaryRole: "organizer",
        },
        admin: {
          accountKey: "demo:admin",
          email: "demo@example.com",
          username: "demo_admin",
          displayName: "Administrator Demo",
          primaryRole: "admin",
        },
      };

      await onComplete?.(demoUsers[role] || demoUsers.organizer);
      onClose?.();
    } catch (submitError) {
      setError(submitError?.message || t("auth.signInFailed", { defaultValue: "Could not sign in." }));
    } finally {
      setBusy(false);
    }
  };

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div className="auth-modal-overlay" onMouseDown={handleOverlayMouseDown}>
      <div className="auth-modal signin-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label={t("auth.close")}>
          x
        </button>

        <div className="auth-modal-logo">Judgify</div>
        <div className="auth-modal-subtitle">{t("auth.welcomeBack")}</div>
        <div className="auth-modal-caption">
          {t("auth.signInCaption")}
        </div>

        <form className="email-signup-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>{t("auth.email")}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="form-field">
            <label>{t("auth.password")}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>

          <button type="submit" className="create-account-btn" disabled={busy}>
            {busy ? t("auth.signingIn") : t("auth.signInAction")}
          </button>
          {error && <div className="auth-error-message" role="alert">{error}</div>}
        </form>

        <div className="auth-divider">
          <span>{t("auth.or")}</span>
        </div>

        <div className="signin-demo-actions">
          <button className="continue-email-btn" type="button" onClick={() => handleDemoLogin("organizer")} disabled={busy}>
            {t("auth.continueOrganizerDemo")}
          </button>
          <button className="continue-email-btn admin-demo-btn" type="button" onClick={() => handleDemoLogin("admin")} disabled={busy}>
            {t("auth.continueAdminDemo")}
          </button>
        </div>

        <div className="auth-bottom-link">
          {t("auth.noAccount")}{" "}
          <button type="button" className="auth-link-btn" onClick={onOpenSignUp}>
            {t("auth.createAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
