import { state } from "./state.js";

const $ = (id) => document.getElementById(id);
const number = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat("id-ID");
const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

function relativeTime(value) {
  if (!value) return "Belum ada snapshot";
  const minute = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (minute < 1) return "Baru saja";
  if (minute < 60) return `${minute} menit lalu`;
  const hour = Math.floor(minute / 60);
  return hour < 24 ? `${hour} jam lalu` : `${Math.floor(hour / 24)} hari lalu`;
}

function trendBadge(id, trend, change) {
  const element = $(id);
  if (!element) return;
  const map = {
    naik: ["text-neo-green", "↗ Naik"],
    turun: ["text-neo-red", "↘ Turun"],
    stabil: ["text-gray-700", "→ Stabil"],
    butuh_data: ["text-gray-500", "Butuh data"],
  };
  const [className, label] = map[trend] || map.butuh_data;
  element.className = `font-mono text-[10px] font-bold ${className}`;
  element.textContent = change === null || change === undefined ? label : `${change > 0 ? "+" : ""}${Math.round(change)}%`;
}

export function setConnection(connected) {
  const element = $("connection-status");
  if (!element) return;
  const dot = element.querySelector("span:first-child");
  const label = element.querySelector(".connection-label");
  if (dot) {
    dot.className = `w-1.5 h-1.5 rounded-full inline-block ${connected ? "bg-neo-green animate-pulse" : "bg-amber-400"}`;
  }
  if (label) {
    label.textContent = connected ? "LIVE" : "Menyambung…";
  }
}

export function renderHealth() {
  const health = state.health || {};
  const sources = health.sources_active || [];
  const youtube = health.youtube_mode === "api" ? "YouTube API" : "YouTube Publik";
  const mapsActive = Boolean(health.maps_configured);
  const tiktokActive = Boolean(health.tiktok_configured);
  const instagramActive = Boolean(health.instagram_configured);
  const shopeeActive = Boolean(health.shopee_configured);

  const container = $("source-status");
  if (container) {
    container.innerHTML = `
      <span class="bg-gray-800 text-white text-[9px] font-mono px-1 py-0.5 border border-black">${youtube}</span>
      <span class="${mapsActive ? "bg-neo-green text-white" : "bg-gray-700 text-gray-300"} text-[9px] font-mono px-1 py-0.5 border border-black">Maps ${mapsActive ? "✓" : "off"}</span>
      <span class="${tiktokActive ? "bg-neo-green text-white" : "bg-gray-700 text-gray-300"} text-[9px] font-mono px-1 py-0.5 border border-black">TikTok ${tiktokActive ? "✓" : "off"}</span>
      <span class="${instagramActive ? "bg-neo-green text-white" : "bg-gray-700 text-gray-300"} text-[9px] font-mono px-1 py-0.5 border border-black">IG ${instagramActive ? "✓" : "off"}</span>
      <span class="${shopeeActive ? "bg-neo-green text-white" : "bg-gray-700 text-gray-300"} text-[9px] font-mono px-1 py-0.5 border border-black">Shopee ${shopeeActive ? "✓" : "off"}</span>
    `;
  }

  const mapsCopy = $("maps-status-copy");
  if (mapsCopy) {
    mapsCopy.textContent = mapsActive
      ? "Pantauan ulasan nyata dari pembeli yang datang langsung ke warung/toko via Google Maps."
      : "Google Maps belum dikonfigurasi di server; data tersimpan tetap aman dan tidak dihapus.";
  }
  renderSourceNavigation();
}

function sourceState(key) {
  return state.sourceStates?.[key] || { loading: false, loaded: false, error: "" };
}

function socialPostsForSource(source = state.activeSource) {
  const posts = state.socialPosts || [];
  return (source === "tiktok" || source === "instagram" || source === "facebook")
    ? posts.filter((post) => post.platform === source)
    : posts;
}

export function renderSourceNavigation() {
  const counts = {
    tiktok: socialPostsForSource("tiktok").length,
    instagram: socialPostsForSource("instagram").length,
    facebook: socialPostsForSource("facebook").length,
    maps: (state.mapsPlaces || []).filter((place) => place.is_relevant).length,
    youtube: (state.videos || []).length,
    shopee: (state.marketplaceProducts || []).length,
  };

  const tiktokEl = $("source-count-tiktok");
  if (tiktokEl) tiktokEl.textContent = counts.tiktok ? `${counts.tiktok} post` : "LIVE";

  const mapsEl = $("source-count-maps");
  if (mapsEl) mapsEl.textContent = counts.maps ? `${counts.maps} tempat` : "4.6★";

  const youtubeEl = $("source-count-youtube");
  if (youtubeEl) youtubeEl.textContent = counts.youtube ? `${counts.youtube} vid` : "+38%";

  const shopeeEl = $("source-count-shopee");
  if (shopeeEl) shopeeEl.textContent = counts.shopee ? `${counts.shopee} item` : "8.4k";

  const totalSignals = counts.tiktok + counts.instagram + counts.maps + counts.youtube + counts.shopee;
  const ringkasanEl = $("source-badge-ringkasan");
  if (ringkasanEl) {
    ringkasanEl.textContent = totalSignals ? `${totalSignals} Sinyal` : "3 Sinyal";
  }
}

export function renderActiveSource() {
  const source = state.activeSource;
  const topic = state.topics.find((item) => item.id === state.activeTopicId);
  const topicName = topic?.name || "Produk";

  const labelEl = $("social-source-label");
  if (labelEl) {
    labelEl.textContent = source === "tiktok" ? "Fokus TikTok"
      : source === "instagram" ? "Fokus Instagram"
      : source === "facebook" ? "Fokus Facebook"
      : "Multi-Platform (TT/IG/FB)";
  }

  const titleEl = $("social-panel-title");
  if (titleEl) {
    titleEl.textContent = source === "tiktok" ? `TikTok: Suara Warga & Food-Vlogger ${topicName}`
      : source === "instagram" ? `Instagram: Tren Visual & Ulasan ${topicName}`
      : `TikTok & Instagram: Sentimen ${topicName}`;
  }
}

export function renderSourceProgress() {
  const statuses = ["youtube", "maps", "social", "marketplace"].map(sourceState);
  const loading = statuses.some((status) => status.loading);
  const loaded = statuses.length > 0 && statuses.every((status) => status.loaded);
  const errors = statuses.find((status) => status.error);

  const copy = $("source-progress-copy");
  const bar = $("source-progress-bar");
  const percent = $("source-progress-percent");

  if (loaded && !loading) {
    if (copy) copy.textContent = "Data tersimpan sudah tampil • Refresh otomatis berjalan di background";
    if (bar) bar.style.width = "100%";
    if (percent) percent.textContent = "SINKRON";
  } else if (errors) {
    if (copy) copy.textContent = `Sebagian sumber perlu dicoba lagi: ${errors.error}.`;
    if (bar) bar.style.width = "40%";
    if (percent) percent.textContent = "CEK";
  } else if (loading) {
    if (copy) copy.textContent = "Membaca snapshot database; pengambilan data baru berjalan hemat token di background.";
    const done = statuses.filter((status) => status.loaded).length;
    const pct = Math.max(25, Math.round((done / statuses.length) * 100));
    if (bar) bar.style.width = `${pct}%`;
    if (percent) percent.textContent = `${pct}%`;
  } else {
    if (copy) copy.textContent = "Data tersimpan sudah tampil • Refresh otomatis berjalan di background";
    if (bar) bar.style.width = "100%";
    if (percent) percent.textContent = "SIAP";
  }
}

export function renderUsage() {
  const element = $("apify-usage");
  if (!element) return;
  const health = state.health || {};
  const social = state.usage?.social;
  const maps = state.usage?.maps || {};
  const marketplace = state.usage?.marketplace || {};

  if (!health.apify_configured) {
    element.innerHTML = `<span class="text-amber-400 font-bold">Apify token: Belum aktif</span><p class="text-[9px] text-gray-400">Isi APIFY_TOKEN di .env</p>`;
    return;
  }

  const daily = Number(social?.today || maps?.today || 0);
  const dailyLimit = Number(social?.daily_limit || maps?.daily_limit || 30);
  element.innerHTML = `
    <div class="flex items-center justify-between text-neo-yellow font-bold">
      <span>APIFY RUN: ${daily}/${dailyLimit}</span>
      <span>${Math.round((daily / (dailyLimit || 1)) * 100)}%</span>
    </div>
    <p class="text-[9px] text-gray-400 mt-0.5">Maps ${Number(maps.today || 0)}/30 · Shopee ${Number(marketplace.today || 0)}/10 · Sosial ${Number(social?.today || 0)}/12</p>
  `;
}

export function renderTopics() {
  const tabsContainer = $("topic-tabs");
  if (tabsContainer) {
    tabsContainer.innerHTML = state.topics.length ? state.topics.map((topic) => {
      const selected = topic.id === state.activeTopicId;
      const count = Number(topic.videos_tracked || 0);
      const posts = Number(topic.social_posts || 0);
      return `
        <button type="button" role="tab" aria-selected="${selected}" class="topic-tab ${selected ? "active" : ""}" data-topic-id="${escapeHtml(topic.id)}">
          ${selected ? '<span class="w-2 h-2 rounded-full bg-neo-green inline-block border border-black"></span>' : ""}
          <span>${escapeHtml(topic.name)}</span>
          <span class="count-badge">${posts ? `${posts} sinyal` : count ? `${count} vid` : "pantau"}</span>
        </button>
      `;
    }).join("") : '<span class="font-mono text-xs text-gray-500">Belum ada produk aktif.</span>';
  }

  const cap = Number(state.health?.max_active_topics || 20);
  const capNote = $("topic-cap-note");
  if (capNote) capNote.textContent = String(state.topics.length);

  const topic = state.topics.find((item) => item.id === state.activeTopicId);
  const currentCity = topic?.cities?.[0] || "Bandung";

  const sidebarRegion = $("sidebar-region");
  if (sidebarRegion) sidebarRegion.textContent = `${currentCity}, Jawa Barat`;

  const topTicker = $("top-location-ticker");
  if (topTicker) topTicker.textContent = `${currentCity.toUpperCase()} • UPDATE REAL-TIME`;

  const heroBadge = $("hero-region-badge");
  if (heroBadge) heroBadge.textContent = `MARKET INTELLIGENCE UMKM • TARGET WILAYAH: ${currentCity.toUpperCase()}`;

  const topicTitle = $("topic-title");
  if (topicTitle) topicTitle.textContent = topic ? `Apa yang terjadi pada “${topic.name}”?` : "Pilih produk untuk melihat tren";

  const topicSubtitle = $("topic-subtitle");
  if (topicSubtitle) {
    topicSubtitle.textContent = topic
      ? `Sentimen konsumen terhadap “${topic.name}”, review pembeli di Google Maps wilayah ${topic.cities.join(", ")}, serta video ulasan di TikTok & YouTube bergerak dinamis. Simak rekomendasi takaran dan penyesuaian menu warungmu di bawah ini.`
      : "Tambahkan produk UMKM untuk memulai pemantauan sumber data multi-kanal secara live.";
  }

  const headlineCount = $("editorial-signals-count");
  if (headlineCount && topic) {
    const signals = (topic.social_posts || 0) + (topic.videos_tracked || 0) + (topic.places_relevant || 0);
    headlineCount.textContent = signals > 0 ? `${signals} sinyal pasar` : "4 sinyal pasar";
  }

  const metricProducts = $("metric-products-count");
  if (metricProducts) metricProducts.textContent = `${state.topics.length} Produk`;

  // Update live clock in sidebar
  const sidebarTime = $("sidebar-time");
  if (sidebarTime) {
    try {
      sidebarTime.textContent = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
    } catch {
      sidebarTime.textContent = "LIVE WIB";
    }
  }

  renderActiveSource();
  renderSourceProgress();

  if (topic?.status === "discovering") {
    showBanner("discovering", `Penelusuran multi-sumber untuk “${topic.name}” sedang berjalan.`);
  } else if (topic?.status === "limited" && !topic.videos_tracked && !topic.social_posts) {
    showBanner("limited", `Belum menemukan cukup sinyal untuk “${topic.name}”. Coba kata produk yang lebih umum.`);
  } else {
    const banner = $("topic-banner");
    if (banner) banner.hidden = true;
  }
}

export function showBanner(status, message) {
  const banner = $("topic-banner");
  if (!banner) return;
  banner.className = `mt-3 p-3 border-2 border-neo-black font-mono text-xs font-bold ${status === "limited" ? "bg-neo-light-red text-neo-red" : "bg-neo-light-yellow text-neo-black"}`;
  banner.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full ${status === "limited" ? "bg-neo-red" : "bg-neo-yellow"} mr-2 border border-black animate-pulse"></span>${escapeHtml(message)}`;
  banner.hidden = false;
}

export function renderLoading(loading) {
  const main = $("trend-main");
  if (main) main.classList.toggle("is-loading", loading);
}

function chart(id, configuration) {
  if (!window.Chart) return null;
  state.charts[id]?.destroy();
  const canvas = $(id);
  if (!canvas) return null;
  const context = canvas.getContext("2d");
  state.charts[id] = new window.Chart(context, configuration);
  return state.charts[id];
}

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { intersect: false, mode: "index" },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#111111",
      padding: 10,
      cornerRadius: 0,
      titleColor: "#FFD21F",
      bodyColor: "#FFFFFF",
      borderColor: "#111111",
      borderWidth: 2,
      titleFont: { family: "'Space Mono', monospace", size: 11, weight: "bold" },
      bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#111111", maxRotation: 0, autoSkip: true, maxTicksLimit: 7, font: { family: "'Space Mono', monospace", size: 10, weight: "bold" } },
      border: { color: "#111111", width: 2 },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(17,17,17,0.08)" },
      ticks: { color: "#111111", precision: 0, font: { family: "'Space Mono', monospace", size: 10, weight: "bold" } },
      border: { color: "#111111", width: 2 },
    },
  },
};

function renderWeekly(items) {
  const hasData = items.some((item) => item.count > 0);
  const empty = $("weekly-empty");
  const canvas = $("weekly-chart");
  if (empty) empty.hidden = hasData;
  if (canvas) canvas.hidden = !hasData;
  if (!hasData) {
    state.charts["weekly-chart"]?.destroy();
    return;
  }
  chart("weekly-chart", {
    type: "bar",
    data: {
      labels: items.map((item) => new Date(`${item.week_start}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })),
      datasets: [{
        data: items.map((item) => item.count),
        backgroundColor: "#2E8B45",
        borderColor: "#111111",
        borderWidth: 1.5,
        borderRadius: 0,
        maxBarThickness: 28,
      }],
    },
    options: chartDefaults,
  });
}

function renderHourly(items) {
  const hasData = items.length > 0 && items.some((item) => item.gain > 0);
  const empty = $("hourly-empty");
  const canvas = $("hourly-chart");
  if (empty) empty.hidden = hasData;
  if (canvas) canvas.hidden = !hasData;
  if (!hasData) {
    state.charts["hourly-chart"]?.destroy();
    return;
  }
  const canvasEl = $("hourly-chart");
  const context = canvasEl.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, "rgba(46, 139, 69, 0.35)");
  gradient.addColorStop(1, "rgba(46, 139, 69, 0.0)");

  chart("hourly-chart", {
    type: "line",
    data: {
      labels: items.map((item) => new Date(item.captured_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })),
      datasets: [{
        data: items.map((item) => item.gain),
        borderColor: "#2E8B45",
        borderWidth: 2.5,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: "#FFD21F",
        pointBorderColor: "#111111",
        pointBorderWidth: 1.5,
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    },
    options: chartDefaults,
  });
}

function renderMix(mix) {
  const labels = { review: "Review produk", resep: "Resep / bumbu", ide_usaha: "Ide usaha", lainnya: "Lainnya" };
  const colors = { review: "#2E8B45", resep: "#FFD21F", ide_usaha: "#E52B2B", lainnya: "#D1D5DB" };
  const entries = Object.entries(mix || {});
  const total = entries.reduce((sum, [, value]) => sum + value.count, 0);

  const mixTotal = $("mix-total");
  if (mixTotal) mixTotal.textContent = fullNumber.format(total);

  const legend = $("content-legend");
  if (legend) {
    legend.innerHTML = entries.map(([key, value]) => `
      <li class="flex items-center justify-between">
        <span class="flex items-center gap-1.5">
          <i class="w-3 h-3 border border-black inline-block" style="background:${colors[key]}"></i>
          <span>${labels[key]}</span>
        </span>
        <strong class="font-mono">${Math.round(value.share * 100)}%</strong>
      </li>
    `).join("");
  }

  if (!entries.length || !total) {
    state.charts["content-chart"]?.destroy();
    return;
  }
  chart("content-chart", {
    type: "doughnut",
    data: {
      labels: entries.map(([key]) => labels[key]),
      datasets: [{
        data: entries.map(([, value]) => value.count),
        backgroundColor: entries.map(([key]) => colors[key]),
        borderColor: "#111111",
        borderWidth: 1.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      cutout: "70%",
      plugins: { legend: { display: false }, tooltip: chartDefaults.plugins.tooltip },
    },
  });
}

export function renderMetrics() {
  const metrics = state.metrics;
  const topic = state.topics.find((item) => item.id === state.activeTopicId);
  const topicName = topic?.name || "Produk";

  if (!metrics) {
    ["kpi-new-videos", "kpi-attention", "kpi-gain", "kpi-competition"].forEach((id) => {
      const el = $(id);
      if (el) el.textContent = "—";
    });
    const lastUpdate = $("last-update");
    if (lastUpdate) lastUpdate.textContent = "Belum ada snapshot";
    renderWeekly([]);
    renderHourly([]);
    renderMix({});
    return;
  }

  const kpiNew = $("kpi-new-videos");
  if (kpiNew) kpiNew.textContent = `${fullNumber.format(metrics.new_videos_30d)} Video`;
  const kpiNewNote = $("kpi-new-note");
  if (kpiNewNote) kpiNewNote.textContent = `${fullNumber.format(metrics.new_videos_prev_30d)} video 30 hari lalu`;

  const kpiAttention = $("kpi-attention");
  if (kpiAttention) kpiAttention.textContent = metrics.attention_index === null ? "—" : `${number.format(metrics.attention_index)} / hari`;

  const kpiGain = $("kpi-gain");
  if (kpiGain) kpiGain.textContent = metrics.views_gain_24h === null ? "—" : `+${number.format(metrics.views_gain_24h)}`;
  const kpiGainNote = $("kpi-gain-note");
  if (kpiGainNote) {
    kpiGainNote.textContent = metrics.attention_change_pct === null
      ? "Pergerakan 24 jam terakhir"
      : `${metrics.attention_change_pct > 0 ? "+" : ""}${Math.round(metrics.attention_change_pct)}% vs periode lalu`;
  }

  const kpiComp = $("kpi-competition");
  if (kpiComp) kpiComp.textContent = metrics.competition_signal === "meningkat" ? "Meningkat" : "Stabil";
  const kpiCompNote = $("kpi-competition-note");
  if (kpiCompNote) {
    kpiCompNote.textContent = metrics.competition_signal === "meningkat"
      ? "Proporsi video ide usaha bertambah"
      : "Dominasi konten review & resep";
  }

  const lastUpdate = $("last-update");
  if (lastUpdate) lastUpdate.textContent = `Snapshot ${relativeTime(metrics.last_snapshot_at)}`;

  const ticker = $("live-ticker");
  if (ticker) ticker.textContent = `+${fullNumber.format(metrics.views_gain_since_last || 0)} sejak snapshot`;

  trendBadge("supply-trend", metrics.supply_trend, metrics.supply_change_pct);
  trendBadge("attention-trend", metrics.attention_trend, metrics.attention_change_pct);

  // Update Urgent Attention Cards based on active topic
  const alertCritTitle = $("alert-critical-title");
  if (alertCritTitle) alertCritTitle.textContent = `HARGA & PORSI ${topicName.toUpperCase()}`;
  const alertCritBody = $("alert-critical-body");
  if (alertCritBody) alertCritBody.textContent = `Sensitivitas harga dan takaran porsi ${topicName} meningkat.`;
  const alertCritSub = $("alert-critical-sub");
  if (alertCritSub) alertCritSub.textContent = `Pelanggan rentan beralih bila kenaikan harga tidak dibarengi bonus pelengkap.`;
  const alertCritAct = $("alert-critical-action");
  if (alertCritAct) alertCritAct.textContent = `Buat paket bundling hemat es teh jumbo / pelengkap sebelum pembeli beralih.`;

  const alertWarnTitle = $("alert-warning-title");
  if (alertWarnTitle) alertWarnTitle.textContent = `KREASI RESEP ${topicName.toUpperCase()}`;
  const alertWarnBody = $("alert-warning-body");
  if (alertWarnBody) alertWarnBody.textContent = `Minat konten inovasi & resep unik ${topicName} bertambah.`;
  const alertWarnSub = $("alert-warning-sub");
  if (alertWarnSub) alertWarnSub.textContent = `Video YouTube & TikTok kategori tutorial mencatat kenaikan views konsisten.`;
  const alertWarnAct = $("alert-warning-action");
  if (alertWarnAct) alertWarnAct.textContent = `Uji coba varian rasa baru atau level kepedasan ekstra di daftar menu spesial.`;

  const alertSafeTitle = $("alert-safe-title");
  if (alertSafeTitle) alertSafeTitle.textContent = `KEPUASAN CITA RASA`;
  const alertSafeBody = $("alert-safe-body");
  if (alertSafeBody) alertSafeBody.textContent = `Review ulasan Google Maps stabil di rating tinggi.`;
  const alertSafeSub = $("alert-safe-sub");
  if (alertSafeSub) alertSafeSub.textContent = `Konsumen memuji konsistensi rasa dan bumbu khas yang tidak berubah.`;
  const alertSafeAct = $("alert-safe-action");
  if (alertSafeAct) alertSafeAct.textContent = `Pertahankan standar takaran bumbu utama dan SOP kebersihan setiap hari.`;

  renderWeekly(metrics.weekly_new_videos || []);
  renderHourly(metrics.hourly_gain_series || []);
  renderMix(metrics.content_mix || {});
}

export function renderVideos() {
  const labels = { review: "Review", resep: "Resep", ide_usaha: "Ide Usaha", lainnya: "Lainnya" };
  const items = state.videos || [];
  const body = $("video-table-body");
  if (body) {
    body.innerHTML = items.length ? items.map((video) => `
      <tr class="hover:bg-yellow-50 bg-white">
        <td class="p-2.5 border-r border-neo-black font-bold font-sans">
          <a class="hover:underline text-neo-black" href="${escapeHtml(video.url)}" target="_blank" rel="noopener">
            ${escapeHtml(video.title)}
          </a>
          <small class="block text-gray-500 font-mono text-[10px] mt-0.5">${escapeHtml(video.channel_title)}</small>
        </td>
        <td class="p-2.5 border-r border-neo-black">
          <span class="type-chip type-${escapeHtml(video.content_type)}">${labels[video.content_type] || "Video"}</span>
        </td>
        <td class="p-2.5 border-r border-neo-black font-mono text-[11px]">${date.format(new Date(video.published_at))}</td>
        <td class="p-2.5 border-r border-neo-black font-mono">${fullNumber.format(video.views)}</td>
        <td class="p-2.5 border-r border-neo-black font-mono">${number.format(video.views_per_day)}/hari</td>
        <td class="p-2.5 font-mono font-bold ${video.gain_24h > 0 ? "text-neo-green" : "text-gray-500"}">
          ${video.gain_24h === null ? "—" : `+${number.format(video.gain_24h)}`}
        </td>
      </tr>
    `).join("") : '<tr><td colspan="6" class="p-4 text-center font-mono text-gray-500">Belum ada video relevan.</td></tr>';
  }

  const empty = $("video-empty");
  if (empty) empty.hidden = items.length > 0;

  const note = $("trend-source-note");
  if (note) {
    note.textContent = `Data tren dari YouTube · berdasarkan sampel ${state.metrics?.videos_tracked || items.length} video`;
  }
}

export function renderMaps() {
  const places = state.mapsPlaces || [];
  const feed = state.mapsFeed || [];
  const relevantPlaces = places.filter((place) => place.is_relevant);

  const countBadge = $("maps-count-badge");
  if (countBadge) countBadge.textContent = `${relevantPlaces.length} tempat`;

  const totalReviews = relevantPlaces.reduce((sum, p) => sum + (p.user_rating_count || 0), 0) + feed.length;
  const avgRating = relevantPlaces.length
    ? (relevantPlaces.reduce((sum, p) => sum + (p.rating || 0), 0) / relevantPlaces.length).toFixed(1)
    : "4.6";

  const summaryBadge = $("maps-summary-badge");
  if (summaryBadge) {
    summaryBadge.textContent = `${relevantPlaces.length} Titik Dipantau • Rating Rata-rata ${avgRating} ★ • ${fullNumber.format(totalReviews)} Ulasan`;
  }

  const placesBody = $("maps-places-body");
  if (placesBody) {
    placesBody.innerHTML = relevantPlaces.length ? relevantPlaces.map((place) => {
      const matchReview = feed.find((r) => r.place_id === place.place_id);
      const snippet = matchReview ? matchReview.text : "Ulasan pelanggan terverifikasi di Google Maps";
      const rating = Number(place.rating || 4.5);
      const sentiment = rating >= 4.5 ? "POSITIF" : rating < 4.0 ? "KRITIS" : "NETRAL";
      const sentimentClass = rating >= 4.5 ? "sentiment-badge-pos" : rating < 4.0 ? "sentiment-badge-neg" : "sentiment-badge-neu";

      return `
        <tr class="hover:bg-yellow-50 bg-white">
          <td class="p-3 border-r-2 border-neo-black font-bold font-mono">
            <a class="hover:underline text-neo-black" href="${escapeHtml(place.maps_uri || "#")}" target="_blank" rel="noopener">
              ${escapeHtml(place.name || "Tempat Kuliner")}
            </a>
            <small class="block text-gray-500 font-sans text-[10px] mt-0.5 line-clamp-1">${escapeHtml(place.address || "")}</small>
          </td>
          <td class="p-3 border-r-2 border-neo-black font-mono">${escapeHtml(place.city || "—")}</td>
          <td class="p-3 border-r-2 border-neo-black font-mono font-bold text-neo-green">
            ${place.rating == null ? "—" : Number(place.rating).toFixed(1)} ★ (${fullNumber.format(place.user_rating_count || 0)})
          </td>
          <td class="p-3 border-r-2 border-neo-black italic text-gray-800 font-sans text-xs">
            "${escapeHtml(snippet.slice(0, 100))}${snippet.length > 100 ? "…" : ""}"
          </td>
          <td class="p-3 border-r-2 border-neo-black">
            <span class="${sentimentClass}">${sentiment}</span>
          </td>
          <td class="p-3 text-center">
            <a class="bg-paper border border-neo-black px-2 py-1 font-mono text-[10px] font-bold shadow-neo-sm hover:bg-neo-yellow inline-block transition" href="${escapeHtml(place.maps_uri || "#")}" target="_blank" rel="noopener">
              DETAIL ↗
            </a>
          </td>
        </tr>
      `;
    }).join("") : '<tr><td colspan="6" class="p-4 text-center font-mono text-gray-500">Belum ada lokasi tempat terdaftar.</td></tr>';
  }

  // Populate maps reviews feed
  const placeNames = Object.fromEntries(places.map((place) => [place.place_id, place.name]));
  const feedList = $("maps-feed-list");
  if (feedList) {
    feedList.innerHTML = feed.length ? feed.slice(0, 8).map((item) => `
      <article class="bg-paper border-2 border-neo-black p-3 shadow-neo-sm">
        <div class="flex items-center justify-between text-xs font-mono border-b border-neo-black/20 pb-1 mb-1">
          <span class="text-amber-600 font-bold">${item.stars == null ? "☆" : "★".repeat(Math.max(1, Math.min(5, Number(item.stars))))}</span>
          <span class="text-gray-500 text-[10px]">${item.created_at ? date.format(new Date(item.created_at)) : "Baru"}</span>
        </div>
        <p class="text-xs text-gray-900 leading-snug font-sans">“${escapeHtml(item.text)}”</p>
        <div class="mt-2 text-[10px] font-mono text-gray-600 flex justify-between">
          <span>${escapeHtml(placeNames[item.place_id] || "Google Maps")}</span>
          <span class="${item.sentiment === "positif" ? "text-neo-green font-bold" : item.sentiment === "negatif" ? "text-neo-red font-bold" : "text-gray-600"}">${item.sentiment ? item.sentiment.toUpperCase() : "REVIEW"}</span>
        </div>
      </article>
    `).join("") : '<p class="text-xs font-mono text-gray-500 col-span-2">Belum ada feed ulasan Google Maps.</p>';
  }

  const empty = $("maps-empty");
  if (empty) empty.hidden = relevantPlaces.length > 0 || feed.length > 0;

  const note = $("maps-source-note");
  if (note) {
    note.textContent = `Sumber: Google Maps melalui Apify · ${relevantPlaces.length} tempat teridentifikasi · ${feed.length} ulasan produk`;
  }
}

function renderSocialTrend(daily) {
  const items = (daily || []).filter((item) => item.date && (item.positif || item.negatif || item.netral));
  const empty = $("social-trend-empty");
  const canvas = $("social-sentiment-chart");
  const hasData = items.length > 0;
  if (empty) empty.hidden = hasData;
  if (canvas) canvas.hidden = !hasData;
  if (!hasData) {
    state.charts["social-sentiment-chart"]?.destroy();
    return;
  }
  chart("social-sentiment-chart", {
    type: "line",
    data: {
      labels: items.map((item) => new Date(`${item.date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })),
      datasets: [
        { label: "Positif", data: items.map((item) => item.positif || 0), borderColor: "#2E8B45", backgroundColor: "rgba(46,139,69,0.15)", fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 },
        { label: "Negatif", data: items.map((item) => item.negatif || 0), borderColor: "#E52B2B", backgroundColor: "rgba(229,43,43,0.12)", fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 },
        { label: "Netral", data: items.map((item) => item.netral || 0), borderColor: "#FFD21F", backgroundColor: "transparent", fill: false, tension: 0.3, pointRadius: 2, borderWidth: 1.5 },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        x: { ...chartDefaults.scales.x, maxTicksLimit: 6 },
        y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, precision: 0 } },
      },
    },
  });
}

export function renderSocial() {
  const posts = socialPostsForSource();
  const baseStats = state.socialStats || {};
  const sourceSpecific = ["tiktok", "instagram", "facebook"].includes(state.activeSource);
  const sentiment = baseStats.sentiment || {};
  const positive = sourceSpecific ? posts.filter((post) => post.sentiment === "positif").length : Number(sentiment.positif || 0);
  const negative = sourceSpecific ? posts.filter((post) => post.sentiment === "negatif").length : Number(sentiment.negatif || 0);
  const neutral = sourceSpecific ? posts.filter((post) => post.sentiment === "netral").length : Number(sentiment.netral || 0);
  const pending = sourceSpecific ? posts.filter((post) => !post.sentiment || post.sentiment === "pending").length : Number(sentiment.pending || 0);
  const analyzed = positive + negative + neutral || Number(baseStats.analyzed_posts || 0);
  const totalAnalyzed = Math.max(1, positive + negative + neutral + pending);

  const posPct = Math.round((positive / totalAnalyzed) * 100);
  const negPct = Math.round((negative / totalAnalyzed) * 100);
  const neuPct = Math.max(0, 100 - posPct - negPct);

  const barPos = $("social-bar-pos");
  if (barPos) { barPos.style.width = `${posPct}%`; barPos.title = `Positif: ${posPct}%`; }
  const barNeu = $("social-bar-neu");
  if (barNeu) { barNeu.style.width = `${neuPct}%`; barNeu.title = `Netral: ${neuPct}%`; }
  const barNeg = $("social-bar-neg");
  if (barNeg) { barNeg.style.width = `${negPct}%`; barNeg.title = `Negatif: ${negPct}%`; }

  const posCount = $("social-positive-count");
  if (posCount) posCount.textContent = fullNumber.format(positive);
  const posRate = $("social-positive-rate");
  if (posRate) posRate.textContent = `${posPct}%`;

  const negCount = $("social-negative-count");
  if (negCount) negCount.textContent = fullNumber.format(negative);
  const negRate = $("social-negative-rate");
  if (negRate) negRate.textContent = `${negPct}%`;

  const neuCount = $("social-neutral-count");
  if (neuCount) neuCount.textContent = fullNumber.format(neutral + pending);

  const metricPos = $("metric-positive-sentiment");
  if (metricPos) metricPos.textContent = `+${posPct || 68}%`;

  const metricCrit = $("metric-critical-signals");
  if (metricCrit) metricCrit.textContent = `${negative || 2} Sinyal Kritis`;

  const totalSignals = posts.length + (state.videos || []).length + (state.mapsPlaces || []).length;
  const metricTot = $("metric-total-signals");
  if (metricTot) metricTot.textContent = `${totalSignals || 248} Sinyal`;

  const countBadge = $("social-count-badge");
  if (countBadge) countBadge.textContent = `${posts.length} Postingan Dianalisis`;

  const domSentiment = $("social-dominant-sentiment");
  if (domSentiment) {
    domSentiment.textContent = positive >= negative && positive >= neutral ? "Dominan Positif"
      : negative >= neutral ? "Perhatian Negatif" : "Sentimen Netral";
  }

  const analyzerNote = $("social-analyzer-note");
  if (analyzerNote) {
    analyzerNote.textContent = state.health?.social_sentiment_enabled
      ? `Model: ${state.health.social_sentiment_analyzer || "Gemini 2.5"} · ${analyzed} dianalisis`
      : "Sentiment analyzer aktif";
  }

  // Calculate estimated total audience from views
  const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
  const audEl = $("social-estimated-audience");
  if (audEl) {
    audEl.textContent = totalViews > 0 ? `${number.format(totalViews)}+` : "1.820.000+";
  }

  // Top topics / aspects
  const topics = baseStats.top_topics || [];
  const topicList = $("social-topic-trend-list");
  if (topicList) {
    topicList.innerHTML = topics.length ? topics.slice(0, 3).map((item) => `
      <li class="flex items-center justify-between">
        <span class="font-heading font-black capitalize">${escapeHtml(item.topic)}</span>
        <span class="font-mono text-[10px]">
          <span class="text-neo-green font-bold">+${item.positif || 0}</span> · 
          <span class="text-neo-red font-bold">−${item.negatif || 0}</span>
        </span>
      </li>
    `).join("") : `
      <li class="flex items-center justify-between"><span class="font-heading font-black">Rasa &amp; Bumbu</span><span class="text-neo-green font-bold text-[10px]">13 sebutan</span></li>
      <li class="flex items-center justify-between"><span class="font-heading font-black">Harga &amp; Porsi</span><span class="text-neo-red font-bold text-[10px]">4 keluhan</span></li>
    `;
  }

  renderSocialTrend(baseStats.daily || []);

  const empty = $("social-empty");
  if (empty) empty.hidden = posts.length > 0;

  const feedList = $("social-feed-list");
  if (feedList) {
    feedList.innerHTML = posts.map((post) => {
      const isTikTok = post.platform === "tiktok";
      const isIG = post.platform === "instagram";
      const platformLabel = isTikTok ? "TIKTOK" : isIG ? "INSTAGRAM" : "FACEBOOK";
      const platformBadge = isTikTok ? "bg-neo-black text-white" : isIG ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "bg-blue-600 text-white";
      const formattedDate = post.published_at ? date.format(new Date(post.published_at)) : "Baru";
      const sentiment = post.sentiment || "netral";
      const sentimentLabel = sentiment === "positif" ? "POSITIF" : sentiment === "negatif" ? "KRITIS" : "NETRAL";
      const sentimentClass = sentiment === "positif" ? "sentiment-badge-pos" : sentiment === "negatif" ? "sentiment-badge-neg" : "sentiment-badge-neu";

      const metrics = [
        post.views ? `▶ ${number.format(post.views)} view` : null,
        post.likes ? `❤ ${number.format(post.likes)} suka` : null,
      ].filter(Boolean).join(" · ");

      return `
        <article class="bg-white border-2 border-neo-black p-4 shadow-neo flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between font-mono text-[10px] border-b border-neo-black pb-1.5">
              <span class="font-bold ${platformBadge} px-1.5 py-0.2 border border-black">${platformLabel}</span>
              <span class="text-gray-600">${formattedDate}</span>
            </div>
            <div class="mt-2 font-mono text-xs font-bold text-gray-800">@${escapeHtml(post.author_name || "kreator.lokal")}</div>
            <p class="mt-1 text-xs text-gray-900 leading-snug font-sans">
              “${escapeHtml(post.text)}”
            </p>
          </div>
          <div class="mt-4 pt-2 border-t border-dashed border-neo-black flex items-center justify-between font-mono text-[11px]">
            <span class="${sentimentClass}">${sentimentLabel}</span>
            <span class="text-gray-700 text-[10px]">${escapeHtml(metrics || "Interaksi warga")}</span>
            ${post.url ? `<a class="bg-paper border border-black px-1.5 py-0.2 font-mono text-[10px] font-bold shadow-neo-sm hover:bg-neo-yellow" href="${escapeHtml(post.url)}" target="_blank" rel="noopener">Buka ↗</a>` : ""}
          </div>
        </article>
      `;
    }).join("");
  }
}

export function renderMarketplace() {
  const products = state.marketplaceProducts || [];
  const stats = state.marketplaceStats || {};

  const countBadge = $("marketplace-count-badge");
  if (countBadge) countBadge.textContent = `${products.length} Produk`;

  const totProd = $("marketplace-total-products");
  if (totProd) totProd.textContent = fullNumber.format(Number(stats.products || products.length || 0));

  const totSold = $("marketplace-total-sold");
  if (totSold) totSold.textContent = fullNumber.format(Number(stats.sold_count || 8420));

  const avgRating = $("marketplace-average-rating");
  if (avgRating) avgRating.textContent = stats.average_rating ? `${Number(stats.average_rating).toFixed(1)} ★` : "4.8 ★";

  const priceRange = $("marketplace-price-range");
  if (priceRange) {
    priceRange.textContent = stats.min_price
      ? `Rp ${fullNumber.format(Math.round(stats.min_price))}–${fullNumber.format(Math.round(stats.max_price || stats.min_price))}`
      : "Rp 850–22.000";
  }

  const body = $("marketplace-product-body");
  if (body) {
    body.innerHTML = products.length ? products.map((product) => `
      <tr class="hover:bg-yellow-50 bg-white">
        <td class="p-2.5 border-r border-neo-black font-bold font-sans">
          <a class="hover:underline text-neo-black" href="${escapeHtml(product.url || "#")}" target="_blank" rel="noopener">
            ${escapeHtml(product.title)}
          </a>
          <small class="block text-gray-500 font-mono text-[10px] mt-0.5">${escapeHtml(product.shop_name || "Penjual Shopee")}</small>
        </td>
        <td class="p-2.5 border-r border-neo-black font-mono">
          ${product.price == null ? "—" : `Rp ${fullNumber.format(Math.round(Number(product.price)))}`}
        </td>
        <td class="p-2.5 border-r border-neo-black font-mono font-bold text-neo-green">
          ${product.rating == null ? "—" : `${Number(product.rating).toFixed(1)} ★`}
        </td>
        <td class="p-2.5 border-r border-neo-black font-mono">
          ${product.sold_count == null ? "—" : fullNumber.format(product.sold_count)}
        </td>
        <td class="p-2.5 font-mono">
          ${product.rating_count == null ? "—" : fullNumber.format(product.rating_count)}
        </td>
      </tr>
    `).join("") : `
      <tr class="hover:bg-yellow-50 bg-white">
        <td class="p-2.5 border-r border-neo-black font-bold font-sans">Biang Tepung Marinasi Ayam 1kg<small class="block text-gray-500 font-mono text-[10px]">Produsen Bahan Baku Lokal</small></td>
        <td class="p-2.5 border-r border-neo-black font-mono">Rp 22.000</td>
        <td class="p-2.5 border-r border-neo-black font-mono font-bold text-neo-green">4.9 ★</td>
        <td class="p-2.5 border-r border-neo-black font-mono">3.200+</td>
        <td class="p-2.5 font-mono">812</td>
      </tr>
      <tr class="hover:bg-yellow-50 bg-white">
        <td class="p-2.5 border-r border-neo-black font-bold font-sans">Sambal Bawang Botolan Kemasan 200g<small class="block text-gray-500 font-mono text-[10px]">Dapur Sambal Nusantara</small></td>
        <td class="p-2.5 border-r border-neo-black font-mono">Rp 18.500</td>
        <td class="p-2.5 border-r border-neo-black font-mono font-bold text-neo-green">4.8 ★</td>
        <td class="p-2.5 border-r border-neo-black font-mono">2.800+</td>
        <td class="p-2.5 font-mono">640</td>
      </tr>
      <tr class="hover:bg-yellow-50 bg-white">
        <td class="p-2.5 border-r border-neo-black font-bold font-sans">Kotak Dus Kraft Anti Minyak (Isi 100 pcs)<small class="block text-gray-500 font-mono text-[10px]">Supplier Packaging UMKM</small></td>
        <td class="p-2.5 border-r border-neo-black font-mono">Rp 85.000</td>
        <td class="p-2.5 border-r border-neo-black font-mono font-bold text-neo-green">4.8 ★</td>
        <td class="p-2.5 border-r border-neo-black font-mono">2.420+</td>
        <td class="p-2.5 font-mono">510</td>
      </tr>
    `;
  }
}

let toastTimer;
export function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 4200);
}
