import { apiRequest } from "./client";

export function fetchAdminOverview() {
  return apiRequest("/admin/overview/");
}

export function fetchAdminUsers(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  return apiRequest(`/admin/users/${query.toString() ? `?${query}` : ""}`);
}

export function updateAdminUser(id, payload = {}) {
  return apiRequest(`/admin/users/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminCompetitions(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  return apiRequest(`/admin/competitions/${query.toString() ? `?${query}` : ""}`);
}

export function updateAdminCompetition(id, payload = {}) {
  return apiRequest(`/admin/competitions/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminMessages() {
  return apiRequest("/admin/messages/");
}

export function createAdminMessages(payload = {}) {
  return apiRequest("/admin/messages/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
