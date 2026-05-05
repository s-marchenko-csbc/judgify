import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import ProfilePage from "./pages/ProfilePage";
import CompetitionPage from "./pages/CompetitionPage"
import CompetitionBuilderPage from "./pages/CompetitionBuilderPage"
import AppSplash from "./components/AppSplash";
import { API_BASE } from "./api/client";

export default function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [loadingHint, setLoadingHint] = useState("Starting backend and database...");

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function waitForBackend() {
      while (!cancelled) {
        attempt += 1;
        try {
          const response = await fetch(`${API_BASE}/health/`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          const payload = await response.json().catch(() => ({}));

          if (response.ok && payload.ready) {
            if (!cancelled) setBackendReady(true);
            return;
          }

          if (!cancelled) {
            setLoadingHint("Loading demo competitions...");
          }
        } catch (error) {
          if (!cancelled && attempt > 3) {
            setLoadingHint("Waiting for API connection...");
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, Math.min(900 + attempt * 150, 1800)));
      }
    }

    waitForBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!backendReady) {
    return <AppSplash hint={loadingHint} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/competitions/new" element={<CompetitionBuilderPage />} />
        <Route path="/competitions/:id/edit" element={<CompetitionBuilderPage />} />
        <Route path="/competitions/:id" element={<CompetitionPage />} />
      </Routes>
    </BrowserRouter>
  );
}