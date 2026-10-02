import { api } from "./api.js";
import { state } from "./state.js";
import {
  renderHealth,
  renderLoading,
  renderMarketplace,
  renderMaps,
  renderMetrics,
  renderSocial,
  renderTopics,
  renderUsage,
  renderVideos,
  renderSourceNavigation,
  renderActiveSource,
  renderSourceProgress,
  setConnection,
  showBanner,
  showToast,
} from "./ui.js";

const $ = (id) => document.getElementById(id);
let stream;
let topicRefreshTimer;
let usageRefreshTimer;
let trendRequestId = 0;

async function refreshUsage() {
  try {
    state.usage = await api.usage();
    renderUsage();
  } catch {
    /* live usage is supplementary to the dashboard */
  }
}

async function loadTopics(preferredId = "") {
  const payload = await api.topics();
  state.topics = payload.items || [];
  const available = state.topics.some((item) => item.id === state.activeTopicId);
  state.activeTopicId = preferredId || (available ? state.activeTopicId : state.topics[0]?.id || "");
  renderTopics();
  renderSourceNavigation();
  return state.activeTopicId;
}

async function refreshTrend({ quiet = false } = {}) {
  const requestId = ++trendRequestId;
  const topicId = state.activeTopicId;
  const videoSort = state.videoSort;
  const videoType = state.videoType;

  const resetGroup = (key) => {
    state.sourceStates[key] = { loading: Boolean(topicId), loaded: false, error: "" };
  };
  ["youtube", "maps", "social", "marketplace"].forEach(resetGroup);

  if (!topicId) {
    state.metrics = null;
    state.videos = [];
    state.mapsPlaces = [];
    state.mapsFeed = [];
    state.socialPosts = [];
    state.socialStats = null;
    state.marketplaceProducts = [];
    state.marketplaceStats = null;
    renderMetrics();
    renderVideos();
    renderMaps();
    renderSocial();
    renderMarketplace();
    renderSourceNavigation();
    renderSourceProgress();
    renderLoading(false);
    return;
  }

  state.metrics = null;
  state.videos = [];
  state.mapsPlaces = [];
  state.mapsFeed = [];
  state.socialPosts = [];
  state.socialStats = null;
  state.marketplaceProducts = [];
  state.marketplaceStats = null;

  renderLoading(true);
  renderMetrics();
  renderVideos();
  renderMaps();
  renderSocial();
  renderSourceNavigation();
  renderSourceProgress();

  const stillCurrent = () => requestId === trendRequestId && topicId === state.activeTopicId;

  const complete = (key, error = "") => {
    if (!stillCurrent()) return false;
    state.sourceStates[key] = { loading: false, loaded: !error, error };
    renderSourceNavigation();
    renderSourceProgress();
    return true;
  };

  const loadGroup = async (key, work, apply) => {
    try {
      const result = await work();
      if (!stillCurrent()) return;
      apply(result);
      complete(key);
      if (key === "youtube") {
        renderMetrics();
        renderVideos();
      } else if (key === "maps") {
        renderMaps();
      } else if (key === "social") {
        renderSocial();
      } else {
        renderMarketplace();
      }
      renderSourceNavigation();
      renderSourceProgress();
    } catch (error) {
      if (complete(key, error.message)) {
        showToast(`${key === "social" ? "TikTok & Instagram" : key === "maps" ? "Google Maps" : key === "marketplace" ? "Shopee" : "YouTube"} belum dapat dimuat: ${error.message}`);
      }
    }
  };

  await Promise.allSettled([
    loadGroup("youtube", () => Promise.all([api.trend(topicId), api.videos(topicId, videoSort, videoType)]), ([metrics, videoPayload]) => {
      state.metrics = metrics;
      state.videos = videoPayload.items || [];
    }),
    loadGroup("maps", () => Promise.all([api.mapsPlaces(topicId), api.mapsFeed(topicId)]), ([placesPayload, feedPayload]) => {
      state.mapsPlaces = placesPayload.items || [];
      state.mapsFeed = feedPayload.items || [];
    }),
    loadGroup("social", () => Promise.all([api.socialFeed(topicId), api.socialStats(topicId)]), ([socialPayload, socialStats]) => {
      state.socialPosts = socialPayload.items || [];
      state.socialStats = socialStats;
    }),
    loadGroup("marketplace", () => Promise.all([api.marketplaceProducts(topicId), api.marketplaceStats(topicId)]), ([productPayload, stats]) => {
      state.marketplaceProducts = productPayload.items || [];
      state.marketplaceStats = stats;
    }),
  ]);

  if (stillCurrent()) {
    renderLoading(false);
    renderSourceNavigation();
    renderSourceProgress();
  }
}

async function selectTopic(id) {
  if (!id || id === state.activeTopicId) return;
  state.activeTopicId = id;
  state.videoType = "";
  document.querySelectorAll("#type-filters button").forEach((button) => button.classList.toggle("active", button.dataset.type === ""));
  renderTopics();
  renderActiveSource();
  await refreshTrend();
}

function resetDialog() {
  $("topic-form")?.reset();
  if ($("topic-city")) $("topic-city").value = "Bandung";
  if ($("suggestion-box")) $("suggestion-box").hidden = true;
  if ($("topic-error")) $("topic-error").hidden = true;
  if ($("save-topic")) $("save-topic").disabled = true;
  state.suggestion = null;
}

function openDialog() {
  resetDialog();
  $("topic-dialog")?.showModal();
  requestAnimationFrame(() => $("topic-name")?.focus());
}

function closeDialog() {
  $("topic-dialog")?.close();
}

function escapeTag(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

function renderSuggestion(suggestion) {
  const tags = (values) => values.map((value) => `<span class="bg-white border border-neo-black px-2 py-0.5 shadow-neo-sm font-mono text-xs font-bold">${escapeTag(value)}</span>`).join("");
  const kw = $("keyword-preview");
  const tp = $("terms-preview");
  const cat = $("topic-category");
  if (kw) kw.innerHTML = tags(suggestion.keywords);
  if (tp) tp.innerHTML = tags(suggestion.product_terms);
  if (cat) cat.value = suggestion.category;
  if ($("suggestion-box")) $("suggestion-box").hidden = false;
  if ($("save-topic")) $("save-topic").disabled = false;
}

async function suggestTopic() {
  const name = $("topic-name")?.value.trim();
  if (!name || name.length < 2) {
    $("topic-name")?.reportValidity();
    return;
  }
  const button = $("suggest-button");
  if (button) {
    button.disabled = true;
    button.textContent = "Menyiapkan…";
  }
  try {
    state.suggestion = await api.suggestTopic(name);
    renderSuggestion(state.suggestion);
    if ($("topic-error")) $("topic-error").hidden = true;
  } catch (error) {
    if ($("topic-error")) {
      $("topic-error").textContent = error.message;
      $("topic-error").hidden = false;
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "🔍 Buat Kata Pencarian Otomatis";
    }
  }
}

async function createTopic(event) {
  event.preventDefault();
  if (!state.suggestion) {
    await suggestTopic();
    if (!state.suggestion) return;
  }
  const save = $("save-topic");
  if (save) {
    save.disabled = true;
    save.textContent = "Mengaktifkan…";
  }
  const name = $("topic-name")?.value.trim();
  const city = $("topic-city")?.value.trim() || "Bandung";
  const category = $("topic-category")?.value || "makanan_minuman";

  const payload = {
    name,
    keywords: state.suggestion.keywords,
    product_terms: state.suggestion.product_terms,
    exclude_terms: state.suggestion.exclude_terms || [],
    category,
    cities: [city],
  };

  try {
    const topic = await api.createTopic(payload);
    closeDialog();
    await loadTopics(topic.id);
    renderTopics();
    showToast(`Topik “${topic.name}” berhasil didaftarkan!`);
    showBanner("discovering", `Menyiapkan sumber untuk “${topic.name}”. Data akan masuk bertahap tanpa mengosongkan dashboard.`);
    clearTimeout(topicRefreshTimer);
    topicRefreshTimer = setTimeout(async () => {
      await loadTopics(topic.id);
      await refreshTrend({ quiet: true });
    }, 5000);
  } catch (error) {
    if ($("topic-error")) {
      $("topic-error").textContent = error.message;
      $("topic-error").hidden = false;
    }
  } finally {
    if (save) {
      save.disabled = false;
      save.textContent = "Mulai Pantau ⚡";
    }
  }
}

// Inline Form Handler
let inlineSuggestion = null;

async function handleInlineSuggest() {
  const nameInput = $("inline-topic-name");
  const name = nameInput?.value.trim();
  if (!name || name.length < 2) {
    nameInput?.reportValidity();
    return;
  }
  const btn = $("inline-suggest-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Menyiapkan…";
  }
  try {
    inlineSuggestion = await api.suggestTopic(name);
    const tags = inlineSuggestion.keywords.map((v) => `<span class="bg-white border border-neo-black px-2.5 py-1 font-mono text-xs font-bold shadow-neo-sm">#${escapeTag(v.replace(/\s+/g, ""))}</span>`).join(" ");
    const preview = $("inline-keyword-preview");
    if (preview) preview.innerHTML = tags;
    showToast("Kata kunci otomatis berhasil dibuat!");
  } catch (err) {
    showToast(`Gagal menyiapkan kata kunci: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🔍 Generate Kata Kunci";
    }
  }
}

async function handleInlineSubmit(event) {
  event.preventDefault();
  const name = $("inline-topic-name")?.value.trim();
  const city = $("inline-topic-city")?.value.trim() || "Bandung";
  const category = $("inline-topic-category")?.value || "makanan_minuman";

  if (!inlineSuggestion) {
    try {
      inlineSuggestion = await api.suggestTopic(name);
    } catch {
      inlineSuggestion = {
        keywords: [name.toLowerCase(), `${name.toLowerCase()} ${city.toLowerCase()}`],
        product_terms: [name.toLowerCase()],
        exclude_terms: [],
      };
    }
  }

  const btn = $("inline-submit-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Mendaftarkan…";
  }

  const payload = {
    name,
    keywords: inlineSuggestion.keywords,
    product_terms: inlineSuggestion.product_terms,
    exclude_terms: inlineSuggestion.exclude_terms || [],
    category,
    cities: [city],
  };

  try {
    const topic = await api.createTopic(payload);
    $("inline-topic-form")?.reset();
    inlineSuggestion = null;
    await loadTopics(topic.id);
    renderTopics();
    showToast(`Pemantauan baru “${topic.name}” berhasil didaftarkan untuk wilayah ${city}!`);
    showBanner("discovering", `Menyiapkan sumber untuk “${topic.name}”. Mengumpulkan sinyal video, ulasan Maps, dan data sosial.`);
    clearTimeout(topicRefreshTimer);
    topicRefreshTimer = setTimeout(async () => {
      await loadTopics(topic.id);
      await refreshTrend({ quiet: true });
    }, 5000);
  } catch (error) {
    showToast(`Gagal mendaftar: ${error.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "MULAI PANTAU SEKARANG ⚡";
    }
  }
}

function connectStream() {
  stream?.close();
  stream = new EventSource("/api/stream");
  stream.onopen = () => {
    state.streamConnected = true;
    setConnection(true);
  };
  stream.onerror = () => {
    state.streamConnected = false;
    setConnection(false);
  };
  stream.addEventListener("trend_tick", (event) => {
    const tick = JSON.parse(event.data);
    if (tick.topic_id !== state.activeTopicId) return;
    const ticker = $("live-ticker");
    if (ticker) {
      ticker.textContent = `+${new Intl.NumberFormat("id-ID").format(tick.views_gain_since_last || 0)} sejak snapshot`;
    }
    refreshTrend({ quiet: true });
  });
  stream.addEventListener("topic_status", async (event) => {
    const update = JSON.parse(event.data);
    await loadTopics(update.topic_id === state.activeTopicId ? update.topic_id : "");
    if (update.topic_id === state.activeTopicId) {
      showBanner(update.status, update.message);
      await refreshTrend({ quiet: true });
    }
  });
  stream.addEventListener("social_sentiment_updated", async (event) => {
    const update = JSON.parse(event.data);
    if (update.topic_id === state.activeTopicId) await refreshTrend({ quiet: true });
    else await loadTopics();
  });
}

function bindControls() {
  // Topic Tabs selection
  $("topic-tabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-topic-id]");
    if (button) selectTopic(button.dataset.topicId);
  });

  // Source Navigation click
  $("source-nav")?.addEventListener("click", (event) => {
    const link = event.target.closest(".source-nav-link");
    if (!link) return;
    const source = link.dataset.source;
    if (source) {
      state.activeSource = source;
      renderActiveSource();
      renderSocial();
      renderMarketplace();
      renderSourceNavigation();
      renderSourceProgress();
    }
  });

  // Social Filter Buttons
  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".social-filter-btn");
    if (!btn) return;
    const platform = btn.dataset.socialPlatform;
    document.querySelectorAll(".social-filter-btn").forEach((b) => {
      b.classList.remove("bg-neo-yellow", "font-bold");
      b.classList.add("bg-paper");
    });
    btn.classList.add("bg-neo-yellow", "font-bold");
    btn.classList.remove("bg-paper");
    state.activeSource = platform === "all" ? "overview" : platform;
    renderActiveSource();
    renderSocial();
  });

  // Modal dialog controls
  $("add-topic-button")?.addEventListener("click", openDialog);
  $("close-dialog")?.addEventListener("click", closeDialog);
  $("cancel-topic")?.addEventListener("click", closeDialog);
  $("suggest-button")?.addEventListener("click", suggestTopic);
  $("topic-name")?.addEventListener("input", () => {
    state.suggestion = null;
    if ($("suggestion-box")) $("suggestion-box").hidden = true;
    if ($("save-topic")) $("save-topic").disabled = true;
  });
  $("topic-form")?.addEventListener("submit", createTopic);
  $("topic-dialog")?.addEventListener("click", (event) => {
    if (event.target === $("topic-dialog")) closeDialog();
  });

  // Inline form controls
  $("inline-suggest-btn")?.addEventListener("click", handleInlineSuggest);
  $("inline-topic-form")?.addEventListener("submit", handleInlineSubmit);

  // YouTube filters & sort
  $("type-filters")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-type]");
    if (!button) return;
    state.videoType = button.dataset.type;
    document.querySelectorAll("#type-filters button").forEach((item) => {
      item.classList.toggle("bg-neo-yellow", item === button);
      item.classList.toggle("font-bold", item === button);
      item.classList.toggle("bg-paper", item !== button);
    });
    await refreshTrend({ quiet: true });
  });

  $("video-sort")?.addEventListener("change", async (event) => {
    state.videoSort = event.target.value;
    await refreshTrend({ quiet: true });
  });
}

async function init() {
  bindControls();
  try {
    const [health, usage] = await Promise.all([api.health(), api.usage()]);
    state.health = health;
    state.usage = usage;
    renderHealth();
    renderUsage();
    renderActiveSource();
    await loadTopics();
    await refreshTrend();
    usageRefreshTimer = window.setInterval(refreshUsage, 30000);
  } catch (error) {
    showToast(`Aplikasi belum siap: ${error.message}`);
  }
  connectStream();
}

init();
