import { apiRequest } from "./client";

export function fetchProfileDashboard() {
  return apiRequest("/me/profile-dashboard/");
}

export function updateProfileDashboard(payload = {}) {
  return apiRequest("/me/profile-dashboard/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}


export function reviewJoinRequest(requestId, decision) {
  return apiRequest(`/competition-join-requests/${requestId}/review/`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}


export function reviewCompetitionCreation(competitionId, decision) {
  return apiRequest(`/competition-builder/${competitionId}/approval/`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}


export function updateTeamManagement(teamId, payload = {}) {
  return apiRequest(`/me/teams/${teamId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
