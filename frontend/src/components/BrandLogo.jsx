import React from "react";
import logoUrl from "../assets/judgify-logo.svg";

export default function BrandLogo({
  className = "",
  markClassName = "",
  showText = false,
  text = "Judgify",
}) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img className={`brand-logo-mark ${markClassName}`.trim()} src={logoUrl} alt="" aria-hidden="true" />
      {showText && <span className="brand-logo-text">{text}</span>}
    </span>
  );
}
