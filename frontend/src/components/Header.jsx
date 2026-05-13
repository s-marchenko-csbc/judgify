import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import AccountSwitcher from "./AccountSwitcher";
import BrandLogo from "./BrandLogo";
import SignUpModal from "./SignUpModal";
import SignInModal from "./auth/SignInModal";
import OnboardModal from "./auth/OnboardModal";

export default function Header({
  search,
  onSearchChange,
  onOpenSignUp,
  onOpenSignIn,
  showSearch,
}) {
  const { isAuthenticated, login } = useAuth();
  const { language, setLanguage, supportedLanguages, t } = useLanguage();
  const shouldShowSearch = Boolean(showSearch || onSearchChange);
  const [localAuthStep, setLocalAuthStep] = useState(null);
  const [pendingSignUpData, setPendingSignUpData] = useState(null);

  const openSignUp = () => {
    if (onOpenSignUp) {
      onOpenSignUp();
      return;
    }
    setLocalAuthStep("signup");
  };

  const openSignIn = () => {
    if (onOpenSignIn) {
      onOpenSignIn();
      return;
    }
    setLocalAuthStep("signin");
  };

  const closeLocalAuth = () => setLocalAuthStep(null);

  const handleLocalSignUpComplete = (data) => {
    setPendingSignUpData(data || null);
    setLocalAuthStep("onboard");
  };

  const handleLocalSignInComplete = async (credentials) => {
    await login(credentials);
    setLocalAuthStep(null);
  };

  const handleLocalFinishOnboarding = async (data) => {
    try {
      await login({
        ...(pendingSignUpData || {}),
        interests: data?.interests || [],
        createTeam: data?.createTeam || false,
      });
      setPendingSignUpData(null);
      setLocalAuthStep(null);
    } catch (error) {
      alert(error?.message || t("auth.registrationFailed", { defaultValue: "Could not create account." }));
    }
  };

  return (
    <>
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
            <button className="auth-btn" type="button" onClick={openSignUp}>
              {t("header.signUp")}
            </button>
            <button className="auth-btn" type="button" onClick={openSignIn}>
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

    {localAuthStep === "signup" && (
      <SignUpModal
        isOpen={true}
        onClose={closeLocalAuth}
        onOpenSignIn={() => setLocalAuthStep("signin")}
        onComplete={handleLocalSignUpComplete}
      />
    )}

    {localAuthStep === "signin" && (
      <SignInModal
        isOpen={true}
        onClose={closeLocalAuth}
        onOpenSignUp={() => setLocalAuthStep("signup")}
        onComplete={handleLocalSignInComplete}
      />
    )}

    {localAuthStep === "onboard" && <OnboardModal onFinish={handleLocalFinishOnboarding} />}
    </>
  );
}
