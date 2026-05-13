import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { fetchProfileDashboard } from "../api/profileApi";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const demoAccounts = [
  {
    accountKey: "demo:organizer",
    email: "demo@example.com",
    username: "demo_organizer",
    displayName: "Organizer Demo",
    primaryRole: "organizer",
  },
  {
    accountKey: "demo:participant",
    email: "demo@example.com",
    username: "demo_participant",
    displayName: "Participant Demo",
    primaryRole: "participant",
  },
  {
    accountKey: "demo:viewer",
    email: "demo@example.com",
    username: "demo_viewer",
    displayName: "Viewer Demo",
    primaryRole: "viewer",
  },
  {
    accountKey: "demo:admin",
    email: "demo@example.com",
    username: "demo_admin",
    displayName: "Administrator Demo",
    primaryRole: "admin",
  },
];

function uniqueAccounts(accounts) {
  const seen = new Set();
  return accounts.filter((account) => {
    const email = (account.email || "").trim().toLowerCase();
    const role = (account.primaryRole || "participant").trim().toLowerCase();
    const username = (account.username || "").trim().toLowerCase();
    const accountKey = String(account.accountKey || "");
    const identityKeys = [
      email ? `email:${email}:role:${role}` : "",
      username ? `username:${username}` : "",
      accountKey || "",
      account.displayName ? `name:${String(account.displayName).trim().toLowerCase()}:role:${role}` : "",
    ].filter(Boolean);
    if (!identityKeys.length || identityKeys.some((key) => seen.has(key))) return false;
    identityKeys.forEach((key) => seen.add(key));
    return true;
  });
}

function initials(user, t) {
  const label = user?.displayName || user?.username || user?.email || t("account.user");
  return label.slice(0, 1).toUpperCase();
}

function avatarUrl(user) {
  return user?.avatarUrl || user?.avatar_url || user?.avatar?.url || user?.profile?.avatar_url || "";
}

function Avatar({ user, t, className = "account-avatar" }) {
  const url = avatarUrl(user);
  if (url) return <img className={className} src={url} alt="" />;
  return <span className={className}>{initials(user, t)}</span>;
}

function AccountMenu({ user, canAdmin, notifications = [], onAdmin, onProfile, onSwitchAccount, onLogout, style, menuRef, t }) {
  const switchableAccounts = uniqueAccounts([...(user ? [user] : []), ...demoAccounts]);
  const roleLabel = (role) => t(`roles.${role || "participant"}`, { defaultValue: role || "participant" });
  const notificationTitle = (item) => {
    const labels = {
      score: t("notifications.score", { defaultValue: "Work scored" }),
      submission: t("notifications.submission", { defaultValue: "New or updated submission" }),
      join_request_pending: t("notifications.joinRequestPending", { defaultValue: "Pending application" }),
      competition_creation_request: t("notifications.competitionApproval", { defaultValue: "Competition approval pending" }),
      judge_assignment: t("notifications.judgeAssignment", { defaultValue: "Judge assignment" }),
      join_request: t("notifications.joinRequest", { defaultValue: "Application status updated" }),
      message: t("notifications.message", { defaultValue: "Message" }),
    };
    return labels[item.type] || item.title;
  };

  return (
    <div className="account-menu account-menu-portal" style={style} ref={menuRef}>
      <div className="account-menu-current">
        <Avatar user={user} t={t} className="account-avatar-large" />
        <div>
          <strong>{user?.displayName || user?.username || t("account.currentUser")}</strong>
          <span>{user?.email}</span>
          <small>{roleLabel(user?.primaryRole)}</small>
        </div>
      </div>

      <button type="button" className="account-profile-link" onClick={onProfile}>
        {t("account.openProfile")}
      </button>
      {canAdmin && (
        <button type="button" className="account-profile-link secondary" onClick={onAdmin}>
          {t("account.adminPanel", { defaultValue: "Admin panel" })}
        </button>
      )}

      <div className="account-menu-divider" />
      <span className="account-menu-caption">{t("profile.latestNotifications", { defaultValue: "Latest notifications" })}</span>
      <div className="account-notification-list">
        {notifications.length === 0 ? (
          <small>{t("profile.noNotifications", { defaultValue: "No account notifications yet." })}</small>
        ) : notifications.slice(0, 3).map((item) => (
          <button
            type="button"
            className="account-notification-row"
            key={item.id}
            onClick={() => item.competition_id && window.location.assign(`/competitions/${item.competition_id}`)}
          >
            <strong>{notificationTitle(item)}</strong>
            <span>{item.competition_name || item.text || item.status}</span>
          </button>
        ))}
      </div>

      <div className="account-menu-divider" />
      <span className="account-menu-caption">{t("account.switchAccount")}</span>
      {switchableAccounts.map((account) => {
        const accountEmail = (account.email || "").trim().toLowerCase();
        const userEmail = (user?.email || "").trim().toLowerCase();
        const accountRole = account.primaryRole || "participant";
        const userRole = user?.primaryRole || "participant";
        const isCurrent =
          account.accountKey === user?.accountKey ||
          (account.id && account.id === user?.id) ||
          (accountEmail && accountEmail === userEmail && accountRole === userRole);
        const isDemoAccount = String(account.accountKey || "").startsWith("demo:");
        const requiresPassword = !isCurrent && !isDemoAccount;
        return (
          <button
            type="button"
            className={`account-switch-row ${isCurrent ? "active" : ""}`}
            key={account.accountKey || account.username}
            onClick={() => onSwitchAccount(account)}
            disabled={requiresPassword}
            title={requiresPassword ? t("account.signInRequired", { defaultValue: "Sign in with password to switch to this account." }) : undefined}
          >
            <span>{account.displayName.slice(0, 1)}</span>
            <div>
              <strong>{account.displayName}</strong>
              <small>{requiresPassword ? t("account.signInRequired", { defaultValue: "Sign in with password to switch to this account." }) : `${roleLabel(account.primaryRole)} - ${account.email}`}</small>
            </div>
            {isCurrent && <em>OK</em>}
          </button>
        );
      })}

      <div className="account-menu-divider" />
      <button type="button" className="account-logout-btn" onClick={onLogout}>
        {t("account.signOut")}
      </button>
    </div>
  );
}

export default function AccountSwitcher({ compact = false }) {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const canAdmin = Boolean(user?.primaryRole === "admin" || user?.isStaff || user?.isSuperuser);

  const updateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 310;
    const margin = 12;
    const left = Math.min(window.innerWidth - width - margin, Math.max(margin, rect.right - width));
    setMenuStyle({
      position: "fixed",
      top: `${rect.bottom + 10}px`,
      left: `${left}px`,
      width: `${width}px`,
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handleClick = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleLayout = () => updateMenuPosition();
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !user) {
      setNotifications([]);
      return undefined;
    }
    let cancelled = false;
    fetchProfileDashboard()
      .then((dashboard) => {
        if (!cancelled) setNotifications(dashboard?.notifications || []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });
    return () => { cancelled = true; };
  }, [open, user?.id, user?.accountKey]);

  const switchAccount = async (account) => {
    if (!String(account.accountKey || "").startsWith("demo:")) {
      return;
    }
    await login(account);
    setOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    navigate("/");
  };

  const handleProfile = () => {
    navigate("/profile");
    setOpen(false);
  };

  const handleAdmin = () => {
    navigate("/admin");
    setOpen(false);
  };

  return (
    <div className={`account-switcher ${compact ? "compact" : ""}`}>
      <button
        className="profile-btn account-trigger"
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((value) => !value)}
        title={t("account.accountMenu")}
        aria-label={t("account.accountMenu")}
      >
        <Avatar user={user} t={t} />
      </button>

      {open && createPortal(
        <AccountMenu
          user={user}
          canAdmin={canAdmin}
          notifications={notifications}
          style={menuStyle}
          menuRef={menuRef}
          onAdmin={handleAdmin}
          onProfile={handleProfile}
          onSwitchAccount={switchAccount}
          onLogout={handleLogout}
          t={t}
        />,
        document.body
      )}
    </div>
  );
}
