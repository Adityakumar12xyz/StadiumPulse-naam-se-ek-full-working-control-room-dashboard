# Security Notes — StadiumPulse

This file documents the security posture of the demo and what changes before a real deployment.

## Implemented in this build

- **Zero external dependencies.** Earlier drafts loaded Google Fonts; this build uses only system fonts, so there is nothing to allow-list, nothing that can be swapped for a malicious asset by a compromised third-party CDN, and no external network request happens at all.
- **A hash-based `Content-Security-Policy` with no `'unsafe-inline'` at all** (real meta tag, not a comment):
  `default-src 'self'; style-src 'self' 'sha256-...'; script-src 'self' 'sha256-...'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  - The `sha256-` values are the exact SHA-256 hash of the page's `<style>` and `<script>` block contents. The browser will only execute/apply that *exact* block — if a single byte were injected (e.g. via a successful XSS attempt), the hash would no longer match and the browser would refuse to run it. This is strictly stronger than `'unsafe-inline'`, which allows *any* inline script/style to run.
  - Every static `style=""` HTML attribute was removed from the markup and replaced with CSS classes, specifically so `'unsafe-inline'` could be dropped from `style-src` entirely (attribute styles, unlike CSSOM calls like `el.style.color = ...`, do require `'unsafe-inline'`/`'unsafe-hashes'` under CSP, so removing them was a precondition for this hardening).
  - `connect-src 'none'` — the app makes no `fetch`/`XHR`/`WebSocket` calls, so none are allowed, closing off a whole class of data-exfiltration vectors even if a script injection somehow occurred.
  - `frame-ancestors 'none'` — blocks this page from being embedded in a hostile iframe (clickjacking protection).
  - `object-src 'none'` and `base-uri 'self'` — standard hardening against legacy plugin and base-tag injection tricks.
  - **This is automatically regression-tested**: `tests.js` recomputes the SHA-256 hash of the live `<style>`/`<script>` blocks and asserts the CSP still contains it, and asserts `'unsafe-inline'` never creeps back in. If someone edits the app without updating the CSP hash, `npm test` fails.
- **`referrer` meta tag** set to `no-referrer` — no page/query data leaks anywhere, including to the (now removed) external font host.
- **XSS prevention on the only free-text input** (incident description):
  - HTML-escaped with `escapeHtml()` before it is ever stored or displayed.
  - Inserted into the DOM exclusively via `textContent` / `createElement`, never `innerHTML`.
- **Input validation**, enforced twice: the HTML `maxlength` attribute, and independently in JavaScript (so the check still holds even if `maxlength` is stripped via devtools).
- **Tamper check on the section dropdown**: on submit, the selected section id is verified against the real, server-known list rather than trusted blindly — a manually-edited `<option value>` is rejected.
- **Client-side rate limiting on the report form**: a 3-second cooldown between submissions (`isRateLimited`) and a hard per-session cap (`MAX_REPORTS_PER_SESSION`), both unit-tested. This is explicitly documented as *defense in depth, not a substitute* for server-side rate limiting — a determined attacker can always bypass client-side checks by calling the (future) API directly.
- **No `eval`, no dynamically constructed `<script>` tags, no third-party JavaScript whatsoever.**
- **Fail-safe startup**: initialisation is wrapped in `try/catch`; a failure shows a visible, accessible error banner (`role="alert"`) instead of a silently broken page.
- **`Object.freeze(CONFIG)`**: the app's tunable constants can't be mutated at runtime, even accidentally, closing off a class of "prototype/constant pollution" style bugs.

## What a production deployment would add

A hackathon demo has no real backend, so the items below are documented rather than built:

- **Authentication & authorization**: staff login (SSO/OAuth) with role-based access — a gate steward should not see or change security-team-only controls.
- **Server-side re-validation of everything**: every client-side check here (length limits, required fields, section-id whitelist, rate limits) must be re-enforced server-side, since client-side checks can always be bypassed by calling an API directly.
- **Real server-side rate limiting / abuse prevention**, e.g. per-IP or per-account throttling, to stop spam or denial-of-service via mass fake reports — the client-side cooldown here only stops accidental double-submits and casual abuse.
- **Transport security**: HTTPS-only, HSTS, secure cookies if sessions are introduced.
- **Audit logging**: every incident report and security alert attributed to an authenticated staff account, logged immutably.
- **Dependency scanning**: if a real backend/build pipeline is introduced, run `npm audit` / Dependabot (or equivalent) in CI.
- **External CSS/JS files instead of inline blocks**: the hash-based CSP here is already stronger than `'unsafe-inline'`, but a production build would typically split CSS/JS into external files served with a per-request nonce so the policy doesn't need updating on every deploy (a hash must be recomputed whenever the inline content changes — acceptable for a single-file hackathon demo, less ideal for a fast-moving production codebase).
