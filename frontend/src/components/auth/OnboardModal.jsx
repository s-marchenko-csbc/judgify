import React, { useState } from "react";

const suggestedInterests = [
  "Programming",
  "AI",
  "Design",
  "Robotics",
  "Cybersecurity",
  "Data Science",
  "Web",
  "Mobile",
];

export default function OnboardModal({ onFinish }) {
  const [input, setInput] = useState("");
  const [interests, setInterests] = useState([]);
  const [createTeam, setCreateTeam] = useState(false);

  const addInterest = (value) => {
    const normalized = value.trim();
    if (!normalized) return;
    if (interests.includes(normalized)) return;

    setInterests((prev) => [...prev, normalized]);
    setInput("");
  };

  const removeInterest = (value) => {
    setInterests((prev) => prev.filter((item) => item !== value));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addInterest(input);
    }
  };

  const filteredSuggestions = suggestedInterests.filter(
    (item) =>
      item.toLowerCase().includes(input.toLowerCase()) &&
      !interests.includes(item)
  );

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal signup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-logo">Judgify</div>

        <div className="onboarding-card">
          <div className="onboarding-title">Tell us more</div>
          <div className="onboarding-subtitle">Choose your interests</div>
          <div className="onboarding-subtitle secondary">
            You can update this later in your profile.
          </div>

          <div className="form-field">
            <label>Interests</label>

            <div className="interests-input-wrapper">
              <div className="selected-tags">
                {interests.map((tag) => (
                  <span key={tag} className="selected-tag">
                    {tag}
                    <button
                      type="button"
                      className="tag-remove-btn"
                      onClick={() => removeInterest(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type interest and press Enter"
              />
            </div>

            {input.trim() && filteredSuggestions.length > 0 && (
              <div className="interest-suggestions">
                {filteredSuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="interest-suggestion-btn"
                    onClick={() => addInterest(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="terms-checkbox">
            <input
              type="checkbox"
              checked={createTeam}
              onChange={(e) => setCreateTeam(e.target.checked)}
            />
            <span>Create team after registration</span>
          </label>

          <div className="onboarding-actions single">
            <button
              type="button"
              className="save-continue-btn"
              onClick={() =>
                onFinish({
                  interests,
                  createTeam,
                })
              }
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}