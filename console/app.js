/* Nirixaan Sovereign Factory Console — demo MVP.
   Runs fully in the browser (no server, works offline). State lives in localStorage. */
(() => {
"use strict";
const SEED = window.NX_SEED;
const { MODELS, CONTROLS } = SEED;
const STORE_KEY = "nx-console-v1";
const OFFICER = "officer:a.kulkarni (CISO)";

/* ───────── utilities ───────── */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = (n) => Number(n).toLocaleString("en-IN");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const fmtTime = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const clone = (o) => JSON.parse(JSON.stringify(o));
const short = (h) => h ? h.slice(0, 12) + "…" + h.slice(-6) : "";

// SHA-256: Web Crypto when available, small pure-JS fallback otherwise (e.g. opened from file://).
async function sha256(str) {
  if (window.crypto && crypto.subtle && window.isSecureContext) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256js(str);
}
function sha256js(ascii) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a));
  const bytes = new TextEncoder().encode(ascii);
  const K = [], H = [];
  let isC = {}, n = 0;
  for (let c = 2; n < 64; c++) { if (!isC[c]) { for (let i = 0; i < 313; i += c) isC[i] = c; H[n] = (Math.pow(c, .5) * 4294967296) | 0; K[n++] = (Math.pow(c, 1 / 3) * 4294967296) | 0; } }
  const hash = H.slice(0, 8);
  const l = bytes.length, words = [];
  const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6); padded.set(bytes); padded[l] = 0x80;
  const bitLen = l * 8; const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0); dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  for (let i = 0; i < padded.length; i += 4) words.push(dv.getUint32(i));
  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16); const old = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + K[i] +
        (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((t1 + t2) | 0); hash[4] = (hash[4] + t1) | 0; hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  return hash.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function download(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ───────── state ───────── */
let S;
function freshState() {
  return {
    systems: clone(SEED.systems),
    connectors: clone(SEED.connectors),
    ledger: [],
    routing: { indian: 18342, global: 1904, allowGlobalLowRisk: true },
    releases: [], incidents: [],
    tourDone: false,
  };
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: demo still works in memory */ } }
function load() { try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

/* ───────── hash-chained audit ledger ───────── */
const ledgerPayload = (e) => JSON.stringify({ seq: e.seq, ts: e.ts, actor: e.actor, kind: e.kind, action: e.action, target: e.target, detail: e.detail, prev: e.prev });
let ledgerQueue = Promise.resolve();
function log(actor, kind, action, target, detail = "", ts = nowIso()) {
  ledgerQueue = ledgerQueue.then(async () => {
    const prev = S.ledger.length ? S.ledger[S.ledger.length - 1].hash : "0".repeat(64);
    const e = { seq: S.ledger.length + 1, ts, actor, kind, action, target, detail, prev };
    e.hash = await sha256(ledgerPayload(e));
    S.ledger.push(e); save();
  });
  return ledgerQueue;
}
async function verifyLedger() {
  let prev = "0".repeat(64); const broken = [];
  for (const e of S.ledger) {
    const h = await sha256(ledgerPayload(e));
    if (e.prev !== prev || h !== e.hash) broken.push(e.seq);
    prev = e.hash;
  }
  return broken;
}
async function seedLedger() {
  const base = Date.now() - 1000 * 60 * 60 * 24 * 9;
  const t = (h) => new Date(base + h * 3600 * 1000).toISOString();
  const items = [
    ["system:kavach", "system", "inventory.import", "tenant", "Imported 7 AI systems from the integrator asset register", 0],
    ["agent:kavach-discovery", "agent", "inventory.discover", "SYS-021", "Found an AI feature inside bought DMS software (not on the register)", 2],
    ["agent:kavach-bom", "agent", "aibom.generate", "SYS-014", "AI-BOM v3 generated: 2 models, 2 base models, 3 plugins", 5],
    [OFFICER, "officer", "tier.approve", "SYS-014", "Tier 4 (Critical) signed off", 6],
    ["agent:router", "agent", "route.decide", "SYS-031", "Code generation → approved global model (tier 1, no personal data)", 30],
    ["agent:nirman-build", "agent", "release.staged", "SYS-031", "WI-2190 released to 100% after canary", 54],
    ["agent:sanchalan-triage", "agent", "incident.grouped", "SYS-032", "38 alerts grouped into INC-0412", 120],
    [OFFICER, "officer", "runbook.approve", "SYS-032", "RB-07 rollback approved for INC-0412", 121],
    ["agent:kavach-bom", "agent", "aibom.revalidate", "SYS-012", "Provider version changed 2026.03 → 2026.05: revalidation triggered", 170],
    ["auditor:empanelled-auditor-demo", "auditor", "audit.complete", "SYS-031", "Independent audit closed with 0 open findings", 200],
  ];
  for (const [a, k, act, tg, d, h] of items) await log(a, k, act, tg, d, t(h));
}

/* ───────── risk tiering ───────── */
const TIER_NAMES = { 1: "Tier 1 · Low", 2: "Tier 2 · Moderate", 3: "Tier 3 · High", 4: "Tier 4 · Critical" };
function scoreTier(a) {
  const r = []; let s = 0;
  if (a.rights) { s += 3; r.push(["+3", "Affects eligibility, benefits or rights"]); }
  if (a.citizen) { s += 2; r.push(["+2", "Interacts directly with citizens"]); }
  if (a.personal === "personal") { s += 1; r.push(["+1", "Processes personal data"]); }
  if (a.personal === "sensitive") { s += 2; r.push(["+2", "Processes sensitive personal data (identity, caste, income, health)"]); }
  if (a.children) { s += 1; r.push(["+1", "May process data of children"]); }
  if (a.autonomy === "approve") { s += 1; r.push(["+1", "Acts after human approval"]); }
  if (a.autonomy === "auto") { s += 3; r.push(["+3", "Acts without per-action human approval"]); }
  if (a.tools) { s += 2; r.push(["+2", "Agents or tools can write to other systems"]); }
  if (a.scale) { s += 1; r.push(["+1", "More than 1 million users"]); }
  const tier = s >= 9 ? 4 : s >= 6 ? 3 : s >= 4 ? 2 : 1;
  return { score: s, tier, reasons: r };
}
const tierOf = (sys) => scoreTier(sys.answers).tier;
function applicable(sys) {
  const t = tierOf(sys);
  return CONTROLS.filter(c => c.minTier <= t && !(c.needsPersonal && sys.answers.personal === "none"));
}
function readiness(sys) {
  const ap = applicable(sys); const done = ap.filter(c => sys.controls[c.id]);
  return { pct: Math.round(done.length / ap.length * 100), done: done.length, total: ap.length, gaps: ap.filter(c => !sys.controls[c.id]) };
}
const tierTag = (t) => `<span class="tag t${t}">${TIER_NAMES[t]}</span>`;
const indianShare = () => Math.round(S.routing.indian / (S.routing.indian + S.routing.global) * 100);
const actorTag = (kind) => `<span class="tag ${kind === "agent" ? "agent" : kind === "officer" ? "officer" : kind === "auditor" ? "ok" : ""}">${esc(kind)}</span>`;

/* ───────── routing ───────── */
const ROUTES = [
  ["overview", "Overview", "Kavach"], ["inventory", "AI inventory", "Kavach"], ["ledger", "Audit ledger", "Kavach"],
  ["router", "Bharat Model Router", "Sovereign stack"], ["connectors", "India Stack connectors", "Sovereign stack"],
  ["nirman", "Nirman · software factory", "Factories"], ["sanchalan", "Sanchalan · ops factory", "Factories"],
];
function currentRoute() {
  const h = location.hash.replace(/^#\/?/, "") || "overview";
  const [name, arg] = h.split("/");
  return { name, arg };
}

function renderNav() {
  const { name } = currentRoute(); let group = "";
  let html = "";
  for (const [id, label, g] of ROUTES) {
    if (g !== group) { html += `<div class="nav-group">${g}</div>`; group = g; }
    const active = name === id || (id === "inventory" && name === "system");
    html += `<a class="nav-link ${active ? "active" : ""}" href="#/${id}"><span class="dot"></span>${label}</a>`;
  }
  $("#nav").innerHTML = html;
}

const VIEWS = {};
let runToken = 0; // cancels running animations on navigation
function render() {
  renderNav();
  const { name, arg } = currentRoute();
  const view = VIEWS[name] || VIEWS.overview;
  $("#page").innerHTML = view.html(arg);
  view.mount && view.mount(arg);
  $(".side").classList.remove("open");
}
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }

/* ───────── Overview ───────── */
VIEWS.overview = {
  html() {
    const sys = S.systems;
    const tiers = [1, 2, 3, 4].map(t => sys.filter(s => tierOf(s) === t).length);
    const avg = Math.round(sys.reduce((a, s) => a + readiness(s).pct, 0) / sys.length);
    const gaps = sys.reduce((a, s) => a + readiness(s).gaps.length, 0);
    const needAudit = sys.filter(s => tierOf(s) >= 2 && !s.controls.audit).length;
    const colors = ["var(--green)", "var(--amber)", "var(--saffron)", "var(--red)"];
    const worst = [...sys].sort((a, b) => readiness(a).pct - readiness(b).pct);
    return `
    <div class="page-head">
      <div><div class="eyebrow">Nirixaan Kavach · governance layer</div><h1>AI audit readiness</h1>
      <p>Every AI system in the department, its risk tier, its AI bill of materials and the evidence an empanelled auditor will ask for under CERT-In's AI Security Auditing Guidelines and the DPDP Act.</p></div>
      <div class="actions"><a class="btn btn-primary" href="#/inventory">Open inventory</a></div>
    </div>
    <div class="grid g4">
      <div class="card kpi"><div class="l">AI systems inventoried</div><div class="v">${sys.length}</div><div class="s">incl. 1 found inside bought software</div></div>
      <div class="card kpi"><div class="l">Average audit readiness</div><div class="v">${avg}%</div><div class="bar green" style="margin-top:8px"><i style="width:${avg}%"></i></div></div>
      <div class="card kpi"><div class="l">Open control gaps</div><div class="v">${gaps}</div><div class="s">${needAudit} systems need an independent audit</div></div>
      <div class="card kpi"><div class="l">AI calls served by Indian models</div><div class="v">${indianShare()}%</div><div class="s">${fmtN(S.routing.indian + S.routing.global)} calls this month</div></div>
    </div>
    <div class="grid g-main" style="margin-top:16px">
      <div class="stack">
        <div class="card"><h3>Risk tiers</h3>
          <div class="stackbar">${tiers.map((n, i) => n ? `<div style="flex:${n};background:${colors[i]}">${n}</div>` : "").join("")}</div>
          <div class="legend">${tiers.map((n, i) => `<span><i style="background:${colors[i]}"></i>${TIER_NAMES[i + 1]}: ${n}</span>`).join("")}</div>
        </div>
        <div class="card"><h3>Readiness by system <span class="muted">· lowest first</span></h3>
          <div class="table-wrap"><table><thead><tr><th>System</th><th>Tier</th><th style="width:34%">Readiness</th><th>Gaps</th></tr></thead><tbody>
          ${worst.map(s => { const r = readiness(s); return `<tr class="click" data-href="#/system/${s.id}"><td><b>${esc(s.name)}</b><div class="muted" style="font-size:12px">${esc(s.dept)}</div></td><td>${tierTag(tierOf(s))}</td><td><div class="row"><div class="bar ${r.pct >= 80 ? "green" : r.pct >= 50 ? "" : "saffron"}" style="flex:1"><i style="width:${r.pct}%"></i></div><b style="width:36px;text-align:right">${r.pct}%</b></div></td><td>${r.gaps.length}</td></tr>`; }).join("")}
          </tbody></table></div>
        </div>
      </div>
      <div class="stack">
        <div class="card"><h3>Sovereignty</h3>
          <dl class="kv">
            <dt>Data residency</dt><dd><span class="tag ok">India</span> ${S.systems.filter(s => !/not confirmed/.test(s.hosting)).length} of ${S.systems.length} systems confirmed</dd>
            <dt>Infrastructure</dt><dd>MeitY-empanelled GCC, NIC DC, State DC, IndiaAI Compute</dd>
            <dt>Model router</dt><dd>Indian-first; global models only for tier 1 code tasks, each choice recorded</dd>
            <dt>Offline mode</dt><dd>Available for sensitive workloads</dd>
          </dl>
        </div>
        <div class="card"><h3>Latest evidence <span class="muted">· hash-chained</span></h3>
          <div class="feed">${S.ledger.slice(-6).reverse().map(e => `<div class="it"><time>${fmtTime(e.ts)}</time><div>${actorTag(e.kind)} <b>${esc(e.action)}</b> · ${esc(e.target)}<div class="muted">${esc(e.detail)}</div></div></div>`).join("")}</div>
          <a href="#/ledger" class="btn btn-sm" style="margin-top:10px">Open audit ledger</a>
        </div>
      </div>
    </div>`;
  },
};

/* ───────── Inventory ───────── */
VIEWS.inventory = {
  html() {
    return `
    <div class="page-head">
      <div><div class="eyebrow">Kavach</div><h1>AI system inventory</h1>
      <p>One record per AI system, including AI features inside software the department bought. The tier is computed from the answers, not typed in.</p></div>
      <div class="actions"><button class="btn btn-primary" id="addSys">+ Register AI system</button></div>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>System</th><th>Models</th><th>Tier</th><th>Status</th><th>Readiness</th><th class="hide-sm">Last audit</th></tr></thead>
      <tbody>${S.systems.map(s => { const r = readiness(s); return `<tr class="click" data-href="#/system/${s.id}">
        <td class="mono">${s.id}</td>
        <td><b>${esc(s.name)}</b><div class="muted" style="font-size:12px">${esc(s.dept)} · ${esc(s.integrator)}</div></td>
        <td>${s.models.map(m => `<div style="white-space:nowrap">${MODELS[m.m].origin === "India" ? '<span class="tag in">IN</span>' : '<span class="tag warn">GL</span>'} ${esc(MODELS[m.m].name)}</div>`).join("")}</td>
        <td>${tierTag(tierOf(s))}</td><td>${esc(s.status)}</td>
        <td><b>${r.pct}%</b> <span class="muted">${r.done}/${r.total}</span></td>
        <td class="hide-sm">${s.lastAudit ? esc(s.lastAudit) : '<span class="tag bad">Never</span>'}</td></tr>`; }).join("")}
      </tbody></table></div></div>`;
  },
  mount() { $("#addSys").onclick = openRegister; },
};

function openRegister() {
  const a = { rights: false, citizen: true, personal: "personal", children: false, autonomy: "assist", tools: false, scale: false };
  const models = new Set(["param2-17b"]);
  const body = `
    <div class="grid g2">
      <label class="f">System name<input type="text" id="r_name" value="Property tax assessment assistant"></label>
      <label class="f">Department<input type="text" id="r_dept" value="Urban Development Dept."></label>
      <label class="f" style="grid-column:1/-1">Purpose<textarea id="r_purpose">Drafts property tax assessments from building plans for an assessor to approve.</textarea></label>
      <label class="f">Built or supplied by<input type="text" id="r_int" value="Sample Integrator Pvt Ltd"></label>
      <label class="f">Hosting<select id="r_host"><option>MeitY-empanelled GCC · Mumbai</option><option>NIC data centre · Pune</option><option>State Data Centre · on-prem</option><option>IndiaAI Compute Portal</option><option>Vendor cloud · region not confirmed</option></select></label>
    </div>
    <hr class="sep">
    <div class="eyebrow" style="margin-bottom:8px">Models used</div>
    <div class="grid g3" id="r_models">${Object.values(MODELS).map(m => `<label class="opt"><input type="checkbox" value="${m.id}" ${models.has(m.id) ? "checked" : ""}><span>${esc(m.name)}<small>${esc(m.maker)} · ${m.origin}</small></span></label>`).join("")}</div>
    <hr class="sep">
    <div class="eyebrow" style="margin-bottom:8px">Risk questions</div>
    <div class="grid g2" id="r_q">
      <label class="opt"><input type="checkbox" data-k="rights"><span>Affects eligibility, benefits or rights<small>e.g. scholarships, land, tax, pensions</small></span></label>
      <label class="opt"><input type="checkbox" data-k="citizen" checked><span>Citizens interact with it directly</span></label>
      <label class="opt"><input type="checkbox" data-k="children"><span>May process children's data</span></label>
      <label class="opt"><input type="checkbox" data-k="tools"><span>Agents or tools can write to other systems</span></label>
      <label class="opt"><input type="checkbox" data-k="scale"><span>More than 1 million users</span></label>
      <label class="f">Personal data<select data-k="personal"><option value="none">None</option><option value="personal" selected>Personal</option><option value="sensitive">Sensitive (identity, caste, income, health)</option></select></label>
      <label class="f">Autonomy<select data-k="autonomy"><option value="assist" selected>Drafts only, a person acts</option><option value="approve">Acts after human approval</option><option value="auto">Acts on its own</option></select></label>
    </div>
    <div class="card" style="margin-top:14px;box-shadow:none" id="r_tier"></div>`;
  const m = modal("Register AI system", body, `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="r_save">Register and generate AI-BOM</button>`);
  const update = () => {
    m.querySelectorAll("#r_q [data-k]").forEach(el => { a[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; });
    const t = scoreTier(a);
    $("#r_tier", m).innerHTML = `<div class="row"><b>Computed tier</b> ${tierTag(t.tier)} <span class="muted">score ${t.score}</span></div>
      <div class="muted" style="margin-top:6px;font-size:12.5px">${t.reasons.map(r => `${r[0]} ${esc(r[1])}`).join(" · ") || "No risk factors"}</div>
      ${t.tier >= 2 ? `<div class="callout saffron" style="margin-top:10px">Tier 2 and up: independent audit by an empanelled auditor at least once a year, plus a risk and impact assessment before go-live.</div>` : ""}`;
  };
  m.querySelectorAll("#r_q [data-k]").forEach(el => el.addEventListener("change", update)); update();
  $("#r_save", m).onclick = async () => {
    const chosen = [...m.querySelectorAll("#r_models input:checked")].map(i => i.value);
    if (!chosen.length) { toast("Pick at least one model"); return; }
    const id = "SYS-" + String(40 + S.systems.length).padStart(3, "0");
    const sys = {
      id, name: $("#r_name", m).value || "Untitled AI system", dept: $("#r_dept", m).value, purpose: $("#r_purpose", m).value,
      integrator: $("#r_int", m).value, status: "Design", users: 0, answers: { ...a },
      models: chosen.map(c => ({ m: c, version: MODELS[c].origin === "India" ? "2026.10" : "2026-10", role: "Primary" })),
      baseModels: chosen.map(c => MODELS[c].name + " base"), plugins: [], retrieval: "To be declared", data: [],
      hosting: $("#r_host", m).value, consentBasis: a.personal === "none" ? "No personal data" : "Not mapped yet",
      lastAudit: null, lastPentest: null,
      controls: Object.fromEntries(CONTROLS.map(c => [c.id, c.id === "inv" || c.id === "bom"])),
    };
    S.systems.push(sys); save();
    log(OFFICER, "officer", "inventory.register", id, `Registered "${sys.name}"`);
    log("agent:kavach-bom", "agent", "aibom.generate", id, `AI-BOM v1 generated: ${chosen.length} model(s); computed ${TIER_NAMES[tierOf(sys)]}`);
    closeModal(); location.hash = "#/system/" + id; toast("Registered. AI-BOM generated automatically.");
  };
}

/* ───────── System detail ───────── */
const FIXES = {
  tier: ["Sign off tier", OFFICER, "officer", "tier.approve"],
  bom: ["Generate AI-BOM", "agent:kavach-bom", "agent", "aibom.generate"],
  tm_p: ["Generate prompt threat model", "agent:kavach-threat", "agent", "threatmodel.prompts"],
  tm_r: ["Generate retrieval threat model", "agent:kavach-threat", "agent", "threatmodel.retrieval"],
  tm_t: ["Generate tool/agent threat model", "agent:kavach-threat", "agent", "threatmodel.agents"],
  ria: ["Draft impact assessment", "agent:kavach-ria", "agent", "ria.draft"],
  pt: ["Attach pen-test report", OFFICER, "officer", "evidence.attach"],
  audit: ["Book empanelled auditor", OFFICER, "officer", "audit.schedule"],
  consent: ["Map consent and purpose", "agent:kavach-dpdp", "agent", "dpdp.consent_map"],
  flow: ["Generate data-flow map", "agent:kavach-dpdp", "agent", "dpdp.dataflow"],
  ir: ["Attach incident runbook", "agent:kavach-ir", "agent", "runbook.attach"],
};
VIEWS.system = {
  html(id) {
    const s = S.systems.find(x => x.id === id);
    if (!s) return `<div class="card">System not found. <a href="#/inventory">Back to inventory</a></div>`;
    const t = scoreTier(s.answers); const r = readiness(s); const ap = applicable(s);
    const groups = [...new Set(CONTROLS.map(c => c.group))];
    const sysLog = S.ledger.filter(e => e.target === s.id).slice(-8).reverse();
    return `
    <div class="page-head">
      <div><div class="eyebrow"><a href="#/inventory">Inventory</a> / ${s.id}</div><h1>${esc(s.name)}</h1>
      <p>${esc(s.purpose)}</p>
      <div class="row wrap" style="margin-top:8px">${tierTag(t.tier)}<span class="tag">${esc(s.status)}</span><span class="tag">${esc(s.dept)}</span>${s.users ? `<span class="tag">${fmtN(s.users)} users</span>` : ""}</div></div>
      <div class="actions"><button class="btn btn-ink" id="pack">Generate evidence pack</button></div>
    </div>
    <div class="grid g-main">
      <div class="stack">
        <div class="card"><h3>Audit readiness <span class="muted">· ${r.done} of ${r.total} controls</span><span class="sp"></span><b>${r.pct}%</b></h3>
          <div class="bar ${r.pct >= 80 ? "green" : "saffron"}"><i style="width:${r.pct}%"></i></div>
          ${r.gaps.length ? `<div class="row wrap" style="margin-top:12px"><button class="btn btn-primary btn-sm" id="fixAll">Close ${r.gaps.filter(g => FIXES[g.id][2] === "agent").length} gaps with Kavach agents</button><span class="muted" style="font-size:12px">Officer and auditor steps stay manual.</span></div>` : `<div class="callout green" style="margin-top:12px">All applicable controls have evidence. Ready for the empanelled auditor.</div>`}
          <hr class="sep">
          ${groups.map(g => { const cs = CONTROLS.filter(c => c.group === g); return `<div class="eyebrow" style="margin-top:6px">${g}</div>` + cs.map(c => {
            const isAp = ap.includes(c); const ok = s.controls[c.id];
            return `<div class="check"><div class="ic ${!isAp ? "na" : ok ? "ok" : "no"}">${!isAp ? "–" : ok ? "✓" : "!"}</div>
              <div class="body">${esc(c.name)}<small>${esc(c.ref)}${!isAp ? " · not required at this tier" : ""}</small></div>
              ${isAp && !ok ? `<button class="btn btn-sm" data-fix="${c.id}">${FIXES[c.id][0]}</button>` : ""}</div>`; }).join(""); }).join("")}
        </div>
        <div class="card"><h3>AI bill of materials</h3>
          <div class="table-wrap"><table><thead><tr><th>Model</th><th>Provider</th><th>Version</th><th>Origin</th><th>Manifest SHA-256</th></tr></thead><tbody id="bomRows">
          ${s.models.map(m => `<tr><td><b>${esc(MODELS[m.m].name)}</b><div class="muted" style="font-size:12px">${esc(m.role)}</div></td><td>${esc(MODELS[m.m].maker)}</td><td class="mono">${esc(m.version)}</td><td>${MODELS[m.m].origin === "India" ? '<span class="tag in">India</span>' : '<span class="tag warn">Global</span>'}</td><td class="mono" data-hash="${esc(MODELS[m.m].maker + "|" + m.m + "|" + m.version)}">…</td></tr>`).join("")}
          </tbody></table></div>
          <dl class="kv" style="margin-top:12px"><dt>Base models</dt><dd>${esc(s.baseModels.join(", "))}</dd><dt>Plugins and tools</dt><dd>${esc(s.plugins.join(", ") || "None declared")}</dd><dt>Retrieval sources</dt><dd>${esc(s.retrieval)}</dd></dl>
          <div class="callout" style="margin-top:12px">Changing a model provider or version creates a new AI-BOM and triggers revalidation, as the CERT-In guidelines require.</div>
        </div>
      </div>
      <div class="stack">
        <div class="card"><h3>Why ${TIER_NAMES[t.tier]}</h3>
          ${t.reasons.map(x => `<div class="row" style="padding:4px 0;font-size:13px"><b class="mono" style="width:26px">${x[0]}</b><span>${esc(x[1])}</span></div>`).join("") || '<div class="muted">No risk factors</div>'}
          <hr class="sep"><div class="row"><span class="muted">Score</span><span class="sp"></span><b>${t.score}</b></div>
          <div class="muted" style="font-size:11.5px;margin-top:6px">Kavach tiering rubric v0.3 (draft). Thresholds are set with the department and its auditor.</div>
        </div>
        <div class="card"><h3>DPDP data flow</h3>
          ${dataFlowSvg(s)}
          <dl class="kv" style="margin-top:10px"><dt>Personal data</dt><dd>${esc(s.data.join(", ") || "None")}</dd><dt>Consent basis</dt><dd>${esc(s.consentBasis)}</dd><dt>Hosting</dt><dd>${esc(s.hosting)}</dd></dl>
        </div>
        <div class="card"><h3>Activity</h3><div class="feed">${sysLog.map(e => `<div class="it"><time>${fmtTime(e.ts)}</time><div>${actorTag(e.kind)} <b>${esc(e.action)}</b><div class="muted">${esc(e.detail)}</div></div></div>`).join("") || '<div class="muted">No activity yet</div>'}</div></div>
      </div>
    </div>`;
  },
  async mount(id) {
    const s = S.systems.find(x => x.id === id); if (!s) return;
    document.querySelectorAll("[data-hash]").forEach(async td => { td.textContent = short(await sha256(td.dataset.hash)); });
    document.querySelectorAll("[data-fix]").forEach(b => b.onclick = async () => { await fixControl(s, b.dataset.fix); rerender(); });
    const fa = $("#fixAll"); if (fa) fa.onclick = async () => {
      fa.disabled = true;
      for (const g of readiness(s).gaps) if (FIXES[g.id][2] === "agent") { await fixControl(s, g.id); rerender(); await sleep(350); }
      toast("Agent-closable gaps closed. Remaining steps need an officer or auditor.");
    };
    $("#pack").onclick = () => openEvidencePack(s);
  },
};
async function fixControl(s, cid) {
  const [label, actor, kind, action] = FIXES[cid];
  s.controls[cid] = true;
  if (cid === "audit") s.lastAudit = new Date().toISOString().slice(0, 10);
  if (cid === "pt") s.lastPentest = new Date().toISOString().slice(0, 10);
  if (cid === "flow" && /not confirmed/.test(s.hosting)) s.hosting = "Vendor cloud · India region (confirmed via vendor attestation)";
  if (cid === "consent" && /Not mapped/.test(s.consentBasis)) s.consentBasis = "Consent notice drafted; purpose limited to " + s.name.toLowerCase();
  save();
  await log(actor, kind, action, s.id, `${label}: ${CONTROLS.find(c => c.id === cid).name}`);
}
function dataFlowSvg(s) {
  const inIndia = !/not confirmed/.test(s.hosting);
  const box = (x, label, sub, color) => `<g><rect x="${x}" y="22" width="92" height="46" rx="8" fill="var(--surface-2)" stroke="${color}"/><text x="${x + 46}" y="42" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text)">${label}</text><text x="${x + 46}" y="57" text-anchor="middle" font-size="9.5" fill="var(--text-3)">${sub}</text></g>`;
  const arrow = (x) => `<path d="M${x} 45h14" stroke="var(--text-3)" stroke-width="1.5" marker-end="url(#ah)"/>`;
  return `<svg viewBox="0 0 330 96" width="100%" role="img" aria-label="Data flow">
    <defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="var(--text-3)"/></marker></defs>
    <rect x="1" y="6" width="328" height="84" rx="10" fill="none" stroke="${inIndia ? "var(--green)" : "var(--red)"}" stroke-dasharray="4 3"/>
    <text x="10" y="18" font-size="9.5" font-weight="600" fill="${inIndia ? "var(--green)" : "var(--red)"}">${inIndia ? "INDIA BOUNDARY: data, models and logs stay in India" : "RESIDENCY NOT CONFIRMED"}</text>
    ${box(8, "Citizen / user", s.answers.personal === "none" ? "no personal data" : "with consent", "var(--border-strong)")}${arrow(102)}
    ${box(118, "Application", "masking + logs", "var(--border-strong)")}${arrow(212)}
    ${box(228, "Models", s.hosting.split("·")[0].trim().slice(0, 18), inIndia ? "var(--green)" : "var(--red)")}
  </svg>`;
}

/* ───────── Evidence pack ───────── */
async function buildPack(s) {
  const t = scoreTier(s.answers); const r = readiness(s);
  const bom = await Promise.all(s.models.map(async m => ({ model: MODELS[m.m].name, provider: MODELS[m.m].maker, version: m.version, origin: MODELS[m.m].origin, role: m.role, hosting: MODELS[m.m].host, manifestSha256: await sha256(MODELS[m.m].maker + "|" + m.m + "|" + m.version) })));
  const pack = {
    schema: "nirixaan.kavach.evidence-pack/0.3", generatedAt: nowIso(), tenant: "Demo State e-Governance Society (sample)",
    system: { id: s.id, name: s.name, department: s.dept, purpose: s.purpose, suppliedBy: s.integrator, status: s.status, users: s.users },
    riskTier: { tier: t.tier, label: TIER_NAMES[t.tier], score: t.score, factors: t.reasons.map(x => x[1]), rubric: "Kavach tiering rubric v0.3 (draft)" },
    aiBom: { models: bom, baseModels: s.baseModels, plugins: s.plugins, retrieval: s.retrieval },
    dpdp: { personalData: s.data, consentBasis: s.consentBasis, hosting: s.hosting, residencyConfirmed: !/not confirmed/.test(s.hosting) },
    controls: CONTROLS.map(c => ({ id: c.id, control: c.name, reference: c.ref, applicable: applicable(s).includes(c), evidence: !!s.controls[c.id] })),
    readiness: { percent: r.pct, open: r.gaps.map(g => g.name) },
    lastIndependentAudit: s.lastAudit, lastPenTest: s.lastPentest,
    ledger: S.ledger.filter(e => e.target === s.id).map(e => ({ seq: e.seq, ts: e.ts, actor: e.actor, action: e.action, detail: e.detail, hash: e.hash })),
    ledgerHead: S.ledger.length ? S.ledger[S.ledger.length - 1].hash : null,
  };
  pack.packSha256 = await sha256(JSON.stringify(pack));
  return pack;
}
async function openEvidencePack(s) {
  const p = await buildPack(s);
  await log(OFFICER, "officer", "evidencepack.generate", s.id, `Evidence pack ${p.packSha256.slice(0, 12)} generated (${p.readiness.percent}% ready)`);
  const body = `<div class="pack">
    <div class="eyebrow">Nirixaan Kavach · AI audit evidence pack</div>
    <h2 style="margin:4px 0 2px">${esc(s.name)} <span class="muted mono" style="font-size:13px">${s.id}</span></h2>
    <div class="muted">${esc(s.dept)} · supplied by ${esc(s.integrator)} · generated ${fmtTime(p.generatedAt)}</div>
    <h4>1. Inventory and risk tier</h4>
    <dl class="kv"><dt>Purpose</dt><dd>${esc(s.purpose)}</dd><dt>Risk tier</dt><dd>${tierTag(p.riskTier.tier)} score ${p.riskTier.score}: ${esc(p.riskTier.factors.join("; "))}</dd><dt>Independent audit</dt><dd>${p.riskTier.tier >= 2 ? "Required yearly. Last: " + (s.lastAudit || "never") : "Not required at tier 1"}</dd></dl>
    <h4>2. AI bill of materials</h4>
    <table><thead><tr><th>Model</th><th>Provider</th><th>Version</th><th>Origin</th><th>Manifest SHA-256</th></tr></thead><tbody>${p.aiBom.models.map(m => `<tr><td>${esc(m.model)}</td><td>${esc(m.provider)}</td><td>${esc(m.version)}</td><td>${m.origin}</td><td class="mono">${short(m.manifestSha256)}</td></tr>`).join("")}</tbody></table>
    <dl class="kv" style="margin-top:8px"><dt>Base models</dt><dd>${esc(p.aiBom.baseModels.join(", "))}</dd><dt>Plugins</dt><dd>${esc(p.aiBom.plugins.join(", ") || "None")}</dd><dt>Retrieval</dt><dd>${esc(p.aiBom.retrieval)}</dd></dl>
    <h4>3. Controls</h4>
    <table><thead><tr><th>Control</th><th>Reference</th><th>Status</th></tr></thead><tbody>${p.controls.filter(c => c.applicable).map(c => `<tr><td>${esc(c.control)}</td><td class="muted">${esc(c.reference)}</td><td>${c.evidence ? '<span class="tag ok">Evidence attached</span>' : '<span class="tag bad">Open</span>'}</td></tr>`).join("")}</tbody></table>
    <h4>4. DPDP</h4>
    <dl class="kv"><dt>Personal data</dt><dd>${esc(p.dpdp.personalData.join(", ") || "None")}</dd><dt>Consent basis</dt><dd>${esc(p.dpdp.consentBasis)}</dd><dt>Hosting</dt><dd>${esc(p.dpdp.hosting)} ${p.dpdp.residencyConfirmed ? '<span class="tag ok">India</span>' : '<span class="tag bad">Not confirmed</span>'}</dd></dl>
    <h4>5. Activity record (${p.ledger.length + 1} ledger entries)</h4>
    <table><tbody>${p.ledger.slice(-6).map(e => `<tr><td class="mono">#${e.seq}</td><td>${fmtTime(e.ts)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td></tr>`).join("")}</tbody></table>
    <h4>Seal</h4>
    <div class="seal">Pack SHA-256: ${p.packSha256}<br>Ledger head: ${p.ledgerHead}</div>
    <p class="muted" style="font-size:11.5px;margin-top:10px">Sample tenant. Control references summarise obligations in CERT-In's AI Security Auditing Guidelines v1.0 and the DPDP Act 2023; the clause mapping is reviewed with each department's empanelled auditor.</p>
  </div>`;
  const m = modal("Evidence pack", body, `<button class="btn" id="pj">Download JSON</button><button class="btn btn-ink" id="pp">Print / save as PDF</button>`);
  $("#pj", m).onclick = () => download(`${s.id}-evidence-pack.json`, JSON.stringify(p, null, 2));
  $("#pp", m).onclick = () => { document.body.classList.add("printing"); window.print(); document.body.classList.remove("printing"); };
}

/* ───────── Ledger ───────── */
VIEWS.ledger = {
  html() {
    return `
    <div class="page-head">
      <div><div class="eyebrow">Kavach</div><h1>Audit ledger</h1>
      <p>Every agent action, officer approval and routing decision is written to an append-only log. Each entry carries the SHA-256 of the one before, so any edit after the fact breaks the chain.</p></div>
      <div class="actions"><button class="btn" id="tamper">Simulate tampering</button><button class="btn btn-primary" id="verify">Verify chain</button><button class="btn" id="exp">Export</button></div>
    </div>
    <div id="vres"></div>
    <div class="card">
      <div class="ledger-row" style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em"><div>#</div><div>Time · actor</div><div>Action</div><div class="hide-sm">Hash</div></div>
      ${[...S.ledger].reverse().map(e => `<div class="ledger-row" data-seq="${e.seq}"><div class="mono">${e.seq}</div><div><div class="mono" style="font-size:11px">${fmtTime(e.ts)}</div>${actorTag(e.kind)}<div style="font-size:12px;overflow-wrap:anywhere">${esc(e.actor)}</div></div><div><b>${esc(e.action)}</b> · <span class="mono">${esc(e.target)}</span><div class="text-2">${esc(e.detail)}</div></div><div class="hash">${short(e.hash)}<br>prev ${short(e.prev)}</div></div>`).join("")}
    </div>`;
  },
  mount() {
    $("#verify").onclick = async () => {
      const broken = await verifyLedger();
      document.querySelectorAll(".ledger-row.broken").forEach(r => r.classList.remove("broken"));
      broken.forEach(n => { const r = document.querySelector(`.ledger-row[data-seq="${n}"]`); r && r.classList.add("broken"); });
      $("#vres").innerHTML = broken.length
        ? `<div class="callout red" style="margin-bottom:16px"><b>Chain broken at entry #${broken[0]}.</b> Entry contents no longer match their hash. The auditor sees exactly where the record was changed. <button class="btn btn-sm" id="repair" style="margin-left:8px">Restore original</button></div>`
        : `<div class="callout green" style="margin-bottom:16px"><b>Chain intact.</b> ${S.ledger.length} entries verified from genesis to head ${short(S.ledger[S.ledger.length - 1]?.hash)}.</div>`;
      const rp = $("#repair"); if (rp) rp.onclick = () => { const e = S.ledger.find(x => x.tampered); if (e) { e.detail = e.original; delete e.tampered; delete e.original; save(); } rerender(); $("#verify").click(); };
    };
    $("#tamper").onclick = () => {
      const e = S.ledger.find(x => x.action === "runbook.approve") || S.ledger[Math.floor(S.ledger.length / 2)];
      if (!e.tampered) { e.original = e.detail; e.tampered = true; e.detail = e.detail + " (approved by vendor, not officer)"; save(); }
      rerender(); toast(`Entry #${e.seq} edited directly in storage. Now verify.`);
    };
    $("#exp").onclick = () => download("audit-ledger.json", JSON.stringify(S.ledger.map(({ original, tampered, ...e }) => e), null, 2));
  },
};

/* ───────── Router ───────── */
const LANGS = ["English", "Hindi", "Bengali", "Marathi", "Telugu", "Tamil", "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi", "Assamese", "Urdu", "Maithili", "Santali", "Kashmiri", "Nepali", "Sindhi", "Konkani", "Dogri", "Manipuri", "Bodo", "Sanskrit"];
const LANG_COVER = { "sarvam-105b": 11, "sarvam-30b": 11, "param2-17b": 23, "gnani-s2s": 12, "bhashini-mt": 23, "global-code": 11 };
const TASKS = {
  code_gen: { label: "Generate code for a portal change", w: { code: .7, reasoning: .2, cost: .1 }, kinds: ["LLM"], codeTask: true },
  code_review: { label: "Review a pull request", w: { code: .5, reasoning: .4, cost: .1 }, kinds: ["LLM"], codeTask: true },
  incident: { label: "Diagnose a production incident", w: { reasoning: .7, code: .2, cost: .1 }, kinds: ["LLM"] },
  citizen_chat: { label: "Answer a citizen's question", w: { indic: .5, reasoning: .3, cost: .2 }, kinds: ["LLM"] },
  summarise: { label: "Summarise a Government Order", w: { reasoning: .4, indic: .4, cost: .2 }, kinds: ["LLM"] },
  translate: { label: "Translate UI strings", w: { translate: .7, indic: .2, cost: .1 }, kinds: ["MT", "LLM"] },
  speech: { label: "Voice helpline turn", w: { speech: .8, indic: .2 }, kinds: ["Speech"] },
};
function route(q) {
  const out = [];
  for (const m of Object.values(MODELS)) {
    const task = TASKS[q.task]; const reasons = []; let ok = true;
    if (!task.kinds.includes(m.kind)) { ok = false; reasons.push(`${m.kind} model, task needs ${task.kinds.join("/")}`); }
    if (LANGS.indexOf(q.lang) >= LANG_COVER[m.id]) { ok = false; reasons.push(`does not cover ${q.lang}`); }
    if (m.origin === "Global") {
      if (!S.routing.allowGlobalLowRisk) { ok = false; reasons.push("global models disabled by department policy"); }
      else if (!task.codeTask) { ok = false; reasons.push("policy P-02: global models only for code tasks"); }
      else if (q.tier > 1) { ok = false; reasons.push(`policy P-02: tier ${q.tier} work must stay on Indian models`); }
      else if (q.data !== "none") { ok = false; reasons.push("policy P-02: no personal data may go to a global model"); }
    }
    const score = Math.round(Object.entries(task.w).reduce((a, [k, w]) => a + (m.caps[k] || 0) * w, 0));
    out.push({ m, ok, score, reasons });
  }
  const eligible = out.filter(c => c.ok).sort((a, b) => b.score - a.score);
  let win = eligible[0]; let note = "Highest score among eligible models.";
  const bestIndian = eligible.find(c => c.m.origin === "India");
  if (win && win.m.origin === "Global" && bestIndian && win.score - bestIndian.score <= 10) { win = bestIndian; note = `Indian-first rule P-01: ${bestIndian.m.name} is within 10 points of the global model, so it is preferred.`; }
  else if (win && win.m.origin === "Global") note = `Global model allowed by P-02 (tier ${q.tier}, no personal data, code task) and ahead of the best Indian model by more than 10 points. Choice recorded for the AI-BOM.`;
  return { candidates: out.sort((a, b) => (b.ok - a.ok) || b.score - a.score), win, note };
}
VIEWS.router = {
  q: { task: "citizen_chat", lang: "Marathi", tier: 3, data: "personal" },
  html() {
    const q = this.q;
    return `
    <div class="page-head">
      <div><div class="eyebrow">Sovereign model layer</div><h1>Bharat Model Router</h1>
      <p>Each task goes to the best Indian model for its language, cost and risk tier. Approved global models are used only where department policy allows, and every decision is recorded.</p></div>
    </div>
    <div class="grid g-main">
      <div class="card"><h3>Route a task</h3>
        <div class="grid g2">
          <label class="f">Task<select id="q_task">${Object.entries(TASKS).map(([k, t]) => `<option value="${k}" ${k === q.task ? "selected" : ""}>${t.label}</option>`).join("")}</select></label>
          <label class="f">Language<select id="q_lang">${LANGS.map(l => `<option ${l === q.lang ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="f">Risk tier of the calling system<select id="q_tier">${[1, 2, 3, 4].map(t => `<option value="${t}" ${t == q.tier ? "selected" : ""}>${TIER_NAMES[t]}</option>`).join("")}</select></label>
          <label class="f">Data in the prompt<select id="q_data"><option value="none" ${q.data === "none" ? "selected" : ""}>No personal data</option><option value="personal" ${q.data === "personal" ? "selected" : ""}>Personal data</option><option value="sensitive" ${q.data === "sensitive" ? "selected" : ""}>Sensitive personal data</option></select></label>
        </div>
        <div class="row" style="margin-top:14px"><button class="btn btn-primary" id="q_go">Route and record</button><span class="sp"></span>
          <label class="row" style="font-size:12.5px;color:var(--text-2)"><input type="checkbox" id="q_pol" ${S.routing.allowGlobalLowRisk ? "checked" : ""}> Allow approved global models for tier 1 code</label></div>
        <div id="q_out" style="margin-top:16px"></div>
      </div>
      <div class="stack">
        <div class="card kpi"><div class="l">AI calls served by Indian models</div><div class="v">${indianShare()}%</div><div class="bar green" style="margin-top:8px"><i style="width:${indianShare()}%"></i></div><div class="s">${fmtN(S.routing.indian)} Indian · ${fmtN(S.routing.global)} global this month</div></div>
        <div class="card"><h3>Policy</h3>
          <div class="check"><div class="ic ok">P1</div><div class="body">Indian-first<small>An Indian model wins if it is within 10 points of any global model.</small></div></div>
          <div class="check"><div class="ic ok">P2</div><div class="body">Global models only for tier 1 code tasks with no personal data<small>Covers the risk that Indian models trail on code generation.</small></div></div>
          <div class="check"><div class="ic ok">P3</div><div class="body">All inference hosted in India<small>Empanelled cloud, NIC, State DC or IndiaAI Compute.</small></div></div>
          <div class="check"><div class="ic ok">P4</div><div class="body">Model or version change → new AI-BOM, revalidation</div></div>
        </div>
        <div class="card"><h3>Models in the catalogue</h3>${Object.values(MODELS).map(m => `<div class="row" style="padding:5px 0;font-size:13px"><span class="tag ${m.origin === "India" ? "in" : "warn"}">${m.origin === "India" ? "IN" : "GL"}</span><span>${esc(m.name)}</span><span class="sp"></span><span class="muted" style="font-size:11.5px">${esc(m.host)}</span></div>`).join("")}
          <div class="muted" style="font-size:11.5px;margin-top:8px">Capability scores are illustrative for the demo. Production scores come from the open Indian-context benchmark.</div></div>
      </div>
    </div>`;
  },
  mount() {
    const go = async (record) => {
      const q = this.q = { task: $("#q_task").value, lang: $("#q_lang").value, tier: +$("#q_tier").value, data: $("#q_data").value };
      const r = route(q);
      let rid = "";
      if (record && r.win) {
        rid = "RTE-" + String(5000 + S.ledger.length);
        if (r.win.m.origin === "India") S.routing.indian++; else S.routing.global++;
        save();
        await log("agent:router", "agent", "route.decide", rid, `${TASKS[q.task].label} (${q.lang}, tier ${q.tier}, ${q.data}) → ${r.win.m.name}`);
      }
      $("#q_out").innerHTML = (r.win ? `<div class="callout ${r.win.m.origin === "India" ? "green" : "saffron"}" style="margin-bottom:12px"><b>Routed to ${esc(r.win.m.name)}</b> · ${esc(r.win.m.host)}<br>${esc(r.note)}${rid ? `<br><span class="mono">Decision ${rid} written to the audit ledger.</span>` : ""}</div>` : `<div class="callout red" style="margin-bottom:12px"><b>No eligible model.</b> The task is blocked and an officer is notified.</div>`)
        + r.candidates.map(c => `<div class="cand ${c === r.win ? "win" : c.ok ? "" : "rej"}"><div><b>${esc(c.m.name)}</b> <span class="tag ${c.m.origin === "India" ? "in" : "warn"}">${c.m.origin}</span></div><div class="mono">${c.ok ? c.score : "—"}</div><div class="why">${c.ok ? (c === r.win ? "Selected" : "Eligible") : "Rejected: " + esc(c.reasons.join("; "))}</div></div>`).join("");
    };
    $("#q_go").onclick = () => go(true);
    $("#q_pol").onchange = (e) => { S.routing.allowGlobalLowRisk = e.target.checked; save(); log(OFFICER, "officer", "policy.update", "P-02", `Global models for tier 1 code ${e.target.checked ? "allowed" : "disabled"}`); go(false); };
    ["#q_task", "#q_lang", "#q_tier", "#q_data"].forEach(s => $(s).onchange = () => go(false));
    go(false);
  },
};

/* ───────── Connectors ───────── */
const MOCK = {
  digilocker: { req: `POST /public/oauth2/1/pull\n{ "consent_id": "cns_8f2…", "doctype": "HSCER", "issuer": "in.gov.sample-board" }`, res: `200 OK\n{ "uri": "in.gov.sample-board-HSCER-XXXX4821",\n  "issuer_signature": "verified",\n  "sha256": "9b1c…e07a",\n  "stored": false }` },
  aadhaar: { req: `POST /auth/otp/verify  (via licensed AUA sandbox)\n{ "uid_token": "tok_…41af", "otp": "******" }`, res: `200 OK\n{ "auth": "Y", "txn": "UKC:…", "uid": "XXXX-XXXX-4821 (masked)" }` },
  bhashini: { req: `POST /services/inference/pipeline\n{ "task": "translation", "source": "en", "target": "mr",\n  "input": "Your application has been approved." }`, res: `200 OK\n{ "output": "तुमचा अर्ज मंजूर झाला आहे." }` },
  apisetu: { req: `GET /certificate/v3/income?txn=…  (sandbox)`, res: `200 OK\n{ "status": "VALID", "issued_by": "Tahsildar (sample)" }` },
  upi: { req: `POST /collect  (sandbox)\n{ "vpa": "citizen@sample", "amount": "50.00", "purpose": "Exam fee" }`, res: `202 Accepted\n{ "status": "PENDING", "ref": "UPI-SBX-…" }` },
  aa: { req: `POST /Consent  (sandbox AA)\n{ "purpose": "Income verification for scholarship", "fetchType": "ONETIME" }`, res: `200 OK\n{ "ConsentHandle": "ch_…", "status": "PENDING_USER" }` },
};
VIEWS.connectors = {
  html() {
    return `
    <div class="page-head">
      <div><div class="eyebrow">Sovereign stack</div><h1>India Stack connectors</h1>
      <p>Pre-tested modules with sandboxes, so factory agents can integrate India Stack safely. Base versions will be open source so every integrator builds on the same blocks.</p></div>
    </div>
    <div class="grid g4">${S.connectors.map(c => `<div class="card conn"><div class="row"><div class="logo">${c.code}</div><span class="sp"></span><span class="tag ${c.status === "Sandbox ready" ? "ok" : c.status === "In development" ? "warn" : ""}">${c.status}</span></div>
      <b>${esc(c.name)}</b><div class="text-2" style="font-size:12.5px;flex:1">${esc(c.desc)}</div>
      ${MOCK[c.id] ? `<button class="btn btn-sm" data-test="${c.id}" ${c.status === "Planned" ? "disabled" : ""}>Run sandbox test</button>` : `<button class="btn btn-sm" disabled>Coming soon</button>`}
      ${c.calls ? `<div class="muted" style="font-size:11.5px">${c.calls} sandbox calls logged</div>` : ""}</div>`).join("")}</div>
    <div id="c_out" style="margin-top:16px"></div>`;
  },
  mount() {
    document.querySelectorAll("[data-test]").forEach(b => b.onclick = async () => {
      const c = S.connectors.find(x => x.id === b.dataset.test); const mk = MOCK[c.id];
      $("#c_out").innerHTML = `<div class="card"><h3>${esc(c.name)} · sandbox <span class="tag">running</span></h3><pre class="code">${esc(mk.req)}</pre></div>`;
      await sleep(700);
      c.calls++; save();
      await log("agent:nirman-verify", "agent", "connector.test", c.name, `Sandbox contract test passed (${c.calls})`);
      $("#c_out").innerHTML = `<div class="card"><h3>${esc(c.name)} · sandbox <span class="tag ok">passed</span></h3><div class="grid g2"><div><div class="eyebrow">Request</div><pre class="code">${esc(mk.req)}</pre></div><div><div class="eyebrow">Response</div><pre class="code">${esc(mk.res)}</pre></div></div><div class="muted" style="font-size:12px;margin-top:8px">Identifiers are masked or tokenised before they reach any model. The call is recorded in the audit ledger.</div></div>`;
    });
  },
};

/* ───────── Nirman (software factory) ───────── */
const NIRMAN_STAGES = [
  ["spec", "Spec", "agent:nirman-spec", "Writes the specification and acceptance criteria"],
  ["plan", "Plan", "agent:nirman-plan", "Breaks the change into steps and picks connectors"],
  ["code", "Code", "agent:nirman-build", "Writes the change on a branch"],
  ["test", "Test", "agent:nirman-verify", "Writes and runs tests"],
  ["scan", "Security scan", "agent:nirman-verify", "SAST, dependency and secrets scans"],
  ["approve", "Officer approval", OFFICER, "A named person approves the risk"],
  ["release", "Staged release", "agent:nirman-release", "Canary 5% → 25% → 100% with automatic rollback"],
];
VIEWS.nirman = {
  sel: "WI-2207", st: null,
  html() {
    const wi = SEED.workItems.find(w => w.id === this.sel); const st = this.st;
    const stageState = (i) => !st ? "" : st.i > i ? "done" : st.i === i ? (NIRMAN_STAGES[i][0] === "approve" ? "wait" : "run") : "";
    const out = (k) => {
      const idx = NIRMAN_STAGES.findIndex(s => s[0] === k);
      const visible = st && (st.i > idx || (k === "approve" && st.i === 5) || (k === "release" && st.i >= 6));
      if (!visible) return "";
      switch (k) {
        case "spec": return `<ul style="margin:0;padding-left:18px;font-size:13px">${wi.spec.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
        case "plan": return `<div class="text-2" style="font-size:13px">${wi.connector ? `Use the pre-tested <b>${wi.connector}</b> connector. ` : ""}Repo <span class="mono">${wi.repo}</span>, branch <span class="mono">nx/${wi.id.toLowerCase()}</span>. Model: Sarvam 105B for spec and review. ${wi.risk > 1 ? `Code generation stays on Sarvam 105B: tier ${wi.risk} work cannot use a global model (policy P-02).` : "Code generation may use the approved global model under policy P-02 (tier 1, no personal data); the choice is recorded."}</div>`;
        case "code": return `<pre class="code">${wi.diff}</pre>`;
        case "test": return `<div class="row wrap"><span class="tag ok">${wi.tests.total} passed</span><span class="tag">+${wi.tests.added} new tests</span><span class="tag in">coverage ${wi.tests.coverage[0]}% → ${wi.tests.coverage[1]}%</span></div>`;
        case "scan": return `<div class="row wrap"><span class="tag ${wi.scan.sast ? "bad" : "ok"}">SAST ${wi.scan.sast}</span><span class="tag ${wi.scan.deps ? "warn" : "ok"}">Dependencies ${wi.scan.deps}</span><span class="tag ok">Secrets ${wi.scan.secrets}</span><span class="muted" style="font-size:12px">${esc(wi.scan.note)}</span></div>`;
        case "approve": return st.i === 5 ? `<div class="approval"><h4>Approval needed: ${esc(wi.title)}</h4><div class="text-2" style="font-size:13px;margin-bottom:10px">Risk tier ${wi.risk} change to a production citizen service. Agents cannot merge to main without a named approver.</div><div class="row wrap"><button class="btn btn-primary" id="n_ok">Approve as ${esc(OFFICER.replace("officer:", ""))}</button><button class="btn" id="n_no">Request changes</button></div></div>` : `<span class="tag officer">Approved by ${esc(OFFICER)}</span>`;
        case "release": { const p = st.canary || 0; return `<div class="row"><div class="bar green" style="flex:1"><i style="width:${p}%"></i></div><b>${p}%</b></div><div class="muted" style="font-size:12px;margin-top:4px">Error rate 0.02% · p95 412 ms · within guardrails</div>`; }
      }
    };
    return `
    <div class="page-head">
      <div><div class="eyebrow">Nirixaan Nirman · autonomous software factory</div><h1>From approved requirement to released code</h1>
      <p>Agents do the routine production work. Named officers approve intent, design and risk. Every release produces its change record and AI-BOM entry as it happens.</p></div>
    </div>
    <div class="grid g-main">
      <div class="card">
        <div class="row wrap" style="margin-bottom:14px"><select id="n_sel" style="width:auto;flex:1" ${st && !st.finished ? "disabled" : ""}>${SEED.workItems.map(w => `<option value="${w.id}" ${w.id === this.sel ? "selected" : ""}>${w.id} · ${esc(w.title)}</option>`).join("")}</select>
          <button class="btn btn-primary" id="n_run" ${st && !st.finished ? "disabled" : ""}>${st && st.finished ? "Run again" : "Run factory"}</button></div>
        <div class="row wrap" style="margin-bottom:16px"><span class="tag">${esc(wi.kind)}</span><span class="tag">repo ${esc(wi.repo)}</span><span class="tag t${wi.risk}">risk tier ${wi.risk}</span></div>
        <div class="pipeline">${NIRMAN_STAGES.map(([k, label, actor, desc], i) => `<div class="stage ${stageState(i)}"><div class="node">${st && st.i > i ? "✓" : i + 1}</div><div><div class="st-title">${label} ${actorTag(actor.startsWith("officer") ? "officer" : "agent")}<span class="muted mono" style="font-size:11px">${esc(actor)}</span></div><div class="st-body">${desc}</div><div class="st-out">${out(k)}</div></div></div>`).join("")}</div>
      </div>
      <div class="stack">
        ${st && st.finished ? `<div class="card"><h3>Change record <span class="tag ok">released</span></h3><dl class="kv"><dt>Change</dt><dd>${esc(st.cr)}</dd><dt>Work item</dt><dd>${wi.id}</dd><dt>Approved by</dt><dd>${esc(OFFICER)}</dd><dt>Lead time</dt><dd>${st.lead}</dd><dt>Agent share</dt><dd>${st.agentShare}% of steps by agents, approved without edits</dd><dt>AI-BOM</dt><dd>Release entry added to SYS-031</dd></dl></div>` : ""}
        <div class="card"><h3>Pilot metrics <span class="muted">· sample baseline</span></h3>
          <dl class="kv"><dt>Lead time</dt><dd>11 days → <b>2.5 days</b></dd><dt>Change failure rate</dt><dd>18% → <b>7%</b></dd><dt>Agent work approved without edits</dt><dd><b>${62 + S.releases.length}%</b></dd><dt>Releases this pilot</dt><dd>${14 + S.releases.length}</dd></dl>
          <div class="muted" style="font-size:11.5px;margin-top:8px">Targets are agreed with each partner after measuring their baseline.</div></div>
        <div class="card"><h3>Agent identities</h3>${["nirman-spec · read repo, write docs", "nirman-build · write branch only", "nirman-verify · run CI, read-only scans", "nirman-release · deploy via pipeline, rollback"].map(x => `<div class="row" style="padding:4px 0;font-size:12.5px">${actorTag("agent")}<span class="mono">${x}</span></div>`).join("")}
          <div class="muted" style="font-size:11.5px;margin-top:6px">Each agent has its own narrowly scoped identity and token.</div></div>
      </div>
    </div>`;
  },
  mount() {
    $("#n_sel").onchange = (e) => { this.sel = e.target.value; this.st = null; rerender(); };
    $("#n_run").onclick = () => this.run();
    const ok = $("#n_ok"); if (ok) ok.onclick = () => this.approve(true);
    const no = $("#n_no"); if (no) no.onclick = () => this.approve(false);
  },
  async run() {
    const tok = ++runToken; const wi = SEED.workItems.find(w => w.id === this.sel);
    this.st = { i: 0, t0: Date.now() }; rerender();
    for (let i = 0; i < 5; i++) {
      await sleep(1100); if (tok !== runToken) return;
      const [k, label, actor] = NIRMAN_STAGES[i];
      log(actor, "agent", "nirman." + k, wi.id, `${label} complete for "${wi.title}"`);
      this.st.i = i + 1; if (currentRoute().name === "nirman") rerender();
    }
  },
  async approve(yes) {
    const wi = SEED.workItems.find(w => w.id === this.sel); const tok = runToken;
    if (!yes) { log(OFFICER, "officer", "nirman.changes_requested", wi.id, "Sent back to the spec agent with comments"); this.st = { i: 0 }; toast("Sent back. The spec agent will revise."); await sleep(600); return this.run(); }
    await log(OFFICER, "officer", "nirman.approve", wi.id, `Approved release of "${wi.title}"`);
    this.st.i = 6; this.st.canary = 0; rerender();
    for (const p of [5, 25, 60, 100]) { await sleep(800); if (tok !== runToken) return; this.st.canary = p; if (currentRoute().name === "nirman") rerender(); }
    const cr = "CR-" + (3100 + S.releases.length);
    S.releases.push({ cr, wi: wi.id, ts: nowIso() }); save();
    await log("agent:nirman-release", "agent", "release.staged", wi.id, `${cr} released to 100% after canary; AI-BOM release entry written`);
    Object.assign(this.st, { i: 7, finished: true, cr, lead: "6 h 40 m (simulated)", agentShare: 86 });
    if (currentRoute().name === "nirman") rerender();
  },
};

/* ───────── Sanchalan (ops factory) ───────── */
const SCENARIOS = {
  results: {
    label: "Results-day slowdown · Board results portal", system: "SYS-012", reportable: false,
    alerts: [["P2", "results-web-03", "p95 latency 4.1s > 1.5s"], ["P2", "results-web-01", "p95 latency 3.8s"], ["P1", "pg-primary", "connections 498/500"], ["P3", "lb-public", "5xx rate 2.4%"], ["P2", "results-web-02", "p95 latency 5.2s"], ["P1", "pg-primary", "connections 500/500"], ["P3", "redis-01", "evictions rising"], ["P2", "results-api", "timeouts 8%"], ["P3", "status-probe", "Hindi page slow"], ["P2", "results-web-04", "p95 latency 6.0s"], ["P3", "lb-public", "5xx rate 4.1%"], ["P2", "results-api", "timeouts 13%"]],
    diagnosis: ["Release v2.14.1 went live at 09:58, 6 minutes before the first alert.", "v2.14.1 removed connection pooling from the marks lookup query (diff line 212).", "Database connections hit the 500 limit; traffic is 9× a normal day (results day).", "Not malicious: no unusual source IPs, no failed-login spike."],
    fix: [["RB-07", "Roll back results-api to v2.14.0", "in runbook"], ["RB-12", "Scale read replicas from 2 to 4", "in runbook"]],
    mttr: [52, 14],
    status: {
      en: ["Some students are seeing slow loading on the results portal. We are fixing it. Expected: 20 minutes.", "The results portal is working normally again. Sorry for the inconvenience."],
      hi: ["परिणाम पोर्टल पर कुछ विद्यार्थियों को धीमी गति का सामना करना पड़ रहा है। हम इसे ठीक कर रहे हैं। अनुमानित समय: 20 मिनट।", "परिणाम पोर्टल अब सामान्य रूप से काम कर रहा है। असुविधा के लिए खेद है।"],
      mr: ["निकाल पोर्टलवर काही विद्यार्थ्यांना संथ गतीचा अनुभव येत आहे. आम्ही समस्या सोडवत आहोत. अंदाजे वेळ: २० मिनिटे.", "निकाल पोर्टल आता सुरळीत सुरू आहे. झालेल्या गैरसोयीबद्दल क्षमस्व."],
    },
  },
  attack: {
    label: "Credential-stuffing on the scholarship login", system: "SYS-014", reportable: true,
    alerts: [["P2", "auth-svc", "failed logins 40×/min baseline"], ["P3", "waf", "rate-limit hits from 312 IPs"], ["P2", "auth-svc", "OTP requests spiking"], ["P1", "auth-svc", "3 accounts logged in from new ASN"], ["P3", "sms-gateway", "OTP cost alert"], ["P2", "waf", "known bad user-agents"], ["P2", "auth-svc", "failed logins 70×/min baseline"], ["P1", "siem", "pattern match: credential stuffing"]],
    diagnosis: ["About 41,000 login attempts in 25 minutes from 312 IPs, mostly 2 hosting providers.", "Usernames match a public breach list; success rate 0.007% (3 accounts).", "No access to DigiLocker data: the 3 sessions stopped at the OTP step.", "Matches 'targeted scanning / unauthorised access attempt' in CERT-In's reportable categories."],
    fix: [["RB-21", "Block the 312 IPs at the WAF for 24 h", "in runbook"], ["RB-22", "Force password reset and revoke sessions for 3 accounts", "in runbook"], ["—", "Notify affected students (DPDP breach-notice check)", "outside runbook: officer decides"]],
    mttr: [190, 31],
    status: {
      en: ["We blocked suspicious login attempts on the scholarship portal. Your data is safe. If asked, please reset your password.", "Login is working normally. Three affected accounts have been secured and their owners informed."],
      hi: ["हमने छात्रवृत्ति पोर्टल पर संदिग्ध लॉगिन प्रयासों को रोक दिया है। आपका डेटा सुरक्षित है। कहे जाने पर कृपया अपना पासवर्ड बदलें।", "लॉगिन सामान्य रूप से काम कर रहा है। प्रभावित तीन खाते सुरक्षित कर दिए गए हैं और उनके धारकों को सूचित किया गया है।"],
      mr: ["आम्ही शिष्यवृत्ती पोर्टलवरील संशयास्पद लॉगिन प्रयत्न रोखले आहेत. तुमचा डेटा सुरक्षित आहे. सांगितल्यास कृपया तुमचा पासवर्ड बदला.", "लॉगिन सुरळीत सुरू आहे. बाधित तीन खाती सुरक्षित केली असून त्यांच्या धारकांना कळवले आहे."],
    },
  },
};
VIEWS.sanchalan = {
  sc: "results", st: null, lang: "hi",
  html() {
    const sc = SCENARIOS[this.sc]; const st = this.st; const ph = st ? st.phase : 0;
    // phases: 1 alerts, 2 grouped, 3 diagnosed, 4 awaiting approval, 5 fixing, 6 resolved
    const clock = st && st.t0 ? Math.max(0, 6 * 3600 - Math.floor((Date.now() - st.t0) / 1000) * 60) : 6 * 3600; // 1 real second = 1 simulated minute
    const hh = String(Math.floor(clock / 3600)).padStart(2, "0"), mm = String(Math.floor(clock % 3600 / 60)).padStart(2, "0");
    return `
    <div class="page-head">
      <div><div class="eyebrow">Nirixaan Sanchalan · autonomous ops factory</div><h1>Keep citizen portals running</h1>
      <p>Alerts are grouped, incidents diagnosed and approved fixes run. Incident records are ready for CERT-In reporting, and citizens get status updates in their language.</p></div>
    </div>
    <div class="grid g-main">
      <div class="stack">
        <div class="card">
          <div class="row wrap"><select id="s_sel" style="width:auto;flex:1" ${ph && ph < 6 ? "disabled" : ""}>${Object.entries(SCENARIOS).map(([k, v]) => `<option value="${k}" ${k === this.sc ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select>
          <button class="btn btn-primary" id="s_run" ${ph && ph < 6 ? "disabled" : ""}>${ph === 6 ? "Run again" : "Start incident"}</button></div>
          <div class="row wrap" style="margin-top:10px"><span class="tag">${sc.system}</span><span class="tag">Autonomy: act with approval</span><span class="tag">Read-only until approved</span></div>
        </div>
        ${ph >= 1 ? `<div class="card"><h3>Alert stream <span class="muted">· ${st.alerts.length} alerts</span>${ph >= 2 ? `<span class="sp"></span><span class="tag in">grouped into 1 incident</span>` : ""}</h3>
          <div style="max-height:200px;overflow:auto">${[...st.alerts].reverse().map(a => `<div class="alert-line"><span class="sev" style="color:${a[0] === "P1" ? "var(--red)" : a[0] === "P2" ? "var(--saffron)" : "var(--text-3)"}">${a[0]}</span><span class="mono">${esc(a[1])}</span><span>${esc(a[2])}</span></div>`).join("")}</div></div>` : ""}
        ${ph >= 3 ? `<div class="card"><h3>Diagnosis ${actorTag("agent")} <span class="muted mono" style="font-size:11px">agent:sanchalan-diagnose · Sarvam 105B</span></h3>
          ${sc.diagnosis.map((d, i) => `<div class="check"><div class="ic ${i === sc.diagnosis.length - 1 ? (sc.reportable ? "no" : "ok") : "na"}">${i + 1}</div><div class="body">${esc(d)}</div></div>`).join("")}</div>` : ""}
        ${ph >= 4 ? `<div class="card"><h3>Proposed fix</h3>
          ${sc.fix.map(f => `<div class="check"><div class="ic ${ph >= 6 ? "ok" : "na"}">${ph >= 6 ? "✓" : "·"}</div><div class="body"><b class="mono">${f[0]}</b> ${esc(f[1])}<small>${esc(f[2])}</small></div></div>`).join("")}
          ${ph === 4 ? `<div class="approval" style="margin-top:12px"><h4>Approve runbook steps</h4><div class="text-2" style="font-size:13px;margin-bottom:10px">The agent will run only the listed runbook steps. Anything outside the runbook stays with the officer.</div><button class="btn btn-primary" id="s_ok">Approve and run</button></div>` : ""}
          ${ph === 5 ? `<div class="callout" style="margin-top:12px">Running approved steps…</div>` : ""}
          ${ph === 6 ? `<div class="callout green" style="margin-top:12px"><b>Resolved.</b> Time to restore: <b>${sc.mttr[1]} min</b> (baseline ${sc.mttr[0]} min). Post-incident review drafted.</div>` : ""}</div>` : ""}
      </div>
      <div class="stack">
        <div class="card"><h3>CERT-In reporting</h3>
          ${ph < 3 ? `<div class="muted">Classification happens after diagnosis.</div>` : sc.reportable
            ? `<div class="callout red" style="margin-bottom:10px"><b>Reportable.</b> CERT-In must be told within 6 hours of noticing.</div><div class="row"><span class="muted">Time left</span><span class="sp"></span><span class="clock" id="s_clock">${hh}:${mm}</span></div><div class="muted" style="font-size:11.5px">Demo clock: 1 second = 1 minute</div>
               <hr class="sep"><dl class="kv"><dt>Incident type</dt><dd>Unauthorised access attempt / targeted scanning</dd><dt>Systems</dt><dd>Scholarship portal auth service</dd><dt>Data affected</dt><dd>3 accounts, no documents accessed</dd><dt>Indicators</dt><dd>312 IPs, 2 ASNs (attached)</dd><dt>Logs</dt><dd>Retained in India, 180 days</dd></dl>
               <button class="btn btn-ink" style="margin-top:12px;width:100%" id="s_rep" ${ph < 6 ? "" : ""}>${st.reported ? "Report filed ✓" : "Review draft and file report"}</button>`
            : `<div class="callout green">Not a cyber security incident under CERT-In's Directions: cause is a faulty release, no malicious activity. The record is kept, and a draft is ready if the classification changes.</div>`}
        </div>
        ${ph >= 3 ? `<div class="card"><h3>Citizen status update <span class="muted">· via Bhashini</span></h3>
          <div class="seg" style="margin-bottom:10px">${[["en", "English"], ["hi", "हिन्दी"], ["mr", "मराठी"]].map(([k, l]) => `<button data-lang="${k}" class="${this.lang === k ? "on" : ""}">${l}</button>`).join("")}</div>
          <div style="font-size:15px;line-height:1.6">${esc(sc.status[this.lang][ph >= 6 ? 1 : 0])}</div>
          <div class="muted" style="font-size:11.5px;margin-top:8px">Posted to the status page and the IVR. Translations are checked against a glossary before posting.</div></div>` : ""}
        <div class="card"><h3>Ops metrics <span class="muted">· sample baseline</span></h3>
          <dl class="kv"><dt>Time to restore</dt><dd>${sc.mttr[0]} min → <b>${sc.mttr[1]} min</b></dd><dt>Alerts per incident</dt><dd>${sc.alerts.length} → 1 page to on-call</dd><dt>Incidents handled</dt><dd>${17 + S.incidents.length} this pilot</dd></dl>
          <div class="muted" style="font-size:11.5px;margin-top:8px">Published AIOps benchmarks show 40–60% faster incident resolution.</div></div>
      </div>
    </div>`;
  },
  mount() {
    $("#s_sel").onchange = (e) => { this.sc = e.target.value; this.st = null; rerender(); };
    $("#s_run").onclick = () => this.run();
    const ok = $("#s_ok"); if (ok) ok.onclick = () => this.approve();
    document.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { this.lang = b.dataset.lang; rerender(); });
    const rep = $("#s_rep"); if (rep) rep.onclick = () => this.report();
    clearInterval(this.tick);
    if (this.st && this.st.t0 && !this.st.reported) this.tick = setInterval(() => { const c = $("#s_clock"); if (!c || currentRoute().name !== "sanchalan") return clearInterval(this.tick); const s = Math.max(0, 6 * 3600 - Math.floor((Date.now() - this.st.t0) / 1000) * 60); c.textContent = String(Math.floor(s / 3600)).padStart(2, "0") + ":" + String(Math.floor(s % 3600 / 60)).padStart(2, "0"); }, 1000);
  },
  async run() {
    const tok = ++runToken; const sc = SCENARIOS[this.sc];
    this.st = { phase: 1, alerts: [] }; rerender();
    for (const a of sc.alerts) { await sleep(320); if (tok !== runToken) return; this.st.alerts.push(a); if (currentRoute().name === "sanchalan") rerender(); }
    await sleep(500); if (tok !== runToken) return;
    this.st.phase = 2; this.st.inc = "INC-" + (420 + S.incidents.length);
    log("agent:sanchalan-triage", "agent", "incident.grouped", sc.system, `${sc.alerts.length} alerts grouped into ${this.st.inc}`);
    rerender(); await sleep(1100); if (tok !== runToken) return;
    this.st.phase = 3; if (sc.reportable) this.st.t0 = Date.now();
    log("agent:sanchalan-diagnose", "agent", "incident.diagnosed", sc.system, `${this.st.inc}: ${sc.diagnosis[1]}`);
    if (sc.reportable) log("agent:sanchalan-diagnose", "agent", "certin.classify", sc.system, `${this.st.inc} classified reportable; 6-hour clock started`);
    rerender(); await sleep(1200); if (tok !== runToken) return;
    this.st.phase = 4; rerender();
  },
  async approve() {
    const sc = SCENARIOS[this.sc]; const tok = runToken;
    await log(OFFICER, "officer", "runbook.approve", sc.system, `${sc.fix.filter(f => f[2] === "in runbook").map(f => f[0]).join(", ")} approved for ${this.st.inc}`);
    this.st.phase = 5; rerender(); await sleep(1600); if (tok !== runToken) return;
    for (const f of sc.fix.filter(f => f[2] === "in runbook")) await log("agent:sanchalan-fix", "agent", "runbook.run", sc.system, `${f[0]} ${f[1]}: success`);
    S.incidents.push({ id: this.st.inc, sc: this.sc, ts: nowIso() }); save();
    await log("agent:sanchalan-fix", "agent", "incident.resolved", sc.system, `${this.st.inc} resolved in ${sc.mttr[1]} min; post-incident review drafted`);
    this.st.phase = 6; if (currentRoute().name === "sanchalan") rerender();
  },
  report() {
    const sc = SCENARIOS[this.sc]; if (this.st.reported) return;
    const body = `<div class="pack"><div class="eyebrow">Draft · CERT-In incident report</div><h2 style="margin:4px 0 12px">${this.st.inc} · ${esc(sc.label)}</h2>
      <dl class="kv"><dt>Reporting entity</dt><dd>Demo State e-Governance Society (sample)</dd><dt>Time noticed</dt><dd>${fmtTime(new Date(this.st.t0).toISOString())}</dd><dt>Category</dt><dd>Targeted scanning / unauthorised access attempt</dd><dt>Affected system</dt><dd>${sc.system} scholarship portal, authentication service</dd><dt>Description</dt><dd>${esc(sc.diagnosis.join(" "))}</dd><dt>Actions taken</dt><dd>${esc(sc.fix.map(f => f[1]).join("; "))}</dd><dt>Indicators</dt><dd>IP list and ASN summary attached (indicators.csv)</dd><dt>Point of contact</dt><dd>${esc(OFFICER.replace("officer:", ""))}</dd></dl>
      <div class="callout saffron" style="margin-top:14px">Sanchalan drafts the report; the officer reviews and submits it through CERT-In's official channel.</div></div>`;
    const m = modal("CERT-In report draft", body, `<button class="btn" data-close>Close</button><button class="btn btn-primary" id="r_sub">Mark as submitted</button>`);
    $("#r_sub", m).onclick = async () => { this.st.reported = true; await log(OFFICER, "officer", "certin.report_submitted", sc.system, `${this.st.inc} report submitted with ${$("#s_clock") ? $("#s_clock").textContent : ""} left on the 6-hour clock`); closeModal(); rerender(); toast("Report marked as submitted and recorded in the ledger."); };
  },
};

/* ───────── modal ───────── */
function modal(title, body, foot) {
  closeModal();
  const bg = document.createElement("div"); bg.className = "modal-bg"; bg.id = "modal";
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button class="x" data-close aria-label="Close">×</button></div><div class="modal-body">${body}</div><div class="modal-foot">${foot}</div></div>`;
  bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) closeModal(); });
  document.body.appendChild(bg); return bg;
}
function closeModal() { const m = $("#modal"); if (m) { m.remove(); if (currentRoute().name !== "ledger") rerender(); } }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ───────── guided demo ───────── */
const TOURS = {
  government: [
    ["overview", "Your AI estate on one page", "Since Nov 4, 2026 every AI system needs an inventory entry, a risk tier, an AI bill of materials and, from tier 2 up, an independent audit. This is the department's live readiness."],
    ["system/SYS-021", "AI you didn't know you had", "Kavach found this OCR model inside bought DMS software. No AI-BOM, residency not confirmed. Click 'Close gaps with Kavach agents' and watch readiness rise."],
    ["system/SYS-014", "Evidence the auditor accepts", "Click 'Generate evidence pack'. It is sealed with a SHA-256 hash and can be printed or exported for the empanelled auditor."],
    ["sanchalan", "Ops factory on a citizen portal", "Pick the credential-stuffing scenario and start it. Alerts are grouped, the incident is diagnosed and the CERT-In 6-hour clock starts. You approve the fix."],
    ["ledger", "Nothing can be quietly changed", "Every agent action and approval is hash-chained. Click 'Simulate tampering', then 'Verify chain'."],
  ],
  integrator: [
    ["inventory", "Register a system in two minutes", "Click 'Register AI system'. The tier is computed from the answers and the AI-BOM is generated from the models you pick."],
    ["nirman", "Software factory on your project", "Run the DigiLocker work item. Agents write the spec, code and tests. You approve before anything ships."],
    ["connectors", "Pre-tested India Stack blocks", "Run a DigiLocker or Bhashini sandbox test. Base connectors will be open source."],
    ["system/SYS-012", "Pass your next AI audit", "This chatbot is missing a prompt threat model and its yearly audit. The evidence pack shows exactly what's left."],
  ],
  investor: [
    ["overview", "The wedge: compliance that sells now", "A rule that took effect Nov 4, 2026 applies to every government AI system. Kavach is the smallest build with the most urgent buyer."],
    ["router", "Model-agnostic, Indian-first", "Change the task to code generation at tier 1 to see policy-gated global fallback. We gain as Indian models improve."],
    ["nirman", "Then the factories", "Kavach deployments give us the inventory and the integrator relationship that Nirman and Sanchalan build on."],
    ["sanchalan", "Ops factory", "Faster recovery with records ready for CERT-In. Run the results-day scenario."],
    ["ledger", "Evidence as a by-product", "Audit material is generated while work happens. That is the moat."],
  ],
};
let tour = null;
function showTour() {
  let el = $("#tour"); if (!el) { el = document.createElement("div"); el.className = "tour"; el.id = "tour"; document.body.appendChild(el); }
  if (!tour) {
    el.innerHTML = `<button class="x" id="t_x" aria-label="Close" style="float:right">×</button><div class="eyebrow">Guided demo</div><h4>Who is in the room?</h4><p>Pick an audience for a 5-minute walkthrough. You can leave it any time.</p>
      <div class="grid" style="gap:8px">${[["government", "Ministry or state IT department"], ["integrator", "System integrator"], ["investor", "Investor"]].map(([k, l]) => `<button class="btn" data-aud="${k}" style="background:transparent;color:inherit;border-color:rgba(127,127,127,.4);justify-content:flex-start">${l}</button>`).join("")}</div>`;
    el.querySelectorAll("[data-aud]").forEach(b => b.onclick = () => { tour = { aud: b.dataset.aud, i: 0 }; location.hash = "#/" + TOURS[tour.aud][0][0]; showTour(); });
  } else {
    const steps = TOURS[tour.aud]; const [r, t, p] = steps[tour.i];
    el.innerHTML = `<button class="x" id="t_x" aria-label="Close" style="float:right">×</button><div class="eyebrow">Step ${tour.i + 1} of ${steps.length}</div><h4>${esc(t)}</h4><p>${esc(p)}</p>
      <div class="row"><button class="btn btn-sm" id="t_prev" ${tour.i === 0 ? "disabled" : ""}>Back</button><span class="sp"></span><button class="btn btn-sm go" id="t_next">${tour.i === steps.length - 1 ? "Finish" : "Next"}</button></div>`;
    $("#t_prev").onclick = () => { tour.i--; location.hash = "#/" + steps[tour.i][0]; showTour(); };
    $("#t_next").onclick = () => { if (tour.i === steps.length - 1) { endTour(); return; } tour.i++; location.hash = "#/" + steps[tour.i][0]; showTour(); };
  }
  $("#t_x").onclick = endTour;
}
function endTour() { tour = null; const el = $("#tour"); el && el.remove(); S.tourDone = true; save(); }

/* ───────── boot ───────── */
async function boot() {
  S = load();
  if (!S) { S = freshState(); await seedLedger(); }
  window.addEventListener("hashchange", () => { runToken++; window.scrollTo(0, 0); render(); });
  document.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-href]"); if (tr) location.hash = tr.dataset.href; });
  $("#tourBtn").onclick = () => { tour = null; showTour(); };
  $("#resetBtn").onclick = async () => { if (!confirm("Reset the demo to its starting data?")) return; try { localStorage.removeItem(STORE_KEY); } catch (e) {} S = freshState(); await seedLedger(); VIEWS.nirman.st = null; VIEWS.sanchalan.st = null; location.hash = "#/overview"; render(); toast("Demo reset"); };
  $("#themeBtn").onclick = () => { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; r.dataset.theme = dark ? "light" : "dark"; try { localStorage.setItem("nx-theme", r.dataset.theme); } catch (e) {} };
  $("#menuBtn").onclick = () => $(".side").classList.toggle("open");
  render();
  if (!S.tourDone && !/[?&]notour/.test(location.search)) showTour();
}
try { const th = localStorage.getItem("nx-theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
boot();
})();
