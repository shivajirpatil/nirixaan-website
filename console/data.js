/* Seed data for the demo tenant. Every name, figure and record here is sample data. */
window.NX_SEED = (() => {
  const MODELS = {
    "sarvam-105b":  { id: "sarvam-105b",  name: "Sarvam 105B",        maker: "Sarvam AI",          origin: "India",  kind: "LLM",    host: "MeitY-empanelled GCC · Mumbai", langs: 11, caps: { reasoning: 86, code: 72, indic: 88, speech: 0, translate: 70, cost: 55 } },
    "sarvam-30b":   { id: "sarvam-30b",   name: "Sarvam 30B",         maker: "Sarvam AI",          origin: "India",  kind: "LLM",    host: "MeitY-empanelled GCC · Mumbai", langs: 11, caps: { reasoning: 74, code: 64, indic: 84, speech: 0, translate: 66, cost: 82 } },
    "param2-17b":   { id: "param2-17b",   name: "BharatGen Param2-17B", maker: "BharatGen",        origin: "India",  kind: "LLM",    host: "IndiaAI Compute Portal",        langs: 22, caps: { reasoning: 70, code: 55, indic: 90, speech: 0, translate: 78, cost: 86 } },
    "gnani-s2s":    { id: "gnani-s2s",    name: "Gnani Voice (speech-to-speech)", maker: "Gnani.ai", origin: "India", kind: "Speech", host: "NIC data centre · Pune",       langs: 12, caps: { reasoning: 40, code: 0, indic: 85, speech: 92, translate: 60, cost: 70 } },
    "bhashini-mt":  { id: "bhashini-mt",  name: "Bhashini translation", maker: "Bhashini (MeitY)", origin: "India",  kind: "MT",     host: "Bhashini ULCA endpoint",        langs: 22, caps: { reasoning: 0, code: 0, indic: 92, speech: 70, translate: 93, cost: 95 } },
    "global-code":  { id: "global-code",  name: "Approved global model (policy-gated)", maker: "Global provider", origin: "Global", kind: "LLM", host: "India region, policy-gated", langs: 10, caps: { reasoning: 92, code: 91, indic: 62, speech: 0, translate: 60, cost: 40 } },
  };

  // Control catalogue: mapped to the obligations named in CERT-In's AI Security Auditing Guidelines v1.0 and the DPDP Act.
  const CONTROLS = [
    { id: "inv",    group: "Inventory",  name: "Listed in the AI system inventory",            ref: "CERT-In AI audit · inventory",          minTier: 1 },
    { id: "tier",   group: "Inventory",  name: "Risk tier assigned and signed off by an officer", ref: "CERT-In AI audit · risk tiering",     minTier: 1 },
    { id: "bom",    group: "AI-BOM",     name: "AI bill of materials: provider, version, hash, base models, plugins", ref: "CERT-In AI audit · AI-BOM", minTier: 1 },
    { id: "tm_p",   group: "Threat model", name: "Threat model covers prompts (injection, jailbreak)", ref: "CERT-In AI audit · threat modelling", minTier: 1 },
    { id: "tm_r",   group: "Threat model", name: "Threat model covers retrieval sources",         ref: "CERT-In AI audit · threat modelling",   minTier: 1 },
    { id: "tm_t",   group: "Threat model", name: "Threat model covers tools and agents",          ref: "CERT-In AI audit · threat modelling",   minTier: 1 },
    { id: "ria",    group: "Assessment", name: "Risk and impact assessment before deployment and after material change", ref: "CERT-In AI audit · impact assessment", minTier: 2 },
    { id: "pt",     group: "Assessment", name: "Penetration test within the last 12 months",     ref: "CERT-In AI audit · testing",            minTier: 2 },
    { id: "audit",  group: "Assessment", name: "Independent audit by an empanelled auditor in the last 12 months", ref: "CERT-In AI audit · tier 2 and up", minTier: 2 },
    { id: "consent",group: "DPDP",       name: "Consent notice and purpose limitation mapped",   ref: "DPDP Act 2023 · s.5–6",                 minTier: 1, needsPersonal: true },
    { id: "flow",   group: "DPDP",       name: "Data-flow map shows data, models and logs stay in India", ref: "DPDP Act · sovereign hosting",   minTier: 1 },
    { id: "ir",     group: "Incident",   name: "Incident runbook with 6-hour CERT-In reporting",  ref: "CERT-In Directions 2022",               minTier: 1 },
  ];

  const ALL = Object.fromEntries(CONTROLS.map(c => [c.id, true]));
  const without = (...ids) => ({ ...ALL, ...Object.fromEntries(ids.map(i => [i, false])) });

  const systems = [
    {
      id: "SYS-014", name: "Scholarship eligibility assistant", dept: "Higher & Technical Education Dept.",
      purpose: "Answers student questions in 6 languages and pre-checks scholarship eligibility from DigiLocker marksheets before an officer approves.",
      integrator: "Sample Integrator Pvt Ltd", status: "Production", users: 1800000,
      answers: { rights: true, citizen: true, personal: "sensitive", children: true, autonomy: "approve", tools: true, scale: true },
      models: [{ m: "sarvam-30b", version: "2026.08", role: "Citizen chat" }, { m: "param2-17b", version: "2.1.0", role: "Eligibility reasoning" }],
      baseModels: ["Sarvam 30B base", "Param2-17B base"], plugins: ["DigiLocker requester API", "Scheme GO retrieval index", "Bhashini MT"],
      retrieval: "312 Government Orders and scheme guidelines (PDF), refreshed weekly",
      data: ["Name", "Aadhaar-linked DigiLocker ID (tokenised)", "Marksheets", "Income certificate", "Caste certificate"],
      hosting: "MeitY-empanelled GCC · Mumbai", consentBasis: "Consent at login, purpose: scholarship eligibility only",
      lastAudit: "2026-02-18", lastPentest: "2026-03-02", controls: without("audit", "tm_t"),
    },
    {
      id: "SYS-009", name: "Grievance routing classifier", dept: "Chief Minister's Helpline",
      purpose: "Classifies incoming grievances by department and urgency and routes them automatically.",
      integrator: "Sample Integrator Pvt Ltd", status: "Production", users: 950000,
      answers: { rights: false, citizen: true, personal: "personal", children: false, autonomy: "auto", tools: false, scale: false },
      models: [{ m: "param2-17b", version: "2.0.3", role: "Classification" }],
      baseModels: ["Param2-17B base"], plugins: ["CPGRAMS export"],
      retrieval: "None", data: ["Name", "Phone", "Grievance text", "District"],
      hosting: "NIC data centre · Pune", consentBasis: "Notice at submission",
      lastAudit: "2025-12-04", lastPentest: "2025-08-11", controls: without("pt", "tm_r"),
    },
    {
      id: "SYS-021", name: "Land record OCR inside a bought DMS", dept: "Revenue Dept.",
      purpose: "AI feature inside a commercial document management system: reads scanned 7/12 extracts and fills mutation forms.",
      integrator: "DMS vendor (bought software)", status: "Production", users: 400000,
      answers: { rights: true, citizen: false, personal: "personal", children: false, autonomy: "approve", tools: false, scale: false },
      models: [{ m: "global-code", version: "unknown", role: "OCR and extraction (vendor-embedded)" }],
      baseModels: ["Not disclosed by vendor"], plugins: ["Vendor OCR pipeline"],
      retrieval: "None", data: ["Owner name", "Survey number", "Mutation history"],
      hosting: "Vendor cloud · region not confirmed", consentBasis: "Not mapped",
      lastAudit: null, lastPentest: null, controls: without("tier", "bom", "tm_p", "tm_t", "ria", "pt", "audit", "consent", "flow"),
    },
    {
      id: "SYS-017", name: "Ration-card voice helpline", dept: "Food, Civil Supplies & Consumer Protection",
      purpose: "Voice bot that tells callers their ration entitlement and nearest fair-price shop in their language.",
      integrator: "Sample Integrator Pvt Ltd", status: "Pilot", users: 220000,
      answers: { rights: false, citizen: true, personal: "personal", children: false, autonomy: "assist", tools: false, scale: false },
      models: [{ m: "gnani-s2s", version: "3.4", role: "Speech in and out" }, { m: "bhashini-mt", version: "ULCA-2026", role: "Translation" }],
      baseModels: ["Gnani ASR/TTS"], plugins: ["PDS entitlement API (read-only)"],
      retrieval: "Fair-price shop directory", data: ["Ration card number", "Caller number"],
      hosting: "NIC data centre · Pune", consentBasis: "IVR notice before the call",
      lastAudit: "2026-06-10", lastPentest: "2026-06-01", controls: without("ria"),
    },
    {
      id: "SYS-031", name: "Nirman build agent", dept: "State e-Governance Society",
      purpose: "Software-factory agent: drafts specs, code, tests and release notes for portal upgrades. All merges need human approval.",
      integrator: "Nirixaan Labs", status: "Pilot", users: 40,
      answers: { rights: false, citizen: false, personal: "none", children: false, autonomy: "approve", tools: true, scale: false },
      models: [{ m: "sarvam-105b", version: "2026.09", role: "Specs and code review" }, { m: "global-code", version: "2026-10", role: "Code generation (low-risk, policy-gated)" }],
      baseModels: ["Sarvam 105B base"], plugins: ["Git (scoped token)", "CI runner", "SAST scanner"],
      retrieval: "Repository and design docs", data: ["Source code (no citizen data)"],
      hosting: "MeitY-empanelled GCC · Mumbai", consentBasis: "No personal data",
      lastAudit: "2026-10-01", lastPentest: "2026-09-20", controls: ALL,
    },
    {
      id: "SYS-032", name: "Sanchalan ops diagnosis agent", dept: "State Data Centre",
      purpose: "Ops-factory agent: groups alerts, diagnoses incidents and runs pre-approved runbook steps.",
      integrator: "Nirixaan Labs", status: "Pilot", users: 25,
      answers: { rights: false, citizen: false, personal: "none", children: false, autonomy: "approve", tools: true, scale: false },
      models: [{ m: "sarvam-105b", version: "2026.09", role: "Diagnosis" }, { m: "bhashini-mt", version: "ULCA-2026", role: "Indic status updates" }],
      baseModels: ["Sarvam 105B base"], plugins: ["Prometheus (read)", "Runbook executor (scoped)", "Status page"],
      retrieval: "Runbooks and past incident reviews", data: ["Logs and metrics (personal data masked)"],
      hosting: "State Data Centre · on-prem", consentBasis: "No personal data",
      lastAudit: "2026-10-01", lastPentest: "2026-09-20", controls: ALL,
    },
    {
      id: "SYS-012", name: "Board exam results chatbot", dept: "State Board of Secondary Education",
      purpose: "Answers results, revaluation and supplementary-exam questions during results week.",
      integrator: "Sample Integrator Pvt Ltd", status: "Production", users: 2600000,
      answers: { rights: false, citizen: true, personal: "personal", children: true, autonomy: "assist", tools: false, scale: true },
      models: [{ m: "sarvam-105b", version: "2026.05", role: "Chat" }],
      baseModels: ["Sarvam 105B base"], plugins: ["Results lookup API (read-only)"],
      retrieval: "Board circulars", data: ["Roll number", "Date of birth"],
      hosting: "MeitY-empanelled GCC · Mumbai", consentBasis: "Notice on chat open",
      lastAudit: "2025-11-20", lastPentest: "2026-01-15", controls: without("audit", "tm_p"),
    },
  ];

  const workItems = [
    { id: "WI-2207", title: "Add DigiLocker document fetch to the scholarship portal", kind: "India Stack integration", repo: "scholarship-portal", risk: 2, connector: "DigiLocker",
      spec: ["Student can pull Class 10 and 12 marksheets from DigiLocker with consent", "Fetched documents are verified against the issuer signature", "No document is stored after the eligibility check; only a hash is kept", "Works in English, Hindi and Marathi"],
      diff: `<span class="cm">// src/eligibility/documents.ts</span>
<span class="add">+ import { digilocker } from "@nirixaan/indiastack/digilocker";</span>
<span class="add">+</span>
<span class="add">+ export async function fetchMarksheets(session: CitizenSession) {</span>
<span class="add">+   const consent = await digilocker.requestConsent(session, ["CBSE_X", "CBSE_XII"]);</span>
<span class="add">+   const docs = await digilocker.pull(consent, { verifyIssuerSignature: true });</span>
<span class="add">+   audit.record("digilocker.pull", { consentId: consent.id, docs: docs.map(d => d.sha256) });</span>
<span class="add">+   return docs; // held in memory only, see retention policy RP-04</span>
<span class="add">+ }</span>
<span class="del">- export async function uploadMarksheet(file: File) { /* manual upload */ }</span>`,
      tests: { total: 148, added: 23, coverage: [71, 84] }, scan: { sast: 0, deps: 1, secrets: 0, note: "1 low-severity dependency advisory, auto-patched" } },
    { id: "WI-2211", title: "Upgrade Spring Boot 2.7 to 3.3 and close 4 CVEs", kind: "Security patch", repo: "grievance-portal", risk: 2, connector: null,
      spec: ["All modules build on Java 21 and Spring Boot 3.3", "CVE-2024-38816 and three other advisories closed", "No change in API responses (contract tests pass)", "Rollback plan tested in staging"],
      diff: `<span class="cm">// pom.xml</span>
<span class="del">-   &lt;version&gt;2.7.18&lt;/version&gt;</span>
<span class="add">+   &lt;version&gt;3.3.5&lt;/version&gt;</span>
<span class="cm">// 41 files: javax.* → jakarta.* (mechanical, agent-generated)</span>
<span class="del">- import javax.servlet.http.HttpServletRequest;</span>
<span class="add">+ import jakarta.servlet.http.HttpServletRequest;</span>`,
      tests: { total: 612, added: 18, coverage: [63, 66] }, scan: { sast: 0, deps: 0, secrets: 0, note: "4 CVEs closed, 0 new findings" } },
    { id: "WI-2214", title: "Marathi and Tamil UI for the grievance portal via Bhashini", kind: "Indic language", repo: "grievance-portal", risk: 1, connector: "Bhashini",
      spec: ["All 214 UI strings available in Marathi and Tamil", "Each string checked by a back-translation test and a native reviewer sample", "Language switch remembered per user", "Screen-reader labels translated too"],
      diff: `<span class="cm">// i18n/mr.json (agent-generated via Bhashini, 214 strings)</span>
<span class="add">+ "submit_grievance": "तक्रार नोंदवा",</span>
<span class="add">+ "track_status": "स्थिती पहा",</span>
<span class="cm">// i18n/ta.json</span>
<span class="add">+ "submit_grievance": "புகாரைச் சமர்ப்பிக்கவும்",</span>`,
      tests: { total: 96, added: 428, coverage: [58, 61] }, scan: { sast: 0, deps: 0, secrets: 0, note: "No findings" } },
  ];

  const connectors = [
    { id: "apisetu",   code: "A",  name: "API Setu",           desc: "Gateway to 1,000+ government APIs with standard auth.", status: "Sandbox ready", calls: 0 },
    { id: "digilocker",code: "D",  name: "DigiLocker",         desc: "Issuer and requester APIs: pull verified documents with consent.", status: "Sandbox ready", calls: 0 },
    { id: "aadhaar",   code: "K",  name: "Aadhaar eKYC",       desc: "Authentication and eKYC through a licensed AUA/KUA. Numbers are tokenised.", status: "Sandbox ready", calls: 0 },
    { id: "upi",       code: "U",  name: "UPI",                desc: "Collect and refund flows for fees and challans.", status: "In development", calls: 0 },
    { id: "bhashini",  code: "B",  name: "Bhashini",           desc: "Translation, speech recognition and speech synthesis in 22 languages.", status: "Sandbox ready", calls: 0 },
    { id: "aa",        code: "AA", name: "Account Aggregator", desc: "Consent-based financial data for income verification.", status: "In development", calls: 0 },
    { id: "ondc",      code: "O",  name: "ONDC",               desc: "Open network buyer and seller app integration.", status: "Planned", calls: 0 },
    { id: "umang",     code: "M",  name: "UMANG",              desc: "Publish a department service into the UMANG app.", status: "Planned", calls: 0 },
  ];

  return { MODELS, CONTROLS, systems, workItems, connectors };
})();
