# Security Notes — StadiumPulse

This file documents the security posture of the demo and what changes before a real deployment.

## Implemented in this demo

- **Content-Security-Policy** (meta tag in `index.html`): restricts script/style/font/image origins to `'self'` and the two Google Fonts hosts, blocks `object-src`, and pins `form-action` to `'self'`. This is a real, enforced browser-level control, not just documentation.
- **`referrer` meta tag** set to `no-referrer` so no URL/query data leaks to third parties (e.g. the fonts CDN) via the `Referer` header.
- **XSS prevention on the only free-text input** (incident description):
  - HTML-escaped with `escapeHtml()` before it is ever stored or displayed.
  - Inserted into the DOM exclusively via `textContent` / `createElement`, never `innerHTML`, so even a successful bypass of the escaping couldn't execute as markup.
- **Input validation**: required-field check, a hard 140-character limit enforced both by the HTML `maxlength` attribute and in JavaScript (defense in depth — the JS check still applies if `maxlength` is removed via devtools).
- **Tamper check on the section dropdown**: on submit, the selected section id is verified against the server-known list (`sections`) rather than trusted blindly, so a manually-edited `<option value>` in devtools is rejected.
- **No `eval`, no dynamically constructed script tags, no third-party JS** — the only external resources loaded are two Google Fonts stylesheets/font files, both explicitly allow-listed in the CSP.
- **Fail-safe startup**: app initialisation is wrapped in `try/catch`; a failure surfaces a visible, accessible error banner (`role="alert"`) instead of leaving a half-broken, confusing page.

## What a production deployment would add

A hackathon demo has no real backend, so the items below are documented rather than built — they're the checklist for turning this into a production system:

- **Authentication & authorization**: staff login (SSO/OAuth), with role-based access — a gate steward should not be able to see or change security-team-only controls.
- **Server-side validation**: every check in this client (length limits, required fields, section-id whitelist) must be re-enforced server-side, since client-side checks can always be bypassed.
- **Transport security**: HTTPS-only, HSTS, secure cookies if sessions are introduced.
- **Rate limiting / abuse prevention** on the incident-report endpoint to stop spam or denial-of-service via mass fake reports.
- **Audit logging**: every incident report and security alert should be attributed to an authenticated staff account and immutably logged.
- **Dependency scanning**: if a real backend/build pipeline is introduced, run `npm audit` / Dependabot (or equivalent) in CI.
- **Real CSP without `'unsafe-inline'`**: this demo uses `'unsafe-inline'` for style/script because everything ships in a single HTML file for zero-install judging. A production build would move CSS/JS to external files and use a nonce- or hash-based CSP instead.
