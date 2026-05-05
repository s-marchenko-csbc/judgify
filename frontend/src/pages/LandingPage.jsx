import React, { useCallback, useEffect, useMemo, useState } from "react";
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

export default function LandingPage() {
  const { user, login, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [filters, setFilters] = useState(initialFilters);
  const [filterOptions, setFilterOptions] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [sidebarData, setSidebarData] = useState(null);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  const [authStep, setAuthStep] = useState(null);
  const [pendingSignUpData, setPendingSignUpData] = useState(null);

  const requestFilters = useMemo(
    () => ({
      search: filters.search,
      tab: filters.tab,
      status: filters.status,
      event_type: filters.event_type,
      participation_type: filters.participation_type,
      industry: filters.industry,
      difficulty: filters.difficulty,
      language: filters.language,
    }),
    [filters]
  );

  useEffect(() => {
    fetchLandingFilters().then(setFilterOptions).catch(console.error);
  }, []);

  const refreshCompetitions = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const data = await fetchCompetitions(requestFilters);
      setCompetitions((prev) => {
        const localSaved = new Set(savedIds);
        prev.forEach((item) => {
          if (item.is_saved) localSaved.add(item.id);
        });
        return mergeSavedState(data, localSaved);
      });
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [requestFilters, savedIds]);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      if (cancelled) return;
      await refreshCompetitions({ showLoader: true });
    }

    initialLoad();
    const intervalId = window.setInterval(() => {
      if (!cancelled) refreshCompetitions({ showLoader: false });
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshCompetitions]);

  useEffect(() => {
    setCompetitions((prev) => mergeSavedState(prev, savedIds));
  }, [savedIds]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSidebarData(null);
      setSavedIds(new Set());
      return;
    }

    fetchSidebar()
      .then((data) => {
        const savedList = (data?.saved_competitions || []).slice(0, 6);
        setSidebarData({
          ...data,
          saved_competitions: savedList,
        });
        setSavedIds(new Set(savedList.map((item) => item.id)));
      })
      .catch(console.error);
  }, [isAuthenticated]);

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
      console.error("Failed to complete demo login", error);
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
