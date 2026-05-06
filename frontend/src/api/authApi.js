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

export function loginUser(payload = {}) {
  return apiRequest("/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerUser(payload = {}) {
  return apiRequest("/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutUser() {
  return apiRequest("/auth/logout/", {
    method: "POST",
  });
}
