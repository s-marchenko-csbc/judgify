import React, { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AccountSwitcher from "../components/AccountSwitcher";
import BrandLogo from "../components/BrandLogo";
import PaginationControls, { usePagination } from "../components/Pagination";
import { clearLandingFiltersCache } from "../api/landingApi";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  createAdminFilter,
  deleteAdminCompetition,
  deleteAdminUser,
  fetchAdminCompetitions,
  fetchAdminFilters,
  fetchAdminOverview,
  fetchAdminUsers,
  updateAdminCompetition,
  updateAdminFilter,
  updateAdminSettings,
  updateAdminUser,
} from "../api/adminApi";

const tabs = [
  { id: "users", labelKey: "admin.tabs.users" },
  { id: "competitions", labelKey: "admin.tabs.competitions" },
  { id: "filters", labelKey: "admin.tabs.filters" },
  { id: "server", labelKey: "admin.tabs.server" },
];

const roleOptions = ["admin", "organizer", "participant", "viewer"];
const competitionStatuses = ["draft", "published", "upcoming", "registration_open", "active", "judging", "finished", "archived"];
const approvalStatuses = ["pending", "approved", "rejected"];
const visibilityModes = ["public", "unlisted", "private"];
const filterGroups = ["event_type", "participation_type", "industry", "difficulty", "language", "access_mode"];

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
    ["admin.stats.activeCompetitions", stats?.activeCompetitions ?? 0],
    ["admin.stats.draftCompetitions", stats?.draftCompetitions ?? 0],
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

function UsersPanel({ users, filters, setFilters, onUpdate, onDelete, t, language }) {
  const pagination = usePagination(users, 8, `${filters.search}|${filters.role}`);

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
          <thead><tr><th>{t("admin.users.user")}</th><th>{t("admin.users.role")}</th><th>{t("admin.users.status")}</th><th>{t("admin.users.staff")}</th><th>{t("admin.users.activity")}</th><th>{t("admin.actions")}</th></tr></thead>
          <tbody>
            {pagination.pageItems.map((user) => (
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
                <td>
                  <small>{formatDate(user.dateJoined, language)}</small>
                  <button className="admin-pill danger" type="button" onClick={() => onDelete(user)}>{t("admin.delete")}</button>
                </td>
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
      <PaginationControls pagination={pagination} t={t} />
    </section>
  );
}

function CompetitionsPanel({ competitions, filters, setFilters, onUpdate, onDelete, t }) {
  const pagination = usePagination(competitions, 8, `${filters.search}|${filters.status}`);

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
          <thead><tr><th>{t("admin.competitions.competition")}</th><th>{t("admin.competitions.status")}</th><th>{t("admin.competitions.approval")}</th><th>{t("admin.competitions.visibility")}</th><th>{t("admin.competitions.catalog")}</th><th>{t("admin.actions")}</th></tr></thead>
          <tbody>
            {pagination.pageItems.map((competition) => (
              <tr key={competition.id}>
                <td><strong>{competition.name}</strong><span>{competition.organizers?.join(", ") || t("admin.competitions.noOrganizer")}</span></td>
                <td><select value={competition.status} onChange={(e) => onUpdate(competition.id, { status: e.target.value })}>{competitionStatuses.map((item) => <option key={item} value={item}>{t(`options.status.${item}`)}</option>)}</select></td>
                <td><select value={competition.organizerApprovalStatus} onChange={(e) => onUpdate(competition.id, { organizerApprovalStatus: e.target.value })}>{approvalStatuses.map((item) => <option key={item} value={item}>{t(`options.status.${item}`)}</option>)}</select></td>
                <td><select value={competition.visibilityMode} onChange={(e) => onUpdate(competition.id, { visibilityMode: e.target.value })}>{visibilityModes.map((item) => <option key={item} value={item}>{t(`options.visibility_mode.${item}`)}</option>)}</select></td>
                <td><button className={`admin-pill ${competition.showInCatalog ? "good" : "muted"}`} onClick={() => onUpdate(competition.id, { showInCatalog: !competition.showInCatalog })}>{competition.showInCatalog ? t("admin.competitions.shown") : t("admin.competitions.hidden")}</button></td>
                <td>
                  <button className={`admin-pill ${competition.resultsFrozen ? "warn" : "muted"}`} onClick={() => onUpdate(competition.id, { resultsFrozen: !competition.resultsFrozen })}>{competition.resultsFrozen ? t("admin.competitions.frozen") : t("admin.competitions.open")}</button>
                  <button className="admin-pill danger" type="button" onClick={() => onDelete(competition)}>{t("admin.delete")}</button>
                </td>
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
      <PaginationControls pagination={pagination} t={t} />
    </section>
  );
}

function formatUptime(seconds = 0, t) {
  const value = Number(seconds) || 0;
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days > 0) return t("admin.server.uptimeDays", { days, hours });
  if (hours > 0) return t("admin.server.uptimeHours", { hours, minutes });
  return t("admin.server.uptimeMinutes", { minutes });
}

function metricValue(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function ServerPanel({ server, onRefresh, t, language }) {
  const memory = server?.memory || {};
  const disk = server?.disk || {};
  const loadAverage = Array.isArray(server?.loadAverage) && server.loadAverage.length
    ? server.loadAverage.join(" / ")
    : "-";
  const cards = [
    [t("admin.server.uptime"), formatUptime(server?.uptimeSeconds, t)],
    [t("admin.server.databaseLatency"), `${metricValue(server?.databaseLatencyMs)} ms`],
    [t("admin.server.processMemory"), `${metricValue(server?.processMemoryMb)} MB`],
    [t("admin.server.memoryUsed"), memory.usedPercent === undefined ? "-" : `${memory.usedPercent}%`],
    [t("admin.server.diskUsed"), disk.usedPercent === undefined ? "-" : `${disk.usedPercent}%`],
    [t("admin.server.loadAverage"), loadAverage],
  ];

  return (
    <section className="admin-panel admin-server-panel">
      <div className="admin-panel-header">
        <div>
          <h2>{t("admin.server.title")}</h2>
          <p>{server?.serverTime ? formatDate(server.serverTime, language) : t("admin.server.waiting")}</p>
        </div>
        <button className="admin-primary-btn compact" type="button" onClick={onRefresh}>{t("admin.server.refresh")}</button>
      </div>
      <div className="admin-server-grid">
        {cards.map(([label, value]) => (
          <div className="admin-server-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <dl className="admin-server-details">
        <div><dt>{t("admin.server.platform")}</dt><dd>{server?.platform || "-"}</dd></div>
        <div><dt>{t("admin.server.python")}</dt><dd>{server?.pythonVersion || "-"}</dd></div>
        <div><dt>{t("admin.server.django")}</dt><dd>{server?.djangoVersion || "-"}</dd></div>
        <div><dt>{t("admin.server.cpu")}</dt><dd>{server?.cpuCount || "-"}</dd></div>
        <div><dt>{t("admin.server.memory")}</dt><dd>{memory.totalMb ? `${memory.usedMb} / ${memory.totalMb} MB` : "-"}</dd></div>
        <div><dt>{t("admin.server.disk")}</dt><dd>{disk.totalMb ? `${disk.usedMb} / ${disk.totalMb} MB` : "-"}</dd></div>
      </dl>
    </section>
  );
}

function AdminSettingsStrip({ settings, onToggle, t }) {
  return (
    <section className="admin-panel admin-settings-strip">
      <div>
        <h2>{t("admin.settings.title")}</h2>
        <p>{t("admin.settings.subtitle")}</p>
      </div>
      <button
        className={`admin-pill ${settings?.autoApproveOrganizerCompetitions ? "good" : "muted"}`}
        type="button"
        onClick={() => onToggle?.(!settings?.autoApproveOrganizerCompetitions)}
      >
        {settings?.autoApproveOrganizerCompetitions ? t("admin.settings.autoApproveOn") : t("admin.settings.autoApproveOff")}
      </button>
    </section>
  );
}

function FiltersPanel({ filterConfig, onLocalChange, onSave, onCreate, t }) {
  const [newFilter, setNewFilter] = useState({
    group: "industry",
    value: "",
    labelEn: "",
    labelUk: "",
    sortOrder: 99,
  });
  const rows = filterGroups.flatMap((group) =>
    (filterConfig?.[group] || []).map((item) => ({ ...item, group }))
  );
  const pagination = usePagination(rows, 12, rows.map((item) => `${item.group}:${item.value}`).join("|"));
  const submitNewFilter = (event) => {
    event.preventDefault();
    const value = newFilter.value.trim();
    if (!value) return;
    onCreate?.({ ...newFilter, value, hidden: false });
    setNewFilter((prev) => ({ ...prev, value: "", labelEn: "", labelUk: "" }));
  };
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>{t("admin.filters.title")}</h2>
          <p>{t("admin.filters.subtitle")}</p>
        </div>
      </div>
      <form className="admin-filter-create-form" onSubmit={submitNewFilter}>
        <select value={newFilter.group} onChange={(event) => setNewFilter((prev) => ({ ...prev, group: event.target.value }))}>
          {filterGroups.map((group) => <option key={group} value={group}>{t(`filters.groups.${group}`, { defaultValue: group })}</option>)}
        </select>
        <input value={newFilter.value} onChange={(event) => setNewFilter((prev) => ({ ...prev, value: event.target.value }))} placeholder={t("admin.filters.newValue")} />
        <input value={newFilter.labelEn} onChange={(event) => setNewFilter((prev) => ({ ...prev, labelEn: event.target.value }))} placeholder={t("admin.filters.labelEn")} />
        <input value={newFilter.labelUk} onChange={(event) => setNewFilter((prev) => ({ ...prev, labelUk: event.target.value }))} placeholder={t("admin.filters.labelUk")} />
        <button className="admin-primary-btn compact" type="submit">{t("admin.filters.add")}</button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table admin-filter-table">
          <thead>
            <tr>
              <th>{t("admin.filters.group")}</th>
              <th>{t("admin.filters.value")}</th>
              <th>{t("admin.filters.labelEn")}</th>
              <th>{t("admin.filters.labelUk")}</th>
              <th>{t("admin.filters.order")}</th>
              <th>{t("admin.filters.visibility")}</th>
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((item) => (
              <tr key={`${item.group}:${item.value}`}>
                <td><strong>{t(`filters.groups.${item.group}`, { defaultValue: item.group })}</strong></td>
                <td><span>{item.value}</span></td>
                <td>
                  <input
                    value={item.labelEn || ""}
                    placeholder={item.defaultLabelEn}
                    onChange={(event) => onLocalChange(item.group, item.value, { labelEn: event.target.value })}
                    onBlur={() => onSave(item)}
                  />
                </td>
                <td>
                  <input
                    value={item.labelUk || ""}
                    placeholder={item.defaultLabelUk}
                    onChange={(event) => onLocalChange(item.group, item.value, { labelUk: event.target.value })}
                    onBlur={() => onSave(item)}
                  />
                </td>
                <td>
                  <input
                    className="admin-order-input"
                    type="number"
                    min="0"
                    value={item.sortOrder}
                    onChange={(event) => onLocalChange(item.group, item.value, { sortOrder: event.target.value })}
                    onBlur={() => onSave(item)}
                  />
                </td>
                <td>
                  <button className={`admin-pill ${item.hidden ? "muted" : "good"}`} type="button" onClick={() => onSave({ ...item, hidden: !item.hidden })}>
                    {item.hidden ? t("admin.filters.hidden") : t("admin.filters.visible")}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6}>{t("admin.filters.empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls pagination={pagination} t={t} />
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
  const [filterConfig, setFilterConfig] = useState(null);
  const [userFilters, setUserFilters] = useState({ search: "", role: "" });
  const [competitionFilters, setCompetitionFilters] = useState({ search: "", status: "" });
  const [busy, setBusy] = useState(false);

  const canAdmin = Boolean(user?.primaryRole === "admin" || user?.isStaff || user?.isSuperuser);

  const loadOverview = useCallback(async () => setOverview(await fetchAdminOverview()), []);
  const loadUsers = useCallback(async () => setUsers(await fetchAdminUsers(userFilters)), [userFilters]);
  const loadCompetitions = useCallback(async () => setCompetitions(await fetchAdminCompetitions(competitionFilters)), [competitionFilters]);
  const loadFilters = useCallback(async () => setFilterConfig(await fetchAdminFilters()), []);

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
    if (!canAdmin) return undefined;
    const timer = window.setInterval(() => loadOverview().catch(console.error), 30000);
    return () => window.clearInterval(timer);
  }, [canAdmin, loadOverview]);

  useEffect(() => {
    if (!canAdmin) return;
    loadFilters().catch(console.error);
  }, [canAdmin, loadFilters]);

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

  const removeUser = async (target) => {
    const confirmed = window.confirm(t("admin.users.confirmDelete", { name: target.displayName || target.email || target.username }));
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteAdminUser(target.id);
      setUsers((prev) => prev.filter((item) => item.id !== target.id));
      await loadOverview();
    } finally {
      setBusy(false);
    }
  };

  const removeCompetition = async (competition) => {
    const confirmed = window.confirm(t("admin.competitions.confirmDelete", { name: competition.name }));
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteAdminCompetition(competition.id);
      setCompetitions((prev) => prev.filter((item) => item.id !== competition.id));
      await loadOverview();
    } finally {
      setBusy(false);
    }
  };

  const updateFilterLocal = (group, value, patch) => {
    setFilterConfig((prev) => ({
      ...(prev || {}),
      [group]: (prev?.[group] || []).map((item) => (
        item.value === value ? { ...item, ...patch } : item
      )),
    }));
  };

  const saveFilter = async (item) => {
    setBusy(true);
    try {
      const updated = await updateAdminFilter({
        group: item.group,
        value: item.value,
        labelEn: item.labelEn,
        labelUk: item.labelUk,
        hidden: item.hidden,
        sortOrder: item.sortOrder,
      });
      setFilterConfig(updated);
      clearLandingFiltersCache();
    } finally {
      setBusy(false);
    }
  };

  const createFilter = async (item) => {
    setBusy(true);
    try {
      const updated = await createAdminFilter(item);
      setFilterConfig(updated);
      clearLandingFiltersCache();
    } finally {
      setBusy(false);
    }
  };

  const updateSettings = async (autoApproveOrganizerCompetitions) => {
    setBusy(true);
    try {
      setOverview(await updateAdminSettings({ autoApproveOrganizerCompetitions }));
    } finally {
      setBusy(false);
    }
  };

  let body = <UsersPanel users={users} filters={userFilters} setFilters={setUserFilters} onUpdate={updateUser} onDelete={removeUser} t={t} language={language} />;
  if (activeTab === "competitions") {
    body = <CompetitionsPanel competitions={competitions} filters={competitionFilters} setFilters={setCompetitionFilters} onUpdate={updateCompetition} onDelete={removeCompetition} t={t} />;
  }
  if (activeTab === "filters") {
    body = <FiltersPanel filterConfig={filterConfig} onLocalChange={updateFilterLocal} onSave={saveFilter} onCreate={createFilter} t={t} />;
  }
  if (activeTab === "server") {
    body = <ServerPanel server={overview?.server} onRefresh={loadOverview} t={t} language={language} />;
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
        <AdminSettingsStrip settings={overview?.settings} onToggle={updateSettings} t={t} />
        <nav className="admin-tabs">
          {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{t(tab.labelKey)}</button>)}
        </nav>
        {busy && <div className="admin-busy">{t("admin.saving")}</div>}
        {body}
      </main>
    </div>
  );
}
