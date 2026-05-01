import React, { useState } from "react";

const roles = [
  { id: "participant", label: "Participant" },
  { id: "team", label: "Team" },
  { id: "observer", label: "Observer" },
];

export default function JoinCompetitionModal({ competition, onClose }) {
  const [selectedRole, setSelectedRole] = useState("participant");

  const handleSubmit = () => {
    alert(`Joined "${competition.name}" as ${selectedRole}`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="join-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Join Competition</h2>
        <p>Select your role before joining this competition.</p>

        <div className="join-role-list">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`join-role-btn ${
                selectedRole === role.id ? "active" : ""
              }`}
              onClick={() => setSelectedRole(role.id)}
            >
              {role.label}
            </button>
          ))}
        </div>

        <div className="join-modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}