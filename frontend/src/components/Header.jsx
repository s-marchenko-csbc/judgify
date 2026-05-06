import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import AccountSwitcher from "./AccountSwitcher";
import BrandLogo from "./BrandLogo";

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
        <BrandLogo className="app-logo-brand" showText />
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
