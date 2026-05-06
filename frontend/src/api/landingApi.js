import { apiRequest } from "./client";

let landingFiltersCache = null;
let landingFiltersPromise = null;

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });

  return searchParams.toString();
}

export function fetchLandingFilters() {
  if (landingFiltersCache) return Promise.resolve(landingFiltersCache);
  if (!landingFiltersPromise) {
    landingFiltersPromise = apiRequest("/landing/filters/")
      .then((data) => {
        landingFiltersCache = data;
        return data;
      })
      .finally(() => {
        landingFiltersPromise = null;
      });
  }
  return landingFiltersPromise;
}

export function fetchCompetitions(filters = {}) {
  const query = buildQuery(filters);
  return apiRequest(`/landing/competitions/${query ? `?${query}` : ""}`);
}

export function fetchSidebar() {
  return apiRequest("/landing/sidebar/");
}

export function fetchCompetitionDetail(id) {
  return apiRequest(`/competitions/${id}/`);
}

export function fetchCompetitionParticipants(id) {
  return apiRequest(`/competitions/${id}/participants/`);
}

export function fetchCompetitionResults(id) {
  return apiRequest(`/competitions/${id}/results/`);
}

export function fetchCompetitionJudging(id) {
  return apiRequest(`/competitions/${id}/judging/`);
}

export function fetchCompetitionSubmissions(id) {
  return apiRequest(`/competitions/${id}/submissions/`);
}

export function submitCompetitionWork(id, payload = {}) {
  return apiRequest(`/competitions/${id}/submissions/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitCompetitionScore(id, payload = {}) {
  return apiRequest(`/competitions/${id}/judging/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteCompetitionScore(id) {
  return apiRequest(`/competition-scores/${id}/`, {
    method: "DELETE",
  });
}

export function joinCompetition(id, payload = {}) {
  return apiRequest(`/competitions/${id}/join/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function markMaterialViewed(id) {
  return apiRequest(`/materials/${id}/view/`, {
    method: "POST",
  });
}
