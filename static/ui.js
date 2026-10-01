import { state } from "./state.js";

const $ = (id) => document.getElementById(id);
const number = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat("id-ID");
const date = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character])); }
function relativeTime(value) {
  if (!value) return "Belum ada snapshot";
  const minute = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (minute < 1) return "Baru saja";
  if (minute < 60) return `${minute} menit lalu`;
  const hour = Math.floor(minute / 60); return hour < 24 ? `${hour} jam lalu` : `${Math.floor(hour / 24)} hari lalu`;
}
function trendBadge(id, trend, change) {
  const element = $(id); const map = { naik: ["naik", "↗ Naik"], turun: ["turun", "↘ Turun"], stabil: ["neutral", "→ Stabil"], butuh_data: ["neutral", "Butuh data"] };
  const [className, label] = map[trend] || map.butuh_data; element.className = `trend-badge ${className}`;
  element.textContent = change === null || change === undefined ? label : `${change > 0 ? "+" : ""}${Math.round(change)}%`;
}

export function setConnection(connected) {
  const element = $("connection-status"); element.classList.toggle("is-live", connected); element.classList.toggle("is-connecting", !connected);
  element.querySelector(".connection-label").textContent = connected ? "LIVE" : "Menyambung…";
}
export function renderHealth() {
  const health = state.health || {}; const sources = health.sources_active || []; const youtube = health.youtube_mode === "api" ? "YouTube API" : "YouTube publik"; const mapsActive = Boolean(health.maps_configured);
  const tiktokActive = Boolean(health.tiktok_configured); const instagramActive = Boolean(health.instagram_configured);
  $("source-status").innerHTML = `${sources.includes("youtube_trend") ? `<span class="source-chip is-on"><i></i>${youtube}</span>` : ""}${sources.includes("maps") ? `<span class="source-chip ${mapsActive ? "is-on" : "is-off"}"><i></i>Google Maps</span>` : ""}${sources.includes("tiktok") ? `<span class="source-chip ${tiktokActive ? "is-on" : "is-off"}"><i></i>TikTok</span>` : ""}${sources.includes("instagram") ? `<span class="source-chip ${instagramActive ? "is-on" : "is-off"}"><i></i>Instagram</span>` : ""}`;
  $("maps-status-badge").className = `source-chip ${mapsActive ? "is-on" : "is-off"}`; $("maps-status-badge").textContent = mapsActive ? `${health.maps_provider === "apify" ? "Apify aktif" : "Places aktif"}` : "Belum dikonfigurasi";
  $("maps-status-copy").textContent = mapsActive ? "Server menjalankan pencarian tempat dan ulasan terbaru melalui Apify." : "Isi APIFY_TOKEN di .env server untuk mengaktifkan pencarian tempat dan ulasan.";
}
export function renderUsage() {
  const element = $("apify-usage"); if (!element) return;
  const health = state.health || {}; const social = state.usage?.social;
  if (!health.apify_configured) {
    element.className = "apify-usage is-off"; element.innerHTML = "<strong>Apify belum aktif</strong><span>Token server belum siap</span>"; return;
  }
  if (!social) {
    const maps = state.usage?.maps || {}; element.className = "apify-usage";
    element.innerHTML = `<strong>Apify token aktif</strong><span>Maps ${Number(maps.today || 0)}/${Number(maps.daily_limit || 0)} request hari ini</span>`; return;
  }
  const daily = Number(social.today || 0); const dailyLimit = Number(social.daily_limit || 0); const monthly = Number(social.this_month || 0); const monthlyLimit = Number(social.monthly_limit || 0);
  const ratio = dailyLimit ? daily / dailyLimit : 0; element.className = `apify-usage ${ratio >= .85 ? "is-warning" : ""}`;
  element.innerHTML = `<strong>Apify ${daily}/${dailyLimit} run hari ini</strong><span>${monthly}/${monthlyLimit} bulan · ${health.social_sentiment_enabled ? "sentiment aktif" : "sentiment off"}</span>`;
}
export function renderTopics() {
  $("topic-tabs").innerHTML = state.topics.length ? state.topics.map((topic) => {
    const selected = topic.id === state.activeTopicId; const count = Number(topic.videos_tracked || 0);
    return `<button type="button" role="tab" aria-selected="${selected}" class="topic-tab ${selected ? "active" : ""}" data-topic-id="${escapeHtml(topic.id)}"><span>${escapeHtml(topic.name)}</span><small>${count ? `${count} video` : topic.status === "discovering" ? "mencari…" : "belum ada"}</small></button>`;
  }).join("") : '<p class="watchlist-empty">Belum ada produk. Tambahkan produk pertama untuk mulai mencari tren.</p>';
  const cap = Number(state.health?.max_active_topics || 20); $("topic-cap-note").textContent = `${state.topics.length}/${cap} aktif`;
  const topic = state.topics.find((item) => item.id === state.activeTopicId);
  $("topic-title").textContent = topic ? `Apa yang terjadi pada “${topic.name}”?` : "Pilih produk untuk melihat tren";
  $("topic-subtitle").textContent = topic ? `Sentimen sosial, opini lokasi, dan tren video untuk produk terkait · target ${topic.cities.join(", ")}` : "Tambahkan produk UMKM untuk memulai pemantauan sumber data secara live.";
  if (topic?.status === "discovering") showBanner("discovering", `Penelusuran YouTube untuk “${topic.name}” sedang berjalan.`);
  else if (topic?.status === "limited" && !topic.videos_tracked) showBanner("limited", "Belum menemukan video yang cukup relevan. Coba kata produk yang lebih spesifik.");
  else $("topic-banner").hidden = true;
}
export function showBanner(status, message) {
  const banner = $("topic-banner"); banner.className = `topic-banner ${status === "limited" ? "is-warning" : "is-loading"}`;
  banner.innerHTML = `<span class="banner-spinner"></span>${escapeHtml(message)}`; banner.hidden = false;
}
export function renderLoading(loading) { $("trend-main").classList.toggle("is-loading", loading); }

function chart(id, configuration) {
  if (!window.Chart) return null;
  state.charts[id]?.destroy(); const context = $(id).getContext("2d"); state.charts[id] = new window.Chart(context, configuration); return state.charts[id];
}
const chartDefaults = {
  responsive: true, maintainAspectRatio: false, animation: false, interaction: { intersect: false, mode: "index" },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: "#101a17", padding: 12, cornerRadius: 8, titleColor: "#83e6a7", bodyColor: "#f5f2e9" } },
  scales: { x: { grid: { display: false }, ticks: { color: "#7b8580", maxRotation: 0, autoSkip: true, maxTicksLimit: 7, font: { size: 10 } }, border: { display: false } }, y: { beginAtZero: true, grid: { color: "rgba(117,128,122,.14)" }, ticks: { color: "#7b8580", precision: 0, font: { size: 10 } }, border: { display: false } } },
};
function renderWeekly(items) {
  const hasData = items.some((item) => item.count > 0); $("weekly-empty").hidden = hasData; $("weekly-chart").hidden = !hasData;
  if (!hasData) { state.charts["weekly-chart"]?.destroy(); return; }
  chart("weekly-chart", { type: "bar", data: { labels: items.map((item) => new Date(`${item.week_start}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })), datasets: [{ data: items.map((item) => item.count), backgroundColor: "#83e6a7", hoverBackgroundColor: "#4bcf7e", borderRadius: 7, borderSkipped: false, maxBarThickness: 34 }] }, options: chartDefaults });
}
function renderHourly(items) {
  const hasData = items.length > 0 && items.some((item) => item.gain > 0); $("hourly-empty").hidden = hasData; $("hourly-chart").hidden = !hasData;
  if (!hasData) { state.charts["hourly-chart"]?.destroy(); return; }
  const context = $("hourly-chart").getContext("2d"); const gradient = context.createLinearGradient(0, 0, 0, 250); gradient.addColorStop(0, "rgba(131,230,167,.35)"); gradient.addColorStop(1, "rgba(131,230,167,0)");
  chart("hourly-chart", { type: "line", data: { labels: items.map((item) => new Date(item.captured_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })), datasets: [{ data: items.map((item) => item.gain), borderColor: "#42c879", backgroundColor: gradient, fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.5 }] }, options: chartDefaults });
}
function renderMix(mix) {
  const labels = { review: "Review produk", resep: "Resep / cara pakai", ide_usaha: "Ide usaha", lainnya: "Lainnya" }; const colors = { review: "#83e6a7", resep: "#101a17", ide_usaha: "#f0b85d", lainnya: "#d8ddd9" };
  const entries = Object.entries(mix || {}); const total = entries.reduce((sum, [, value]) => sum + value.count, 0); $("mix-total").textContent = fullNumber.format(total);
  $("content-legend").innerHTML = entries.map(([key, value]) => `<li><i style="background:${colors[key]}"></i><span>${labels[key]}</span><strong>${Math.round(value.share * 100)}%</strong></li>`).join("");
  if (!entries.length || !total) { state.charts["content-chart"]?.destroy(); return; }
  chart("content-chart", { type: "doughnut", data: { labels: entries.map(([key]) => labels[key]), datasets: [{ data: entries.map(([, value]) => value.count), backgroundColor: entries.map(([key]) => colors[key]), borderWidth: 0, hoverOffset: 3 }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: "72%", plugins: { legend: { display: false }, tooltip: chartDefaults.plugins.tooltip } } });
}
export function renderMetrics() {
  const metrics = state.metrics;
  if (!metrics) { ["kpi-new-videos", "kpi-attention", "kpi-gain", "kpi-competition"].forEach((id) => { $(id).textContent = "—"; }); $("last-update").textContent = "Belum ada snapshot"; renderWeekly([]); renderHourly([]); renderMix({}); return; }
  $("kpi-new-videos").textContent = fullNumber.format(metrics.new_videos_30d); $("kpi-new-note").textContent = `${fullNumber.format(metrics.new_videos_prev_30d)} video pada 30 hari sebelumnya`;
  $("kpi-attention").textContent = metrics.attention_index === null ? "—" : `${number.format(metrics.attention_index)} / hari`; $("kpi-gain").textContent = metrics.views_gain_24h === null ? "—" : `+${number.format(metrics.views_gain_24h)}`;
  $("kpi-gain-note").textContent = metrics.attention_change_pct === null ? "Butuh 48 jam data untuk pembanding" : `${metrics.attention_change_pct > 0 ? "+" : ""}${Math.round(metrics.attention_change_pct)}% vs 24 jam sebelumnya`;
  $("coverage-badge").textContent = `${Math.round(metrics.coverage * 100)}% cakupan`; $("kpi-competition").textContent = metrics.competition_signal === "meningkat" ? "Meningkat" : "Stabil";
  $("kpi-competition-note").textContent = metrics.competition_signal === "meningkat" ? "Proporsi video ide usaha bertambah" : "Belum ada lonjakan konten ide usaha"; $("last-update").textContent = `Snapshot ${relativeTime(metrics.last_snapshot_at)}`;
  $("live-ticker").textContent = `+${fullNumber.format(metrics.views_gain_since_last || 0)} sejak snapshot`; trendBadge("supply-trend", metrics.supply_trend, metrics.supply_change_pct); trendBadge("attention-trend", metrics.attention_trend, metrics.attention_change_pct);
  renderWeekly(metrics.weekly_new_videos || []); renderHourly(metrics.hourly_gain_series || []); renderMix(metrics.content_mix || {});
}
export function renderVideos() {
  const labels = { review: "Review", resep: "Resep", ide_usaha: "Ide usaha", lainnya: "Lainnya" }; const items = state.videos || [];
  $("video-table-body").innerHTML = items.map((video) => `<tr><td><a class="video-title" href="${escapeHtml(video.url)}" target="_blank" rel="noopener"><span>${escapeHtml(video.title)}</span><small>${escapeHtml(video.channel_title)}</small></a></td><td><span class="type-chip type-${escapeHtml(video.content_type)}">${labels[video.content_type]}</span></td><td>${date.format(new Date(video.published_at))}</td><td class="numeric">${fullNumber.format(video.views)}</td><td class="numeric">${number.format(video.views_per_day)}</td><td class="numeric gain">${video.gain_24h === null ? "—" : `+${number.format(video.gain_24h)}`}</td></tr>`).join("");
  $("video-empty").hidden = items.length > 0; $("video-table-note").textContent = `${items.length} video ditampilkan · komentar YouTube tidak digunakan`;
  $("trend-source-note").textContent = `Data tren dari YouTube · berdasarkan sampel ${state.metrics?.videos_tracked || 0} video`;
}
export function renderMaps() {
  const places = state.mapsPlaces || []; const feed = state.mapsFeed || [];
  const relevantPlaces = places.filter((place) => place.is_relevant);
  $("maps-count-badge").textContent = `${relevantPlaces.length} tempat`;
  $("maps-empty").hidden = relevantPlaces.length > 0 || feed.length > 0;
  $("maps-places-body").innerHTML = relevantPlaces.map((place) => `<tr><td><a class="maps-place-link" href="${escapeHtml(place.maps_uri || "#")}" target="_blank" rel="noopener">${escapeHtml(place.name || "Tempat")}</a><small class="maps-place-address">${escapeHtml(place.address || "")}</small></td><td>${escapeHtml(place.city || "—")}</td><td class="numeric">${place.rating == null ? "—" : Number(place.rating).toFixed(1)}</td><td class="numeric">${place.user_rating_count == null ? "—" : fullNumber.format(place.user_rating_count)}</td></tr>`).join("");
  const placeNames = Object.fromEntries(places.map((place) => [place.place_id, place.name]));
  $("maps-feed-list").innerHTML = feed.map((item) => `<article class="maps-feed-item"><div class="maps-feed-meta"><span class="maps-feed-stars">${item.stars == null ? "☆" : `${"★".repeat(Math.max(0, Math.min(5, Number(item.stars))))}${"☆".repeat(Math.max(0, 5 - Number(item.stars)))}`}</span><time>${item.created_at ? date.format(new Date(item.created_at)) : "Baru"}</time></div><p class="maps-feed-text">${escapeHtml(item.text)}</p><p class="maps-feed-place">${escapeHtml(placeNames[item.place_id] || "Google Maps")}</p></article>`).join("");
  $("maps-source-note").textContent = `Sumber: Google Maps melalui Apify · ${feed.length} opini tersimpan · ulasan difilter berdasarkan kata produk`;
}
function renderSocialTrend(daily) {
  const items = (daily || []).filter((item) => item.date && (item.positif || item.negatif || item.netral));
  const empty = $("social-trend-empty"); const canvas = $("social-sentiment-chart"); const hasData = items.length > 0;
  empty.hidden = hasData; canvas.hidden = !hasData;
  if (!hasData) { state.charts["social-sentiment-chart"]?.destroy(); return; }
  chart("social-sentiment-chart", { type: "line", data: { labels: items.map((item) => new Date(`${item.date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })), datasets: [
    { label: "Positif", data: items.map((item) => item.positif || 0), borderColor: "#42c879", backgroundColor: "rgba(66,200,121,.12)", fill: true, tension: .35, pointRadius: 2, borderWidth: 2 },
    { label: "Negatif", data: items.map((item) => item.negatif || 0), borderColor: "#bd5343", backgroundColor: "rgba(189,83,67,.08)", fill: true, tension: .35, pointRadius: 2, borderWidth: 2 },
    { label: "Netral", data: items.map((item) => item.netral || 0), borderColor: "#8b9690", backgroundColor: "transparent", fill: false, tension: .35, pointRadius: 2, borderWidth: 1.5 },
  ] }, options: { ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } }, scales: { ...chartDefaults.scales, x: { ...chartDefaults.scales.x, maxTicksLimit: 5 }, y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, precision: 0 } } } } });
}
export function renderSocial() {
  const posts = state.socialPosts || [];
  const stats = state.socialStats || {}; const sentiment = stats.sentiment || {}; const positive = Number(sentiment.positif || 0); const negative = Number(sentiment.negatif || 0); const neutral = Number(sentiment.netral || 0); const pending = Number(sentiment.pending || 0); const analyzed = Number(stats.analyzed_posts || positive + negative + neutral);
  $("social-count-badge").textContent = `${posts.length} post`;
  $("social-positive-count").textContent = fullNumber.format(positive); $("social-negative-count").textContent = fullNumber.format(negative); $("social-neutral-count").textContent = fullNumber.format(neutral + pending);
  $("social-positive-rate").textContent = `${Math.round(Number(stats.positive_rate || 0) * 100)}% dari dianalisis`; $("social-negative-rate").textContent = `${Math.round(Number(stats.negative_rate || 0) * 100)}% dari dianalisis`;
  const dominant = { positif: "Dominan positif", negatif: "Dominan negatif", netral: "Dominan netral", pending: "Menunggu analisis" }[stats.dominant_sentiment] || (pending ? "Menunggu analisis" : "Belum ada data"); $("social-dominant-sentiment").textContent = dominant;
  $("social-analyzer-note").textContent = state.health?.social_sentiment_enabled ? `Analyzer: ${state.health.social_sentiment_analyzer || "auto"} · ${analyzed} dianalisis` : "Sentiment dimatikan";
  const topics = stats.top_topics || []; $("social-topic-trend-list").innerHTML = topics.length ? topics.slice(0, 4).map((item) => `<li><span>${escapeHtml(item.topic)}</span><strong>${fullNumber.format(item.total)} sebutan</strong><small>+${item.positif || 0} positif · −${item.negatif || 0} negatif</small></li>`).join("") : "<li><span>Belum ada aspek</span><strong>—</strong><small>Hasil muncul setelah caption dianalisis.</small></li>";
  renderSocialTrend(stats.daily || []);
  $("social-empty").hidden = posts.length > 0;
  $("social-feed-list").innerHTML = posts.map((post) => {
    const platform = post.platform === "tiktok" ? "TikTok" : "Instagram";
    const metrics = [post.views == null ? null : `▶ ${number.format(post.views)}`, post.likes == null ? null : `♥ ${number.format(post.likes)}`, post.comments == null ? null : `◌ ${number.format(post.comments)}`].filter(Boolean).join(" · ");
    const sentimentLabel = { positif: "Positif", negatif: "Negatif", netral: "Netral", pending: "Belum dianalisis" }[post.sentiment || "pending"] || "Belum dianalisis";
    return `<article class="social-feed-item"><div class="social-feed-meta"><span class="social-platform">${platform}</span><time>${post.published_at ? date.format(new Date(post.published_at)) : "Baru"}</time></div><p class="social-feed-author">${escapeHtml(post.author_name || "Akun publik")}</p><p class="social-feed-text">${escapeHtml(post.text)}</p><span class="social-sentiment-badge ${escapeHtml(post.sentiment || "pending")}">${sentimentLabel}</span><p class="social-feed-metrics">${escapeHtml(metrics || "Tanpa metrik")}</p>${post.url ? `<a class="social-feed-link" href="${escapeHtml(post.url)}" target="_blank" rel="noopener">Buka post ↗</a>` : ""}</article>`;
  }).join("");
  $("social-source-note").textContent = `Sumber: TikTok & Instagram melalui Apify · ${posts.length} post relevan · sentiment dihitung lokal/Gemini · media/comment crawl dimatikan`;
}
let toastTimer;
export function showToast(message) { const toast = $("toast"); toast.textContent = message; toast.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("visible"), 4200); }
