import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import AccountSwitcher from "../components/AccountSwitcher";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  assignCompetitionJudge,
  createCompetitionAnnouncement,
  createCompetitionDraft,
  createCompetitionInvitations,
  deleteCompetitionAnnouncement,
  deleteCompetitionMaterial,
  fetchCompetitionAnnouncements,
  fetchCompetitionBuilder,
  fetchCompetitionJudges,
  fetchCompetitionMaterials,
  publishCompetition,
  saveCompetitionBuilder,
  updateCompetitionAnnouncement,
  uploadCompetitionMaterial,
} from "../api/competitionBuilderApi";
import { getMaterialBadge, getMaterialMeta, getMaterialTitle, getMaterialUrl } from "../utils/materials";

const defaultDraft = {
  name: "Untitled competition",
  short_description: "",
  full_description: "",
  cover_image: "",
  banner_image: "",
  status: "draft",
  event_type: "online",
  participation_type: "individual",
  industry: "programming",
  difficulty: "mixed",
  language: "uk",
  access_mode: "application",
  visibility_mode: "public",
  show_in_catalog: true,
  allow_sharing_link: true,
  allow_external_registration: true,
  auto_approve_join_requests: false,
  registration_open: true,
  submissions_open: false,
  min_team_size: 1,
  max_team_size: 4,
  allow_user_team_invites: true,
  allow_organizer_team_assignment: true,
  setup_step: 1,
  completion_percent: 20,
  registration_starts_at: "",
  registration_ends_at: "",
  starts_at: "",
  ends_at: "",
  judging_starts_at: "",
  judging_ends_at: "",
  results_public_at: "",
  rounds: [{ title: "Round 1", description: "", starts_at: "", ends_at: "", submission_required: true, max_attempts: 1, is_stream_enabled: false, stream_url: "", stream_embed_url: "", stream_label: "", sort_order: 0 }],
  submission_settings: {
    submission_mode: "mixed",
    allowed_file_types: ["pdf", "zip", "ipynb"],
    max_file_size_mb: 25,
    max_submissions: 1,
    repository_url_required: false,
    demo_url_required: false,
    description_required: true,
  },
  judging_criteria: [{ title: "Quality", description: "", max_score: 10, weight: 1, sort_order: 0 }],
  awards: [{ title: "Winner", place: 1, issue_certificate: true, issue_badge: true, description: "" }],
  materials: [],
};

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function toLocalInputFromTime(time) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}


function extractIframeSrc(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
  return match ? match[1].replace(/&amp;/g, "&") : text;
}

function buildEmbedUrl(value) {
  const raw = extractIframeSrc(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const parentHost = window.location.hostname || "localhost";

    if (host === "youtube.com" && url.pathname === "/watch") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtube.com" && url.pathname.startsWith("/embed/")) {
      return raw;
    }

    if (host === "vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : "";
    }

    if (host === "player.vimeo.com" && url.pathname.startsWith("/video/")) {
      return raw;
    }

    if (host === "twitch.tv") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "videos" && parts[1]) {
        return `https://player.twitch.tv/?video=${parts[1]}&parent=${parentHost}`;
      }
      if (parts[0]) {
        return `https://player.twitch.tv/?channel=${parts[0]}&parent=${parentHost}`;
      }
    }

    if (host === "player.twitch.tv") {
      if (!url.searchParams.has("parent")) url.searchParams.set("parent", parentHost);
      return url.toString();
    }

    return raw;
  } catch {
    return "";
  }
}

function normalizeStreamInput(value) {
  return extractIframeSrc(value);
}

function normalizeDraft(data) {
  const result = { ...defaultDraft, ...(data || {}) };
  [
    "registration_starts_at",
    "registration_ends_at",
    "starts_at",
    "ends_at",
    "judging_starts_at",
    "judging_ends_at",
    "results_public_at",
  ].forEach((key) => {
    result[key] = toDateTimeLocal(result[key]);
  });
  if (!result.rounds?.length) result.rounds = defaultDraft.rounds;
  result.rounds = result.rounds.map((round) => ({
    ...round,
    starts_at: toDateTimeLocal(round.starts_at),
    ends_at: toDateTimeLocal(round.ends_at),
  }));
  if (!result.judging_criteria?.length) result.judging_criteria = defaultDraft.judging_criteria;
  if (!result.awards?.length) result.awards = defaultDraft.awards;
  result.submission_settings = { ...defaultDraft.submission_settings, ...(result.submission_settings || {}) };
  return result;
}

function preparePayload(draft, step) {
  const payload = { ...draft, setup_step: step, completion_percent: Math.min(100, step * 20) };
  if (!payload.judging_starts_at && payload.starts_at) payload.judging_starts_at = payload.starts_at;
  if (!payload.judging_ends_at && payload.ends_at) payload.judging_ends_at = payload.ends_at;
  [
    "registration_starts_at",
    "registration_ends_at",
    "starts_at",
    "ends_at",
    "judging_starts_at",
    "judging_ends_at",
    "results_public_at",
  ].forEach((key) => {
    payload[key] = fromDateTimeLocal(payload[key]);
  });
  let previousRoundEnd = null;
  payload.rounds = normalizeRoundSequence(payload.rounds || [], payload.starts_at).map((round, index) => {
    const derivedStart = !round.starts_at && previousRoundEnd
      ? toLocalInputFromTime(previousRoundEnd + 1000)
      : round.starts_at;
    const streamUrl = normalizeStreamInput(round.stream_url);
    const embedUrl = buildEmbedUrl(streamUrl);
    const prepared = {
      ...round,
      starts_at: fromDateTimeLocal(derivedStart),
      ends_at: fromDateTimeLocal(round.ends_at),
      stream_url: streamUrl,
      stream_embed_url: round.is_stream_enabled ? embedUrl : "",
      sort_order: index,
    };
    const endTime = timeValue(round.ends_at);
    if (endTime) previousRoundEnd = endTime;
    return prepared;
  });
  payload.is_public = payload.visibility_mode === "public";
  payload.show_in_catalog = payload.visibility_mode === "public" && Boolean(payload.show_in_catalog);
  delete payload.materials;
  return payload;
}

function Field({ label, children, note }) {
  return <label className="builder-field"><span>{label}</span>{children}{note && <small>{note}</small>}</label>;
}


function timeValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function normalizeRoundSequence(rounds = [], competitionStarts = "") {
  let previousEnd = null;
  const fallbackStart = timeValue(competitionStarts);
  const normalized = (rounds.length ? rounds : [{ ...defaultDraft.rounds[0] }]).map((round, index) => {
    let startsAt = round.starts_at || "";
    let endsAt = round.ends_at || "";
    const startTime = timeValue(startsAt);
    if (previousEnd && (!startTime || startTime <= previousEnd)) {
      startsAt = toLocalInputFromTime(previousEnd + 1000);
    } else if (!startTime && index === 0 && fallbackStart) {
      startsAt = toLocalInputFromTime(fallbackStart);
    }
    const effectiveStart = timeValue(startsAt);
    const endTime = timeValue(endsAt);
    if (effectiveStart && endTime && endTime <= effectiveStart) {
      endsAt = toLocalInputFromTime(effectiveStart + 60 * 60 * 1000);
    }
    previousEnd = timeValue(endsAt) || previousEnd;
    return { ...round, starts_at: startsAt, ends_at: endsAt, sort_order: index };
  });
  return normalized;
}

function getScheduleErrors(draft, t) {
  const errors = [];
  const starts = timeValue(draft.starts_at);
  const ends = timeValue(draft.ends_at);
  const registrationStarts = timeValue(draft.registration_starts_at);
  const registrationEnds = timeValue(draft.registration_ends_at);
  const judgingStarts = timeValue(draft.judging_starts_at);
  const judgingEnds = timeValue(draft.judging_ends_at);
  const resultsAt = timeValue(draft.results_public_at);

  if (starts && ends && ends <= starts) errors.push(t("builder.validation.endAfterStart"));
  if (registrationStarts && starts && registrationStarts > starts) errors.push(t("builder.validation.registrationBeforeStart"));
  if (registrationEnds && starts && registrationEnds > starts) errors.push(t("builder.validation.registrationEndBeforeStart"));
  if (registrationStarts && registrationEnds && registrationEnds <= registrationStarts) errors.push(t("builder.validation.registrationEndAfterStart"));
  if (judgingStarts && judgingEnds && judgingEnds <= judgingStarts) errors.push(t("builder.validation.judgingEndAfterStart"));
  if (resultsAt && judgingEnds && resultsAt < judgingEnds) errors.push(t("builder.validation.resultsAfterJudging"));

  let previousRoundEnd = null;
  (draft.rounds || []).forEach((round, index) => {
    const roundStart = timeValue(round.starts_at);
    const roundEnd = timeValue(round.ends_at);
    const effectiveRoundStart = roundStart || (previousRoundEnd ? previousRoundEnd + 1000 : starts);
    const label = round.title || `Round ${index + 1}`;
    if (effectiveRoundStart && starts && effectiveRoundStart < starts) errors.push(t("builder.validation.roundWithinWindow", { label }));
    if (roundEnd && ends && roundEnd > ends) errors.push(t("builder.validation.roundEndWithinWindow", { label }));
    if (effectiveRoundStart && roundEnd && roundEnd <= effectiveRoundStart) errors.push(t("builder.validation.roundEndAfterStart", { label }));
    if (previousRoundEnd && effectiveRoundStart && effectiveRoundStart <= previousRoundEnd) errors.push(t("builder.validation.nextRoundAfterPrevious", { label }));
    if (previousRoundEnd && roundEnd && roundEnd <= previousRoundEnd) errors.push(t("builder.validation.nextRoundEndAfterPrevious", { label }));
    if (roundEnd) previousRoundEnd = roundEnd;
  });

  return [...new Set(errors)];
}

function CheckField({ label, checked, onChange, note }) {
  return (
    <label className="builder-field builder-check-field">
      <span>{label}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      {note && <small>{note}</small>}
    </label>
  );
}

function ToggleCard({ active, title, text, onClick }) {
  return (
    <button type="button" className={`builder-choice ${active ? "active" : ""}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}

export default function CompetitionBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading, user } = useAuth();
  const { t, language } = useLanguage();
  const steps = [
    { id: 1, title: t("builder.steps.basics"), hint: t("builder.steps.basicsHint") },
    { id: 2, title: t("builder.steps.format"), hint: t("builder.steps.formatHint") },
    { id: 3, title: t("builder.steps.schedule"), hint: t("builder.steps.scheduleHint") },
    { id: 4, title: t("builder.steps.submissions"), hint: t("builder.steps.submissionsHint") },
    { id: 5, title: t("builder.steps.publish"), hint: t("builder.steps.publishHint") },
  ];
  const localizedDefaultDraft = useMemo(() => ({
    ...defaultDraft,
    name: t("builder.defaults.untitled"),
    rounds: [{ ...defaultDraft.rounds[0], title: t("builder.defaults.round", { number: 1 }) }],
    judging_criteria: [{ ...defaultDraft.judging_criteria[0], title: t("builder.defaults.quality") }],
    awards: [{ ...defaultDraft.awards[0], title: t("builder.defaults.winner") }],
  }), [t]);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(localizedDefaultDraft);
  const [competitionId, setCompetitionId] = useState(id || null);
  const [statusText, setStatusText] = useState("");
  const [inviteText, setInviteText] = useState("");
  const [teamInviteText, setTeamInviteText] = useState("");
  const [judgeText, setJudgeText] = useState("");
  const [judges, setJudges] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementId, setAnnouncementId] = useState(null);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [materialFile, setMaterialFile] = useState(null);
  const [materialName, setMaterialName] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialType, setMaterialType] = useState("guide");
  const [saving, setSaving] = useState(false);
  const draftCreationStartedRef = useRef(false);
  const autoApproveLabel = language === "uk" ? "Автоприйом заявок" : t("builder.autoApproveJoinRequests", { defaultValue: "Auto-approve join requests" });
  const autoApproveNote = language === "uk"
    ? "Нові заявки на це змагання одразу отримують статус схвалено."
    : t("builder.autoApproveJoinRequestsNote", { defaultValue: "New applications for this competition become approved immediately." });

  useEffect(() => {
    if (!isAuthenticated) return;
    if (id) {
      fetchCompetitionBuilder(id).then((data) => {
        setDraft(normalizeDraft(data));
        setStep(data.setup_step || 1);
        return Promise.all([fetchCompetitionJudges(id), fetchCompetitionMaterials(id), fetchCompetitionAnnouncements(id)]);
      }).then(([judgeItems, materialItems, announcementItems]) => {
        if (judgeItems) setJudges(judgeItems);
        if (materialItems) setDraft((prev) => ({ ...prev, materials: materialItems }));
        if (announcementItems) setAnnouncements(announcementItems);
      }).catch((error) => setStatusText(error.message));
    } else {
      if (draftCreationStartedRef.current) return;
      draftCreationStartedRef.current = true;
      createCompetitionDraft(preparePayload(localizedDefaultDraft, 1)).then((data) => {
        setCompetitionId(data.id);
        setDraft(normalizeDraft(data));
        return Promise.all([fetchCompetitionJudges(data.id), fetchCompetitionMaterials(data.id), fetchCompetitionAnnouncements(data.id)]).then(([judgeItems, materialItems, announcementItems]) => {
          setJudges(judgeItems || []);
          setDraft((prev) => ({ ...prev, materials: materialItems || [] }));
          setAnnouncements(announcementItems || []);
          return data;
        });
      }).then((data) => {
        navigate(`/competitions/${data.id}/edit`, { replace: true });
      }).catch((error) => {
        draftCreationStartedRef.current = false;
        setStatusText(error.message);
      });
    }
  }, [id, isAuthenticated, localizedDefaultDraft, navigate]);

  const setField = (field, value) => setDraft((prev) => {
    const next = { ...prev, [field]: value };
    if (field === "starts_at" && (!prev.judging_starts_at || prev.judging_starts_at === prev.starts_at)) {
      next.judging_starts_at = value;
    }
    if (field === "ends_at" && (!prev.judging_ends_at || prev.judging_ends_at === prev.ends_at)) {
      next.judging_ends_at = value;
    }
    if (field === "starts_at" || field === "ends_at") {
      next.rounds = normalizeRoundSequence(next.rounds || [], next.starts_at);
    }
    return next;
  });
  const setNested = (section, field, value) => setDraft((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));

  const updateArrayItem = (section, index, field, value) => {
    setDraft((prev) => {
      const nextItems = prev[section].map((item, i) => i === index ? { ...item, [field]: value } : item);
      return {
        ...prev,
        [section]: section === "rounds" && ["starts_at", "ends_at"].includes(field)
          ? normalizeRoundSequence(nextItems, prev.starts_at)
          : nextItems,
      };
    });
  };

  const addArrayItem = (section, item) => {
    setDraft((prev) => {
      const nextItems = [...prev[section], { ...item, sort_order: prev[section].length }];
      return {
        ...prev,
        [section]: section === "rounds" ? normalizeRoundSequence(nextItems, prev.starts_at) : nextItems,
      };
    });
  };

  const removeArrayItem = (section, index) => {
    setDraft((prev) => {
      const nextItems = (prev[section] || [])
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, sort_order: itemIndex }));
      return {
        ...prev,
        [section]: section === "rounds" ? normalizeRoundSequence(nextItems, prev.starts_at) : nextItems,
      };
    });
  };

  const saveDraft = async (nextStep = step) => {
    if (!competitionId || saving) return null;
    setSaving(true);
    setStatusText(t("builder.status.saving"));
    try {
      const saved = await saveCompetitionBuilder(competitionId, preparePayload(draft, nextStep));
      setDraft(normalizeDraft(saved));
      setStep(nextStep);
      setStatusText(t("builder.status.saved"));
      return saved;
    } catch (error) {
      setStatusText(error.message || t("builder.status.notSaved"));
      setStep(nextStep);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const validation = useMemo(() => {
    const missing = [];
    if (!draft.name || draft.name === "Untitled competition" || draft.name === t("builder.defaults.untitled")) missing.push(t("builder.validation.title"));
    if (!draft.short_description) missing.push(t("builder.validation.shortDescription"));
    if (!draft.ends_at) missing.push(t("builder.validation.competitionEnd"));
    if (!draft.rounds?.length) missing.push(t("builder.validation.oneRound"));
    if ((draft.rounds || []).some((round) => !round.ends_at)) missing.push(t("builder.validation.roundEnd"));
    if (draft.access_mode === "invite_only" && !draft.allow_sharing_link) missing.push(t("builder.validation.sharingOrInvitations"));
    return [...missing, ...getScheduleErrors(draft, t)];
  }, [draft, t]);

  const scheduleErrors = useMemo(() => getScheduleErrors(draft, t), [draft, t]);
  const approvalStatus = draft.organizer_approval_status || "pending";
  const canPublishFromApproval = user?.primaryRole === "admin" || approvalStatus !== "rejected";

  const handlePublish = async () => {
    if (!competitionId || validation.length > 0 || !canPublishFromApproval) return;
    const saved = await saveDraft(5);
    if (!saved) return;
    try {
      const published = await publishCompetition(competitionId);
      setDraft(normalizeDraft(published));
      setStatusText(t("builder.status.published"));
      navigate(`/competitions/${published.id || competitionId}`);
    } catch (error) {
      setStatusText(error.message || t("builder.status.notPublished"));
    }
  };

  const queueInvitations = async (targetType) => {
    const raw = targetType === "team" ? teamInviteText : inviteText;
    const recipients = raw.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    if (!recipients.length) return;
    try {
      await createCompetitionInvitations(competitionId, {
        recipients,
        target_type: targetType,
        team_name: targetType === "team" ? t("builder.defaults.invitedTeam") : "",
        message: `You are invited to join ${draft.name}.`,
        queue_messages: true,
      });
      setStatusText(t("builder.status.invitesQueued"));
      if (targetType === "team") setTeamInviteText(""); else setInviteText("");
    } catch (error) {
      setStatusText(error.message || t("builder.status.invitesFailed"));
    }
  };

  const assignJudge = async () => {
    const email = judgeText.trim();
    if (!email || !competitionId) return;
    try {
      await assignCompetitionJudge(competitionId, { email, displayName: email.split("@")[0] });
      const items = await fetchCompetitionJudges(competitionId);
      setJudges(items || []);
      setJudgeText("");
      setStatusText(t("builder.status.judgeAssigned"));
    } catch (error) {
      setStatusText(error.message || t("builder.status.judgeFailed"));
    }
  };

  const refreshMaterials = async () => {
    if (!competitionId) return;
    const items = await fetchCompetitionMaterials(competitionId);
    setDraft((prev) => ({ ...prev, materials: items || [] }));
  };

  const uploadMaterial = async () => {
    if (!competitionId || (!materialFile && !materialUrl.trim())) return;
    const formData = new FormData();
    if (materialFile) formData.append("file", materialFile);
    if (materialUrl.trim()) formData.append("url", materialUrl.trim());
    formData.append("name", materialName.trim() || materialFile?.name || materialUrl.trim());
    formData.append("material_type", materialType);
    try {
      const created = await uploadCompetitionMaterial(competitionId, formData);
      setDraft((prev) => ({ ...prev, materials: [...(prev.materials || []), created] }));
      setMaterialFile(null);
      setMaterialName("");
      setMaterialUrl("");
      setStatusText(t("builder.status.materialUploaded"));
    } catch (error) {
      setStatusText(error.message || t("builder.status.materialFailed"));
    }
  };

  const removeMaterial = async (materialId) => {
    if (!competitionId || !materialId) return;
    try {
      await deleteCompetitionMaterial(competitionId, materialId);
      await refreshMaterials();
      setStatusText(t("builder.status.materialRemoved"));
    } catch (error) {
      setStatusText(error.message || t("builder.status.materialRemoveFailed"));
    }
  };

  const resetAnnouncementForm = () => {
    setAnnouncementId(null);
    setAnnouncementTitle("");
    setAnnouncementText("");
    setAnnouncementPinned(false);
  };

  const refreshAnnouncements = async () => {
    if (!competitionId) return;
    const items = await fetchCompetitionAnnouncements(competitionId);
    setAnnouncements(items || []);
  };

  const saveAnnouncement = async () => {
    if (!competitionId || !announcementTitle.trim() || !announcementText.trim()) return;
    const payload = {
      id: announcementId,
      title: announcementTitle.trim(),
      text: announcementText.trim(),
      is_pinned: announcementPinned,
    };
    try {
      if (announcementId) {
        await updateCompetitionAnnouncement(competitionId, payload);
        setStatusText(t("builder.status.saved"));
      } else {
        await createCompetitionAnnouncement(competitionId, payload);
        setStatusText(t("builder.status.saved"));
      }
      resetAnnouncementForm();
      await refreshAnnouncements();
    } catch (error) {
      setStatusText(error.message || t("builder.status.notSaved"));
    }
  };

  const editAnnouncement = (announcement) => {
    setAnnouncementId(announcement.id);
    setAnnouncementTitle(announcement.title || "");
    setAnnouncementText(announcement.text || "");
    setAnnouncementPinned(Boolean(announcement.is_pinned));
  };

  const removeAnnouncement = async (idToRemove) => {
    if (!competitionId || !idToRemove) return;
    try {
      await deleteCompetitionAnnouncement(competitionId, idToRemove);
      if (announcementId === idToRemove) resetAnnouncementForm();
      await refreshAnnouncements();
      setStatusText(t("builder.status.saved"));
    } catch (error) {
      setStatusText(error.message || t("builder.status.notSaved"));
    }
  };

  if (loading) return <div className="builder-page"><main className="builder-shell">{t("builder.loading")}</main></div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="builder-page">
      <main className="builder-shell">
        <div className="builder-topbar">
          <button type="button" onClick={() => navigate("/profile")}>{t("builder.topbarProfile")}</button>
          <div><strong>{t("builder.constructor")}</strong><span>{statusText}</span></div>
          <div className="builder-topbar-actions"><button type="button" onClick={() => saveDraft(step)} disabled={saving}>{t("builder.saveDraft")}</button><AccountSwitcher compact /></div>
        </div>

        <section className="builder-hero">
          <div>
            <span className="profile-section-kicker">{t("builder.stepOf", { step })}</span>
            <h1>{draft.name || t("builder.newCompetition")}</h1>
            <p>{t("builder.heroText")}</p>
          </div>
          <div className="builder-progress"><i style={{ width: `${Math.min(100, step * 20)}%` }} /></div>
        </section>

        <div className="builder-layout">
          <aside className="builder-steps">
            {steps.map((item) => (
              <button key={item.id} type="button" className={step === item.id ? "active" : ""} onClick={() => saveDraft(item.id)}>
                <strong>{item.title}</strong><span>{item.hint}</span>
              </button>
            ))}
          </aside>

          <section className="builder-panel">
            {step === 1 && (
              <div className="builder-form-grid">
                <Field label={t("builder.title")}><input value={draft.name} onChange={(e) => setField("name", e.target.value)} /></Field>
                <Field label={t("builder.categoryIndustry")} note={t("builder.categoryNote")}><select value={draft.industry} onChange={(e) => setField("industry", e.target.value)}><option value="programming">{t("options.industry.programming")}</option><option value="design">{t("options.industry.design")}</option><option value="robotics">{t("options.industry.robotics")}</option><option value="cybersecurity">{t("options.industry.cybersecurity")}</option></select></Field>
                <Field label={t("builder.eventType")}><select value={draft.event_type} onChange={(e) => setField("event_type", e.target.value)}><option value="online">{t("options.event_type.online")}</option><option value="offline">{t("options.event_type.offline")}</option><option value="hybrid">{t("options.event_type.hybrid")}</option></select></Field>
                <Field label={t("builder.difficulty")}><select value={draft.difficulty} onChange={(e) => setField("difficulty", e.target.value)}><option value="beginner">{t("options.difficulty.beginner")}</option><option value="intermediate">{t("options.difficulty.intermediate")}</option><option value="advanced">{t("options.difficulty.advanced")}</option><option value="mixed">{t("options.difficulty.mixed")}</option></select></Field>
                <Field label={t("builder.language")} note={t("builder.languageNote")}><select value={draft.language} onChange={(e) => setField("language", e.target.value)}><option value="uk">{t("options.language.uk")}</option><option value="en">{t("options.language.en")}</option><option value="pl">{t("options.language.pl")}</option><option value="de">{t("options.language.de")}</option><option value="fr">{t("options.language.fr")}</option><option value="es">{t("options.language.es")}</option><option value="other">{t("options.language.other")}</option></select></Field>
                <Field label={t("builder.shortDescription")}><textarea value={draft.short_description} onChange={(e) => setField("short_description", e.target.value)} /></Field>
                <Field label={t("builder.fullDescription")}><textarea value={draft.full_description} onChange={(e) => setField("full_description", e.target.value)} /></Field>
                <Field label={t("builder.coverImage")}><input value={draft.cover_image || ""} onChange={(e) => setField("cover_image", e.target.value)} /></Field>
                <Field label={t("builder.bannerImage")}><input value={draft.banner_image || ""} onChange={(e) => setField("banner_image", e.target.value)} /></Field>
              </div>
            )}

            {step === 2 && (
              <div className="builder-stack">
                <h2>{t("builder.registrationModel")}</h2>
                <div className="builder-choice-grid">
                  <ToggleCard active={draft.access_mode === "open"} title={t("options.access_mode.open")} text={t("builder.openRegistrationText")} onClick={() => setField("access_mode", "open")} />
                  <ToggleCard active={draft.access_mode === "application"} title={t("options.access_mode.application")} text={t("builder.applicationReviewText")} onClick={() => setField("access_mode", "application")} />
                  <ToggleCard active={draft.access_mode === "invite_only"} title={t("options.access_mode.invite_only")} text={t("builder.inviteOnlyText")} onClick={() => setField("access_mode", "invite_only")} />
                </div>
                <div className="builder-choice-grid">
                  <ToggleCard active={draft.participation_type === "individual"} title={t("options.participation_type.individual")} text={t("builder.individualText")} onClick={() => setField("participation_type", "individual")} />
                  <ToggleCard active={draft.participation_type === "team"} title={t("options.participation_type.team")} text={t("builder.teamText")} onClick={() => setField("participation_type", "team")} />
                  <ToggleCard active={draft.participation_type === "mixed"} title={t("options.participation_type.mixed")} text={t("builder.mixedText")} onClick={() => setField("participation_type", "mixed")} />
                </div>
                <div className="builder-form-grid">
                  <Field label={t("builder.visibility")}><select value={draft.visibility_mode} onChange={(e) => setField("visibility_mode", e.target.value)}><option value="public">{t("options.visibility_mode.public")}</option><option value="unlisted">{t("options.visibility_mode.unlisted")}</option><option value="private">{t("options.visibility_mode.private")}</option></select></Field>
                  <CheckField label={t("builder.showCatalog")} checked={draft.show_in_catalog} onChange={(value) => setField("show_in_catalog", value)} />
                  <CheckField label={t("builder.allowSharing")} checked={draft.allow_sharing_link} onChange={(value) => setField("allow_sharing_link", value)} />
                  <CheckField label={t("builder.externalRegistration")} checked={draft.allow_external_registration} onChange={(value) => setField("allow_external_registration", value)} />
                  <CheckField label={autoApproveLabel} checked={draft.auto_approve_join_requests} onChange={(value) => setField("auto_approve_join_requests", value)} note={autoApproveNote} />
                  {draft.participation_type !== "individual" && (
                    <>
                      <Field label={t("builder.minTeam")}><input type="number" min="1" value={draft.min_team_size} onChange={(e) => setField("min_team_size", Number(e.target.value))} /></Field>
                      <Field label={t("builder.maxTeam")}><input type="number" min="1" value={draft.max_team_size} onChange={(e) => setField("max_team_size", Number(e.target.value))} /></Field>
                      <CheckField label={t("builder.participantInvites")} checked={draft.allow_user_team_invites} onChange={(value) => setField("allow_user_team_invites", value)} />
                      <CheckField label={t("builder.organizerAssignment")} checked={draft.allow_organizer_team_assignment} onChange={(value) => setField("allow_organizer_team_assignment", value)} />
                    </>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="builder-stack">
                <h2>{t("builder.scheduleRounds")}</h2>
                <p className="builder-muted">{t("builder.scheduleText")}</p>
                <div className="builder-form-grid">
                  <Field label={t("builder.registrationStarts")}><input type="datetime-local" value={draft.registration_starts_at || ""} onChange={(e) => setField("registration_starts_at", e.target.value)} /></Field>
                  <Field label={t("builder.registrationEnds")}><input type="datetime-local" value={draft.registration_ends_at || ""} onChange={(e) => setField("registration_ends_at", e.target.value)} /></Field>
                  <Field label={t("builder.competitionStarts")} note={t("builder.competitionStartsNote")}><input type="datetime-local" value={draft.starts_at || ""} onChange={(e) => setField("starts_at", e.target.value)} /></Field>
                  <Field label={t("builder.competitionEnds")}><input type="datetime-local" value={draft.ends_at || ""} onChange={(e) => setField("ends_at", e.target.value)} /></Field>
                  <Field label={t("builder.judgingStarts")}><input type="datetime-local" value={draft.judging_starts_at || ""} onChange={(e) => setField("judging_starts_at", e.target.value)} /></Field>
                  <Field label={t("builder.judgingEnds")}><input type="datetime-local" value={draft.judging_ends_at || ""} onChange={(e) => setField("judging_ends_at", e.target.value)} /></Field>
                  <Field label={t("builder.resultsPublic")}><input type="datetime-local" value={draft.results_public_at || ""} onChange={(e) => setField("results_public_at", e.target.value)} /></Field>
                </div>

                {scheduleErrors.length > 0 && (
                  <div className="builder-error-list" role="alert">
                    {scheduleErrors.map((item) => <div key={item}>{item}</div>)}
                  </div>
                )}

                <h2>{t("builder.rounds")}</h2>
                {draft.rounds.map((round, index) => (
                  <div className="builder-inline-card builder-round-card" key={index}>
                    <div className="builder-round-card-head">
                      <strong>{t("builder.defaults.round", { number: index + 1 })}</strong>
                      <button
                        type="button"
                        className="builder-danger-btn"
                        onClick={() => removeArrayItem("rounds", index)}
                        disabled={draft.rounds.length <= 1}
                      >
                        {t("builder.delete")}
                      </button>
                    </div>
                    <input value={round.title} onChange={(e) => updateArrayItem("rounds", index, "title", e.target.value)} placeholder={t("builder.roundTitle")} />
                    <input type="datetime-local" value={round.starts_at || ""} onChange={(e) => updateArrayItem("rounds", index, "starts_at", e.target.value)} title={t("builder.roundTimeTitle")} />
                    <input type="datetime-local" value={round.ends_at || ""} onChange={(e) => updateArrayItem("rounds", index, "ends_at", e.target.value)} />
                    <input
                      type="number"
                      min="1"
                      value={round.max_attempts || 1}
                      onChange={(e) => updateArrayItem("rounds", index, "max_attempts", Math.max(1, Number(e.target.value) || 1))}
                      placeholder={t("builder.maxAttempts", { defaultValue: "Max attempts" })}
                    />
                    <label className="builder-round-check"><input type="checkbox" checked={Boolean(round.submission_required)} onChange={(e) => updateArrayItem("rounds", index, "submission_required", e.target.checked)} /> {t("builder.submissionRequired")}</label>
                    <label className="builder-round-check"><input type="checkbox" checked={Boolean(round.is_stream_enabled)} onChange={(e) => updateArrayItem("rounds", index, "is_stream_enabled", e.target.checked)} /> {t("builder.showVideo")}</label>
                    {round.is_stream_enabled && (
                      <>
                        <input value={round.stream_label || ""} onChange={(e) => updateArrayItem("rounds", index, "stream_label", e.target.value)} placeholder={t("builder.streamLabel")} />
                        <input
                          value={round.stream_url || ""}
                          onChange={(e) => updateArrayItem("rounds", index, "stream_url", e.target.value)}
                          onBlur={(e) => updateArrayItem("rounds", index, "stream_url", normalizeStreamInput(e.target.value))}
                          placeholder={t("builder.streamUrl")}
                        />
                        <small className="builder-stream-hint">{t("builder.streamHint")}</small>
                      </>
                    )}
                    <textarea value={round.description || ""} onChange={(e) => updateArrayItem("rounds", index, "description", e.target.value)} placeholder={t("builder.roundDescription")} />
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem("rounds", { title: t("builder.defaults.round", { number: draft.rounds.length + 1 }), description: "", starts_at: "", ends_at: "", submission_required: true, max_attempts: 1, is_stream_enabled: false, stream_url: "", stream_embed_url: "", stream_label: "" })}>+ {t("builder.addRound")}</button>
              </div>
            )}

            {step === 4 && (
              <div className="builder-stack">
                <h2>{t("builder.submissionSettings")}</h2>
                <div className="builder-form-grid">
                  <Field label={t("builder.submissionMode")}><select value={draft.submission_settings.submission_mode} onChange={(e) => setNested("submission_settings", "submission_mode", e.target.value)}><option value="file_upload">{t("options.submission_mode.file_upload")}</option><option value="text_answer">{t("options.submission_mode.text_answer")}</option><option value="repository_link">{t("options.submission_mode.repository_link")}</option><option value="demo_link">{t("options.submission_mode.demo_link")}</option><option value="mixed">{t("options.submission_mode.mixed")}</option></select></Field>
                  <Field label={t("builder.submissionPolicy", { defaultValue: "Submission policy" })}><select value={draft.submission_settings.submission_policy || "single"} onChange={(e) => setNested("submission_settings", "submission_policy", e.target.value)}><option value="single">{t("options.submission_policy.single", { defaultValue: "Single submission" })}</option><option value="latest">{t("options.submission_policy.latest", { defaultValue: "Latest submission wins" })}</option><option value="multiple">{t("options.submission_policy.multiple", { defaultValue: "Multiple submissions" })}</option></select></Field>
                  <Field label={t("builder.maxFileSize")}><input type="number" value={draft.submission_settings.max_file_size_mb} onChange={(e) => setNested("submission_settings", "max_file_size_mb", Number(e.target.value))} /></Field>
                  <Field label={t("builder.maxSubmissions")}><input type="number" value={draft.submission_settings.max_submissions} onChange={(e) => setNested("submission_settings", "max_submissions", Number(e.target.value))} /></Field>
                  <CheckField label={t("builder.repositoryRequired")} checked={draft.submission_settings.repository_url_required} onChange={(value) => setNested("submission_settings", "repository_url_required", value)} />
                  <CheckField label={t("builder.demoRequired")} checked={draft.submission_settings.demo_url_required} onChange={(value) => setNested("submission_settings", "demo_url_required", value)} />
                </div>

                <h2>{t("builder.materials")}</h2>
                <div className="builder-form-grid">
                  <Field label={t("builder.materialTitle")}><input value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder={t("builder.materialPlaceholder")} /></Field>
                  <Field label={t("builder.materialType")}><select value={materialType} onChange={(e) => setMaterialType(e.target.value)}><option value="rules">{t("options.material_type.rules")}</option><option value="dataset">{t("options.material_type.dataset")}</option><option value="template">{t("options.material_type.template")}</option><option value="guide">{t("options.material_type.guide")}</option><option value="other">{t("options.material_type.other")}</option></select></Field>
                  <Field label={t("builder.uploadFile")}><input type="file" onChange={(e) => setMaterialFile(e.target.files?.[0] || null)} /></Field>
                  <Field label={t("builder.externalUrl")}><input value={materialUrl} onChange={(e) => setMaterialUrl(e.target.value)} placeholder="https://..." /></Field>
                </div>
                <button type="button" onClick={uploadMaterial}>{t("builder.addMaterial")}</button>
                {(draft.materials || []).length > 0 && (
                  <div className="builder-inline-card">
                    {(draft.materials || []).map((material) => {
                      const href = getMaterialUrl(material);
                      return (
                        <span className="builder-material-row" key={material.id}>
                          <strong>{getMaterialBadge(material)}</strong>
                          {href ? (
                            <a href={href} target="_blank" rel="noreferrer">{getMaterialTitle(material, t("profile.material"))}</a>
                          ) : (
                            <span>{getMaterialTitle(material, t("profile.material"))}</span>
                          )}
                          <small>{getMaterialMeta(material, t)}</small>
                          <button type="button" onClick={() => removeMaterial(material.id)}>{t("builder.remove")}</button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <h2>{t("builder.criteria")}</h2>
                {draft.judging_criteria.map((criterion, index) => (
                  <div className="builder-inline-card" key={index}>
                    <input value={criterion.title} onChange={(e) => updateArrayItem("judging_criteria", index, "title", e.target.value)} placeholder={t("builder.criterionTitle", { defaultValue: "Criterion title" })} />
                    <select value={criterion.judging_mode || "manual"} onChange={(e) => updateArrayItem("judging_criteria", index, "judging_mode", e.target.value)}>
                      <option value="manual">{t("options.review_type.manual", { defaultValue: "Manual" })}</option>
                      <option value="automatic">{t("options.review_type.automatic", { defaultValue: "Automatic" })}</option>
                      <option value="peer_review">{t("options.review_type.peer_review", { defaultValue: "Peer review" })}</option>
                      <option value="mixed">{t("options.review_type.mixed", { defaultValue: "Mixed" })}</option>
                    </select>
                    <input type="number" min="1" value={criterion.max_score} onChange={(e) => updateArrayItem("judging_criteria", index, "max_score", Math.max(1, Number(e.target.value) || 1))} />
                    <Field label={t("builder.criterionWeight", { defaultValue: "Вага критерію" })}><input type="number" min="0" step="0.1" value={criterion.weight} onChange={(e) => updateArrayItem("judging_criteria", index, "weight", Math.max(0, Number(e.target.value) || 0))} /></Field>
                    <textarea value={criterion.description || ""} onChange={(e) => updateArrayItem("judging_criteria", index, "description", e.target.value)} placeholder={t("builder.criterionDescription", { defaultValue: "Criterion description" })} />
                  </div>
                ))}
                <button type="button" onClick={() => addArrayItem("judging_criteria", { title: t("builder.defaults.newCriterion"), description: "", judging_mode: "manual", max_score: 10, weight: 1 })}>+ {t("builder.addCriterion")}</button>

                <h2>{t("builder.jury")}</h2>
                <div className="builder-form-grid">
                  <Field label={t("builder.judgeEmail")}><input type="email" value={judgeText} onChange={(e) => setJudgeText(e.target.value)} placeholder="judge@example.com" /></Field>
                </div>
                <button type="button" onClick={assignJudge}>{t("builder.assignJudge")}</button>
                {judges.length > 0 && <div className="builder-inline-card">{judges.map((judge) => <span key={judge.id}>{judge.display_name || judge.user_name || t("builder.judgeFallback")} - {t(`options.status.${judge.status}`, { defaultValue: judge.status })}</span>)}</div>}

                <h2>{t("builder.awards")}</h2>
                {draft.awards.map((award, index) => <div className="builder-inline-card" key={index}><input value={award.title} onChange={(e) => updateArrayItem("awards", index, "title", e.target.value)} /><input type="number" value={award.place || ""} onChange={(e) => updateArrayItem("awards", index, "place", Number(e.target.value))} /></div>)}
                <button type="button" onClick={() => addArrayItem("awards", { title: t("builder.defaults.specialAward"), place: null, issue_certificate: true, issue_badge: true })}>+ {t("builder.addAward")}</button>
              </div>
            )}

            {step === 5 && (
              <div className="builder-stack">
                <section className="builder-preview-card">
                  <div style={draft.cover_image ? { backgroundImage: `url(${draft.cover_image})` } : undefined} />
                  <article><span>{t(`options.industry.${draft.industry}`, { defaultValue: draft.industry })} - {t(`options.participation_type.${draft.participation_type}`, { defaultValue: draft.participation_type })} - {t(`options.access_mode.${draft.access_mode}`, { defaultValue: draft.access_mode })} - {String(draft.language || "uk").toUpperCase()}</span><h2>{draft.name}</h2><p>{draft.short_description || t("builder.noShort")}</p></article>
                </section>
                <section className="builder-validation">
                  <h2>{t("builder.validationTitle")}</h2>
                  {validation.length ? <p>{t("builder.fixBefore", { items: validation.join(", ") })}</p> : <p>{t("builder.requiredFilled")}</p>}
                  {approvalStatus === "rejected" && <p>{t("builder.rejected")}</p>}
                </section>
                <section className="builder-invites">
                  <h2>{t("builder.invitations")}</h2>
                  <p>{t("builder.invitationsText")}</p>
                  <div className="builder-form-grid">
                    <Field label={t("builder.individualEmails")}><textarea value={inviteText} onChange={(e) => setInviteText(e.target.value)} placeholder="one@email.com, two@email.com" /></Field>
                    <Field label={t("builder.teamEmails")}><textarea value={teamInviteText} onChange={(e) => setTeamInviteText(e.target.value)} placeholder="captain@email.com" /></Field>
                  </div>
                  <button type="button" onClick={() => queueInvitations("individual")}>{t("builder.queueIndividual")}</button>
                  <button type="button" onClick={() => queueInvitations("team")}>{t("builder.queueTeam")}</button>
                </section>
                <section className="builder-invites">
                  <h2>{t("overviewTab.announcements", { defaultValue: "Announcements" })}</h2>
                  <div className="builder-form-grid">
                    <Field label={t("builder.announcementTitle", { defaultValue: "Announcement title" })}><input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} /></Field>
                    <CheckField label={t("builder.announcementPinned", { defaultValue: "Pinned" })} checked={announcementPinned} onChange={setAnnouncementPinned} />
                    <Field label={t("builder.announcementText", { defaultValue: "Announcement text" })}><textarea value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} /></Field>
                  </div>
                  <button type="button" onClick={saveAnnouncement}>{announcementId ? t("builder.saveFinal") : t("builder.addAnnouncement", { defaultValue: "Add announcement" })}</button>
                  {announcementId && <button type="button" onClick={resetAnnouncementForm}>{t("auth.close", { defaultValue: "Cancel" })}</button>}
                  {announcements.length > 0 && (
                    <div className="builder-inline-card">
                      {announcements.map((announcement) => (
                        <span className="builder-material-row" key={announcement.id}>
                          <strong>{announcement.is_pinned ? "PIN" : "MSG"}</strong>
                          <span>{announcement.title}</span>
                          <button type="button" onClick={() => editAnnouncement(announcement)}>{t("builder.edit", { defaultValue: "Edit" })}</button>
                          <button type="button" onClick={() => removeAnnouncement(announcement.id)}>{t("builder.remove")}</button>
                        </span>
                      ))}
                    </div>
                  )}
                </section>
                <button className="builder-publish-btn" type="button" onClick={handlePublish} disabled={validation.length > 0 || !canPublishFromApproval}>{t("builder.publishCompetition")}</button>
              </div>
            )}

            <div className="builder-actions">
              <button type="button" disabled={step === 1} onClick={() => saveDraft(step - 1)}>{t("builder.back")}</button>
              <button type="button" onClick={() => step < 5 ? saveDraft(step + 1) : saveDraft(5)}>{step < 5 ? t("builder.saveContinue") : t("builder.saveFinal")}</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
