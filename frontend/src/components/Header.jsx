import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import AccountSwitcher from "./AccountSwitcher";

export default function Header({
  search,
  onSearchChange,
  onOpenSignUp,
  onOpenSignIn,
  showSearch,
}) {
  const { isAuthenticated } = useAuth();
  const { language, setLanguage, supportedLanguages, t } = useLanguage();
  const shouldShowSearch = Boolean(showSearch || onSearchChange);

  return (
    <header className="landing-header">
      <Link className="app-logo-link" to="/" aria-label={t("header.goHome")}>
        <span className="app-logo-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="img" focusable="false">
            <path d="M19 10c-5.1 3.4-8.1 8.9-8.1 15.1 0 8.6 6 14.1 13.5 21l7.6 7 7.6-7c7.5-6.9 13.5-12.4 13.5-21 0-6.2-3-11.7-8.1-15.1-4.8-3.2-11.5-2.5-15.2 1.7L32 13.6l1.7-1.9C30 7.5 23.8 6.8 19 10Z" />
            <path d="M22.3 19.5c-2 1.5-3.1 3.7-3.1 6.2 0 4 2.9 6.7 7.2 10.6l5.6 5.1 5.6-5.1c4.3-3.9 7.2-6.6 7.2-10.6 0-2.5-1.1-4.7-3.1-6.2-2.4-1.8-5.7-1.5-7.7.7L32 22.4l-2-2.2c-2-2.2-5.3-2.5-7.7-.7Z" />
          </svg>
        </span>
        <span className="app-logo-text">Judgify</span>
      </Link>

      {shouldShowSearch ? (
        <div className="search-wrap">
          <input
            className="search-input"
            type="text"
            placeholder={t("header.search")}
            value={search || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      ) : (
        <div className="header-spacer" aria-hidden="true" />
      )}

      <div className="header-actions">
        <div className="language-switcher" aria-label={t("header.language")}>
          {supportedLanguages.map((item) => (
            <button
              key={item.code}
              type="button"
              className={`lang-btn ${language === item.code ? "active" : ""}`}
              onClick={() => setLanguage(item.code)}
              aria-pressed={language === item.code}
              title={item.name}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!isAuthenticated ? (
          <div className="auth-actions-group">
            <button className="auth-btn" onClick={onOpenSignUp}>
              {t("header.signUp")}
            </button>
            <button className="auth-btn" onClick={onOpenSignIn}>
              {t("header.signIn")}
            </button>
          </div>
        ) : (
          <div className="signed-header-actions">
            <Link className="profile-direct-link" to="/profile">{t("header.profile")}</Link>
            <AccountSwitcher />
          </div>
        )}
      </div>
    </header>
  );
}
