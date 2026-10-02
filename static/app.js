import { api } from "./api.js";
import { state } from "./state.js";
import { renderHealth, renderLoading, renderMaps, renderMetrics, renderSocial, renderTopics, renderVideos, setConnection, showBanner, showToast } from "./ui.js";

const $ = (id) => document.getElementById(id);
let stream;
let topicRefreshTimer;

async function loadTopics(preferredId = "") {
  const payload = await api.topics(); state.topics = payload.items || [];
  const available = state.topics.some((item) => item.id === state.activeTopicId);
  state.activeTopicId = preferredId || (available ? state.activeTopicId : state.topics[0]?.id || "");
  renderTopics(); return state.activeTopicId;
}
async function refreshTrend({ quiet = false } = {}) {
  if (!state.activeTopicId) { state.metrics = null; state.videos = []; state.mapsPlaces = []; state.socialPosts = []; state.socialStats = null; renderMetrics(); renderVideos(); renderMaps(); renderSocial(); return; }
  if (!quiet) renderLoading(true);
  try {
    const [metrics, videoPayload, placesPayload, socialPayload, socialStats] = await Promise.all([api.trend(state.activeTopicId), api.videos(state.activeTopicId, state.videoSort, state.videoType), api.mapsPlaces(state.activeTopicId), api.socialFeed(state.activeTopicId), api.socialStats(state.activeTopicId)]);
    state.metrics = metrics; state.videos = videoPayload.items || []; state.mapsPlaces = placesPayload.items || []; state.socialPosts = socialPayload.items || []; state.socialStats = socialStats; renderMetrics(); renderVideos(); renderMaps(); renderSocial();
  } catch (error) { showToast(`Tren belum dapat dimuat: ${error.message}`); }
  finally { renderLoading(false); }
}
async function selectTopic(id) {
  if (!id || id === state.activeTopicId) return;
  state.activeTopicId = id; state.videoType = "";
  document.querySelectorAll("#type-filters button").forEach((button) => button.classList.toggle("active", button.dataset.type === ""));
  renderTopics(); await refreshTrend();
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
    state.metrics = null; state.videos = []; state.mapsPlaces = []; state.socialPosts = []; state.socialStats = null; renderMetrics(); renderVideos(); renderMaps(); renderSocial();
    showBanner("discovering", `Mencari video YouTube yang relevan untuk “${topic.name}”. Hasil akan muncul otomatis.`);
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
}
function bindControls() {
  $("topic-tabs").addEventListener("click", (event) => { const button = event.target.closest("button[data-topic-id]"); if (button) selectTopic(button.dataset.topicId); });
  $("add-topic-button").addEventListener("click", openDialog); $("close-dialog").addEventListener("click", closeDialog); $("cancel-topic").addEventListener("click", closeDialog); $("suggest-button").addEventListener("click", suggestTopic);
  $("topic-name").addEventListener("input", () => { state.suggestion = null; $("suggestion-box").hidden = true; $("save-topic").disabled = true; });
  $("topic-form").addEventListener("submit", createTopic); $("topic-dialog").addEventListener("click", (event) => { if (event.target === $("topic-dialog")) closeDialog(); });
  $("type-filters").addEventListener("click", async (event) => { const button = event.target.closest("button[data-type]"); if (!button) return; state.videoType = button.dataset.type; document.querySelectorAll("#type-filters button").forEach((item) => item.classList.toggle("active", item === button)); await refreshTrend({ quiet: true }); });
  $("video-sort").addEventListener("change", async (event) => { state.videoSort = event.target.value; await refreshTrend({ quiet: true }); });
}
async function init() {
  bindControls();
  try { const [health, usage] = await Promise.all([api.health(), api.usage()]); state.health = health; state.usage = usage; renderHealth(); await loadTopics(); await refreshTrend(); }
  catch (error) { showToast(`Aplikasi belum siap: ${error.message}`); }
  connectStream();
}
init();
