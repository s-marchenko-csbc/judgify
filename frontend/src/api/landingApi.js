const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });
  return searchParams.toString();
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function fetchLandingFilters() {
  return requestJson(`${API_BASE}/landing/filters/`);
}

export async function fetchCompetitions(filters = {}) {
  const query = buildQuery(filters);
  const url = query
    ? `${API_BASE}/landing/competitions/?${query}`
    : `${API_BASE}/landing/competitions/`;
  return requestJson(url);
}

export async function fetchSidebar() {
  return requestJson(`${API_BASE}/landing/sidebar/`);
}

export async function fetchCompetitionDetail(id) {
  return requestJson(`${API_BASE}/competitions/${id}/`);
}

export async function toggleCompetitionSaved(id, nextSaved) {
  return requestJson(`${API_BASE}/competitions/${id}/save/`, {
    method: nextSaved ? 'POST' : 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
