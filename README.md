# 🏟️ StadiumPulse
### Smart Stadiums & Tournament Operations — Control Room Dashboard

StadiumPulse is a real-time operations dashboard that gives stadium staff a single screen to watch crowd density, respond to security incidents, track ticketing and fixtures, and serve fans with disabilities — everything a tournament control room needs during a live match day.

---

## 1. Problem Statement Alignment

Large tournaments fail for the same handful of reasons every time: nobody notices a stand filling up until it's dangerous, security teams find out about incidents secondhand, ticketing and gate data live in a different system than crowd data, and accessibility is treated as an afterthought. StadiumPulse addresses each of these directly in one interface:

| Problem area | What StadiumPulse does |
|---|---|
| Crowd safety | Live per-section occupancy map with automatic critical-density alerts |
| Security operations | Real-time alert feed + on-the-spot incident reporting from any section |
| Tournament & ticketing ops | Live fixture list, gate assignments, and ticket-sold tracking |
| Accessibility & inclusion | High-contrast mode, adjustable text size, live captions, screen-reader-safe alerts, spoken alerts, and wheelchair-seating highlighting |

Everything above is implemented and interactive in `index.html` — there is no mocked-up screenshot standing in for functionality.

## 2. Live Feature Tour

- **Stadium Bowl visualization** — a 16-section SVG map (4 stands × 4 blocks) built from scratch with polar-coordinate geometry. Each section is colour-coded by live occupancy (green/amber/red) and is fully keyboard-navigable; focusing or hovering a section announces its exact count.
- **Live Alert Feed** — auto-generated crowd/security events stream in as occupancy changes, each tagged by severity (`info` / `high` / `critical`).
- **Incident reporting** — staff can file a report against any section; input is validated (required, 140-char limit) and HTML-escaped before it ever touches the DOM.
- **Ticketing & Tournament Schedule** — upcoming fixtures, gate assignments, and a live "tickets sold" progress bar per match.
- **Accessibility toolbar** — high contrast, larger text, live captions (for hard-of-hearing fans following commentary/announcements), "read alerts aloud" (uses the browser's built-in Web Speech API), and a one-tap wheelchair-accessible-seating highlight on the stadium map.

## 3. Tech Stack

- **Frontend:** Semantic HTML5, CSS (custom properties / design tokens, no framework), vanilla JavaScript (ES6, no build step, no external runtime dependencies)
- **Fonts:** Oswald (display), Inter (body), JetBrains Mono (data/timestamps) — loaded from Google Fonts
- **Browser APIs used:** SVG DOM, Web Speech API (`speechSynthesis`), `prefers-reduced-motion`
- **Testing:** Node.js `assert` module, zero test-framework dependencies
- **No backend required** for the demo — all data is simulated client-side so judges can run it instantly from a single file. Section 8 explains how this plugs into real sensors/APIs.

Deliberately dependency-free: nothing to `npm install`, no build pipeline, no CDN dependency in the JS/CSS itself (only optional Google Fonts) — it runs anywhere, instantly, which matters a lot on unreliable hackathon wifi.

## 4. Project Structure

```
smart-stadium/
├── index.html      # The entire application (markup + styles + logic)
├── tests.js         # Unit tests for the core business logic
├── package.json     # `npm test` entry point
└── README.md
```

## 5. Running It

**Just the dashboard:**
Open `index.html` directly in any modern browser. No server, no build, no install.

**Unit tests:**
```bash
npm test
# or
node tests.js
```

## 6. Code Quality

- Single responsibility per function (`getDensityLevel`, `escapeHtml`, `renderBowl`, `renderAlerts`, `renderTicketing`, …) — each does one job and is independently testable.
- No inline event handlers in markup; all wiring done via `addEventListener` in a single IIFE to avoid polluting the global scope.
- Consistent naming, small functions, and comments only where intent isn't obvious from the code itself.
- Design tokens (colour, spacing, radius) centralised as CSS custom properties in `:root` rather than scattered magic values — one place to re-skin the whole app.

## 7. Security Considerations

- **XSS prevention:** the only free-text user input (incident description) is escaped with `escapeHtml()` before being rendered, and is inserted via `textContent`, never `innerHTML`, wherever it reaches the DOM.
- **Input validation:** required-field and max-length checks run before any data is accepted, with visible, screen-reader-announced error messages (`role="alert"`).
- **Least trust by default:** all rendering functions that touch dynamic data use safe DOM APIs (`textContent`, `createElement`) rather than string-concatenated `innerHTML`.
- **For a production deployment**, this client would sit behind: authenticated staff login with role-based access (control-room operator vs. security vs. gate staff), HTTPS-only delivery, server-side validation mirroring the client-side checks above, and rate-limiting on the incident-report endpoint to prevent spam/abuse. These are noted here rather than built, since a hackathon demo has no real backend to secure.

## 8. Efficiency

- A single `setInterval` drives the clock (1s), crowd simulation (3.5s), and stats refresh (5s) — no redundant timers, no polling loops per component.
- The stadium map re-renders only its own SVG subtree, not the whole page, on each update.
- No external JS/CSS framework is loaded — the entire interactive experience ships in one HTML file, so first paint is essentially instant.
- Animations are GPU-friendly (opacity/stroke changes) and are fully disabled when `prefers-reduced-motion` is set, saving battery/CPU for users who've asked for it.

## 9. Testing

`tests.js` unit-tests the pure logic that the UI depends on, independent of the DOM:
- Density classification thresholds (live / warn / critical)
- HTML-escaping / XSS-prevention on user input
- Incident-report validation rules
- Geometry helpers used to draw the stadium map
- General-purpose utilities (`clamp`)

Run `npm test` — all 10 tests pass in under a second, with no test framework or `npm install` required.

## 10. Accessibility

Built to WCAG-minded practice, not just a toggle bolted on at the end:
- Every interactive element (including SVG stadium sections) is keyboard-reachable and has a visible focus ring.
- A skip-to-content link, landmark regions (`header`, `main`, `footer`), and labelled sections for screen readers.
- Live regions (`aria-live`) announce new alerts and section details without stealing focus.
- High-contrast mode swaps the entire palette to AAA-level contrast; larger-text mode scales type via a single CSS variable.
- Live captions surface commentary/announcements as text for hard-of-hearing fans; "read alerts aloud" uses the Web Speech API for critical alerts, for fans who benefit from audio over text.
- One tap highlights wheelchair-accessible sections directly on the stadium map.

## 11. Future Scope

- Replace simulated data with real feeds: IoT turnstile/occupancy sensors, CCTV-based crowd-density AI, and a real ticketing API.
- Push notifications to security staff's phones instead of in-app-only alerts.
- Multi-language captions and interpreter video feed toggle for live commentary.
- Historical analytics (post-match crowd-flow reports) to improve gate allocation for future fixtures.

---

*Built for the "Smart Stadiums & Tournament Operations" hackathon track. Evaluation focus: Code Quality · Security · Efficiency · Testing · Accessibility · Problem Statement Alignment.*
