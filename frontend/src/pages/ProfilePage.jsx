import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import CompetitionCard from "../components/CompetitionCard";
import { fetchProfileDashboard, reviewCompetitionCreation, reviewJoinRequest, updateProfileDashboard, updateTeamManagement } from "../api/profileApi";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import AccountSwitcher from "../components/AccountSwitcher";
import BrandLogo from "../components/BrandLogo";
import { getFileUrl, getMaterialMeta, getMaterialTitle } from "../utils/materials";

function normalizeRole(role) {
  if (role === "administrator") return "admin";
  return role || "participant";
}

function getStatusLabel(status, t) {
  if (!status) return "";
  return t(`options.status.${status}`, { defaultValue: status });
}

function getStatusClass(status) {
  const map = {
    active: "status-active",
    finished: "status-finished",
    judging: "status-judging",
    archived: "status-archived",
    registration_open: "status-registration-open",
    upcoming: "status-upcoming",
    pending: "status-registration-open",
    approved: "status-active",
    rejected: "status-finished",
  };
  return map[status] || "status-default";
}

function mergeSavedState(items, savedIds, { isAuthenticated = true, trustItemState = true } = {}) {
  return (items || []).map((item) => ({
    ...item,
    is_saved: isAuthenticated && (savedIds.has(item.id) || (trustItemState && Boolean(item.is_saved))),
  }));
}

function LastCompetitionBanner({ item, t }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="last-competition-banner profile-shared-banner" onClick={() => navigate(`/competitions/${item.id}`, { state: { competition: item } })}>
      <div className="last-competition-banner-cover" style={item.cover_image ? { backgroundImage: `url(${item.cover_image})` } : undefined} />
      <div className="last-competition-banner-content">
        <div className="last-competition-banner-name">{item.name}</div>
        <div className="last-competition-banner-meta">
          <span>{t("card.participants", { count: item.participants_count })}</span>
          <span>{t("sidebar.comments", { count: item.comments_count })}</span>
          <span className={getStatusClass(item.status)}>{getStatusLabel(item.status, t)}</span>
        </div>
      </div>
    </button>
  );
}

function StatsBlock({ role, statsData, onNavigate, t }) {
  const isAdmin = role === "admin";
  const isOrganizer = role === "organizer" || isAdmin;
  const stats = isAdmin
    ? [
        { value: statsData?.pending ?? 0, label: "pending" },
        { value: statsData?.archived ?? 0, label: "archived" },
        { value: statsData?.judge_assignments ?? 0, label: "judgeAssignments" },
      ]
    : isOrganizer
    ? [
        { value: statsData?.organized ?? statsData?.active ?? 0, label: "organized" },
        { value: statsData?.pending ?? 0, label: "pending" },
        { value: statsData?.archived ?? 0, label: "archived" },
        { value: statsData?.badges ?? 0, label: "badges" },
      ]
    : [
        { value: statsData?.badges ?? 0, label: "badges" },
        { value: statsData?.certificates ?? 0, label: "certificates" },
        { value: statsData?.pending ?? 0, label: "pending" },
        { value: statsData?.archived ?? 0, label: "archived" },
      ];

  return (
    <section className="profile-panel">
      <h2>{isOrganizer ? t("profile.organizerStats") : t("profile.participantStats")}</h2>
      <div className="profile-stats-cards">
        {stats.map((stat) => (
          <button
            type="button"
            className={`profile-stat-tile ${["pending", "archived"].includes(stat.label) ? "profile-stat-tile--link" : ""}`}
            key={stat.label}
            onClick={() => ["pending", "archived"].includes(stat.label) && onNavigate?.(stat.label)}
            disabled={!["pending", "archived"].includes(stat.label)}
          >
            <strong>{stat.value}</strong>
            <small>{t(`profile.${stat.label}`)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function CreateCompetitionPanel({ t }) {
  const navigate = useNavigate();
  return (
    <section className="profile-create-panel">
      <div>
        <span className="profile-section-kicker">{t("profile.organizerTools")}</span>
        <h2>{t("profile.createCompetitionTitle")}</h2>
        <p>{t("profile.createCompetitionText")}</p>
      </div>
      <button type="button" onClick={() => navigate("/competitions/new")}>+ {t("profile.createCompetition")}</button>
    </section>
  );
}

function DraftsPanel({ items = [], t }) {
  return (
    <section className="profile-panel">
      <h2>{t("profile.organizedCompetitions")}</h2>
      {items.length === 0 ? <div className="profile-empty-state">{t("profile.noOrganized")}</div> : (
        <div className="profile-draft-list">
          {items.map((draft) => (
            <button type="button" className="profile-draft-card" key={draft.id} onClick={() => window.location.assign(`/competitions/${draft.id}/edit`)}>
              <strong>{draft.name}</strong>
              <span>
                {draft.stage || draft.status_label || `${t("profile.step", { step: draft.setup_step || 1 })} - ${getStatusLabel(draft.status || "draft", t)}`}
                {" - "}
                {t("profile.approval")}: {getStatusLabel(draft.organizer_approval_status || "pending", t)}
              </span>
              <div className="profile-progress"><i style={{ width: `${draft.progress || draft.completion_percent || 35}%` }} /></div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamAccessPanel({ teams = [], currentUserId, onManageTeam, t }) {
  if (!teams.length) return null;
  return (
    <section className="profile-panel profile-team-panel">
      <h2>{t("profile.myTeams")}</h2>
      <div className="profile-team-list">
        {teams.map((team) => {
          const isCaptain = Number(team.captain) === Number(currentUserId);
          return (
            <article className="profile-team-card" key={team.id}>
              <div className="profile-team-card-head">
                <div><strong>{team.name}</strong><span>{team.competition_name}</span></div>
                <em className={`team-status team-status-${team.status}`}>{getStatusLabel(team.status, t)}</em>
              </div>
              <div className="profile-team-captain">{t("profile.captain", { name: team.captain_name || t("profile.notAssigned") })}{isCaptain ? ` - ${t("profile.you")}` : ""}</div>
              <div className="profile-team-members">
                {(team.members || []).map((member) => {
                  const isSelf = Number(member.user) === Number(currentUserId);
                  const canTransfer = isCaptain && !isSelf && member.user && ["pending", "approved"].includes(member.status);
                  const canWithdraw = isCaptain && !isSelf && member.status !== "withdrawn";
                  return (
                    <div className="profile-team-member" key={member.id} title={member.user_name || member.display_name}>
                      <span>{(member.user_name || member.display_name || "U").slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{member.user_name || member.display_name}</strong>
                        <small>{t(`roles.${member.role}`, { defaultValue: member.role })} - {getStatusLabel(member.status, t)}{isSelf ? ` - ${t("profile.you")}` : ""}</small>
                      </div>
                      {isCaptain && <div className="profile-team-member-actions">
                        {canTransfer && <button type="button" onClick={() => onManageTeam?.(team.id, { action: "transfer_captain", member_id: member.id })}>{t("profile.makeCaptain")}</button>}
                        {canWithdraw && <button type="button" className="danger" onClick={() => onManageTeam?.(team.id, { action: "update_member", member_id: member.id, status: "withdrawn", role: member.role })}>{t("profile.remove")}</button>}
                      </div>}
                    </div>
                  );
                })}
              </div>
              {isCaptain && <p className="profile-team-note">{t("profile.captainNote")}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CompetitionSection({ title, items = [], savedIds, onSavedChange, emptyText, t }) {
  return (
    <section className="profile-panel profile-competition-section">
      <h2>{title}</h2>
      {items.length === 0 ? <div className="profile-empty-state">{emptyText || t("profile.noCompetitions")}</div> : (
        <div className="cards-grid profile-competition-grid">
          {items.map((item) => <CompetitionCard key={item.id} item={{ ...item, is_saved: savedIds.has(item.id) || Boolean(item.is_saved) }} onSavedChange={onSavedChange} />)}
        </div>
      )}
    </section>
  );
}

function NotificationsPanel({ items = [], t }) {
  return (
    <section className="right-panel-block profile-notifications-panel">
      <div className="profile-panel-header"><h2>{t("profile.latestNotifications")}</h2></div>
      {items.length === 0 ? <div className="profile-empty-state">{t("profile.noNotifications")}</div> : (
        <div className="profile-notifications-list">
          {items.map((item) => (
            <button type="button" className="profile-notification-item" key={item.id} onClick={() => item.competition_id && window.location.assign(`/competitions/${item.competition_id}`)}>
              <strong>{item.title}</strong>
              <span>{item.competition_name || item.text || getStatusLabel(item.status, t)}</span>
              <small>{getStatusLabel(item.status, t)}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AwardAccordion({ title, count, items = [], emptyText, t }) {
  const latest = items[0];
  const latestHref = getFileUrl(latest?.file);
  return (
    <details className="profile-panel profile-award-accordion" open={Boolean(latest)}>
      <summary>
        <span>{title}</span>
        <strong>{count ?? items.length}</strong>
      </summary>
      {!latest ? <div className="profile-empty-state">{emptyText}</div> : (
        <>
          <article className="profile-latest-award">
            <small>{t("profile.latest")}</small>
            {latestHref ? (
              <a href={latestHref} target="_blank" rel="noreferrer">{latest.title || latest.file?.original_name || title}</a>
            ) : (
              <strong>{latest.title || latest.file?.original_name || title}</strong>
            )}
            <span>{latest.competition_name || latest.badge_type || latest.verification_code || t("profile.achievement")}</span>
          </article>
          <div className="profile-resource-list profile-award-list">
            {items.map((item) => {
              const href = getFileUrl(item.file);
              const itemTitle = item.title || item.file?.original_name || title;
              return (
              <div className="profile-resource-item" key={item.id || `${title}-${item.title}`}>
                {href ? <a href={href} target="_blank" rel="noreferrer">{itemTitle}</a> : <strong>{itemTitle}</strong>}
                <span>{item.competition_name || item.badge_type || item.verification_code || "-"}</span>
              </div>
              );
            })}
          </div>
        </>
      )}
    </details>
  );
}

function BadgesCertificatesPanel({ badges = [], certificates = [], stats, t }) {
  return (
    <div className="profile-awards-stack">
      <AwardAccordion title={t("profile.badges")} count={stats?.badges ?? badges.length} items={badges} emptyText={t("profile.noBadges")} t={t} />
      <AwardAccordion title={t("profile.certificates")} count={stats?.certificates ?? certificates.length} items={certificates} emptyText={t("profile.noCertificates")} t={t} />
    </div>
  );
}

function PendingRequestsPanel({ role, requests = [], onReview, t }) {
  const navigate = useNavigate();
  const title = role === "organizer" ? t("profile.registrationRequests") : role === "admin" ? t("profile.creationRequests") : t("profile.myApplications");
  const canReviewJoin = role === "organizer" || role === "admin";

  return (
    <section className="profile-panel profile-pending-panel">
      <h2>{title}</h2>
      {requests.length === 0 ? <div className="profile-empty-state">{t("profile.noPending")}</div> : (
        <div className="profile-resource-list">
          {requests.map((item) => (
            <div className="profile-resource-item profile-pending-item" key={`${item.type}-${item.id}`}>
              <button type="button" className="profile-pending-open" onClick={() => item.competition_id && navigate(`/competitions/${item.competition_id}`)}>
                <strong>{item.title || item.competition_name}</strong>
                <span>{item.competition_name && item.competition_name !== item.title ? `${item.competition_name} - ` : ""}{item.team_name ? `${item.team_name} - ` : ""}{item.role ? `${t(`roles.${item.role}`, { defaultValue: item.role })} - ` : ""}{getStatusLabel(item.status, t)}</span>
                {item.message && <small>{item.message}</small>}
              </button>
              {canReviewJoin && item.type === "join_request" && (
                <div className="profile-pending-actions">
                  <button type="button" onClick={() => onReview?.(item.id, "approved")}>{t("profile.approve")}</button>
                  <button type="button" className="danger" onClick={() => onReview?.(item.id, "rejected")}>{t("profile.reject")}</button>
                </div>
              )}
              {role === "admin" && item.type === "competition_creation_request" && (
                <div className="profile-pending-actions">
                  <button type="button" onClick={() => onReview?.(item.competition_id || item.id, "approved", item.type)}>{t("profile.approve")}</button>
                  <button type="button" className="danger" onClick={() => onReview?.(item.competition_id || item.id, "rejected", item.type)}>{t("profile.reject")}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function JudgeWorkPanel({ items = [], t }) {
  const navigate = useNavigate();
  if (!items.length) return null;
  return (
    <section className="profile-panel profile-judge-work-panel">
      <h2>{t("profile.judgeWork")}</h2>
      <div className="profile-resource-list">
        {items.map((item) => (
          <button
            type="button"
            className="profile-resource-item profile-pending-open"
            key={item.id}
            onClick={() => navigate(`/competitions/${item.competition_id}?tab=judging`)}
          >
            <strong>{item.competition_name}</strong>
            <span>
              {item.round_title ? `${item.round_title} - ` : ""}
              {getStatusLabel(item.status, t)}
            </span>
            <small>{t("profile.judgeScores", { count: item.scores_count || 0, final: item.finalized_count || 0 })}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProfileEditForm({ user, onSave, t }) {
  const [draft, setDraft] = useState(() => ({
    displayName: user?.displayName || user?.username || "",
    email: user?.email || "",
    primaryRole: normalizeRole(user?.primaryRole),
    organization: user?.organization || "",
    country: user?.country || "Ukraine",
    bio: user?.bio || "",
    skillsText: (user?.skills || []).join(", "),
    interestsText: (user?.interests || []).join(", "),
    avatarDataUrl: user?.avatarUrl || user?.avatar_url || user?.avatar?.url || "",
  }));
  const setField = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const handleAvatarFile = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setField("avatarDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const submit = (event) => {
    event.preventDefault();
    onSave({
      displayName: draft.displayName,
      email: draft.email,
      primaryRole: draft.primaryRole,
      organization: draft.organization,
      country: draft.country,
      bio: draft.bio,
      skills: draft.skillsText.split(",").map((item) => item.trim()).filter(Boolean),
      interests: draft.interestsText.split(",").map((item) => item.trim()).filter(Boolean),
      avatarDataUrl: draft.avatarDataUrl,
    });
  };
  return (
    <section className="profile-panel profile-edit-panel">
      <h2>{t("profile.editProfile")}</h2>
      <form className="profile-form" onSubmit={submit}>
        <div className="profile-avatar-editor"><div className="profile-avatar-preview">{draft.avatarDataUrl ? <img src={draft.avatarDataUrl} alt="" /> : t("profile.profilePhoto")}</div><label className="profile-avatar-upload">{t("profile.uploadPhoto")}<input type="file" accept="image/*" onChange={handleAvatarFile} /></label></div>
        <div className="profile-form-grid">
          <label>{t("profile.displayName")}<input value={draft.displayName} onChange={(e) => setField("displayName", e.target.value)} /></label>
          <label>{t("profile.email")}<input type="email" value={draft.email} onChange={(e) => setField("email", e.target.value)} /></label>
          <label>{t("profile.status")}<select value={draft.primaryRole} onChange={(e) => setField("primaryRole", e.target.value)}><option value="organizer">{t("roles.organizer")}</option><option value="participant">{t("roles.participant")}</option><option value="viewer">{t("roles.viewer")}</option>{normalizeRole(user?.primaryRole) === "admin" && <option value="admin">{t("roles.admin")}</option>}</select></label>
          <label>{t("profile.organization")}<input value={draft.organization} onChange={(e) => setField("organization", e.target.value)} /></label>
          <label>{t("profile.country")}<input value={draft.country} onChange={(e) => setField("country", e.target.value)} /></label>
          <label>{t("profile.skills")}<input value={draft.skillsText} onChange={(e) => setField("skillsText", e.target.value)} /></label>
        </div>
        <label>{t("profile.interests")}<input value={draft.interestsText} onChange={(e) => setField("interestsText", e.target.value)} /></label>
        <label>{t("profile.bio")}<textarea value={draft.bio} onChange={(e) => setField("bio", e.target.value)} /></label>
        <button className="profile-primary-btn" type="submit">{t("profile.saveProfile")}</button>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, authSessionKey, updateProfile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [savedCompetitions, setSavedCompetitions] = useState([]);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [profileStats, setProfileStats] = useState(null);
  const [profileBadges, setProfileBadges] = useState([]);
  const [profileCertificates, setProfileCertificates] = useState([]);
  const [profileMaterials, setProfileMaterials] = useState([]);
  const [draftCompetitions, setDraftCompetitions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeCompetitions, setActiveCompetitions] = useState([]);
  const [archivedCompetitions, setArchivedCompetitions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [judgeWork, setJudgeWork] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const role = normalizeRole(user?.primaryRole);

  const loadDashboard = async () => {
    const dashboard = await fetchProfileDashboard();
    const saved = dashboard?.saved_competitions || [];
    const ids = new Set(saved.map((item) => item.id));
    setSavedIds(ids);
    setSavedCompetitions(mergeSavedState(saved, ids));
    setRecentlyViewed(mergeSavedState(dashboard?.recently_viewed || [], ids));
    setDraftCompetitions(dashboard?.draft_competitions || []);
    setPendingRequests(dashboard?.pending_requests || []);
    setActiveCompetitions(mergeSavedState(dashboard?.active_competitions || [], ids));
    setArchivedCompetitions(mergeSavedState(dashboard?.archived_competitions || [], ids));
    setTeams(dashboard?.teams || []);
    setProfileStats(dashboard?.stats || null);
    setProfileBadges(dashboard?.badges || []);
    setProfileCertificates(dashboard?.certificates || []);
    setProfileMaterials(dashboard?.materials || []);
    setJudgeWork(dashboard?.judge_work || []);
    setNotifications(dashboard?.notifications || []);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedIds(new Set());
      setSavedCompetitions([]);
      setRecentlyViewed([]);
      setDraftCompetitions([]);
      setPendingRequests([]);
      setActiveCompetitions([]);
      setArchivedCompetitions([]);
      setTeams([]);
      setProfileStats(null);
      setProfileBadges([]);
      setProfileCertificates([]);
      setProfileMaterials([]);
      setJudgeWork([]);
      setNotifications([]);
      return;
    }
    let cancelled = false;
    const requestAuthKey = authSessionKey;
    setSavedIds(new Set());
    setSavedCompetitions([]);
    setRecentlyViewed([]);
    setActiveCompetitions([]);
    setArchivedCompetitions([]);
    fetchProfileDashboard().then((dashboard) => {
      if (cancelled || requestAuthKey !== authSessionKey) return;
      const ids = new Set((dashboard?.saved_competitions || []).map((item) => item.id));
      setSavedIds(ids);
      setSavedCompetitions(mergeSavedState(dashboard?.saved_competitions || [], ids));
      setRecentlyViewed(mergeSavedState(dashboard?.recently_viewed || [], ids));
      setDraftCompetitions(dashboard?.draft_competitions || []);
      setPendingRequests(dashboard?.pending_requests || []);
      setActiveCompetitions(mergeSavedState(dashboard?.active_competitions || [], ids));
      setArchivedCompetitions(mergeSavedState(dashboard?.archived_competitions || [], ids));
      setTeams(dashboard?.teams || []);
      setProfileStats(dashboard?.stats || null);
      setProfileBadges(dashboard?.badges || []);
      setProfileCertificates(dashboard?.certificates || []);
      setProfileMaterials(dashboard?.materials || []);
      setJudgeWork(dashboard?.judge_work || []);
      setNotifications(dashboard?.notifications || []);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [authSessionKey, isAuthenticated]);

  const handleSavedChange = (competitionId, nextSaved, sourceItem = null) => {
    setSavedIds((prev) => { const next = new Set(prev); if (nextSaved) next.add(competitionId); else next.delete(competitionId); return next; });
    const patch = (items) => items.map((competition) => competition.id === competitionId ? { ...competition, is_saved: nextSaved } : competition);
    setRecentlyViewed(patch);
    setSavedCompetitions((prev) => {
      if (nextSaved) {
        const knownCompetition = sourceItem || [...prev, ...recentlyViewed, ...activeCompetitions, ...archivedCompetitions].find((competition) => competition.id === competitionId);
        if (!knownCompetition) return patch(prev);
        return [
          { ...knownCompetition, id: competitionId, is_saved: true },
          ...prev.filter((competition) => competition.id !== competitionId),
        ].slice(0, 12);
      }
      return prev.filter((competition) => competition.id !== competitionId);
    });
    setActiveCompetitions(patch);
    setArchivedCompetitions(patch);
  };

  const handleReview = async (requestId, decision, type = "join_request") => {
    if (type === "competition_creation_request") {
      await reviewCompetitionCreation(requestId, decision);
    } else {
      await reviewJoinRequest(requestId, decision);
    }
    await loadDashboard();
  };

  const handleManageTeam = async (teamId, payload) => {
    await updateTeamManagement(teamId, payload);
    await loadDashboard();
  };

  const tabs = [
    { id: "overview", label: t("profile.overview") },
    ...(role !== "viewer" ? [{ id: "pending", label: t("profile.pending") }] : []),
    { id: "archived", label: t("profile.archivedTab") },
    ...(role === "organizer" ? [{ id: "drafts", label: t("profile.myCompetitions") }] : []),
  ];

  if (loading) return <div className="profile-dashboard-page"><main className="profile-dashboard-shell"><div className="profile-loading-panel">{t("profile.loading")}</div></main></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="profile-dashboard-page">
      <main className="profile-dashboard-shell">
        <div className="profile-topbar">
          <button className="profile-back-btn" type="button" onClick={() => navigate(-1)}>{"<"}</button>
          <button className="profile-logo-link" type="button" onClick={() => navigate("/")} aria-label={t("profile.goHome")}>
            <BrandLogo className="profile-logo-brand" showText />
          </button>
          <div className="profile-search"><span>{"⌕"}</span><input placeholder={t("profile.search")} /></div>
          <AccountSwitcher compact />
        </div>

        <div className="profile-dashboard-grid">
          <section className="profile-left-column">
            <section className="profile-main-identity profile-panel">
              <div className="profile-photo-box">{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : t("profile.profilePhoto")}</div>
              <div className="profile-name-block"><h1>{user?.displayName || user?.username || t("profile.nameFallback")}</h1><p>{t("profile.status")}: {t(`roles.${role}`, { defaultValue: t("roles.participant") })}</p>{user?.organization && <span>{user.organization}</span>}</div>
              <button className="profile-edit-link" type="button" onClick={() => setEditing((prev) => !prev)}>{editing ? t("profile.close") : t("profile.edit")}</button>
            </section>

            <nav className="profile-tabs-row" aria-label={t("profile.profileSections")}>
              {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
            </nav>

            {editing && <ProfileEditForm user={user} t={t} onSave={async (patch) => { try { const result = await updateProfileDashboard(patch); updateProfile(result?.user || patch); } catch (error) { console.error(error); updateProfile(patch); } setEditing(false); }} />}

            {role === "organizer" && activeTab === "overview" && <CreateCompetitionPanel t={t} />}
            {role === "organizer" && activeTab === "drafts" && <DraftsPanel items={draftCompetitions} t={t} />}
            {activeTab === "pending" && <PendingRequestsPanel role={role} requests={pendingRequests} onReview={handleReview} t={t} />}

            {role === "participant" && activeTab === "overview" && (
              <>
                <StatsBlock role={role} statsData={profileStats} onNavigate={setActiveTab} t={t} />
                <CompetitionSection title={t("profile.registeredCompetitions")} items={activeCompetitions} savedIds={savedIds} onSavedChange={handleSavedChange} emptyText={t("profile.noRegistered")} t={t} />
                <CompetitionSection title={t("profile.archivedCompetitions")} items={archivedCompetitions} savedIds={savedIds} onSavedChange={handleSavedChange} emptyText={t("profile.noArchived")} t={t} />
                <JudgeWorkPanel items={judgeWork} t={t} />
                <TeamAccessPanel teams={teams} currentUserId={user?.id} onManageTeam={handleManageTeam} t={t} />
                <BadgesCertificatesPanel badges={profileBadges} certificates={profileCertificates} stats={profileStats} t={t} />
              </>
            )}

            {(role === "organizer" || role === "admin") && activeTab === "overview" && (
              <>
                <StatsBlock role={role} statsData={profileStats} t={t} />
                <JudgeWorkPanel items={judgeWork} t={t} />
                <TeamAccessPanel teams={teams} currentUserId={user?.id} onManageTeam={handleManageTeam} t={t} />
                {role !== "admin" && <BadgesCertificatesPanel badges={profileBadges} certificates={profileCertificates} stats={profileStats} t={t} />}
              </>
            )}

            {role === "viewer" && activeTab === "overview" && (
              <>
                <section className="profile-panel profile-viewer-note"><h2>{t("profile.viewerProfile")}</h2><p>{t("profile.viewerText")}</p></section>
                <CompetitionSection title={t("profile.savedCompetitions")} items={savedCompetitions} savedIds={savedIds} onSavedChange={handleSavedChange} emptyText={t("profile.noSaved")} t={t} />
              </>
            )}

            {activeTab === "archived" && <CompetitionSection title={t("profile.archivedCompetitions")} items={archivedCompetitions} savedIds={savedIds} onSavedChange={handleSavedChange} emptyText={t("profile.noArchived")} t={t} />}
          </section>

          <aside className="profile-right-column">
            <section className="right-panel-block profile-recent-panel">
              <div className="profile-panel-header"><h2>{t("profile.recentlyViewed")}</h2></div>
              <div className="last-competitions-list">{recentlyViewed.slice(0, role === "viewer" ? 6 : 4).map((item) => <LastCompetitionBanner key={item.id} item={item} t={t} />)}</div>
            </section>
            <NotificationsPanel items={notifications} t={t} />
            {role !== "viewer" && activeTab !== "overview" && <StatsBlock role={role} statsData={profileStats} onNavigate={setActiveTab} t={t} />}
            {role === "participant" && profileMaterials.length > 0 && (
              <section className="profile-panel"><h2>{t("profile.personalMaterials")}</h2><div className="profile-resource-list">{profileMaterials.map((item) => {
                const href = getFileUrl(item.file);
                const title = getMaterialTitle(item, t("profile.material"));
                return (
                  <div className="profile-resource-item" key={item.id}>
                    {href ? <a href={href} target="_blank" rel="noreferrer">{title}</a> : <strong>{title}</strong>}
                    <span>{item.competition_name || getMaterialMeta(item, t) || t("profile.file")}</span>
                  </div>
                );
              })}</div></section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
