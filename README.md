# 🏟️ StadiumPulse
### Smart Stadiums & Tournament Operations — Control Room Dashboard

StadiumPulse is a real-time operations dashboard that gives stadium staff a single screen to watch crowd density, respond to security incidents, manage gate/staff logistics, track ticketing and fixtures, monitor weather impact, and serve fans with disabilities — everything a tournament control room needs during a live match day.

Everything described below is **implemented and interactive** in `index.html`. There is no mocked-up screenshot standing in for functionality — open the file and it runs.

---

## 1. Problem Statement Alignment

"Smart Stadiums & Tournament Operations" spans several operational domains at once. StadiumPulse deliberately covers all of them in one control room, rather than going deep on a single feature:

| Operational domain | What StadiumPulse does |
|---|---|
| **Crowd safety** | Live per-section occupancy map (16 sections) with automatic threshold-based alerts (warn at 60%, critical at 85%) |
| **Security operations** | Real-time alert feed + validated, tamper-checked incident reporting from any section |
| **Gate & staff logistics** | Live per-gate queue length and staff-on-duty tracking, colour-coded by congestion |
| **Ticketing & tournament scheduling** | Upcoming fixtures, gate assignments, and live "tickets sold" tracking |
| **Environmental/weather impact** | A live weather pill with advisories (e.g. rerouting fans to covered concourse in rain) — a real factor in outdoor-stadium operations |
| **Accessibility & inclusion** | High-contrast mode, adjustable text size, live captions, spoken alerts, and wheelchair-seating highlighting — not bolted on, but load-bearing for the "smart" claim: a stadium isn't smart if it only works for some fans |

This spread is intentional: a tournament control room's actual job is coordinating *all* of these simultaneously, and a dashboard that only shows one of them (e.g. only ticketing, or only a crowd heatmap) doesn't reflect the real problem.

## 2. Live Feature Tour

- **Stadium Bowl visualization** — a 16-section SVG map (4 stands × 4 blocks) built from scratch with polar-coordinate geometry (no charting library). Colour-coded by live occupancy, fully keyboard-navigable, and updates only the one section that changed per tick (see §9, Efficiency).
- **Live Alert Feed** — crowd, security, and weather events stream in automatically, tagged by severity (`info` / `high` / `critical`).
- **Incident reporting** — staff can file a report against any section; input is required, length-limited, HTML-escaped, and the selected section is verified against the real section list before acceptance.
- **Gate & Staff Deployment** — six gates with live queue time and staff count, colour-coded so control room staff can see at a glance where to redeploy people.
- **Ticketing & Tournament Schedule** — upcoming fixtures, gate assignments, live "tickets sold" progress bars.
- **Weather advisory pill** — simulated live conditions with an operational advisory when weather turns adverse.
- **Accessibility toolbar** — high contrast, larger text, live captions (for fans following commentary/announcements), "read alerts aloud" (Web Speech API), and a one-tap wheelchair-accessible-seating highlight on the stadium map.

## 3. Tech Stack

- **Frontend:** Semantic HTML5, CSS (custom properties / design tokens, no framework), vanilla JavaScript (ES6, no build step, no runtime dependencies)
- **Fonts:** Oswald (display), Inter (body), JetBrains Mono (data/timestamps) — Google Fonts, explicitly allow-listed in the CSP
- **Browser APIs used:** SVG DOM, Web Speech API (`speechSynthesis`), `prefers-reduced-motion`
- **Testing:** Node.js `assert` module only, zero test-framework dependencies
- **No backend required** for the demo — all data is simulated client-side so judges can run it instantly from a single file. §11 explains how this plugs into real sensors/APIs for production.

Deliberately dependency-free: nothing to `npm install` for the app itself, no build pipeline — it runs anywhere, instantly, which matters a lot on unreliable hackathon wifi.

## 4. Project Structure

```
smart-stadium/
├── index.html      # The entire application (markup + styles + logic)
├── tests.js        # 25 unit tests for the core business logic
├── package.json    # `npm test` entry point
├── SECURITY.md      # Security posture: what's implemented vs. production checklist
└── README.md
```

## 5. Running It

**Dashboard:** open `index.html` directly in any modern browser. No server, no build, no install.

**Unit tests:**
```bash
npm test
# or
node tests.js
```

## 6. Code Quality

- **No magic numbers** — every threshold (density %, alert cap, tick interval, report length limit) is a named constant in a single `CONFIG` object, so judges (and future maintainers) can find every tunable in one place instead of grepping for literals.
- **Pure logic separated from DOM code** — functions like `getDensityLevel`, `escapeHtml`, `validateIncidentReport`, `trimAlerts`, `buildSections`, and `gateStatusLevel` take plain arguments and return plain values; they don't touch `document` at all, which is what makes them independently unit-testable in `tests.js` without a browser.
- **Single responsibility per function** — rendering (`renderAlerts`, `renderTicketing`, `renderGates`), simulation (`simulateCrowd`, `simulateGates`, `simulateWeather`), and state (`pushAlert`) are all separate, small functions.
- **No inline event handlers in markup** — all wiring is done via `addEventListener` inside one IIFE, so nothing leaks into the global scope.
- **Fail-safe bootstrap** — the whole app initialises inside a `try/catch`; a failure shows a visible, accessible error message instead of a silently broken page.
- **DocumentFragment batching** — list rendering (`renderAlerts`) builds nodes into a fragment before touching the live DOM once, avoiding layout thrashing.

## 7. Security

See [`SECURITY.md`](./SECURITY.md) for the full write-up. Highlights:
- An enforced `Content-Security-Policy` meta tag (not just a comment) restricting script/style/font/image origins.
- All user-supplied text (incident description) is HTML-escaped and rendered exclusively via `textContent`/`createElement`, never `innerHTML`.
- Server-trust checks even on the client: the submitted section id is verified against the real section list, rejecting devtools-tampered `<option>` values.
- `no-referrer` policy so no page/query data leaks to the fonts CDN.
- A documented (not hand-waved) checklist of what a production backend adds: auth, server-side re-validation, rate limiting, audit logging, HTTPS/HSTS.

## 8. Testing

`tests.js` contains **25 unit tests**, all passing, covering:
- Density classification at and around both thresholds (59.99 vs 60.0, 84 vs 85, and overflow at 100/150)
- Gate-queue classification boundaries
- XSS-prevention on multiple payload shapes (script tags, ampersands, quotes, plain text passthrough)
- Incident-report validation: empty input, over-length input, exactly-at-the-limit input, whitespace trimming
- Alert-queue trimming behaviour (cap enforcement, ordering preserved)
- Geometry helpers used to draw the stadium map, checked at known angles (0°, 90°)
- Deterministic section generation using an injectable RNG stub, so results are reproducible in CI

Run `npm test` — all 25 tests pass in under a second, with no test framework or `npm install` required.

## 9. Efficiency

- **Partial DOM updates, not full re-renders**: the stadium map is built once (`buildBowlOnce`); every subsequent crowd-density tick repaints only the one `<path>` element that changed (`paintSection`), instead of clearing and rebuilding all 16 segments + pitch + label every cycle.
- **One consolidated timer**, not three: a single `setInterval` drives a tick counter, and the clock/crowd-simulation/ticketing-refresh/gate-refresh cadences are derived from that one counter (`tick % N === 0`) — fewer timer callbacks competing for the main thread.
- **`DocumentFragment` batching** for list re-renders (alerts) to minimise reflows.
- **No external JS/CSS framework** — the whole interactive experience ships in one HTML file, so first paint is effectively instant.
- **Animations are GPU-cheap** (opacity/stroke) and fully disabled under `prefers-reduced-motion`, saving CPU/battery for users who've asked for it.

## 10. Accessibility

Built to WCAG-minded practice, not just a toggle bolted on at the end:
- Every interactive element (including SVG stadium sections) is keyboard-reachable with a visible focus ring.
- Skip-to-content link, landmark regions (`header`, `main`, `footer`), and labelled sections for screen readers.
- Live regions (`aria-live`) announce new alerts and section details without stealing focus.
- High-contrast mode swaps the entire palette to AAA-level contrast; larger-text mode scales type via one CSS variable.
- Live captions surface commentary/announcements as text for hard-of-hearing fans; "read alerts aloud" uses the Web Speech API for critical alerts.
- One tap highlights wheelchair-accessible sections directly on the stadium map.
- Form errors use `role="alert"` so validation failures are announced immediately to screen-reader users, and a live character counter helps anyone track the 140-character limit without guessing.

## 11. Future Scope

- Replace simulated data with real feeds: IoT turnstile/occupancy sensors, CCTV-based crowd-density AI, a real ticketing API, and a live weather API.
- Push notifications to security staff's phones instead of in-app-only alerts.
- Multi-language captions and an interpreter video-feed toggle for live commentary.
- Historical analytics (post-match crowd-flow and gate-queue reports) to improve gate allocation and staff scheduling for future fixtures.
- The production security checklist in `SECURITY.md` (auth, server-side validation, rate limiting, audit logs).

---

*Built for the "Smart Stadiums & Tournament Operations" hackathon track. Evaluation focus: Code Quality · Security · Efficiency · Testing · Accessibility · Problem Statement Alignment.*
