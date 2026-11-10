# Nirixaan Labs website

Company website for [nirixaanlabs.com](https://www.nirixaanlabs.com): sovereign autonomous factories for Digital India.

## What's here
- `index.html`: the marketing site (single page, no build step)
- `console/`: the **Sovereign Factory Console**, an interactive demo MVP served at `/console/`
  - Kavach: AI inventory, computed risk tiers, AI bill of materials, CERT-In/DPDP control checklist, sealed evidence packs (print or JSON)
  - Audit ledger: SHA-256 hash-chained log with a tamper demo
  - Bharat Model Router: Indian-first routing with policy-gated global fallback
  - India Stack connectors: sandbox test calls (mocked)
  - Nirman: software-factory run with an officer approval gate and staged release
  - Sanchalan: ops-factory incidents, CERT-In 6-hour reporting clock, Hindi/Marathi status updates
  - Guided demo for government, integrator and investor audiences
  - Runs fully in the browser on sample data, works offline; state is kept in localStorage (use **Reset** to start over). Add `?notour` to skip the guided demo popup.

## Local development
```bash
python3 -m http.server 8080 --bind 127.0.0.1 -d /path/to/nirixaan-website
```
Always pass `-d` with the repo path: without it the server shares whatever folder your terminal is in. `--bind 127.0.0.1` keeps it off your local network.
Then open http://localhost:8080 and http://localhost:8080/console/.

## Deploy
Every push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`). Custom domain is set in `CNAME`.

## Contact form
The form opens the visitor's email app with a pre-filled message to enquiry@nirixaanlabs.com (no third-party form service).
