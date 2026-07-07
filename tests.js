/**
 * tests.js
 * Zero-dependency unit tests for StadiumPulse's core logic functions.
 * These mirror the pure functions defined inside index.html so they can be
 * verified independently of the DOM (jsdom/browser not required).
 *
 * Run with:  node tests.js
 */
const assert = require("assert");

/* ---- functions under test (kept identical to index.html) ---- */
function getDensityLevel(pct){
  if (pct >= 85) return "critical";
  if (pct >= 60) return "warn";
  return "live";
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, function(c){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
  });
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function polarToCartesian(cx, cy, r, angleDeg){
  const a = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function validateIncidentReport(text){
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok:false, error:"Please describe the incident before submitting." };
  if (trimmed.length > 140) return { ok:false, error:"Description must be 140 characters or fewer." };
  return { ok:true, value: escapeHtml(trimmed) };
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
test("below 60% is classified as live", () => {
  assert.strictEqual(getDensityLevel(0), "live");
  assert.strictEqual(getDensityLevel(59), "live");
});
test("60-84% is classified as warn", () => {
  assert.strictEqual(getDensityLevel(60), "warn");
  assert.strictEqual(getDensityLevel(84), "warn");
});
test("85%+ is classified as critical", () => {
  assert.strictEqual(getDensityLevel(85), "critical");
  assert.strictEqual(getDensityLevel(100), "critical");
});

console.log("\nInput sanitization (XSS prevention)");
test("escapes angle brackets and quotes", () => {
  const dirty = `<img src=x onerror="alert(1)">`;
  const clean = escapeHtml(dirty);
  assert.ok(!clean.includes("<img"));
  assert.ok(clean.includes("&lt;img"));
});
test("escapes ampersands without double-escaping issues", () => {
  assert.strictEqual(escapeHtml("Gate 4 & 5"), "Gate 4 &amp; 5");
});

console.log("\nIncident report validation");
test("rejects empty description", () => {
  const r = validateIncidentReport("   ");
  assert.strictEqual(r.ok, false);
});
test("rejects description over 140 chars", () => {
  const r = validateIncidentReport("a".repeat(141));
  assert.strictEqual(r.ok, false);
});
test("accepts and sanitizes a valid description", () => {
  const r = validateIncidentReport("Overcrowding near <Gate 4>");
  assert.strictEqual(r.ok, true);
  assert.ok(!r.value.includes("<Gate"));
});

console.log("\nUtility functions");
test("clamp keeps values within bounds", () => {
  assert.strictEqual(clamp(150, 0, 100), 100);
  assert.strictEqual(clamp(-10, 0, 100), 0);
  assert.strictEqual(clamp(50, 0, 100), 50);
});
test("polarToCartesian places 0 degrees at the top of the circle", () => {
  const p = polarToCartesian(100, 100, 50, 0);
  assert.ok(Math.abs(p.x - 100) < 1e-6);
  assert.ok(Math.abs(p.y - 50) < 1e-6);
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
