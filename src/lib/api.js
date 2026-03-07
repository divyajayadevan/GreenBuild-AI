const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

async function buildError(response) {
  const detail = await response.text();
  try {
    const parsed = JSON.parse(detail);
    return parsed.detail || detail || `Request failed: ${response.status}`;
  } catch {
    return detail || `Request failed: ${response.status}`;
  }
}

export const api = {
  base: API_BASE,
  analyze: (payload) =>
    jsonRequest("/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  status: (jobId) => jsonRequest(`/status/${jobId}`),
  results: (slug) => jsonRequest(`/results/${slug}`),
  climate: (location) =>
    jsonRequest(`/climate?location=${encodeURIComponent(location)}`),
  materialsCatalog: () => jsonRequest("/admin/materials"),
  async uploadMaterialsCatalog(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/admin/materials/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await buildError(response));
    }

    return response.json();
  },
};
