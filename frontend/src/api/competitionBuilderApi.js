import { apiRequest } from "./client";

export function fetchCompetitionDrafts() {
  return apiRequest("/me/competition-drafts/");
}

export function createCompetitionDraft(payload = {}) {
  return apiRequest("/me/competition-drafts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCompetitionBuilder(id) {
  return apiRequest(`/competition-builder/${id}/`);
}

export function saveCompetitionBuilder(id, payload = {}) {
  return apiRequest(`/competition-builder/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function publishCompetition(id) {
  return apiRequest(`/competition-builder/${id}/publish/`, {
    method: "POST",
  });
}

export function reviewCompetitionApproval(id, decision) {
  return apiRequest(`/competition-builder/${id}/approval/`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export function fetchCompetitionJudges(id) {
  return apiRequest(`/competition-builder/${id}/judges/`);
}

export function assignCompetitionJudge(id, payload = {}) {
  return apiRequest(`/competition-builder/${id}/judges/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCompetitionMaterials(id) {
  return apiRequest(`/competition-builder/${id}/materials/`);
}

export function uploadCompetitionMaterial(id, payload) {
  return apiRequest(`/competition-builder/${id}/materials/`, {
    method: "POST",
    body: payload,
  });
}

export function deleteCompetitionMaterial(id, materialId) {
  return apiRequest(`/competition-builder/${id}/materials/?id=${encodeURIComponent(materialId)}`, {
    method: "DELETE",
  });
}

export function createCompetitionInvitations(id, payload = {}) {
  return apiRequest(`/competition-builder/${id}/invitations/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchCompetitionInvitations(id) {
  return apiRequest(`/competition-builder/${id}/invitations/`);
}

export function fetchCompetitionMessages(id) {
  return apiRequest(`/competition-builder/${id}/messages/`);
}
