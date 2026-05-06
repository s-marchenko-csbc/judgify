import React, { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AccountSwitcher from "../components/AccountSwitcher";
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  createAdminMessages,
  fetchAdminCompetitions,
  fetchAdminMessages,
  fetchAdminOverview,
  fetchAdminUsers,
  updateAdminCompetition,
  updateAdminUser,
} from "../api/adminApi";

const tabs = [
  { id: "users", labelKey: "admin.tabs.users" },
  { id: "competitions", labelKey: "admin.tabs.competitions" },
  { id: "messages", labelKey: "admin.tabs.messages" },
];

const roleOptions = ["admin", "organizer", "participant", "viewer"];
const competitionStatuses = ["draft", "published", "upcoming", "registration_open", "active", "judging", "finished", "archived"];
const approvalStatuses = ["pending", "approved", "rejected"];
const visibilityModes = ["public", "unlisted", "private"];

function formatDate(value, language) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatGrid({ stats, t }) {
  const items = [
    ["admin.stats.users", stats?.users ?? 0],
    ["admin.stats.activeUsers", stats?.activeUsers ?? 0],
    ["admin.stats.competitions", stats?.competitions ?? 0],
    ["admin.stats.pendingCompetitions", stats?.pendingCompetitions ?? 0],
    ["admin.stats.queuedMessages", stats?.queuedMessages ?? 0],
    ["admin.stats.failedMessages", stats?.failedMessages ?? 0],
  ];
  return (
    <div className="admin-stat-grid">
      {items.map(([labelKey, value]) => (
        <div className="admin-stat" key={labelKey}>
          <span>{t(labelKey)}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function UsersPanel({ users, filters, setFilters, onUpdate, t, language }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2>{t("admin.users.title")}</h2>
        <div className="admin-tools">
          <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder={t("admin.users.search")} />
          <select value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
            <option value="">{t("admin.users.allRoles")}</option>
            {roleOptions.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>{t("admin.users.user")}</th><th>{t("admin.users.role")}</th><th>{t("admin.users.status")}</th><th>{t("admin.users.staff")}</th><th>{t("admin.users.activity")}</th><th /></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.displayName}</strong><span>{user.email || user.username}</span></td>
                <td>
                  <select value={user.primaryRole} onChange={(e) => onUpdate(user.id, { primaryRole: e.target.value })}>
                    {roleOptions.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
                  </select>
                </td>
                <td><button className={`admin-pill ${user.isActive ? "good" : "muted"}`} onClick={() => onUpdate(user.id, { isActive: !user.isActive })}>{user.isActive ? t("admin.users.active") : t("admin.users.inactive")}</button></td>
                <td><button className={`admin-pill ${user.isStaff ? "good" : "muted"}`} onClick={() => onUpdate(user.id, { isStaff: !user.isStaff })}>{user.isStaff ? t("admin.users.staffYes") : t("admin.users.staffNo")}</button></td>
                <td><span>{t("admin.users.competitions", { count: user.competitionsCount })}</span><span>{t("admin.users.requests", { count: user.requestsCount })}</span></td>
                <td><small>{formatDate(user.dateJoined, language)}</small></td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={6}>{t("admin.users.empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompetitionsPanel({ competitions, filters, setFilters, onUpdate, t }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <h2>{t("admin.competitions.title")}</h2>
        <div className="admin-tools">
          <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder={t("admin.competitions.search")} />
          <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="">{t("admin.competitions.allStatuses")}</option>
            {competitionStatuses.map((status) => <option key={status} value={status}>{t(`options.status.${status}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>{t("admin.competitions.competition")}</th><th>{t("admin.competitions.status")}</th><th>{t("admin.competitions.approval")}</th><th>{t("admin.competitions.visibility")}</th><th>{t("admin.competitions.catalog")}</th><th>{t("admin.competitions.results")}</th></tr></thead>
          <tbody>
            {competitions.map((competition) => (
              <tr key={competition.id}>
                <td><strong>{competition.name}</strong><span>{competition.organizers?.join(", ") || t("admin.competitions.noOrganizer")}</span></td>
                <td><select value={competition.status} onChange={(e) => onUpdate(competition.id, { status: e.target.value })}>{competitionStatuses.map((item) => <option key={item} value={item}>{t(`options.status.${item}`)}</option>)}</select></td>
                <td><select value={competition.organizerApprovalStatus} onChange={(e) => onUpdate(competition.id, { organizerApprovalStatus: e.target.value })}>{approvalStatuses.map((item) => <option key={item} value={item}>{t(`options.status.${item}`)}</option>)}</select></td>
                <td><select value={competition.visibilityMode} onChange={(e) => onUpdate(competition.id, { visibilityMode: e.target.value })}>{visibilityModes.map((item) => <option key={item} value={item}>{t(`options.visibility_mode.${item}`)}</option>)}</select></td>
                <td><button className={`admin-pill ${competition.showInCatalog ? "good" : "muted"}`} onClick={() => onUpdate(competition.id, { showInCatalog: !competition.showInCatalog })}>{competition.showInCatalog ? t("admin.competitions.shown") : t("admin.competitions.hidden")}</button></td>
                <td><button className={`admin-pill ${competition.resultsFrozen ? "warn" : "muted"}`} onClick={() => onUpdate(competition.id, { resultsFrozen: !competition.resultsFrozen })}>{competition.resultsFrozen ? t("admin.competitions.frozen") : t("admin.competitions.open")}</button></td>
              </tr>
            ))}
            {!competitions.length && (
              <tr>
                <td colSpan={6}>{t("admin.competitions.empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MessagesPanel({ messages, competitions, onCreate, t }) {
  const emptyDraft = { targetRole: "", recipients: "", competition: "", subject: "", body: "", status: "draft" };
  const [draft, setDraft] = useState(emptyDraft);
  const update = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  return (
    <section className="admin-panel admin-messages-grid">
      <form className="admin-message-form" onSubmit={(event) => { event.preventDefault(); onCreate(draft).then(() => setDraft(emptyDraft)); }}>
        <h2>{t("admin.messages.create")}</h2>
        <div className="admin-form-grid">
          <label>{t("admin.messages.targetRole")}<select value={draft.targetRole} onChange={(e) => update("targetRole", e.target.value)}><option value="">{t("admin.messages.manualRecipients")}</option><option value="all">{t("admin.messages.allUsers")}</option>{roleOptions.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}</select></label>
          <label>{t("admin.messages.competition")}<select value={draft.competition} onChange={(e) => update("competition", e.target.value)}><option value="">{t("admin.messages.noCompetition")}</option>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></label>
          <label>{t("admin.messages.status")}<select value={draft.status} onChange={(e) => update("status", e.target.value)}><option value="queued">{t("admin.messages.queued")}</option><option value="draft">{t("admin.messages.draft")}</option></select></label>
        </div>
        <label>{t("admin.messages.manualRecipients")}<input value={draft.recipients} onChange={(e) => update("recipients", e.target.value)} placeholder={t("admin.messages.recipientsPlaceholder")} /></label>
        <label>{t("admin.messages.subject")}<input value={draft.subject} onChange={(e) => update("subject", e.target.value)} required /></label>
        <label>{t("admin.messages.body")}<textarea value={draft.body} onChange={(e) => update("body", e.target.value)} rows={6} required /></label>
        <button className="admin-primary-btn" type="submit">{t("admin.messages.create")}</button>
      </form>
      <div className="admin-message-list">
        <h2>{t("admin.messages.recent")}</h2>
        {messages.map((message) => (
          <div className="admin-message-item" key={message.id}>
            <strong>{message.subject}</strong>
            <span>{message.recipientEmail} - {message.status}</span>
            <p>{message.competitionName || t("admin.messages.general")}</p>
          </div>
        ))}
        {!messages.length && <p className="admin-empty">{t("admin.messages.empty")}</p>}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("users");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [userFilters, setUserFilters] = useState({ search: "", role: "" });
  const [competitionFilters, setCompetitionFilters] = useState({ search: "", status: "" });
  const [busy, setBusy] = useState(false);

  const canAdmin = Boolean(user?.primaryRole === "admin" || user?.isStaff || user?.isSuperuser);

  const loadOverview = useCallback(async () => setOverview(await fetchAdminOverview()), []);
  const loadUsers = useCallback(async () => setUsers(await fetchAdminUsers(userFilters)), [userFilters]);
  const loadCompetitions = useCallback(async () => setCompetitions(await fetchAdminCompetitions(competitionFilters)), [competitionFilters]);
  const loadMessages = useCallback(async () => setMessages(await fetchAdminMessages()), []);

  useEffect(() => {
    if (!canAdmin) return;
    loadOverview().catch(console.error);
  }, [canAdmin, loadOverview]);

  useEffect(() => {
    if (!canAdmin) return;
    const timer = window.setTimeout(() => loadUsers().catch(console.error), 250);
    return () => window.clearTimeout(timer);
  }, [canAdmin, loadUsers]);

  useEffect(() => {
    if (!canAdmin) return;
    const timer = window.setTimeout(() => loadCompetitions().catch(console.error), 250);
    return () => window.clearTimeout(timer);
  }, [canAdmin, loadCompetitions]);

  useEffect(() => {
    if (!canAdmin) return;
    loadMessages().catch(console.error);
  }, [canAdmin, loadMessages]);

  const updateUser = async (id, payload) => {
    setBusy(true);
    try {
      const updated = await updateAdminUser(id, payload);
      setUsers((prev) => prev.map((item) => (item.id === id ? updated : item)));
      await loadOverview();
    } finally {
      setBusy(false);
    }
  };

  const updateCompetition = async (id, payload) => {
    setBusy(true);
    try {
      const updated = await updateAdminCompetition(id, payload);
      setCompetitions((prev) => prev.map((item) => (item.id === id ? updated : item)));
      await loadOverview();
    } finally {
      setBusy(false);
    }
  };

  const createMessages = async (draft) => {
    setBusy(true);
    try {
      await createAdminMessages({
        ...draft,
        recipientEmails: draft.recipients,
        competition: draft.competition || undefined,
      });
      await Promise.all([loadMessages(), loadOverview()]);
    } finally {
      setBusy(false);
    }
  };

  let body = <UsersPanel users={users} filters={userFilters} setFilters={setUserFilters} onUpdate={updateUser} t={t} language={language} />;
  if (activeTab === "competitions") {
    body = <CompetitionsPanel competitions={competitions} filters={competitionFilters} setFilters={setCompetitionFilters} onUpdate={updateCompetition} t={t} />;
  }
  if (activeTab === "messages") {
    body = <MessagesPanel messages={messages} competitions={competitions} onCreate={createMessages} t={t} />;
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!canAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <button className="profile-back-btn" type="button" onClick={() => navigate(-1)}>{"<"}</button>
        <button className="profile-logo-link" type="button" onClick={() => navigate("/")}><BrandLogo className="profile-logo-brand" showText /></button>
        <div><h1>{t("admin.title")}</h1><p>{t("admin.subtitle")}</p></div>
        <AccountSwitcher compact />
      </header>
      <main className="admin-shell">
        <StatGrid stats={overview?.stats} t={t} />
        <nav className="admin-tabs">
          {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{t(tab.labelKey)}</button>)}
        </nav>
        {busy && <div className="admin-busy">{t("admin.saving")}</div>}
        {body}
      </main>
    </div>
  );
}
