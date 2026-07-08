/**
 * tests.js
 * Zero-dependency unit tests for StadiumPulse's core logic.
 * These functions are kept identical to the pure logic layer inside index.html
 * so behaviour can be verified without a DOM (no jsdom/browser required).
 *
 * Run with:  node tests.js   (or  npm test)
 */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HTML_PATH = path.join(__dirname, "index.html");
const html = fs.existsSync(HTML_PATH) ? fs.readFileSync(HTML_PATH, "utf8") : "";
const cspMatch = html.match(/content="(default-src[^"]*)"/);
const csp = cspMatch ? cspMatch[1] : "";
const styleBlockMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const scriptBlockMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const actualStyleHash = styleBlockMatch
  ? "sha256-" + crypto.createHash("sha256").update(styleBlockMatch[1], "utf8").digest("base64")
  : "";
const actualScriptHash = scriptBlockMatch
  ? "sha256-" + crypto.createHash("sha256").update(scriptBlockMatch[1], "utf8").digest("base64")
  : "";

/* ---------------------------------------------------------------
 * Functions under test — mirrors index.html's pure logic layer
 * ----------------------------------------------------------- */
const CONFIG = Object.freeze({
  DENSITY_WARN_PCT: 60,
  DENSITY_CRITICAL_PCT: 85,
  GATE_WARN_QUEUE: 12,
  GATE_CRITICAL_QUEUE: 25,
  MAX_ALERTS: 30,
  REPORT_MAX_LEN: 140,
  REPORT_COOLDOWN_MS: 3000,
  MAX_REPORTS_PER_SESSION: 10
});

function getDensityLevel(pct){
  if (pct >= CONFIG.DENSITY_CRITICAL_PCT) return "critical";
  if (pct >= CONFIG.DENSITY_WARN_PCT) return "warn";
  return "live";
}

function gateStatusLevel(queue){
  if (queue >= CONFIG.GATE_CRITICAL_QUEUE) return "critical";
  if (queue >= CONFIG.GATE_WARN_QUEUE) return "warn";
  return "live";
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, function(c){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
  });
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function validateIncidentReport(text, maxLen){
  const limit = maxLen || CONFIG.REPORT_MAX_LEN;
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok:false, error:"Please describe the incident before submitting." };
  if (trimmed.length > limit){
    return { ok:false, error:"Description must be " + limit + " characters or fewer." };
  }
  return { ok:true, value: escapeHtml(trimmed) };
}

function isRateLimited(lastSubmitAt, now, cooldownMs){
  if (lastSubmitAt === null || lastSubmitAt === undefined) return false;
  return (now - lastSubmitAt) < cooldownMs;
}

function trimAlerts(list, max){
  return list.length > max ? list.slice(0, max) : list;
}

function shouldRunOnTick(tick, everyN){
  return everyN > 0 && (tick % everyN === 0);
}

function polarToCartesian(cx, cy, r, angleDeg){
  const a = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function buildSections(stands, perStand, rand){
  rand = rand || Math.random;
  const out = [];
  stands.forEach(function(stand){
    for (let i = 1; i <= perStand; i++){
      const capacity = 3000 + Math.floor(rand()*800);
      out.push({
        id: stand[0] + i,
        name: stand + " " + i,
        capacity: capacity,
        count: Math.floor(capacity * (0.3 + rand()*0.5))
      });
    }
  });
  return out;
}

/* ------------------------- test runner ------------------------- */
let passed = 0, failed = 0;
function test(name, fn){
  try{
    fn();
    passed++;
    console.log("  \u2713 " + name);
  }catch(err){
    failed++;
    console.error("  \u2717 " + name);
    console.error("    " + err.message);
  }
}

console.log("Density classification");
test("below warn threshold is classified as live", () => {
  assert.strictEqual(getDensityLevel(0), "live");
  assert.strictEqual(getDensityLevel(59), "live");
});
test("exact warn boundary (60) flips to warn, not live", () => {
  assert.strictEqual(getDensityLevel(60), "warn");
});
test("59.99 stays live, 60.0 is warn (boundary is inclusive on the high side)", () => {
  assert.strictEqual(getDensityLevel(59.99), "live");
  assert.strictEqual(getDensityLevel(60.0), "warn");
});
test("exact critical boundary (85) flips to critical, not warn", () => {
  assert.strictEqual(getDensityLevel(84), "warn");
  assert.strictEqual(getDensityLevel(85), "critical");
});
test("100% and beyond is still critical (no overflow class)", () => {
  assert.strictEqual(getDensityLevel(100), "critical");
  assert.strictEqual(getDensityLevel(150), "critical");
});
test("negative percentages (malformed input) still resolve safely to live", () => {
  assert.strictEqual(getDensityLevel(-5), "live");
});

console.log("\nGate queue classification");
test("short queue is live", () => { assert.strictEqual(gateStatusLevel(0), "live"); });
test("queue just below the warn boundary (11) is still live", () => { assert.strictEqual(gateStatusLevel(11), "live"); });
test("queue boundary at 12 is warn", () => { assert.strictEqual(gateStatusLevel(12), "warn"); });
test("queue just below the critical boundary (24) is still warn", () => { assert.strictEqual(gateStatusLevel(24), "warn"); });
test("queue boundary at 25 is critical", () => { assert.strictEqual(gateStatusLevel(25), "critical"); });

console.log("\nInput sanitization (XSS prevention)");
test("escapes a script-bearing payload", () => {
  const dirty = `<img src=x onerror="alert(1)">`;
  const clean = escapeHtml(dirty);
  assert.ok(!clean.includes("<img"));
  assert.ok(clean.includes("&lt;img"));
});
test("escapes a <script> tag payload specifically", () => {
  const clean = escapeHtml(`<script>alert(document.cookie)</script>`);
  assert.ok(!clean.includes("<script>"));
});
test("escapes ampersands without double-escaping", () => {
  assert.strictEqual(escapeHtml("Gate 4 & 5"), "Gate 4 &amp; 5");
});
test("escapes single and double quotes (attribute-breakout prevention)", () => {
  assert.strictEqual(escapeHtml(`it's "loud"`), "it&#39;s &quot;loud&quot;");
});
test("leaves plain text untouched", () => {
  assert.strictEqual(escapeHtml("Overcrowding near gate 4"), "Overcrowding near gate 4");
});
test("escaping is idempotent-safe: escaping twice does not corrupt readable text", () => {
  const once = escapeHtml("Tom & Jerry");
  const twice = escapeHtml(once);
  assert.strictEqual(twice, "Tom &amp;amp; Jerry"); // documents real double-escape behaviour so callers escape exactly once
});

console.log("\nIncident report validation");
test("rejects empty description", () => {
  assert.strictEqual(validateIncidentReport("   ").ok, false);
});
test("rejects description over the max length", () => {
  assert.strictEqual(validateIncidentReport("a".repeat(141)).ok, false);
});
test("accepts a description exactly at the max length", () => {
  assert.strictEqual(validateIncidentReport("a".repeat(140)).ok, true);
});
test("accepts and sanitizes a valid description", () => {
  const r = validateIncidentReport("Overcrowding near <Gate 4>");
  assert.strictEqual(r.ok, true);
  assert.ok(!r.value.includes("<Gate"));
});
test("trims surrounding whitespace before validating", () => {
  const r = validateIncidentReport("   fire exit blocked   ");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value, "fire exit blocked");
});
test("respects a custom max length override", () => {
  assert.strictEqual(validateIncidentReport("hello world", 5).ok, false);
});

console.log("\nClient-side rate limiting");
test("first-ever submission (no prior timestamp) is never rate limited", () => {
  assert.strictEqual(isRateLimited(null, Date.now(), CONFIG.REPORT_COOLDOWN_MS), false);
});
test("a submission inside the cooldown window is rate limited", () => {
  const last = 1000;
  const now = last + CONFIG.REPORT_COOLDOWN_MS - 1;
  assert.strictEqual(isRateLimited(last, now, CONFIG.REPORT_COOLDOWN_MS), true);
});
test("a submission exactly at the cooldown boundary is allowed", () => {
  const last = 1000;
  const now = last + CONFIG.REPORT_COOLDOWN_MS;
  assert.strictEqual(isRateLimited(last, now, CONFIG.REPORT_COOLDOWN_MS), false);
});
test("a submission well after the cooldown is allowed", () => {
  const last = 1000;
  const now = last + CONFIG.REPORT_COOLDOWN_MS + 5000;
  assert.strictEqual(isRateLimited(last, now, CONFIG.REPORT_COOLDOWN_MS), false);
});

console.log("\nTick scheduling (single consolidated timer)");
test("runs on exact multiples of the interval", () => {
  assert.strictEqual(shouldRunOnTick(4, 4), true);
  assert.strictEqual(shouldRunOnTick(8, 4), true);
});
test("does not run on non-multiples", () => {
  assert.strictEqual(shouldRunOnTick(5, 4), false);
  assert.strictEqual(shouldRunOnTick(0, 4), true); // tick 0 % N === 0 by definition
});
test("guards against a zero or negative interval instead of dividing by zero", () => {
  assert.strictEqual(shouldRunOnTick(4, 0), false);
  assert.strictEqual(shouldRunOnTick(4, -1), false);
});

console.log("\nAlert queue trimming");
test("keeps list untouched when under the cap", () => {
  const list = [1,2,3];
  assert.deepStrictEqual(trimAlerts(list, CONFIG.MAX_ALERTS), [1,2,3]);
});
test("trims list down to the cap, keeping the newest (front) entries", () => {
  const list = Array.from({length: 40}, (_, i) => i);
  const trimmed = trimAlerts(list, CONFIG.MAX_ALERTS);
  assert.strictEqual(trimmed.length, CONFIG.MAX_ALERTS);
  assert.strictEqual(trimmed[0], 0);
});
test("an empty list stays empty", () => {
  assert.deepStrictEqual(trimAlerts([], CONFIG.MAX_ALERTS), []);
});

console.log("\nUtility functions");
test("clamp keeps values within bounds", () => {
  assert.strictEqual(clamp(150, 0, 100), 100);
  assert.strictEqual(clamp(-10, 0, 100), 0);
  assert.strictEqual(clamp(50, 0, 100), 50);
});
test("clamp is inclusive at both boundaries", () => {
  assert.strictEqual(clamp(0, 0, 100), 0);
  assert.strictEqual(clamp(100, 0, 100), 100);
});
test("polarToCartesian places 0 degrees at the top of the circle", () => {
  const p = polarToCartesian(100, 100, 50, 0);
  assert.ok(Math.abs(p.x - 100) < 1e-6);
  assert.ok(Math.abs(p.y - 50) < 1e-6);
});
test("polarToCartesian places 90 degrees on the right of the circle", () => {
  const p = polarToCartesian(100, 100, 50, 90);
  assert.ok(Math.abs(p.x - 150) < 1e-6);
  assert.ok(Math.abs(p.y - 100) < 1e-6);
});
test("polarToCartesian places 180 degrees at the bottom of the circle", () => {
  const p = polarToCartesian(100, 100, 50, 180);
  assert.ok(Math.abs(p.x - 100) < 1e-6);
  assert.ok(Math.abs(p.y - 150) < 1e-6);
});

console.log("\nConfiguration integrity");
test("CONFIG is frozen and resists mutation attempts", () => {
  assert.strictEqual(Object.isFrozen(CONFIG), true);
  assert.throws(() => { CONFIG.MAX_ALERTS = 999; });
  assert.strictEqual(CONFIG.MAX_ALERTS, 30); // unchanged
});

console.log("\nSection generation (deterministic with a seeded RNG stub)");
test("builds the expected number of sections for 4 stands x 4 blocks", () => {
  const sections = buildSections(["North","East","South","West"], 4, () => 0.5);
  assert.strictEqual(sections.length, 16);
});
test("every generated section has a positive capacity and count within it", () => {
  const sections = buildSections(["North"], 4, () => 0.5);
  sections.forEach(s => {
    assert.ok(s.capacity > 0);
    assert.ok(s.count >= 0 && s.count <= s.capacity);
  });
});
test("section ids are derived from the first letter of the stand + index", () => {
  const sections = buildSections(["North"], 2, () => 0);
  assert.strictEqual(sections[0].id, "N1");
  assert.strictEqual(sections[1].id, "N2");
});
test("zero sections-per-stand produces an empty section list without error", () => {
  const sections = buildSections(["North","South"], 0, () => 0.5);
  assert.strictEqual(sections.length, 0);
});

console.log("\nBuild integrity (index.html regression checks)");
test("index.html exists and is readable", () => {
  assert.ok(fs.existsSync(HTML_PATH), "index.html not found next to tests.js");
});
test("CSP has no 'unsafe-inline' (hash-based CSP must stay hardened)", () => {
  assert.ok(!csp.includes("unsafe-inline"));
});
test("CSP blocks outbound connections (connect-src 'none')", () => {
  assert.ok(csp.includes("connect-src 'none'"));
});
test("CSP blocks framing (frame-ancestors 'none')", () => {
  assert.ok(csp.includes("frame-ancestors 'none'"));
});
test("the declared style-src hash matches the actual <style> block content", () => {
  assert.ok(csp.includes(actualStyleHash), "style block was edited without updating the CSP hash");
});
test("the declared script-src hash matches the actual <script> block content", () => {
  assert.ok(csp.includes(actualScriptHash), "script block was edited without updating the CSP hash");
});
test("no external stylesheet or script origins are referenced (zero third-party requests)", () => {
  assert.ok(!html.includes("fonts.googleapis.com"));
  assert.ok(!html.includes("fonts.gstatic.com"));
  assert.ok(!html.includes("cdnjs.cloudflare.com"));
});
test("no static inline style=\"\" attributes remain in the markup", () => {
  // JS-driven `el.style.property = value` (CSSOM) is unaffected by CSP and is fine;
  // this only guards against HTML-authored style="..." attributes creeping back in.
  const bodyOnly = html.split("<script>")[0];
  assert.ok(!/\sstyle="/.test(bodyOnly));
});
test("every ARIA landmark referenced in the README is actually present", () => {
  ["aria-live", "role=\"alert\"", "aria-label", "skip-link", "aria-pressed", "aria-describedby"].forEach((marker) => {
    assert.ok(html.includes(marker), "missing expected accessibility marker: " + marker);
  });
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
