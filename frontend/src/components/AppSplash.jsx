import React from "react";

export default function AppSplash({ hint = "Starting backend and database..." }) {
  return (
    <div className="app-splash" aria-label="Judgify loading">
      <div className="app-splash-logo">Judgify</div>
      <div className="app-splash-hint">{hint}</div>
    </div>
  );
}
