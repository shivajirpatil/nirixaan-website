# Nirixaan Website

Company website for [nirixaanlabs.com](https://nirixaanlabs.com).

## Stack
- Pure HTML/CSS/JS — no build step required
- Hosted on GitHub Pages
- Auto-deploys on every push to `main`

## Local development
Open `index.html` directly in a browser, or use any static file server:
```bash
npx serve .
# or
python3 -m http.server 8080
```

## CI/CD
Every push to `main`:
1. **Validate** — checks HTML and flags placeholder values
2. **Deploy** — publishes to GitHub Pages automatically

## Custom domain
Configured via `CNAME` file → `nirixaanlabs.com`

## Contact form
Replace `YOUR_FORM_ID` in `index.html` with your [Formspree](https://formspree.io) form ID.
