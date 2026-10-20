// End-to-end check with Playwright. Usage:
//   BASE_URL=https://ping-when.vercel.app node scripts/e2e.mjs            (Chromium: system Chrome)
//   BROWSER=firefox BASE_URL=... node scripts/e2e.mjs                      (Playwright Firefox)
// ROSTER overrides the CSV (default: Amy's local 16-person roster, kept out of the repo), or use
// ROSTER=scripts/fixtures/export-fixture.csv EXPECT_SCORED=5 EXPECT_UNSCORED=11 EXPECT_NAME="Fixture Echo".
// SHOT_DIR saves screenshots at 375 and 1440 widths. LINKS=0 skips the network link check.
import { chromium, firefox } from "playwright";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const ExcelJS = createRequire(import.meta.url)("../public/vendor/exceljs.min.js");

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
check("hero: one-click example button is visible", (await page.locator('[data-testid="hero-example"]').count()) === 1);
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
check("loaded: 'Bring a roster' collapses to a one-line Import link", (await page.locator('[data-testid="import-collapsed"]').count()) === 1 && (await page.getByRole("heading", { name: "Bring a roster." }).count()) === 0);
const nc = await page.evaluate(() => {
  const ranked = [...document.querySelectorAll("[data-person]")].sort((a, b) => a.dataset.rank - b.dataset.rank);
  const reach = ranked.filter((e) => e.dataset.status === "reach");
  const top = ranked.find((e) => e.dataset.status !== "reach");
  return { reach: reach.length, section: !!document.querySelector('[data-testid="this-week"]'), line: document.querySelector('[data-testid="none-clear"]')?.textContent ?? null,
    expect: top ? `Closest to ready is ${top.dataset.name}` : null, href: document.querySelector('[data-testid="closest-link"]')?.getAttribute("href"), topId: top?.id, score: top?.dataset.score,
    navNewIn: [...document.querySelectorAll('[data-testid="nav"] a')].some((a) => a.getAttribute("href") === "#new-in") };
});
if (nc.reach === 0) {
  check("empty 'New in' is not shown; data-computed 'Nothing clears' line instead", !nc.section && !nc.navNewIn && nc.line?.startsWith(nc.expect) && nc.line.endsWith(` at ${nc.score}, since nobody clears 60 this week.`), JSON.stringify(nc));
  check("'Closest' link targets that card", nc.href === `#${nc.topId}`, JSON.stringify(nc));
  await page.click('[data-testid="closest-link"]');
  await page.waitForSelector('[data-testid="drawer"]');
  check("'Closest' link opens that person", (await page.locator('[data-testid="drawer"] h1').textContent()) === nc.expect.replace("Closest to ready is ", ""));
  const scrim = await page.evaluate(() => getComputedStyle(document.querySelector(".scrim")).backgroundColor);
  check("drawer overlay dims at 40%", scrim === "rgba(0, 0, 0, 0.4)", scrim);
  await page.keyboard.press("Escape");
} else {
  check("'New in' shown because someone clears the line", nc.section && nc.line === null, JSON.stringify(nc));
}
check("no heart icon on cards (approve lives in the drawer)", (await page.locator('[data-person] button[aria-label^="Save "], .heart').count()) === 0);

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

// 5b. Excel export: formatted workbook with the same people, links, and frozen header
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-testid="export-xlsx"]')]);
  check("xlsx: file name", dl.suggestedFilename() === "ping-when-ranked-queue.xlsx", dl.suggestedFilename());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(await dl.path()));
  const ws = wb.getWorksheet("Queue");
  const n = ws ? ws.rowCount - 2 : -1;
  check(`xlsx: ${EXPECT_SCORED + EXPECT_UNSCORED} people under title and header`, n === EXPECT_SCORED + EXPECT_UNSCORED, String(n));
  check("xlsx: black bold header, frozen, filtered", ws.getCell(2, 1).value === "Rank" && ws.getCell(2, 1).fill?.fgColor?.argb === "FF000000" && ws.getCell(2, 1).font?.bold && ws.views?.[0]?.ySplit === 2 && !!ws.autoFilter);
  const csvNames = out.slice(1).map((l) => l.split(",")[1]?.replace(/^"/, ""));
  check("xlsx: same order as the CSV export", [...Array(Math.min(5, n)).keys()].every((i) => String(ws.getCell(i + 3, 2).value).startsWith(csvNames[i])), JSON.stringify(csvNames.slice(0, 5)));
  const csvLinks = out.slice(1).filter((l) => /,https?:\/\//.test(l)).length;
  let links = 0;
  for (let r = 3; r <= ws.rowCount; r++) if (ws.getCell(r, 14).value?.hyperlink) links++;
  check(`xlsx: every source link from the CSV is a live link (${csvLinks})`, links === csvLinks, `${links} vs ${csvLinks}`);
  check("xlsx: unscored rows have no score", [...Array(EXPECT_UNSCORED).keys()].every((i) => ws.getCell(ws.rowCount - i, 4).value === null && ws.getCell(ws.rowCount - i, 3).value === "Needs start date"));
  check("xlsx: notice confirms the save", /Saved ping-when-ranked-queue\.xlsx/.test(await page.locator('[data-testid="notice"]').textContent()));
}

// 5c. Calendar reminders: none until someone is approved, then one event per approved person
{
  await page.click('[data-testid="remind-approved"]');
  check("ics: no approvals gives a plain notice, no file", /No one is approved yet/.test(await page.locator('[data-testid="notice"]').textContent()));
  const top = await page.evaluate(() => [...document.querySelectorAll("[data-person]")].sort((a, b) => a.dataset.rank - b.dataset.rank)[0].dataset.name);
  await page.locator("[data-person] button.card").first().click();
  await page.waitForSelector('[data-testid="drawer"]');
  const opened = await page.locator('[data-testid="drawer"] h1').textContent();
  const [one] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), page.click('[data-testid="remind-one"]')]);
  const drawerNote = await page.locator('[data-testid="drawer-notice"]').textContent();
  if (one) {
    const ics = readFileSync(await one.path(), "utf8").replace(/\r\n /g, "");
    check("ics (drawer): one event for the open person", (ics.match(/BEGIN:VEVENT/g) ?? []).length === 1 && ics.includes(`SUMMARY:Reach out to ${opened.replace(/,/g, "\\,")}`), ics.slice(0, 300));
    check("ics (drawer): all-day, CRLF, says nothing was sent", /DTSTART;VALUE=DATE:\d{8}/.test(ics) && ics.includes("\r\n") && ics.includes("Ping When sent nothing."));
  } else check("ics (drawer): closed window is reported instead of a file", /window already closed/.test(drawerNote), drawerNote);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.keyboard.press("Escape");
  check("ics: button counts approvals", /\(1\)/.test(await page.locator('[data-testid="remind-approved"]').textContent()));
  const [many] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), page.click('[data-testid="remind-approved"]')]);
  const note = await page.locator('[data-testid="notice"]').textContent();
  check("ics (approved): saved file or reported closed window", many ? /Saved ping-when-reminders\.ics with 1 reminder/.test(note) : /window already closed/.test(note), note);
  check("ics: approved person is the one opened", opened === top, `${opened} vs ${top}`);
}
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
{
  // Scored people only: incomplete drawers list what is missing, not signals (never scored).
  const notes = [...new Set(csv.split("\n").slice(1).filter((l) => l && l.split(",")[3]).map((l) => (l.match(/("(?:[^"]|"")*"|[^,]*)$/) || [""])[0].replace(/^"|"$/g, "").replace(/""/g, '"')).filter(Boolean))];
  const missing = notes.filter((n) => !allText.includes(n));
  check(`real roster: all ${notes.length} scored-people source titles shown in full in the drawers (no truncation)`, notes.length > 0 && missing.length === 0, missing.join(" | "));
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
const exNames = await page.evaluate(() => [...document.querySelectorAll("[data-person]")].map((e) => e.dataset.name));
const exFile = readFileSync("public/ping-when-example.csv", "utf8").split("\n").slice(1).filter(Boolean).map((l) => l.split(",")[0].replace(/^"|"$/g, ""));
const realNames = csv.split("\n").slice(1).filter(Boolean).map((l) => l.split(",")[0]);
check("Load example: 30 people, every one from the fictional example file, none from the real roster", exNames.length === 30 && exNames.every((n) => exFile.includes(n)) && !exNames.some((n) => realNames.includes(n)), JSON.stringify(exNames.slice(0, 3)));
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
  if (SHOT) await page.waitForTimeout(300), await page.screenshot({ path: path.join(SHOT, `${ENGINE}-${width}-empty.png`), fullPage: false });
  await upload(page, ROSTER);
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => {
    const vis = [...document.querySelectorAll("p,li,span,button,a,h1,h2,h3,dt,dd,label")].filter((e) => e.offsetParent && e.textContent.trim());
    const all = [...document.querySelectorAll("*")];
    const cs = (e) => getComputedStyle(e);
    const borders = all.filter((e) => ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs(e)[`border${s}Width`]) > 0 && !["rgba(134, 161, 182, 0.25)", "rgb(134, 161, 182)", "rgb(255, 255, 255)", "rgba(255, 255, 255, 0.1)", "rgb(235, 255, 10)", "rgba(255, 255, 255, 0.33)", "rgba(255, 255, 255, 0.6)", "rgb(77, 77, 77)", "rgba(0, 0, 0, 0)"].includes(cs(e)[`border${s}Color`]) && cs(e)[`border${s}Style`] !== "none")).map((e) => e.className || e.tagName);
    return {
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      minFont: Math.min(...vis.map((e) => parseFloat(cs(e).fontSize))),
      h1: cs(document.querySelector("h1")).fontFamily,
      body: cs(document.body).fontFamily,
      shadows: all.filter((e) => cs(e).boxShadow !== "none").length,
      tile: cs(document.querySelector('[data-status]:not([data-status="reach"]) .tile, [data-incomplete] .tile') ?? document.querySelector(".tile")).backgroundColor,
      hiOff: all.filter((e) => !e.closest('[data-status="reach"]') && [cs(e).backgroundColor, cs(e).color, cs(e).borderTopColor].includes("rgb(235, 255, 10)")).length,
      bg: cs(document.body).backgroundColor,
      ink: cs(document.body).color,
      borders,
      firstTile: document.querySelector("[data-person] .card")?.getBoundingClientRect().top ?? 9999,
      banner: (() => { const b = document.querySelector('[data-testid="announcement"]'); return { h: b.getBoundingClientRect().height, sw: b.scrollWidth, cw: b.clientWidth, text: b.innerText.trim() }; })(),
      nav: (() => { const n = document.querySelector('[data-testid="nav"]'); const tops = [...n.querySelectorAll("a")].map((a) => Math.round(a.getBoundingClientRect().top)); return { rows: new Set(tops).size, overflowX: getComputedStyle(n).overflowX, sw: n.scrollWidth, cw: n.clientWidth }; })(),
      loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "").toLowerCase()),
    };
  });
  check(`${width}px: no sideways scroll`, m.sw <= m.cw, JSON.stringify(m));
  check(`${width}px: smallest visible text >= 12px`, m.minFont >= 12, String(m.minFont));
  check(`${width}px: GI fonts (h1 and body Geist)`, /geist/i.test(m.h1) && /geist/i.test(m.body) && m.loaded.some((f) => f.includes("geist")), `${m.h1} | ${m.body} | loaded ${m.loaded}`);
  check(`${width}px: GI colours (#000 page, #86A1B6 tiles, #EBFF0A only on ready cards), no shadows`, m.bg === "rgb(0, 0, 0)" && m.tile === "rgb(134, 161, 182)" && m.shadows === 0 && m.hiOff === 0, JSON.stringify(m));
  if (width === 1440) check("1440px: first card sits above the fold (card top < 760px)", m.firstTile < 760, String(m.firstTile));
  if (width === 375) {
    check("375px: banner is one line 'NOTHING IS SENT · STAYS IN YOUR BROWSER'", m.banner.text === "NOTHING IS SENT · STAYS IN YOUR BROWSER" && m.banner.h <= 34 && m.banner.sw <= m.banner.cw, JSON.stringify(m.banner));
    check("375px: nav is a single row that scrolls sideways", m.nav.rows === 1 && m.nav.overflowX === "auto", JSON.stringify(m.nav));
  }
  check(`${width}px: no borders outside the GI line tokens`, m.borders.length === 0, JSON.stringify(m.borders.slice(0, 5)));
  if (SHOT) {
    await page.waitForTimeout(900); await page.screenshot({ path: path.join(SHOT, `${ENGINE}-${width}-roster.png`), fullPage: false });
    await page.locator('[data-testid="closest"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(900);
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
