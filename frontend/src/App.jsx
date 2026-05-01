import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import ProfilePage from "./pages/ProfilePage";
import CompetitionPage from "./pages/CompetitionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/competitions/:id" element={<CompetitionPage />} />
      </Routes>
    </BrowserRouter>
  );
}