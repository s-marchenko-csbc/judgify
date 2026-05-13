import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import FiltersSidebar from "../components/FiltersSidebar";
import CompetitionTabs from "../components/CompetitionTabs";
import CompetitionCard from "../components/CompetitionCard";
import RightSidebar from "../components/RightSidebar";
import SignUpModal from "../components/SignUpModal";
import OnboardModal from "../components/auth/OnboardModal";
import SignInModal from "../components/auth/SignInModal";

import {
  fetchCompetitions,
  fetchLandingFilters,
  fetchSidebar,
} from "../api/landingApi";
import { fetchSavedCompetitions } from "../api/savedApi";

import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const initialFilters = {
  search: "",
  tab: "registration_open",
  event_type: [],
  participation_type: [],
  industry: [],
  difficulty: [],
  language: [],
};

const statusTabs = {
  registration_open: ["registration_open"],
  active: ["active"],
  judging: ["judging"],
  upcoming: ["upcoming", "published"],
  finished: ["finished"],
  archived: ["archived"],
};

function mergeSavedState(items, savedIds, { isAuthenticated = false, trustItemState = false } = {}) {
  return (items || []).map((item) => ({
    ...item,
    is_saved: isAuthenticated && (savedIds.has(item.id) || (trustItemState && Boolean(item.is_saved))),
  }));
}

function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isWithin(start, end, now) {
  return Boolean(start && end && start <= now && now <= end);
}

function deriveTimedCompetition(item, now) {
  if (!item || ["draft", "archived"].includes(item.status)) return item;

  const startsAt = toTime(item.starts_at);
  const endsAt = toTime(item.ends_at);
  const registrationStartsAt = toTime(item.registration_starts_at);
  const registrationEndsAt = toTime(item.registration_ends_at);
  const judgingStartsAt = toTime(item.judging_starts_at);
  const judgingEndsAt = toTime(item.judging_ends_at);
  const resultsPublicAt = toTime(item.results_public_at);

  const registrationOpen = registrationStartsAt && registrationEndsAt
    ? registrationStartsAt <= now && now <= registrationEndsAt
    : registrationEndsAt
      ? now <= registrationEndsAt
      : registrationStartsAt
        ? registrationStartsAt <= now && (!startsAt || now < startsAt)
        : Boolean(item.registration_open);

  const resultsPublished = Boolean(resultsPublicAt && now >= resultsPublicAt);
  const judgingOpen = !resultsPublished
    && Boolean(judgingStartsAt || judgingEndsAt)
    && (!judgingStartsAt || now >= judgingStartsAt)
    && (!judgingEndsAt || now <= judgingEndsAt);
  let status = item.status || "upcoming";

  const competitionWindowFinished = Boolean(endsAt && now > endsAt);

  if (resultsPublished) {
    status = "finished";
  } else if (judgingOpen && (competitionWindowFinished || item.status === "judging")) {
    status = "judging";
  } else if (startsAt && now < startsAt) {
    status = registrationOpen ? "registration_open" : "upcoming";
  } else if (isWithin(startsAt, endsAt, now)) {
    status = "active";
  } else if (endsAt && now > endsAt) {
    status = "finished";
  } else if (status === "published") {
    status = registrationOpen ? "registration_open" : "upcoming";
  }

  let timerDeadline = null;
  if (status === "registration_open") timerDeadline = item.registration_ends_at || item.starts_at;
  else if (status === "upcoming") {
    const futureMilestones = [
      item.registration_starts_at,
      item.starts_at,
    ].filter((value) => {
      const time = toTime(value);
      return time && time > now;
    });
    timerDeadline = futureMilestones.sort((a, b) => toTime(a) - toTime(b))[0] || item.starts_at;
  }
  else if (status === "active") timerDeadline = item.timer_deadline || item.ends_at;
  else if (status === "judging") timerDeadline = item.judging_ends_at || item.results_public_at;
  else if (status === "finished") timerDeadline = resultsPublicAt && resultsPublicAt > now ? item.results_public_at : null;

  return {
    ...item,
    status,
    timer_deadline: timerDeadline,
    registration_open: registrationOpen,
    submissions_open: status === "active" ? item.submissions_open : false,
  };
}

function LandingSkeleton({ withSidebar = false }) {
  return (
    <div className={`competition-grid landing-loading-grid ${withSidebar ? "with-sidebar" : ""}`} aria-hidden="true">
      <div className="cards-grid landing-skeleton-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="landing-skeleton-card" key={index}>
            <div className="landing-skeleton-cover" />
            <div className="landing-skeleton-line wide" />
            <div className="landing-skeleton-line" />
            <div className="landing-skeleton-line short" />
          </div>
        ))}
      </div>
      {withSidebar && (
        <aside className="right-sidebar landing-skeleton-sidebar">
          <div className="landing-skeleton-panel" />
          <div className="landing-skeleton-panel short" />
        </aside>
      )}
    </div>
  );
}

function LatestCompetitionsBlock({ items, now, onSavedChange, title }) {
  if (!items.length) return null;

  return (
    <section className="landing-latest-block landing-results-enter" aria-labelledby="landing-latest-title">
      <div className="landing-section-heading">
        <h2 id="landing-latest-title">{title}</h2>
      </div>
      <div className="cards-grid landing-latest-grid">
        {items.map((item) => (
          <CompetitionCard
            key={`latest-${item.id}`}
            item={item}
            now={now}
            onSavedChange={onSavedChange}
          />
        ))}
      </div>
    </section>
  );
}

function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function usePageTicker(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
      }
    };
    const timer = window.setInterval(tick, intervalMs);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);

  return now;
}

export default function LandingPage() {
  const { user, login, isAuthenticated, authSessionKey } = useAuth();
  const { language, t } = useLanguage();

  const [filters, setFilters] = useState(initialFilters);
  const debouncedSearch = useDebouncedValue(filters.search, 250);
  const [filterOptions, setFilterOptions] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [sidebarData, setSidebarData] = useState(null);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const savedIdsRef = useRef(savedIds);
  const loadSeqRef = useRef(0);
  const now = usePageTicker(1000);
  const [loading, setLoading] = useState(false);

  const [authStep, setAuthStep] = useState(null);
  const [pendingSignUpData, setPendingSignUpData] = useState(null);
  const latestTitle = language === "uk"
    ? "Останні змагання"
    : t("landing.latestCompetitions", { defaultValue: "Latest competitions" });

  const requestFilters = useMemo(
    () => ({
      search: debouncedSearch,
      tab: filters.tab,
      event_type: filters.event_type,
      participation_type: filters.participation_type,
      industry: filters.industry,
      difficulty: filters.difficulty,
      language: filters.language,
    }),
    [debouncedSearch, filters.tab, filters.event_type, filters.participation_type, filters.industry, filters.difficulty, filters.language]
  );

  const timedCompetitions = useMemo(
    () => competitions.map((item) => deriveTimedCompetition(item, now)),
    [competitions, now]
  );

  const displayedCompetitions = useMemo(() => {
    const tabStatuses = statusTabs[filters.tab] || statusTabs.registration_open;
    return timedCompetitions.filter((item) => tabStatuses.includes(item.status));
  }, [filters.tab, timedCompetitions]);

  const latestCompetitions = useMemo(() => {
    const latest = sidebarData?.last_competitions || [];
    return latest
      .map((item) => deriveTimedCompetition({
        ...item,
        is_saved: isAuthenticated && savedIds.has(item.id),
      }, now))
      .filter((item) => item?.status !== "archived")
      .slice(0, 6);
  }, [isAuthenticated, now, savedIds, sidebarData]);

  useEffect(() => {
    fetchLandingFilters(language).then(setFilterOptions).catch(console.error);
  }, [language]);

  useEffect(() => {
    savedIdsRef.current = savedIds;
  }, [savedIds]);

  const refreshCompetitions = useCallback(async ({ showLoader = false } = {}) => {
    const seq = ++loadSeqRef.current;
    const requestAuthKey = authSessionKey;
    if (showLoader) setLoading(true);
    try {
      const data = await fetchCompetitions(requestFilters);
      if (seq !== loadSeqRef.current || requestAuthKey !== authSessionKey) return;
      setCompetitions(() => {
        const localSaved = isAuthenticated ? new Set(savedIdsRef.current) : new Set();
        if (isAuthenticated) {
          data.forEach((item) => {
            if (item.is_saved) localSaved.add(item.id);
          });
        }
        return mergeSavedState(data, localSaved, {
          isAuthenticated,
          trustItemState: isAuthenticated,
        });
      });
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoader && seq === loadSeqRef.current) setLoading(false);
    }
  }, [authSessionKey, isAuthenticated, requestFilters]);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      if (cancelled) return;
      await refreshCompetitions({ showLoader: true });
    }

    initialLoad();
    const intervalId = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") {
        refreshCompetitions({ showLoader: false });
      }
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authSessionKey, refreshCompetitions]);

  useEffect(() => {
    const currentTime = Date.now();
    const nearestDeadline = competitions.reduce((nearest, item) => {
      const deadline = toTime(item.timer_deadline);
      if (!deadline || deadline <= currentTime) return nearest;
      return Math.min(nearest, deadline);
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(nearestDeadline)) return undefined;

    const delay = Math.max(500, Math.min(nearestDeadline - currentTime + 1200, 60000));
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        refreshCompetitions({ showLoader: false });
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [competitions, refreshCompetitions]);

  useEffect(() => {
    setCompetitions((prev) => mergeSavedState(prev, savedIds, { isAuthenticated }));
  }, [authSessionKey, isAuthenticated, savedIds]);

  useEffect(() => {
    let cancelled = false;
    const requestAuthKey = authSessionKey;

    const applyAnonymousSidebar = (data) => {
      if (cancelled || requestAuthKey !== authSessionKey) return;
      setSidebarData({
        ...(data || {}),
        saved_competitions: [],
      });
    };

    const applyAuthenticatedSidebar = (data, savedRecords) => {
      if (cancelled || requestAuthKey !== authSessionKey) return;
      const savedList = (data?.saved_competitions || []).slice(0, 6);
      const nextSavedIds = new Set(
        (savedRecords || [])
          .map((record) => record?.competition?.id)
          .filter(Boolean)
      );
      setSidebarData({
        ...data,
        saved_competitions: savedList.map((item) => ({ ...item, is_saved: true })),
      });
      setSavedIds(nextSavedIds);
    };

    if (!isAuthenticated) {
      setSidebarData(null);
      setSavedIds(new Set());
      setCompetitions((prev) => mergeSavedState(prev, new Set(), { isAuthenticated: false }));
      const loadAnonymousSidebar = () => fetchSidebar().then(applyAnonymousSidebar).catch(console.error);
      loadAnonymousSidebar();
      const intervalId = window.setInterval(() => {
        if (document.visibilityState === "visible") loadAnonymousSidebar();
      }, 15000);
      return () => {
        cancelled = true;
        window.clearInterval(intervalId);
      };
    }

    setSidebarData(null);
    setSavedIds(new Set());
    setCompetitions((prev) => mergeSavedState(prev, new Set(), { isAuthenticated: false }));
    const loadAuthenticatedSidebar = () =>
      Promise.all([fetchSidebar(), fetchSavedCompetitions()])
        .then(([data, savedRecords]) => applyAuthenticatedSidebar(data, savedRecords))
        .catch(console.error);
    loadAuthenticatedSidebar();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") loadAuthenticatedSidebar();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authSessionKey, isAuthenticated]);

  const handleToggleFilter = (groupName, value) => {
    setFilters((prev) => {
      const exists = prev[groupName].includes(value);

      return {
        ...prev,
        [groupName]: exists
          ? prev[groupName].filter((v) => v !== value)
          : [...prev[groupName], value],
      };
    });
  };

  const handleReset = () => {
    setFilters(initialFilters);
  };

  const handleOpenSignUp = () => {
    setAuthStep("signup");
  };

  const handleCloseSignUp = () => {
    setAuthStep(null);
  };

  const handleOpenSignIn = () => {
    setAuthStep("signin");
  };

  const handleSignUpComplete = (data) => {
    setPendingSignUpData(data || null);
    setAuthStep("onboard");
  };

  const handleSignInComplete = async (credentials) => {
    await login(credentials);
    setAuthStep(null);
  };

  const handleFinishOnboarding = async (data) => {
    try {
      await login({
        ...(pendingSignUpData || {}),
        interests: data?.interests || [],
        createTeam: data?.createTeam || false,
      });
      setPendingSignUpData(null);
      setAuthStep(null);
    } catch (error) {
      console.error("Failed to complete account registration", error);
      alert(error?.message || t("auth.registrationFailed", { defaultValue: "Could not create account." }));
    }
  };

  const handleSavedChange = (competitionId, nextSaved, sourceItem = null) => {
    const knownCompetition =
      sourceItem || competitions.find((competition) => competition.id === competitionId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nextSaved) next.add(competitionId);
      else next.delete(competitionId);
      return next;
    });

    setCompetitions((prev) =>
      prev.map((competition) =>
        competition.id === competitionId
          ? { ...competition, is_saved: nextSaved }
          : competition
      )
    );

    if (!isAuthenticated) return;

    setSidebarData((prev) => {
      if (!prev) {
        return {
          recently_viewed: [],
          recent_materials: [],
          last_competitions: [],
          saved_competitions: nextSaved && knownCompetition ? [knownCompetition] : [],
        };
      }

      const currentSaved = prev.saved_competitions || [];
      let nextSavedList;

      if (nextSaved) {
        const itemForSidebar = {
          ...(knownCompetition || {}),
          id: competitionId,
          is_saved: true,
        };
        nextSavedList = [
          itemForSidebar,
          ...currentSaved.filter((item) => item.id !== competitionId),
        ].slice(0, 6);
      } else {
        nextSavedList = currentSaved.filter((item) => item.id !== competitionId);
      }

      return {
        ...prev,
        saved_competitions: nextSavedList,
      };
    });
  };

  return (
    <div className="landing-page">
      <Header
        search={filters.search}
        onSearchChange={(value) =>
          setFilters((prev) => ({ ...prev, search: value }))
        }
        onOpenSignUp={handleOpenSignUp}
        onOpenSignIn={handleOpenSignIn}
      />

      <div className="landing-layout">
        <FiltersSidebar
          filterOptions={filterOptions}
          filters={filters}
          onToggleFilter={handleToggleFilter}
          onReset={handleReset}
        />

        <main className="landing-main">
          <CompetitionTabs
            activeTab={filters.tab}
            onChange={(tab) => setFilters((prev) => ({ ...prev, tab }))}
          />

          {loading ? (
            <LandingSkeleton withSidebar={isAuthenticated} />
          ) : (
            <div
              className={`competition-grid landing-results-enter ${
                isAuthenticated ? "with-sidebar" : ""
              }`}
            >
              <div className="cards-grid">
                {displayedCompetitions.map((item) => (
                  <CompetitionCard
                    key={item.id}
                    item={item}
                    now={now}
                    onSavedChange={handleSavedChange}
                  />
                ))}
                {!displayedCompetitions.length && (
                  <div className="landing-empty-state">
                    {t("landing.empty", { defaultValue: "No competitions in this tab yet." })}
                  </div>
                )}
              </div>

              {isAuthenticated && (
                <RightSidebar data={sidebarData} onSavedChange={handleSavedChange} />
              )}
            </div>
          )}

          {!loading && !isAuthenticated && (
            <LatestCompetitionsBlock
              items={latestCompetitions}
              now={now}
              onSavedChange={handleSavedChange}
              title={latestTitle}
            />
          )}
        </main>
      </div>

      {authStep === "signup" && (
        <SignUpModal
          isOpen={true}
          onClose={handleCloseSignUp}
          onOpenSignIn={handleOpenSignIn}
          onComplete={handleSignUpComplete}
        />
      )}

      {authStep === "signin" && (
        <SignInModal
          isOpen={true}
          onClose={() => setAuthStep(null)}
          onOpenSignUp={handleOpenSignUp}
          onComplete={handleSignInComplete}
        />
      )}

      {authStep === "onboard" && <OnboardModal onFinish={handleFinishOnboarding} />}
    </div>
  );
}
