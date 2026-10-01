import { api } from "./api.js";
import { state } from "./state.js";
import { renderHealth, renderLoading, renderMaps, renderMetrics, renderSocial, renderTopics, renderUsage, renderVideos, renderSourceNavigation, renderActiveSource, renderSourceProgress, setConnection, showBanner, showToast } from "./ui.js";

const $ = (id) => document.getElementById(id);
let stream;
let topicRefreshTimer;
let usageRefreshTimer;
let trendRequestId = 0;

async function refreshUsage() {
  try { state.usage = await api.usage(); renderUsage(); } catch { /* live usage is supplementary to the dashboard */ }
}

async function loadTopics(preferredId = "") {
  const payload = await api.topics(); state.topics = payload.items || [];
  const available = state.topics.some((item) => item.id === state.activeTopicId);
  state.activeTopicId = preferredId || (available ? state.activeTopicId : state.topics[0]?.id || "");
  renderTopics(); renderSourceNavigation(); return state.activeTopicId;
}
async function refreshTrend({ quiet = false } = {}) {
  const requestId = ++trendRequestId;
  const topicId = state.activeTopicId;
  const videoSort = state.videoSort;
  const videoType = state.videoType;
  const resetGroup = (key) => { state.sourceStates[key] = { loading: Boolean(topicId), loaded: false, error: "" }; };
  ["youtube", "maps", "social"].forEach(resetGroup);
  if (!topicId) { state.metrics = null; state.videos = []; state.mapsPlaces = []; state.mapsFeed = []; state.socialPosts = []; state.socialStats = null; renderMetrics(); renderVideos(); renderMaps(); renderSocial(); renderSourceNavigation(); renderSourceProgress(); renderLoading(false); return; }
  state.metrics = null; state.videos = []; state.mapsPlaces = []; state.mapsFeed = []; state.socialPosts = []; state.socialStats = null;
  renderLoading(true); renderMetrics(); renderVideos(); renderMaps(); renderSocial(); renderSourceNavigation(); renderSourceProgress();
  const stillCurrent = () => requestId === trendRequestId && topicId === state.activeTopicId;
  const complete = (key, error = "") => { if (!stillCurrent()) return false; state.sourceStates[key] = { loading: false, loaded: !error, error }; renderSourceNavigation(); renderSourceProgress(); return true; };
  const loadGroup = async (key, work, apply) => {
    try { const result = await work(); if (!stillCurrent()) return; apply(result); complete(key); if (key === "youtube") { renderMetrics(); renderVideos(); } else if (key === "maps") renderMaps(); else renderSocial(); renderSourceNavigation(); renderSourceProgress(); }
    catch (error) { if (complete(key, error.message)) showToast(`${key === "social" ? "TikTok & Instagram" : key === "maps" ? "Google Maps" : "YouTube"} belum dapat dimuat: ${error.message}`); }
  };
  // Groups settle independently, so the first cached result can paint while slower sources refresh.
  await Promise.allSettled([
    loadGroup("youtube", () => Promise.all([api.trend(topicId), api.videos(topicId, videoSort, videoType)]), ([metrics, videoPayload]) => { state.metrics = metrics; state.videos = videoPayload.items || []; }),
    loadGroup("maps", () => Promise.all([api.mapsPlaces(topicId), api.mapsFeed(topicId)]), ([placesPayload, feedPayload]) => { state.mapsPlaces = placesPayload.items || []; state.mapsFeed = feedPayload.items || []; }),
    loadGroup("social", () => Promise.all([api.socialFeed(topicId), api.socialStats(topicId)]), ([socialPayload, socialStats]) => { state.socialPosts = socialPayload.items || []; state.socialStats = socialStats; }),
  ]);
  if (stillCurrent()) { renderLoading(false); renderSourceNavigation(); renderSourceProgress(); }
}
async function selectTopic(id) {
  if (!id || id === state.activeTopicId) return;
  state.activeTopicId = id; state.videoType = "";
  document.querySelectorAll("#type-filters button").forEach((button) => button.classList.toggle("active", button.dataset.type === ""));
  renderTopics(); renderActiveSource(); await refreshTrend();
}
function resetDialog() { $("topic-form").reset(); $("topic-city").value = "Bandung"; $("suggestion-box").hidden = true; $("topic-error").hidden = true; $("save-topic").disabled = true; state.suggestion = null; }
function openDialog() { resetDialog(); $("topic-dialog").showModal(); requestAnimationFrame(() => $("topic-name").focus()); }
function closeDialog() { $("topic-dialog").close(); }
function escapeTag(value) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character])); }
function renderSuggestion(suggestion) {
  const tags = (values) => values.map((value) => `<span>${escapeTag(value)}</span>`).join("");
  $("keyword-preview").innerHTML = tags(suggestion.keywords); $("terms-preview").innerHTML = tags(suggestion.product_terms); $("topic-category").value = suggestion.category;
  $("suggestion-box").hidden = false; $("save-topic").disabled = false;
}
async function suggestTopic() {
  const name = $("topic-name").value.trim(); if (name.length < 2) { $("topic-name").reportValidity(); return; }
  const button = $("suggest-button"); button.disabled = true; button.textContent = "Menyiapkan…";
  try { state.suggestion = await api.suggestTopic(name); renderSuggestion(state.suggestion); $("topic-error").hidden = true; }
  catch (error) { $("topic-error").textContent = error.message; $("topic-error").hidden = false; }
  finally { button.disabled = false; button.textContent = "Buat kata pencarian"; }
}
async function createTopic(event) {
  event.preventDefault(); if (!state.suggestion) { await suggestTopic(); if (!state.suggestion) return; }
  const save = $("save-topic"); save.disabled = true; save.textContent = "Mengaktifkan…";
  const payload = { name: $("topic-name").value.trim(), keywords: state.suggestion.keywords, product_terms: state.suggestion.product_terms, exclude_terms: state.suggestion.exclude_terms || [], category: $("topic-category").value, cities: [$("topic-city").value.trim()] };
  try {
    const topic = await api.createTopic(payload); closeDialog(); await loadTopics(topic.id); renderTopics();
    state.metrics = null; state.videos = []; state.mapsPlaces = []; state.mapsFeed = []; state.socialPosts = []; state.socialStats = null; state.sourceStates = { youtube: { loading: true, loaded: false, error: "" }, maps: { loading: true, loaded: false, error: "" }, social: { loading: true, loaded: false, error: "" } };
    renderMetrics(); renderVideos(); renderMaps(); renderSocial(); renderSourceNavigation(); renderSourceProgress(); renderActiveSource();
    showBanner("discovering", `Menyiapkan sumber untuk “${topic.name}”. Data akan masuk bertahap tanpa mengosongkan dashboard.`);
    clearTimeout(topicRefreshTimer); topicRefreshTimer = setTimeout(async () => { await loadTopics(topic.id); await refreshTrend({ quiet: true }); }, 5000);
  } catch (error) { $("topic-error").textContent = error.message; $("topic-error").hidden = false; }
  finally { save.disabled = false; save.textContent = "Mulai pantau"; }
}
function connectStream() {
  stream?.close(); stream = new EventSource("/api/stream");
  stream.onopen = () => { state.streamConnected = true; setConnection(true); };
  stream.onerror = () => { state.streamConnected = false; setConnection(false); };
  stream.addEventListener("trend_tick", (event) => { const tick = JSON.parse(event.data); if (tick.topic_id !== state.activeTopicId) return; $("live-ticker").textContent = `+${new Intl.NumberFormat("id-ID").format(tick.views_gain_since_last || 0)} sejak snapshot`; refreshTrend({ quiet: true }); });
  stream.addEventListener("topic_status", async (event) => { const update = JSON.parse(event.data); await loadTopics(update.topic_id === state.activeTopicId ? update.topic_id : ""); if (update.topic_id === state.activeTopicId) { showBanner(update.status, update.message); await refreshTrend({ quiet: true }); } });
  stream.addEventListener("social_sentiment_updated", async (event) => { const update = JSON.parse(event.data); if (update.topic_id === state.activeTopicId) await refreshTrend({ quiet: true }); else await loadTopics(); });
}
function bindControls() {
  $("topic-tabs").addEventListener("click", (event) => { const button = event.target.closest("button[data-topic-id]"); if (button) selectTopic(button.dataset.topicId); });
  $("source-nav").addEventListener("click", (event) => { const button = event.target.closest("button[data-source]"); if (!button) return; state.activeSource = button.dataset.source; renderActiveSource(); renderSocial(); renderSourceNavigation(); renderSourceProgress(); });
  $("overview-view").addEventListener("click", (event) => { const button = event.target.closest("button[data-source-jump]"); if (!button) return; state.activeSource = button.dataset.sourceJump; renderActiveSource(); renderSocial(); renderSourceNavigation(); renderSourceProgress(); });
  $("add-topic-button").addEventListener("click", openDialog); $("close-dialog").addEventListener("click", closeDialog); $("cancel-topic").addEventListener("click", closeDialog); $("suggest-button").addEventListener("click", suggestTopic);
  $("topic-name").addEventListener("input", () => { state.suggestion = null; $("suggestion-box").hidden = true; $("save-topic").disabled = true; });
  $("topic-form").addEventListener("submit", createTopic); $("topic-dialog").addEventListener("click", (event) => { if (event.target === $("topic-dialog")) closeDialog(); });
  $("type-filters").addEventListener("click", async (event) => { const button = event.target.closest("button[data-type]"); if (!button) return; state.videoType = button.dataset.type; document.querySelectorAll("#type-filters button").forEach((item) => item.classList.toggle("active", item === button)); await refreshTrend({ quiet: true }); });
  $("video-sort").addEventListener("change", async (event) => { state.videoSort = event.target.value; await refreshTrend({ quiet: true }); });
}
async function init() {
  bindControls();
  try { const [health, usage] = await Promise.all([api.health(), api.usage()]); state.health = health; state.usage = usage; renderHealth(); renderUsage(); renderActiveSource(); await loadTopics(); await refreshTrend(); usageRefreshTimer = window.setInterval(refreshUsage, 30000); }
  catch (error) { showToast(`Aplikasi belum siap: ${error.message}`); }
  connectStream();
}
init();
