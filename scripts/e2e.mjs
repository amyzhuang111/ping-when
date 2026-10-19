// End-to-end check with Playwright. Usage:
//   BASE_URL=https://ping-when.vercel.app node scripts/e2e.mjs            (Chromium: system Chrome)
//   BROWSER=firefox BASE_URL=... node scripts/e2e.mjs                      (Playwright Firefox)
// ROSTER overrides the CSV (default: Amy's local 16-person roster, kept out of the repo), or use
// ROSTER=scripts/fixtures/export-fixture.csv EXPECT_SCORED=5 EXPECT_UNSCORED=11 EXPECT_NAME="Fixture Echo".
// SHOT_DIR saves screenshots at 375 and 1440 widths. LINKS=0 skips the network link check.
import { chromium, firefox } from "playwright";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ROSTER = path.resolve(process.env.ROSTER || "/workspace/x-growth/ping-when-real-demo.csv");
const SCALE = path.resolve("scripts/fixtures/scale-2000.csv");
const EXPECT_SCORED = Number(process.env.EXPECT_SCORED ?? 14);
const EXPECT_UNSCORED = Number(process.env.EXPECT_UNSCORED ?? 2);
const EXPECT_NAME = process.env.EXPECT_NAME ?? "Parker-Holder";
const ENGINE = process.env.BROWSER === "firefox" ? "firefox" : "chromium";
const CHROME = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
const SHOT = process.env.SHOT_DIR;
if (SHOT) mkdirSync(SHOT, { recursive: true });

let pass = 0;
const fails = [];
function check(name, ok, detail = "") {
  name = `[${ENGINE}] ${name}`;
  if (ok) { pass++; console.log(`ok   ${name}`); }
  else { fails.push(name); console.log(`FAIL ${name} ${detail}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = ENGINE === "firefox"
  ? await firefox.launch({ headless: true })
  : await chromium.launch({ headless: true, executablePath: CHROME, args: ["--no-sandbox"] });
const consoleErrors = [];
async function fresh(width = 1280, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  return page;
}
const done = (page) => page.context().close();
const upload = async (page, file) => {
  await page.setInputFiles('input[type="file"]', file);
  await page.waitForSelector('[data-testid="closest"]', { timeout: 20000 });
};
const loadExample = async (page) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await page.waitForSelector('[data-testid="closest"]', { timeout: 20000 });
};
const state = (page) =>
  page.evaluate(() => {
    const ids = (sel) => [...document.querySelectorAll(`${sel} [data-person]`)].map((e) => e.getAttribute("data-person"));
    const names = (sel) => [...document.querySelectorAll(`${sel} [data-person]`)].map((e) => e.getAttribute("data-name"));
    return {
      week: ids('[data-testid="this-week"]'),
      closest: ids('[data-testid="closest"]'),
      weekNames: names('[data-testid="this-week"]'),
      closestNames: names('[data-testid="closest"]'),
      unscored: document.querySelectorAll("[data-unscored]").length,
      errorsHeading: [...document.querySelectorAll("h2")].some((h) => h.textContent.trim() === "Import errors."),
      empty: !!document.querySelector('[data-empty="true"]'),
    };
  });
const cliffBox = (page) => page.locator('input[aria-label="Cliff proximity weight"]');
async function setNumber(page, value) {
  const box = cliffBox(page);
  await box.fill(value);
  await sleep(400);
}
async function download(page, testid) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`[data-testid="${testid}"]`)]);
  const p = await dl.path();
  return readFileSync(p, "utf8").trim().split("\n");
}

const csv = readFileSync(ROSTER, "utf8");

// 1. Empty state
let page = await fresh();
let s = await state(page);
check("empty state shown before import", s.empty);
check("how-to-use steps present", (await page.locator('[data-testid="how-to"]').count()) === 1);

// 2. File upload
await upload(page, ROSTER);
s = await state(page);
const scored = [...s.week, ...s.closest];
check("upload: 0 import errors", !s.errorsHeading);
check(`upload: ${EXPECT_SCORED} scored people`, scored.length === EXPECT_SCORED, JSON.stringify(scored));
check(`upload: ${EXPECT_UNSCORED} needs-start-date`, s.unscored === EXPECT_UNSCORED, String(s.unscored));
check("upload: every scored person is in New in or Almost there (no cap)", new Set(scored).size === EXPECT_SCORED);
check(`upload: ${EXPECT_NAME} shown`, [...s.weekNames, ...s.closestNames].some((n) => n.includes(EXPECT_NAME)));
const before = scored.join(",");

// 3. Cliff weight to 70 via the number box
await setNumber(page, "70");
s = await state(page);
const after = [...s.week, ...s.closest].join(",");
check("cliff 70: weight applied (input reads 70)", (await cliffBox(page).inputValue()) === "70");
check("cliff 70 on real roster: UI explains unchanged order, or order changed", before !== after || (await page.locator('[data-testid="order-unchanged"]').count()) > 0);

// 4. Persistence
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
const s2 = await state(page);
check("reload: roster persists", [...s2.week, ...s2.closest].length === EXPECT_SCORED && s2.unscored === EXPECT_UNSCORED);
check("reload: weights persist", [...s2.week, ...s2.closest].join(",") === after && (await cliffBox(page).inputValue()) === "70");

// 5. Export
const out = await download(page, "export-ranked");
check(`export: ranked CSV has header + ${EXPECT_SCORED + EXPECT_UNSCORED} rows`, out.length === EXPECT_SCORED + EXPECT_UNSCORED + 1, String(out.length));
check(`export: ${EXPECT_UNSCORED} rows marked needs-start-date`, out.filter((l) => l.includes("needs-start-date")).length === EXPECT_UNSCORED);
await done(page);

// 6. Paste
page = await fresh();
await page.fill("#paste-roster", csv);
await page.getByRole("button", { name: "Import paste", exact: true }).click();
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
s = await state(page);
check("paste: same counts as upload, 0 errors", [...s.week, ...s.closest].length === EXPECT_SCORED && s.unscored === EXPECT_UNSCORED && !s.errorsHeading, JSON.stringify(s));
check("paste: same order as upload", [...s.week, ...s.closest].join(",") === before);
await done(page);

// 7. Slider drag (pointer, not keyboard): drag the cliff thumb right and the weight rises
page = await fresh();
await upload(page, ROSTER);
const thumb = page.locator('[data-testid="slider-cliff"] [data-slot="slider-thumb"]');
const track = page.locator('[data-testid="slider-cliff"] [data-slot="slider-track"]');
await track.scrollIntoViewIfNeeded();
const tb = await thumb.boundingBox();
const kb = await track.boundingBox();
const startVal = Number(await cliffBox(page).inputValue());
await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(tb.x + ((kb.x + kb.width * 0.8) - tb.x) * (i / 10), tb.y + tb.height / 2);
await page.mouse.up();
await sleep(400);
const dragVal = Number(await cliffBox(page).inputValue());
check(`slider drag: cliff weight ${startVal} -> ~80`, startVal === 30 && dragVal >= 72 && dragVal <= 88, `${startVal} -> ${dragVal}`);
const share = await page.locator('[data-testid="refine"]').innerText();
check("slider drag: Reset weights appears and scores re-render", (await page.getByRole("button", { name: "Reset weights" }).count()) === 1 && /\d+%/.test(share));
if (await page.getByRole("button", { name: "Reset weights" }).count()) await page.getByRole("button", { name: "Reset weights" }).click();
await sleep(300);
check("slider drag: Reset restores 30", (await cliffBox(page).inputValue()) === "30");
await done(page);

// 8. Real roster: open every card's drawer, collect links and text
function placeholderScan(p) {
  return p.evaluate(() => ({
    hrefs: [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /example\.(com|org|net)/i.test(h)),
    text: /example\.(com|org|net)/i.test(document.body.innerText),
  }));
}
page = await fresh();
await upload(page, ROSTER);
let bad = await placeholderScan(page);
check("real roster: no example.com href or text on page", bad.hrefs.length === 0 && !bad.text, JSON.stringify(bad));
const collected = [];
const placeholderHits = [];
const overflowing = [];
let allText = await page.evaluate(() => document.body.innerText);
const nCards = await page.locator("[data-person] button.card, [data-unscored] button.card").count();
for (let i = 0; i < nCards; i++) {
  await page.locator("[data-person] button.card, [data-unscored] button.card").nth(i).click();
  await page.waitForSelector('[data-testid="drawer"]');
  const info = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="drawer"]');
    return {
      text: d.innerText,
      links: [...d.querySelectorAll("a[href^='http']")].map((a) => a.href),
      overflow: [...d.querySelectorAll("a[href]")].filter((a) => a.getBoundingClientRect().right > a.closest("dd").getBoundingClientRect().right + 1).map((a) => a.href),
      bad: /example\.(com|org|net)/i.test(d.innerText + [...d.querySelectorAll("a[href]")].map((a) => a.href).join(" ")),
    };
  });
  collected.push(...info.links);
  overflowing.push(...info.overflow);
  if (info.bad) placeholderHits.push(i + 1);
  allText += "\n" + info.text;
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="drawer"]', { state: "detached" });
}
const links = [...new Set(collected)];
check(`real roster: opened all ${EXPECT_SCORED + EXPECT_UNSCORED} drawers`, nCards === EXPECT_SCORED + EXPECT_UNSCORED, String(nCards));
check("real roster: no example.com in any opened drawer", placeholderHits.length === 0, placeholderHits.join(","));
check("real roster: label says 'Real public sources · scores are illustrative'", (await page.locator('[data-testid="dataset"]').textContent()) === "Real public sources · scores are illustrative");
const seedRe = /Same fictional employer|30 fictional seed archetypes|EXAMPLE DATA|Fictional seed signal|Fictional seed archetype/;
check("real roster: no seed/fictional labels anywhere (drawers opened)", !seedRe.test(allText), (allText.match(new RegExp(".{0,60}(" + seedRe.source + ").{0,40}")) || [""])[0]);
check("real roster: long source URLs stay inside their column", overflowing.length === 0, overflowing.join(" | "));
if (EXPECT_NAME === "Parker-Holder") {
  check("real roster: full paper titles shown (Beyond the Visible, Consistent Long-Horizon)", allText.includes("Generative Pixel-Aligned Geometry Beyond the Visible") && allText.includes("Local-Global Rewards for Consistent Long-Horizon Video Generation"));
}
const summary = await page.locator('[data-testid="summary"]').textContent();
check("summary counts scored and incomplete (no 'All scored')", summary.includes(`${EXPECT_SCORED} scored`) && summary.includes(`${EXPECT_UNSCORED} need a start date`) && !allText.includes("All scored"), summary);
await page.addInitScript(() => {
  window.__emptySeen = false;
  new MutationObserver(() => { if (document.querySelector('[data-empty="true"]')) window.__emptySeen = true; }).observe(document, { childList: true, subtree: true });
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
check("reload with stored roster: 'The queue is empty' never flashes", (await page.evaluate(() => window.__emptySeen)) === false && !(await page.content()).includes("The queue is empty."));
if (process.env.LINKS !== "0") {
  const dead = [];
  for (const url of links) {
    let status = 0;
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (ping-when link check)" }, signal: AbortSignal.timeout(15000) });
      status = res.status;
    } catch { status = -1; }
    if (status === 404 || status === 410 || status === -1) dead.push(`${status} ${url}`);
  }
  check(`real roster: all ${links.length} source links resolve (non-404)`, links.length > 0 && dead.length === 0, dead.join(" | "));
}
// In-page links: every anchor href on the page points somewhere real (hash targets exist).
const anchors = await page.evaluate(() => [...document.querySelectorAll("a[href^='#']")].map((a) => [a.getAttribute("href"), !!document.querySelector(a.getAttribute("href"))]));
check("nav: every in-page anchor has a target", anchors.length > 0 && anchors.every(([, ok]) => ok), JSON.stringify(anchors));
await done(page);

// 9. Fictional example: labelled, no-source text, cliff re-orders
page = await fresh();
await loadExample(page);
bad = await placeholderScan(page);
check("fictional example: no example.com href or text on page", bad.hrefs.length === 0 && !bad.text, JSON.stringify(bad));
check("example: label says 'EXAMPLE DATA, fictional' and never 'Real public sources'", (await page.locator('[data-testid="dataset"]').textContent()) === "EXAMPLE DATA, fictional" && !(await page.evaluate(() => document.body.innerText)).includes("Real public sources"));
let noSource = 0;
for (let i = 0; i < 6 && noSource === 0; i++) {
  await page.locator("[data-person] button.card").nth(i).click();
  noSource = await page.locator('[data-testid="drawer"] [data-no-source]', { hasText: "Fictional seed signal, no source link" }).count();
  await page.keyboard.press("Escape");
}
check("fictional example: placeholder signals say 'Fictional seed signal, no source link'", noSource > 0);
check("example: labelled as fictional seed data", (await page.content()).includes("30 fictional seed archetypes"));
const exBefore = await state(page);
await setNumber(page, "70");
const exAfter = await state(page);
check("example cliff 70: ready-to-reach re-orders", exBefore.week.join(",") !== exAfter.week.join(","), `${exBefore.weekNames} => ${exAfter.weekNames}`);
await done(page);

// 10. 2,000-row fictional fixture through the real UI
page = await fresh();
const t0 = Date.now();
await upload(page, SCALE);
const wall = Date.now() - t0;
const big = await page.evaluate(() => ({
  summary: document.querySelector('[data-testid="summary"]').textContent,
  cards: document.querySelectorAll("[data-person]").length,
  ranks: [...document.querySelectorAll('[data-testid="closest"] [data-person]')].map((e) => Number(e.getAttribute("data-rank"))),
}));
check("2,000 rows: summary 1900 scored · 100 need a start date, 0 errors", big.summary.startsWith("1900 scored · 100 need a start date") && !big.summary.includes("error"), big.summary);
check(`2,000 rows: import to render under 8 s (${wall} ms)`, wall < 8000);
check("2,000 rows: first page renders 48 cards per section, ranks ascending", big.cards > 0 && big.cards <= 96 && big.ranks.every((r, i) => i === 0 || r > big.ranks[i - 1]), String(big.cards));
await page.getByRole("button", { name: /^Show more/ }).first().click();
await sleep(300);
check("2,000 rows: Show more adds the next page", (await page.locator("[data-person]").count()) > big.cards);
const bigOut = await download(page, "export-ranked");
check("2,000 rows: ranked export has 2,000 rows + header", bigOut.length === 2001, String(bigOut.length));
check("2,000 rows: every exported row is a fictional 'Scale Fixture' name", bigOut.slice(1).every((l) => l.includes("Scale Fixture")));
await done(page);

// 11. Layout and spec at 375 and 1440
for (const width of [375, 1440]) {
  page = await fresh(width, width === 375 ? 812 : 900);
  if (SHOT) await page.screenshot({ path: path.join(SHOT, `${ENGINE}-${width}-empty.png`), fullPage: false });
  await upload(page, ROSTER);
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const vis = [...document.querySelectorAll("p,li,span,button,a,h1,h2,h3,dt,dd,label")].filter((e) => e.offsetParent && e.textContent.trim());
    const all = [...document.querySelectorAll("*")];
    const cs = (e) => getComputedStyle(e);
    const borders = all.filter((e) => ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs(e)[`border${s}Width`]) > 0 && !["rgb(232, 232, 232)", "rgba(0, 0, 0, 0)"].includes(cs(e)[`border${s}Color`]) && cs(e)[`border${s}Style`] !== "none")).map((e) => e.className || e.tagName);
    return {
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      minFont: Math.min(...vis.map((e) => parseFloat(cs(e).fontSize))),
      h1: cs(document.querySelector("h1")).fontFamily,
      body: cs(document.body).fontFamily,
      shadows: all.filter((e) => cs(e).boxShadow !== "none").length,
      tile: cs(document.querySelector(".tile")).backgroundColor,
      bg: cs(document.body).backgroundColor,
      ink: cs(document.body).color,
      borders,
      loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "").toLowerCase()),
    };
  });
  check(`${width}px: no sideways scroll`, m.sw <= m.cw, JSON.stringify(m));
  check(`${width}px: smallest visible text >= 12px`, m.minFont >= 12, String(m.minFont));
  check(`${width}px: spec fonts (h1 Bodoni Moda, body Inter)`, /bodoni/i.test(m.h1) && /^"?inter\b/i.test(m.body) && m.loaded.includes("inter") && m.loaded.includes("bodoni"), `${m.h1} | ${m.body} | loaded ${m.loaded}`);
  check(`${width}px: spec colours (#FFFFFF bg, #0A0A0A ink, #F7F1E8 tiles), no shadows`, m.bg === "rgb(255, 255, 255)" && m.ink === "rgb(10, 10, 10)" && m.tile === "rgb(247, 241, 232)" && m.shadows === 0, JSON.stringify(m));
  check(`${width}px: no borders other than #E8E8E8 hairlines`, m.borders.length === 0, JSON.stringify(m.borders.slice(0, 5)));
  if (SHOT) {
    await page.screenshot({ path: path.join(SHOT, `${ENGINE}-${width}-roster.png`), fullPage: false });
    await page.locator('[data-testid="closest"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOT, `${ENGINE}-${width}-closest.png`), fullPage: false });
    await page.locator("[data-person] button.card").first().click();
    await page.waitForSelector('[data-testid="drawer"]');
    await page.screenshot({ path: path.join(SHOT, `${ENGINE}-${width}-drawer.png`), fullPage: false });
  }
  await done(page);
}

check("no console errors", consoleErrors.length === 0, JSON.stringify(consoleErrors.slice(0, 5)));
await browser.close();
console.log(`\n${pass} passed, ${fails.length} failed against ${BASE} (${ENGINE})`);
if (SHOT) writeFileSync(path.join(SHOT, `e2e-result-${ENGINE}.txt`), `${pass} passed, ${fails.length} failed against ${BASE} (${ENGINE})\n`);
process.exit(fails.length ? 1 : 0);
