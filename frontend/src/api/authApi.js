import { apiRequest } from "./client";

export function fetchCurrentUser() {
  return apiRequest("/auth/me/");
}

export function devLogin(payload = {}) {
  return apiRequest("/auth/dev-login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutUser() {
  return apiRequest("/auth/logout/", {
    method: "POST",
  });
}
