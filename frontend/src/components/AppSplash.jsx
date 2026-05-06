import React from "react";
import BrandLogo from "./BrandLogo";

export default function AppSplash({ hint = "Starting backend and database..." }) {
  return (
    <div className="app-splash" aria-label="Judgify loading">
      <BrandLogo className="app-splash-logo" showText />
      <div className="app-splash-hint">{hint}</div>
    </div>
  );
}
