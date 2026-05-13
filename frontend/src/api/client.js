const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

let csrfReady = false;
let csrfToken = "";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(";").shift());
  }
  return "";
}

async function ensureCsrfCookie() {
  if (csrfReady && csrfToken) return csrfToken;

  const response = await fetch(`${API_BASE}/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to initialize CSRF protection");
  }

  const payload = await response.json();
  csrfToken = payload.csrfToken || getCookie("csrftoken");
  if (!csrfToken) {
    throw new Error("Failed to initialize CSRF token");
  }
  csrfReady = true;
  return csrfToken;
}

function isUnsafeMethod(method) {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase());
}

async function readPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? await response.json()
    : await response.text();
}

function getErrorMessage(response, payload) {
  let message = `Request failed: ${response.status}`;
  const stringifyError = (value) => {
    if (Array.isArray(value)) {
      return value.map(stringifyError).filter(Boolean).join(", ");
    }
    if (typeof value === "object" && value) {
      return Object.entries(value)
        .map(([key, nestedValue]) => `${key}: ${stringifyError(nestedValue)}`)
        .filter(Boolean)
        .join("; ");
    }
    return value === null || value === undefined ? "" : String(value);
  };
  if (typeof payload === "object" && payload) {
    if (payload.detail) {
      message = stringifyError(payload.detail);
      if (payload.errors) {
        const nested = stringifyError(payload.errors);
        if (nested) message = `${message}: ${nested}`;
      }
    } else {
      const fieldErrors = Object.entries(payload)
        .map(([field, value]) => `${field}: ${stringifyError(value)}`)
        .join("; ");
      if (fieldErrors) message = fieldErrors;
    }
  }
  return message;
}

function resetCsrfToken() {
  csrfReady = false;
  csrfToken = "";
}

export async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const unsafe = isUnsafeMethod(method);
  const baseHeaders = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !baseHeaders.has("Content-Type") && options.body) {
    baseHeaders.set("Content-Type", "application/json");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = new Headers(baseHeaders);
    if (unsafe) {
      headers.set("X-CSRFToken", await ensureCsrfCookie());
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
    });

    const payload = await readPayload(response);

    if (typeof payload === "object" && payload?.csrfToken) {
      csrfToken = payload.csrfToken;
      csrfReady = true;
    }

    if (!response.ok) {
      const message = getErrorMessage(response, payload);
      if (unsafe && response.status === 403 && attempt === 0 && message.toLowerCase().includes("csrf")) {
        resetCsrfToken();
        continue;
      }
      throw new Error(message);
    }

    return payload;
  }

  throw new Error("Request failed after refreshing CSRF token");
}

export { API_BASE, ensureCsrfCookie, getCookie };
