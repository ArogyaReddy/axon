/**
 * dashboard-shell.js — AROG Dashboard shell.
 *
 * Provides the header (live stat badges), tab navigation, global search box,
 * and a slide-in detail drawer -- the same interaction model as the
 * reference FRAMEWORK-DASHBOARD.html, applied to real, always-current AROG
 * data instead of a frozen catalog snapshot.
 *
 * Tabs are real server routes (GET /, /sessions, /recurring, /framework,
 * /health), not client-side SPA state -- every tab click is a genuine live
 * re-render from disk. Simpler and more honestly "live" than faking SPA
 * navigation over data that was actually fetched once.
 *
 * SECURITY: panelHtml is trusted, pre-escaped HTML produced by the other
 * panel modules (gaps-panel.js, etc.) -- each of THOSE modules is
 * responsible for escaping any attacker/query-influenced content before it
 * reaches here. The shell itself escapes only the plain numeric stats it
 * renders directly.
 */

const TABS = [
  { id: "my-work", label: "My Work", path: "/my-work", icon: "\u25C6" },
  {
    id: "suggestions",
    label: "Suggestions",
    path: "/suggestions",
    icon: "\u2691",
  },
  {
    id: "command-center",
    label: "Command Center",
    path: "/command-center",
    icon: "\u2318",
  },
  { id: "skills", label: "Skills", path: "/skills", icon: "\u2726" },
  { id: "agents", label: "Agents", path: "/agents", icon: "\u25C9" },
  { id: "prompts", label: "Prompts", path: "/prompts", icon: "\u275D" },
  { id: "monitor", label: "Monitor", path: "/monitor", icon: "\u25B3" },
  { id: "gaps", label: "Gaps", path: "/", icon: "\u25D0" },
  { id: "sessions", label: "Sessions", path: "/sessions", icon: "\u25A4" },
  {
    id: "recurring",
    label: "Recurring Files",
    path: "/recurring",
    icon: "\u27F2",
  },
  { id: "framework", label: "Framework", path: "/framework", icon: "\u2B21" },
  { id: "health", label: "Health", path: "/health", icon: "\u271A" },
  { id: "notes", label: "Notes", path: "/notes", icon: "\u270E" },
];

const CLIENT_SCRIPT = `
function filterGlobal(input) {
  const q = input.value.toLowerCase();
  const sessionGrid = document.getElementById("session-grid");
  document.querySelectorAll("[data-searchable]").forEach(function (el) {
    if (sessionGrid && sessionGrid.contains(el)) return; // Sessions tab: reordered below, never hidden
    el.style.display = el.textContent.toLowerCase().includes(q) ? "" : "none";
  });
  if (!sessionGrid) return;
  const cards = Array.from(sessionGrid.querySelectorAll(".session-card"));
  if (!q) {
    cards.forEach(function (c) { c.classList.remove("dimmed"); });
    if (typeof sortSessionCards === "function") sortSessionCards(); // restore the chosen sort order
    return;
  }
  const matches = [];
  const rest = [];
  cards.forEach(function (c) {
    const isMatch = c.textContent.toLowerCase().includes(q);
    c.classList.toggle("dimmed", !isMatch);
    (isMatch ? matches : rest).push(c);
  });
  matches.concat(rest).forEach(function (c) { sessionGrid.appendChild(c); }); // matches float to top, nothing hidden
}
function openDrawer(html) {
  const d = document.getElementById("drawer");
  d.querySelector(".drawer-body").innerHTML = html;
  d.classList.add("open");
}
function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
}
async function openSessionDrawer(sessionId) {
  const res = await fetch("/session/" + encodeURIComponent(sessionId));
  const html = await res.text();
  openDrawer(html);
}
async function openSkillDrawer(name) {
  const res = await fetch("/skill/" + encodeURIComponent(name));
  const html = await res.text();
  openDrawer(html);
}
async function openAgentDrawer(name) {
  const res = await fetch("/agent/" + encodeURIComponent(name));
  const html = await res.text();
  openDrawer(html);
}
function copyToClipboard(btn, text, isEncoded) {
  const value = isEncoded ? decodeURIComponent(text) : text;
  navigator.clipboard.writeText(value).then(function () {
    const original = btn.textContent;
    btn.textContent = "copied!";
    btn.classList.add("done");
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("done");
    }, 1500);
  });
}
function setTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  try {
    localStorage.setItem("arog-theme", name);
  } catch (e) {}
}
`;

function renderTabs(activeTab) {
  return TABS.map((t) => {
    const cls = t.id === activeTab ? "tab on" : "tab";
    return `<a class="${cls}" href="${t.path}"><span class="tab-icon">${t.icon}</span><span class="tab-label">${t.label}</span></a>`;
  }).join("\n      ");
}

function renderStatCard(num, label) {
  return `<div class="stat-card"><span class="stat-num">${num}</span><span class="stat-lbl">${label}</span></div>`;
}

/**
 * @param {object} opts
 * @param {string} opts.activeTab - one of gaps|sessions|recurring|framework|health
 * @param {string} opts.panelHtml - pre-rendered, pre-escaped panel content for the active tab
 * @param {object} opts.stats - {skills, agents, hooks, sessions, days, gapsAvgPct}
 * @returns {string} full HTML document
 */
function renderShell({ activeTab, panelHtml, stats }) {
  const s = stats || {};
  const arogBadge =
    s.arogOn === false
      ? `<span class="badge off" title="One or more AROG daemons is down — check the Health tab">AROG OFF</span>`
      : `<span class="badge live" title="All AROG daemons loaded and responding">AROG ON</span>`;
  const statStrip = [
    renderStatCard(s.skills ?? 0, "Skills"),
    renderStatCard(s.agents ?? 0, "Agents"),
    renderStatCard(s.hooks ?? 0, "Hooks"),
    renderStatCard(s.sessions ?? 0, "Sessions"),
    renderStatCard(s.days ?? 0, "Days"),
    renderStatCard(`${s.gapsAvgPct ?? 0}%`, "Gaps Avg"),
  ].join("");
  return `<!DOCTYPE html>
<html lang="en" data-theme="midnight-gold">
<head>
<meta charset="utf-8">
<script>(function(){try{var t=localStorage.getItem("arog-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AROG Dashboard</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0b0d;--s1:#141519;--s2:#1b1c21;--s3:#232429;--bd:#28292f;--bd-soft:#1c1d22;
  --tx:#eeeae2;--dim:#93919c;--dim2:#605f6b;
  --ac:#e8a33d;--ac2:#f4c06b;--ac-soft:#2e2311;--info:#2dd4bf;--info-soft:#0f2b28;
  --good:#3ecf8e;--warn:#e8a33d;--bad:#f2545b;--bad-soft:#341316;
  --on-ac:#0a0b0d;--ac-glow:rgba(232,163,61,.35);--ac-glow-soft:rgba(232,163,61,.25);
  --ac-wash:rgba(232,163,61,.07);--info-wash:rgba(45,212,191,.05);--code-bg:#050506;
  --nav-1:#111217;--nav-2:#0d0e11;--topbar-bg:rgba(10,11,13,.85);
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --serif:'Fraunces',Georgia,ui-serif,serif;
  --shadow-sm:0 1px 2px rgba(0,0,0,.45);
  --shadow-md:0 8px 24px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.5);
  --shadow-lg:0 20px 48px rgba(0,0,0,.5),0 4px 12px rgba(0,0,0,.4);
  --sidebar-w:236px;
}
/* ── Theme: Nord Frost (cool dark, icy-blue accent) ── */
:root[data-theme="nord-frost"]{
  --bg:#0b0f17;--s1:#131a24;--s2:#1a2330;--s3:#22303f;--bd:#2b3b4e;--bd-soft:#1e2833;
  --tx:#e6edf5;--dim:#8fa0b3;--dim2:#5b6b7d;
  --ac:#5eb3e4;--ac2:#8ad1f0;--ac-soft:#12293a;--info:#7ee8c8;--info-soft:#0e2b28;
  --good:#4ad999;--warn:#f0b34e;--bad:#f2596b;--bad-soft:#341018;
  --on-ac:#0b0f17;--ac-glow:rgba(94,179,228,.35);--ac-glow-soft:rgba(94,179,228,.25);
  --ac-wash:rgba(94,179,228,.08);--info-wash:rgba(126,232,200,.05);--code-bg:#050709;
  --nav-1:#121a26;--nav-2:#0d131c;--topbar-bg:rgba(11,15,23,.85);
}
/* ── Theme: Violet Dusk (dark, plum background, violet accent) ── */
:root[data-theme="violet-dusk"]{
  --bg:#120f1a;--s1:#1a1626;--s2:#221c30;--s3:#2b2440;--bd:#3a3152;--bd-soft:#241f34;
  --tx:#ece8f5;--dim:#a99fc0;--dim2:#6b6088;
  --ac:#b072e8;--ac2:#d19cf5;--ac-soft:#2a1c3a;--info:#64d9e0;--info-soft:#122d2e;
  --good:#4ad999;--warn:#f0b34e;--bad:#f2596b;--bad-soft:#2c1424;
  --on-ac:#120f1a;--ac-glow:rgba(176,114,232,.35);--ac-glow-soft:rgba(176,114,232,.25);
  --ac-wash:rgba(176,114,232,.08);--info-wash:rgba(100,217,224,.05);--code-bg:#0a0710;
  --nav-1:#160f22;--nav-2:#100b19;--topbar-bg:rgba(18,15,26,.85);
}
/* ── Theme: Solar Light (warm paper background, dark ink text) ── */
:root[data-theme="solar-light"]{
  --bg:#f5f2ea;--s1:#ffffff;--s2:#f0ece1;--s3:#e8e2d3;--bd:#ddd5c2;--bd-soft:#e8e2d3;
  --tx:#2a2620;--dim:#6b6558;--dim2:#94897a;
  --ac:#c1791f;--ac2:#e0a545;--ac-soft:#fbead1;--info:#0d8f82;--info-soft:#e0f5f0;
  --good:#1f9d64;--warn:#c1791f;--bad:#d13c44;--bad-soft:#fbe2e2;
  --on-ac:#2a2620;--ac-glow:rgba(193,121,31,.35);--ac-glow-soft:rgba(193,121,31,.25);
  --ac-wash:rgba(193,121,31,.06);--info-wash:rgba(13,143,130,.05);--code-bg:#211c14;
  --shadow-sm:0 1px 2px rgba(120,100,70,.14);
  --shadow-md:0 8px 24px rgba(120,100,70,.16),0 2px 6px rgba(120,100,70,.12);
  --shadow-lg:0 20px 48px rgba(120,100,70,.2),0 4px 12px rgba(120,100,70,.14);
  --nav-1:#fbf9f4;--nav-2:#efe9db;--topbar-bg:rgba(245,242,234,.82);
}
/* ── Theme: Sage Light (light, green-tinted paper, forest accent) ── */
:root[data-theme="sage-light"]{
  --bg:#f2f5ec;--s1:#ffffff;--s2:#eaf0e0;--s3:#dde8d0;--bd:#cddabb;--bd-soft:#e3ecd7;
  --tx:#232f1e;--dim:#5c6b52;--dim2:#86927a;
  --ac:#3f8f4f;--ac2:#63b06f;--ac-soft:#e1f0e3;--info:#1f7a8c;--info-soft:#e2f2f5;
  --good:#2f9d5c;--warn:#c1791f;--bad:#d13c44;--bad-soft:#fbe2e2;
  --on-ac:#152710;--ac-glow:rgba(63,143,79,.35);--ac-glow-soft:rgba(63,143,79,.25);
  --ac-wash:rgba(63,143,79,.06);--info-wash:rgba(31,122,140,.05);--code-bg:#16210f;
  --shadow-sm:0 1px 2px rgba(60,80,50,.12);
  --shadow-md:0 8px 24px rgba(60,80,50,.14),0 2px 6px rgba(60,80,50,.1);
  --shadow-lg:0 20px 48px rgba(60,80,50,.18),0 4px 12px rgba(60,80,50,.12);
  --nav-1:#f7faf1;--nav-2:#e9f0dd;--topbar-bg:rgba(242,245,236,.82);
}
html{background:var(--bg);transition:background-color .2s ease}
body{
  color:var(--tx);font-family:var(--sans);font-size:13.5px;line-height:1.5;
  -webkit-font-smoothing:antialiased;transition:background-color .2s ease,color .2s ease;
}
.shell{display:flex;min-height:100vh}

/* ── Sidebar nav ── */
.sidebar-nav{
  width:var(--sidebar-w);flex-shrink:0;background:linear-gradient(180deg,var(--nav-1),var(--nav-2));
  border-right:1px solid var(--bd);display:flex;flex-direction:column;height:100vh;
  position:sticky;top:0;overflow-y:auto;transition:background-color .2s ease;
}
.brand{display:flex;align-items:center;gap:11px;padding:22px 20px 20px}
.brand-mark{
  font-size:20px;width:38px;height:38px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 30% 25%,var(--ac2),var(--ac) 70%);border-radius:10px;
  box-shadow:0 4px 14px var(--ac-glow),inset 0 1px 1px rgba(255,255,255,.3);
}
.brand-name{font-family:var(--serif);font-size:16.5px;font-weight:700;color:var(--tx);line-height:1.2}
.brand-tag{font-family:var(--mono);font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ac);opacity:.9;margin-top:2px}
.nav-list{display:flex;flex-direction:column;gap:2px;padding:8px 12px;flex:1}
.tab{
  display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:9px;color:var(--dim);
  font-size:12.5px;font-weight:600;text-decoration:none;transition:background .15s,color .15s;letter-spacing:.01em;
  position:relative;
}
.tab-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0;opacity:.85}
.tab-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tab:hover{background:var(--s2);color:var(--tx)}
.tab.on{color:var(--on-ac);background:linear-gradient(135deg,var(--ac2),var(--ac));box-shadow:0 4px 14px var(--ac-glow-soft)}
.tab.on .tab-icon{opacity:1}
.sidebar-footer{padding:16px;border-top:1px solid var(--bd-soft)}
.sidebar-footer .badge{width:100%;display:flex;justify-content:center}
.theme-switcher{margin-bottom:14px}
.theme-switcher-label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--dim2);font-weight:600;margin-bottom:9px;font-family:var(--mono)}
.theme-swatches{display:flex;gap:9px}
.theme-swatch{
  width:26px;height:26px;border-radius:50%;border:2px solid var(--bd);cursor:pointer;padding:0;flex-shrink:0;
  transition:transform .15s,border-color .15s,box-shadow .15s;
}
.theme-swatch:hover{transform:translateY(-2px)}
.theme-swatch:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.theme-swatch[data-theme-btn="midnight-gold"]{background:linear-gradient(135deg,#f4c06b,#0a0b0d 65%)}
.theme-swatch[data-theme-btn="nord-frost"]{background:linear-gradient(135deg,#8ad1f0,#0b0f17 65%)}
.theme-swatch[data-theme-btn="violet-dusk"]{background:linear-gradient(135deg,#d19cf5,#120f1a 65%)}
.theme-swatch[data-theme-btn="solar-light"]{background:linear-gradient(135deg,#e0a545,#f5f2ea 65%)}
.theme-swatch[data-theme-btn="sage-light"]{background:linear-gradient(135deg,#63b06f,#f2f5ec 65%)}
html[data-theme="midnight-gold"] .theme-swatch[data-theme-btn="midnight-gold"],
html[data-theme="nord-frost"] .theme-swatch[data-theme-btn="nord-frost"],
html[data-theme="violet-dusk"] .theme-swatch[data-theme-btn="violet-dusk"],
html[data-theme="solar-light"] .theme-swatch[data-theme-btn="solar-light"],
html[data-theme="sage-light"] .theme-swatch[data-theme-btn="sage-light"]{
  border-color:var(--ac);box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--ac);
}

/* ── Main area / topbar ── */
.main-area{
  flex:1;min-width:0;
  background:radial-gradient(1200px 520px at 100% -10%,var(--ac-wash),transparent 55%),
    radial-gradient(900px 420px at 0% 110%,var(--info-wash),transparent 55%),var(--bg);
  transition:background-color .2s ease;
}
.topbar{
  display:flex;align-items:center;gap:20px;padding:18px 28px;border-bottom:1px solid var(--bd);
  position:sticky;top:0;background:var(--topbar-bg);backdrop-filter:blur(12px);z-index:50;flex-wrap:wrap;
}
.stat-strip{display:flex;gap:10px;flex-wrap:wrap}
.stat-card{
  background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:7px 14px;
  display:flex;flex-direction:column;align-items:flex-start;min-width:64px;box-shadow:var(--shadow-sm);
}
.stat-num{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--tx);line-height:1.2}
.stat-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim2);font-weight:600;margin-top:1px}
.badge{
  background:var(--s2);border:1px solid var(--bd);border-radius:20px;padding:5px 14px;font-size:11px;
  font-family:var(--mono);color:var(--dim);font-weight:600;transition:border-color .15s,color .15s;
}
.badge.live{color:var(--good);border-color:rgba(62,207,142,.4);background:rgba(62,207,142,.09);box-shadow:0 0 0 1px rgba(62,207,142,.1),0 0 16px rgba(62,207,142,.15)}
.badge.off{color:var(--bad);border-color:rgba(242,84,91,.45);background:var(--bad-soft);animation:pulse-bad 2s ease-in-out infinite}
@keyframes pulse-bad{0%,100%{opacity:1}50%{opacity:.55}}
#global-search{
  margin-left:auto;padding:9px 16px;background:var(--s1);border:1px solid var(--bd);border-radius:9px;
  color:var(--tx);font-size:12px;width:250px;outline:none;font-family:var(--sans);
  transition:border-color .15s,box-shadow .15s,width .2s;
}
#global-search:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--ac-soft);width:290px}
#global-search::placeholder{color:var(--dim2)}
.content{padding:28px 32px 60px;max-width:1500px;animation:fade-in .4s cubic-bezier(.16,1,.3,1)}
@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.note{
  background:linear-gradient(135deg,var(--s1),var(--s2));border:1px solid var(--bd);border-left:3px solid var(--info);
  padding:13px 17px;color:var(--dim);font-size:12px;border-radius:0 10px 10px 0;margin-bottom:20px;box-shadow:var(--shadow-sm);
}
.note code{color:var(--info);font-family:var(--mono)}
.drawer{
  position:fixed;top:0;right:-460px;width:460px;height:100vh;background:var(--s1);
  border-left:1px solid var(--bd);overflow-y:auto;transition:right .3s cubic-bezier(.16,1,.3,1);
  z-index:100;box-shadow:-24px 0 48px rgba(0,0,0,.4);
}
.drawer.open{right:0}
.drawer-close{
  position:sticky;top:0;float:right;margin:12px;width:28px;height:28px;border:1px solid var(--bd);
  border-radius:8px;background:var(--s2);color:var(--dim);cursor:pointer;font-size:15px;
  transition:color .15s,border-color .15s;
}
.drawer-close:hover{color:var(--tx);border-color:var(--ac)}
.drawer-body{padding:20px}
.drawer-section{margin-bottom:16px}
.drawer-label{font-size:10px;color:var(--dim2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px;font-family:var(--mono);font-weight:600}
.drawer-value{font-size:12.5px;color:var(--tx);line-height:1.65;margin-bottom:4px}
.drawer-file-list{list-style:none;font-size:11px;color:var(--dim);line-height:1.8}
.drawer-link{color:var(--ac);text-decoration:none;font-weight:600;border-bottom:1px solid transparent;transition:border-color .15s}
.drawer-link:hover{border-bottom-color:var(--ac)}

/* ── Generic sections/tables (Framework, Health, Recurring) ── */
.section{margin-bottom:30px}
.section-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--dim);font-weight:700;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--bd);font-family:var(--mono);display:flex;align-items:center;gap:8px}
.section-title::before{content:'';width:3px;height:12px;background:linear-gradient(var(--ac),var(--info));border-radius:2px}
table{width:100%;border-collapse:collapse;margin-top:8px;background:var(--s1);border-radius:10px;overflow:hidden;box-shadow:var(--shadow-sm)}
th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim2);padding:10px 14px;border-bottom:1px solid var(--bd);cursor:pointer;user-select:none;font-family:var(--mono);background:var(--s2)}
th:hover{color:var(--tx)}
td{padding:10px 14px;border-bottom:1px solid var(--bd-soft);font-size:12px}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}
td.v,.v{color:var(--good)}
td.f,.f{color:var(--bad)}
td.o,.o{color:var(--warn)}
td.empty,.empty-state{color:var(--dim2);font-style:italic;padding:24px;text-align:center}
code{color:var(--info);font-size:11px;font-family:var(--mono)}

/* ── Gaps tab ── */
.gap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}
.gap-card{background:linear-gradient(160deg,var(--s1),var(--s2));border:1px solid var(--bd);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-sm);transition:border-color .2s,box-shadow .2s,transform .2s}
.gap-card:hover{box-shadow:var(--shadow-md);transform:translateY(-2px);border-color:#33353d}
.gap-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.gap-title{font-size:14px;font-weight:700;color:var(--tx);font-family:var(--serif)}
.gap-pct{font-size:14px;font-weight:700;padding:4px 14px;border-radius:20px;background:var(--s3);font-family:var(--mono);box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}
.gap-bar{height:7px;background:var(--s3);border-radius:4px;overflow:hidden;margin-bottom:16px;box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}
.gap-bar-fill{height:100%;transition:width .5s cubic-bezier(.16,1,.3,1)}
.gap-bar-fill.v{background:linear-gradient(90deg,var(--good),#5ce0a3)}
.gap-bar-fill.o{background:linear-gradient(90deg,var(--warn),#f0b95e)}
.gap-bar-fill.f{background:linear-gradient(90deg,var(--bad),#f4787e)}
.gap-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px}
.gap-col-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim2);margin-bottom:6px;font-family:var(--mono);font-weight:600}
.gap-list{list-style:none;font-size:11.5px;line-height:1.7;color:var(--tx)}
.gap-list li{padding-left:14px;position:relative;margin-bottom:3px}
.gap-list li::before{content:'\u2022';position:absolute;left:0;color:var(--ac)}
.gap-list.not-working li::before{color:var(--warn)}
.gap-list li.empty{color:var(--dim);font-style:italic}
.gap-last{font-size:11px;color:var(--dim);border-top:1px solid var(--bd);padding-top:10px;line-height:1.6}
.gap-last-date{color:var(--ac);font-weight:700;margin-right:8px;font-family:var(--mono)}
.gap-last.empty{font-style:italic}

/* ── Sessions tab ── */
.session-toolbar{display:flex;justify-content:flex-end;margin-bottom:12px}
.session-sort-label{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dim);font-weight:600}
.session-sort-label select{background:var(--s1);border:1px solid var(--bd);color:var(--tx);border-radius:7px;padding:6px 10px;font-size:11.5px;font-family:var(--sans);cursor:pointer}
.session-sort-label select:focus{outline:none;border-color:var(--ac)}
.session-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:13px}
.session-card{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:13px 15px;cursor:pointer;transition:border-color .15s,transform .15s,box-shadow .15s,opacity .15s}
.session-card:hover{border-color:var(--ac);transform:translateY(-2px);box-shadow:var(--shadow-md)}
.session-card.dimmed{opacity:.35}
.session-card-head{display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px}
.session-date{color:var(--dim);font-family:var(--mono)}
.session-status{font-weight:700;font-size:10px;letter-spacing:.04em;font-family:var(--mono)}
.session-branch{font-size:11px;color:var(--ac);font-family:var(--mono);margin-bottom:8px}
.session-req{font-size:12px;color:var(--tx);line-height:1.5;margin-bottom:9px;min-height:34px}
.session-meta{font-size:10px;color:var(--dim2);font-family:var(--mono)}

/* ── Framework tab ── */
.fw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:11px}
.fw-card{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:13px 15px;transition:border-color .15s,transform .15s}
.fw-card:hover{border-color:var(--ac);transform:translateY(-1px)}
.fw-name{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ac);margin-bottom:5px}
.fw-desc{font-size:11.5px;color:var(--dim);line-height:1.55;max-height:60px;overflow:hidden;text-overflow:ellipsis}

/* ── Health tab ── */
.alert-toolbar{display:flex;justify-content:flex-end;gap:10px;margin-bottom:10px}
.alert-toolbar label{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dim);font-weight:600}
.alert-toolbar select{background:var(--s1);border:1px solid var(--bd);color:var(--tx);border-radius:7px;padding:6px 10px;font-size:11.5px;font-family:var(--sans);cursor:pointer}
.alert-toolbar select:focus{outline:none;border-color:var(--ac)}
.alert-line{font-family:var(--mono);font-size:11px;color:var(--warn);padding:8px 14px;border-bottom:1px solid var(--bd-soft)}
.alert-line.healthy{color:var(--good);font-family:var(--sans)}
/* ── My Work tab: PR-status chips on ticket rows ── */
.pr-status-chip{font-size:9px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.04em;padding:1px 7px;border-radius:8px;font-weight:700}
.pr-status-chip.merged{color:var(--good);background:rgba(62,207,142,.12)}
.pr-status-chip.open{color:var(--ac);background:var(--ac-soft)}
.pr-status-chip.declined{color:var(--bad);background:var(--bad-soft)}
/* ── Command Center tab ── */
.cc-priority-list{list-style:none;display:flex;flex-direction:column;gap:8px}
.cc-priority-item{
  display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:10px;background:var(--s1);
  border:1px solid var(--bd);border-left:3px solid var(--ac);transition:transform .15s,box-shadow .15s;
}
.cc-priority-item:hover{transform:translateX(3px);box-shadow:var(--shadow-sm)}
.cc-priority-rank{
  font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--on-ac);width:26px;height:26px;flex-shrink:0;
  border-radius:50%;background:linear-gradient(135deg,var(--ac2),var(--ac));display:flex;align-items:center;justify-content:center;
}
.cc-priority-title{flex:1;font-size:12.5px;color:var(--tx);line-height:1.5}
.cc-chip{font-size:9.5px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.05em;color:var(--dim);background:var(--s3);border:1px solid var(--bd);border-radius:10px;padding:3px 9px;white-space:nowrap}
.cc-chip-done{color:var(--good);border-color:var(--good)}
.cc-priority-item details{width:100%}
.cc-priority-item summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none}
.cc-priority-item summary::-webkit-details-marker{display:none}
.cc-priority-detail{margin-top:10px;padding:10px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:8px;font-size:11.5px;color:var(--dim);line-height:1.6}
.cc-detail-row{margin-bottom:6px}
.cc-detail-row:last-child{margin-bottom:0}
.cc-detail-row strong{color:var(--tx);font-weight:600}
.cc-detail-resolved strong{color:var(--good)}
.cc-resolved-priorities{margin-top:14px}
.cc-resolved-priorities>summary{font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);cursor:pointer;padding:6px 0}
.cc-board{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.cc-column{background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:14px;min-height:80px;box-shadow:var(--shadow-sm)}
.cc-column-head{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--dim);margin-bottom:12px;display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--bd)}
.cc-column-done{color:var(--good)}
.cc-column-in-progress{color:var(--ac)}
.cc-column-pending{color:var(--dim)}
.cc-column-count{font-family:var(--mono);background:var(--s3);border-radius:10px;padding:1px 8px}
.cc-column-body{display:flex;flex-direction:column;gap:9px}
.cc-task-card{background:var(--s2);border:1px solid var(--bd);border-radius:9px;padding:12px 14px;border-top:2px solid var(--bd);transition:border-color .15s,transform .15s,box-shadow .15s}
.cc-task-card:hover{border-color:var(--ac);transform:translateY(-1px);box-shadow:var(--shadow-sm)}
.cc-column-done .cc-task-card{border-top-color:var(--good)}
.cc-column-in-progress .cc-task-card{border-top-color:var(--ac)}
.cc-task-title{font-size:12px;color:var(--tx);line-height:1.5;margin-bottom:7px}
.cc-task-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cc-task-date{font-family:var(--mono);font-size:10px;color:var(--dim2)}
.cc-task-note{margin-top:8px;font-size:11px;color:var(--dim);font-style:italic;line-height:1.5}
.cc-task-details{margin-top:8px}
.cc-task-details>summary{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ac);cursor:pointer}
.cc-task-details .cc-priority-detail{margin-top:8px;padding:8px 10px}
.cc-inbox-item{list-style:none;display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--s1);border:1px solid var(--bd);border-radius:9px;font-size:12px;color:var(--tx);margin-bottom:8px}
.cc-inbox-item .cc-task-date{margin-left:auto}
.cc-inbox-form{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--bd)}
.cc-inbox-form select,.cc-inbox-form input[type="text"]{background:var(--s2);border:1px solid var(--bd);border-radius:8px;color:var(--tx);font-size:12px;padding:8px 10px;font-family:inherit}
.cc-inbox-form input[name="text"]{flex:1;min-width:220px}
.cc-inbox-form button{background:linear-gradient(135deg,var(--ac2),var(--ac));border:none;border-radius:8px;color:var(--on-ac);font-weight:700;font-size:12px;padding:8px 16px;cursor:pointer;white-space:nowrap}
.cc-inbox-form button:hover{filter:brightness(1.08)}
.cc-decisions{position:relative;padding-left:8px}
.cc-decisions::before{content:'';position:absolute;left:8px;top:6px;bottom:6px;width:2px;background:linear-gradient(var(--ac),var(--bd))}
.cc-decision-row{position:relative;display:flex;gap:18px;padding:14px 0 14px 26px}
.cc-decision-row::before{content:'';position:absolute;left:2px;top:19px;width:9px;height:9px;border-radius:50%;background:var(--ac);box-shadow:0 0 0 3px var(--bg),0 0 0 4px var(--ac)}
.cc-decision-date{font-family:var(--mono);font-size:11px;color:var(--ac);width:80px;flex-shrink:0;padding-top:1px;font-weight:600}
.cc-decision-title{font-size:13px;font-weight:600;color:var(--tx);margin-bottom:5px;font-family:var(--serif)}
.cc-decision-rationale{font-size:11.5px;color:var(--dim);line-height:1.6}

/* ── Notes tab ── */
.notes-body{background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:26px 30px;box-shadow:var(--shadow-sm);max-width:820px}
.notes-body h1{font-family:var(--serif);font-size:21px;font-weight:700;margin:4px 0 16px;color:var(--tx)}
.notes-body h2{font-family:var(--serif);font-size:15.5px;font-weight:600;margin:22px 0 10px;color:var(--ac);padding-bottom:6px;border-bottom:1px solid var(--bd)}
.notes-body h3{font-size:13px;font-weight:700;margin:16px 0 6px;color:var(--info)}
.notes-body p{font-size:12.5px;color:var(--tx);line-height:1.7;margin-bottom:8px}
.notes-body .notes-list{list-style:none;margin-bottom:10px}
.notes-body .notes-list li{font-size:12.5px;color:var(--tx);line-height:1.85;padding-left:18px;position:relative}
.notes-body .notes-list li::before{content:'\u2192';position:absolute;left:0;color:var(--ac)}
.notes-body .notes-list-ol{margin:0 0 10px 20px;color:var(--tx)}
.notes-body .notes-list-ol li{font-size:12.5px;line-height:1.85}
.notes-body .notes-table{border-collapse:collapse;width:100%;margin-bottom:14px;font-size:12px}
.notes-body .notes-table th,.notes-body .notes-table td{border:1px solid var(--bd);padding:6px 10px;text-align:left;color:var(--tx)}
.notes-body .notes-table th{background:var(--s2);color:var(--ac);font-weight:600}
.notes-body hr{border:none;border-top:1px solid var(--bd);margin:16px 0}

/* ── Skills / Agents tabs (tile cards + drawer) ── */
.tile-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.tile-card{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color .15s,transform .15s,box-shadow .15s}
.tile-card:hover{border-color:var(--ac);transform:translateY(-2px);box-shadow:var(--shadow-md)}
.tile-name{font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--ac);margin-bottom:6px}
.tile-desc{font-size:11.5px;color:var(--dim);line-height:1.55;margin-bottom:10px;min-height:36px}
.tile-footer{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.tile-chip{font-size:9px;font-family:var(--mono);color:var(--info);background:var(--info-soft);border-radius:8px;padding:2px 8px}
.copy-btn{margin-left:auto;padding:4px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;color:var(--dim);font-size:10px;cursor:pointer;font-family:var(--mono);transition:color .15s,border-color .15s}
.copy-btn:hover{color:var(--tx);border-color:var(--ac)}
.copy-btn.done{color:var(--good);border-color:var(--good)}
.example-box{font-family:var(--mono);font-size:11.5px;background:var(--code-bg);border:1px solid var(--bd);border-radius:8px;padding:10px 12px;color:var(--info);white-space:pre-wrap;word-break:break-word}

/* ── Prompts tab ── */
.prompt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.prompt-card{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;transition:border-color .15s,box-shadow .15s}
.prompt-card:hover{border-color:var(--ac);box-shadow:var(--shadow-sm)}
.prompt-card-head{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.prompt-title{font-size:12.5px;font-weight:700;color:var(--tx);flex:1}
.prompt-type{font-size:9px;font-family:var(--mono);text-transform:uppercase;padding:2px 8px;border-radius:8px;background:var(--s2)}
.prompt-type.cmd{color:var(--good)}
.prompt-type.tmpl{color:#bc8cff}
.prompt-desc{font-size:11px;color:var(--dim);line-height:1.55;margin-bottom:10px}
.prompt-template{font-family:var(--mono);font-size:10.5px;background:var(--code-bg);border:1px solid var(--bd);border-radius:6px;padding:8px 10px;margin-bottom:10px;white-space:pre-wrap;word-break:break-all;color:var(--info);max-height:90px;overflow:hidden}
.tpl-placeholder{color:var(--warn);font-weight:700}

/* ── Monitor tab ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:26px}
.kpi-card{background:linear-gradient(160deg,var(--s1),var(--s2));border:1px solid var(--bd);border-radius:12px;padding:16px;text-align:center;box-shadow:var(--shadow-sm)}
.kpi-num{font-family:var(--mono);font-size:26px;font-weight:700;color:var(--ac);line-height:1.2}
.kpi-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim2);margin-top:4px;font-weight:600}
.monitor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:10px}
.rank-row{display:flex;align-items:center;gap:10px;padding:6px 0}
.rank-label{font-family:var(--mono);font-size:11px;color:var(--tx);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rank-count{font-family:var(--mono);font-size:11px;color:var(--dim);font-weight:700;min-width:32px;text-align:right}
.rank-bar{width:60px;height:5px;background:var(--s3);border-radius:3px;overflow:hidden;flex-shrink:0}
.rank-bar-fill{height:100%;background:linear-gradient(90deg,var(--ac),var(--ac2));border-radius:3px}
.daily-chart{display:flex;align-items:flex-end;gap:3px;height:100px;margin-bottom:8px;background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:12px}
.daily-bar{flex:1;background:linear-gradient(180deg,var(--ac2),var(--ac));border-radius:3px 3px 0 0;min-height:4px;transition:opacity .15s}
.daily-bar:hover{opacity:.7}
.daily-chart-labels{display:flex;justify-content:space-between;font-size:10px;color:var(--dim2);font-family:var(--mono)}
</style>
</head>
<body>
<div class="shell">
  <aside class="sidebar-nav">
    <div class="brand">
      <span class="brand-mark">&#9889;</span>
      <div>
        <div class="brand-name">AROG</div>
        <div class="brand-tag">Dashboard &amp; Framework</div>
      </div>
    </div>
    <nav class="nav-list">
      ${renderTabs(activeTab)}
    </nav>
    <div class="sidebar-footer">
      <div class="theme-switcher" role="group" aria-label="Dashboard theme">
        <div class="theme-switcher-label">Theme</div>
        <div class="theme-swatches">
          <button type="button" class="theme-swatch" data-theme-btn="midnight-gold" title="Midnight Gold" aria-label="Midnight Gold theme" onclick="setTheme('midnight-gold')"></button>
          <button type="button" class="theme-swatch" data-theme-btn="nord-frost" title="Nord Frost" aria-label="Nord Frost theme" onclick="setTheme('nord-frost')"></button>
          <button type="button" class="theme-swatch" data-theme-btn="violet-dusk" title="Violet Dusk" aria-label="Violet Dusk theme" onclick="setTheme('violet-dusk')"></button>
          <button type="button" class="theme-swatch" data-theme-btn="solar-light" title="Solar Light" aria-label="Solar Light theme" onclick="setTheme('solar-light')"></button>
          <button type="button" class="theme-swatch" data-theme-btn="sage-light" title="Sage Light" aria-label="Sage Light theme" onclick="setTheme('sage-light')"></button>
        </div>
      </div>
      ${arogBadge}
    </div>
  </aside>
  <div class="main-area">
    <div class="topbar">
      <div class="stat-strip">
        ${statStrip}
      </div>
      <input id="global-search" type="text" placeholder="Search this tab..." oninput="filterGlobal(this)">
    </div>
    <div class="content">
${panelHtml}
    </div>
  </div>
</div>
<div id="drawer" class="drawer">
  <button class="drawer-close" onclick="closeDrawer()">&times;</button>
  <div class="drawer-body"></div>
</div>
<script>
${CLIENT_SCRIPT}
</script>
</body>
</html>`;
}

module.exports = { renderShell, TABS };
