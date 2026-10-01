async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
  if (!response.ok) {
    let detail = `Permintaan gagal (${response.status})`;
    try { const payload = await response.json(); detail = payload.detail || detail; } catch { /* not JSON */ }
    throw new Error(detail);
  }
  return response.status === 204 ? null : response.json();
}
function query(params) { const search = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== "" && value !== null && value !== undefined) search.set(key, String(value)); }); return search.toString(); }
export const api = {
  health: () => request("/api/health"), usage: () => request("/api/usage"), topics: () => request("/api/topics"),
  suggestTopic: (name) => request("/api/topics/suggest", { method: "POST", body: JSON.stringify({ name }) }),
  createTopic: (payload) => request("/api/topics", { method: "POST", body: JSON.stringify(payload) }),
  removeTopic: (id) => request(`/api/topics/${encodeURIComponent(id)}`, { method: "DELETE" }),
  trend: (topicId) => request(`/api/trend?${query({ topic_id: topicId })}`),
  videos: (topicId, sort, type) => request(`/api/trend/videos?${query({ topic_id: topicId, sort, type })}`),
};
