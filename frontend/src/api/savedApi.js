import { apiRequest } from "./client";

export function toggleSavedCompetition(competitionId, nextSaved) {
  return apiRequest(`/competitions/${competitionId}/save/`, {
    method: nextSaved ? "POST" : "DELETE",
  });
}

export function fetchSavedCompetitions() {
  return apiRequest("/me/saved/");
}
