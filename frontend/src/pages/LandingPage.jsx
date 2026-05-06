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

import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const initialFilters = {
  search: "",
  tab: "active",
  status: [],
  event_type: [],
  participation_type: [],
  industry: [],
  difficulty: [],
  language: [],
};

function mergeSavedState(items, savedIds) {
  return (items || []).map((item) => ({
    ...item,
    is_saved: savedIds.has(item.id) || Boolean(item.is_saved),
  }));
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

  const requestFilters = useMemo(
    () => ({
      search: debouncedSearch,
      tab: filters.tab,
      status: filters.status,
      event_type: filters.event_type,
      participation_type: filters.participation_type,
      industry: filters.industry,
      difficulty: filters.difficulty,
      language: filters.language,
    }),
    [debouncedSearch, filters.tab, filters.status, filters.event_type, filters.participation_type, filters.industry, filters.difficulty, filters.language]
  );

  useEffect(() => {
    fetchLandingFilters(language).then(setFilterOptions).catch(console.error);
  }, [language]);

  useEffect(() => {
    savedIdsRef.current = savedIds;
  }, [savedIds]);

  const refreshCompetitions = useCallback(async ({ showLoader = false } = {}) => {
    const seq = ++loadSeqRef.current;
    if (showLoader) setLoading(true);
    try {
      const data = await fetchCompetitions(requestFilters);
      if (seq !== loadSeqRef.current) return;
      setCompetitions((prev) => {
        const localSaved = isAuthenticated ? new Set(savedIdsRef.current) : new Set();
        if (isAuthenticated) {
          prev.forEach((item) => {
            if (item.is_saved) localSaved.add(item.id);
          });
        }
        return mergeSavedState(data, localSaved);
      });
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoader && seq === loadSeqRef.current) setLoading(false);
    }
  }, [isAuthenticated, requestFilters]);

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
    setCompetitions((prev) => mergeSavedState(prev, isAuthenticated ? savedIds : new Set()));
  }, [isAuthenticated, savedIds]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSidebarData(null);
      setSavedIds(new Set());
      return;
    }

    let cancelled = false;
    setSidebarData(null);
    setSavedIds(new Set());
    fetchSidebar()
      .then((data) => {
        if (cancelled) return;
        const savedList = (data?.saved_competitions || []).slice(0, 6);
        setSidebarData({
          ...data,
          saved_competitions: savedList,
        });
        setSavedIds(new Set(savedList.map((item) => item.id)));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
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
            <div>{t("landing.loading")}</div>
          ) : (
            <div
              className={`competition-grid ${
                isAuthenticated ? "with-sidebar" : ""
              }`}
            >
              <div className="cards-grid">
                {competitions.map((item) => (
                  <CompetitionCard
                    key={item.id}
                    item={item}
                    now={now}
                    onSavedChange={handleSavedChange}
                  />
                ))}
              </div>

              {isAuthenticated && (
                <RightSidebar data={sidebarData} onSavedChange={handleSavedChange} />
              )}
            </div>
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
