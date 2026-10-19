// End-to-end check in headless Chrome. Usage: BASE_URL=https://ping-when.vercel.app node scripts/e2e.mjs
// CHROME_PATH overrides the browser; ROSTER overrides the CSV (defaults to the 16-person demo roster).
import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
// The real-person roster is kept out of the repo. Point ROSTER at it (default: Amy's local copy),
// or at scripts/fixtures/export-fixture.csv (fictional) with EXPECT_SCORED=5 EXPECT_UNSCORED=11 EXPECT_NAME="Fixture Echo".
const ROSTER = path.resolve(process.env.ROSTER || "/workspace/x-growth/ping-when-real-demo.csv");
const EXPECT_SCORED = Number(process.env.EXPECT_SCORED ?? 14);
const EXPECT_UNSCORED = Number(process.env.EXPECT_UNSCORED ?? 2);
const EXPECT_NAME = process.env.EXPECT_NAME ?? "Parker-Holder";
const CHROME =
  process.env.CHROME_PATH ||
  ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
const SHOT = process.env.SHOT_DIR;

let pass = 0;
const fails = [];
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`ok   ${name}`); }
  else { fails.push(name); console.log(`FAIL ${name} ${detail}`); }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const consoleErrors = [];
async function fresh(width = 1280) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  return page;
}

const state = (page) =>
  page.evaluate(() => {
    const ids = (sel) => [...document.querySelectorAll(`${sel} [data-person]`)].map((e) => e.getAttribute("data-person"));
    const names = (sel) => [...document.querySelectorAll(`${sel} [data-person] .gi-row > div:nth-child(2) > p:first-child`)].map((e) => e.textContent);
    return {
      week: ids('[data-testid="this-week"]'),
      closest: ids('[data-testid="closest"]'),
      closestNames: names('[data-testid="closest"]'),
      weekNames: names('[data-testid="this-week"]'),
      unscored: document.querySelectorAll("[data-unscored]").length,
      errorsHeading: [...document.querySelectorAll("h2")].some((h) => h.textContent.trim() === "Import errors."),
      empty: !!document.querySelector('[data-empty="true"]'),
    };
  });

async function setNumber(handle, value) {
  await handle.focus();
  await handle.evaluate((e) => e.select());
  await handle.press("Backspace");
  await handle.type(value);
}

const csv = readFileSync(ROSTER, "utf8");

// 1. Empty state and how-to copy
let page = await fresh();
let s = await state(page);
check("empty state shown before import", s.empty);
check("how-to-use steps present", !!(await page.$('[data-testid="how-to"]')));

// 2. File upload
const input = await page.$('input[type="file"]');
await input.uploadFile(ROSTER);
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
s = await state(page);
const scored = [...s.week, ...s.closest];
check("upload: 0 import errors", !s.errorsHeading);
check(`upload: ${EXPECT_SCORED} scored people`, scored.length === EXPECT_SCORED, JSON.stringify(scored));
check(`upload: ${EXPECT_UNSCORED} needs-start-date`, s.unscored === EXPECT_UNSCORED, String(s.unscored));
check("upload: every scored person is in This week or Closest (no cap)", s.week.length + s.closest.length === EXPECT_SCORED, JSON.stringify(s));
check(`upload: ${EXPECT_NAME} shown`, [...s.weekNames, ...s.closestNames].some((n) => n.includes(EXPECT_NAME)), JSON.stringify(s.closestNames));
const balanced = s;
console.log("balanced order:", JSON.stringify([...s.weekNames.map((n) => `WEEK ${n}`), ...s.closestNames]));
const balancedText = await page.evaluate(() => [...document.querySelectorAll("[data-person]")].slice(0, 5).map((e) => e.innerText.split("\n").slice(0, 6).join(" | ")));
console.log(balancedText.join("\n"));

// 3. Cliff weight to 70 re-orders
const cliffInput = await page.$('input[aria-label="Cliff proximity weight"]') ?? (await page.$$('input[type="number"]'))[0];
await setNumber(cliffInput, "70");
await new Promise((r) => setTimeout(r, 400));
s = await state(page);
const before = [...balanced.week, ...balanced.closest].join(",");
const after = [...s.week, ...s.closest].join(",");
const cliffVal = await page.$eval('input[aria-label="Cliff proximity weight"]', (e) => e.value);
check("cliff 70: weight applied (input reads 70)", cliffVal === "70", cliffVal);
// Honest expectation for the real roster: only one person has a non-zero cliff score today,
// so the order holds and the UI must say so instead of looking broken.
const reordered = before !== after;
console.log(`roster re-ordered at cliff 70: ${reordered} (${before} => ${after})`);
check("cliff 70 on real roster: UI explains unchanged order, or order changed", reordered || !!(await page.$('[data-testid="order-unchanged"]')));
console.log("cliff70 order:", JSON.stringify([...s.weekNames.map((n) => `WEEK ${n}`), ...s.closestNames]));
const cliffText = await page.evaluate(() => [...document.querySelectorAll("[data-person]")].slice(0, 5).map((e) => e.innerText.split("\n").slice(0, 6).join(" | ")));
console.log(cliffText.join("\n"));

// 4. Persistence across reload (roster + weights)
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
const s2 = await state(page);
check("reload: roster persists", [...s2.week, ...s2.closest].length === EXPECT_SCORED && s2.unscored === EXPECT_UNSCORED);
check("reload: weights persist", [...s2.week, ...s2.closest].join(",") === after);

// 5. Export ranked queue
const client = await page.createCDPSession();
const dl = path.resolve("e2e-downloads");
await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
await page.click('[data-testid="export-ranked"]');
const file = path.join(dl, "ping-when-ranked-queue.csv");
for (let i = 0; i < 30 && !existsSync(file); i++) await new Promise((r) => setTimeout(r, 200));
const out = existsSync(file) ? readFileSync(file, "utf8").trim().split("\n") : [];
check(`export: ranked CSV has header + ${EXPECT_SCORED + EXPECT_UNSCORED} rows`, out.length === EXPECT_SCORED + EXPECT_UNSCORED + 1, String(out.length));
check(`export: ${EXPECT_UNSCORED} rows marked needs-start-date`, out.filter((l) => l.includes("needs-start-date")).length === EXPECT_UNSCORED);
await page.close();

// 6. Paste flow
page = await fresh();
await page.type("#paste-roster", "x"); // focus
await page.$eval("#paste-roster", (el, v) => {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  set.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, csv);
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Import paste").click());
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
s = await state(page);
check("paste: same counts as upload, 0 errors", [...s.week, ...s.closest].length === EXPECT_SCORED && s.unscored === EXPECT_UNSCORED && !s.errorsHeading, JSON.stringify(s));
check("paste: same order as upload", [...s.week, ...s.closest].join(",") === before);
await page.close();

// 6a. Links: no placeholder anywhere; every real-roster link resolves (non-404)
async function openAllSignals(p) {
  await p.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^Signals$/.test(b.textContent.trim())).forEach((b) => b.click()));
  await new Promise((r) => setTimeout(r, 300));
}
async function placeholderCheck(p, label) {
  const bad = await p.evaluate(() => {
    const hrefs = [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /example\.(com|org|net)/i.test(h));
    const text = /example\.(com|org|net)/i.test(document.body.innerText);
    return { hrefs, text };
  });
  check(`${label}: no example.com href or text on page`, bad.hrefs.length === 0 && !bad.text, JSON.stringify(bad));
}
page = await fresh();
await (await page.$('input[type="file"]')).uploadFile(ROSTER);
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
await openAllSignals(page);
await placeholderCheck(page, "real roster (signals open)");
const collected = [];
const placeholderHits = [];
let allText = "";
const overflowing = [];
const nButtons = await page.$$eval("button", (bs) => bs.filter((b) => /^(Signals|Hide signals)$/.test(b.textContent.trim())).length);
for (let i = 0; i < nButtons; i++) {
  await page.evaluate((i) => {
    const bs = [...document.querySelectorAll("button")].filter((b) => /^(Signals|Hide signals)$/.test(b.textContent.trim()));
    if (bs[i] && bs[i].textContent.trim() === "Signals") bs[i].click();
  }, i);
  await new Promise((r) => setTimeout(r, 120));
  collected.push(...(await page.$$eval("[data-person] a[href^='http']", (as) => as.map((a) => a.href))));
  if (/example\.(com|org|net)/i.test(await page.evaluate(() => document.body.innerText + [...document.querySelectorAll("a[href]")].map((a) => a.href).join(" ")))) placeholderHits.push(i + 1);
  const info = await page.evaluate(() => ({
    text: document.body.innerText,
    overflow: [...document.querySelectorAll("[data-person] a[href]")].filter((a) => {
      const cell = a.parentElement.getBoundingClientRect();
      return a.getBoundingClientRect().right > cell.right + 1;
    }).map((a) => a.href),
  }));
  allText += "\n" + info.text;
  overflowing.push(...info.overflow);
}
const links = [...new Set(collected)];
check("real roster: no example.com on any opened card", placeholderHits.length === 0, placeholderHits.join(","));
check("real roster: label says 'Real public sources · scores are illustrative'", (await page.$eval('[data-testid="dataset"]', (e) => e.textContent)) === "Real public sources · scores are illustrative");
check("real roster: no seed/fictional labels anywhere (cards opened)", !/Same fictional employer|30 fictional seed archetypes|EXAMPLE DATA|Fictional seed signal/.test(allText), (allText.match(/.{0,40}(Same fictional employer|30 fictional seed archetypes|EXAMPLE DATA|Fictional seed signal).{0,40}/) || [""])[0]);
check("real roster: long source URLs stay inside their column", overflowing.length === 0, overflowing.join(" | "));
if (!process.env.EXPECT_NAME || process.env.EXPECT_NAME === "Parker-Holder") {
  check("real roster: full paper titles shown (Beyond the Visible, Consistent Long-Horizon)", allText.includes("Generative Pixel-Aligned Geometry Beyond the Visible") && allText.includes("Local-Global Rewards for Consistent Long-Horizon Video Generation"));
}
const summary = await page.$eval('[data-testid="summary"]', (e) => e.textContent);
check("summary counts scored and incomplete (no 'All scored' while people are unscored)", summary.includes(`${EXPECT_SCORED} scored`) && summary.includes(`${EXPECT_UNSCORED} need a start date`) && !allText.includes("All scored"), summary);
// Empty state must never flash on reload while a stored roster loads.
await page.evaluateOnNewDocument(() => {
  window.__emptySeen = false;
  new MutationObserver(() => { if (document.querySelector('[data-empty="true"]')) window.__emptySeen = true; }).observe(document, { childList: true, subtree: true });
});
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
check("reload with stored roster: 'The queue is empty' never flashes", (await page.evaluate(() => window.__emptySeen)) === false && !(await page.content()).includes("The queue is empty."));
const dead = [];
for (const url of links) {
  let status = 0;
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (ping-when link check)" }, signal: AbortSignal.timeout(15000) });
    status = res.status;
  } catch { status = -1; }
  if (status === 404 || status === 410 || status === -1) dead.push(`${status} ${url}`);
}
check(`real roster: all ${links.length} source links resolve (non-404)`, links.length > 0 && dead.length === 0, dead.join(" | "));
await page.close();
page = await fresh();
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load example").click());
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
await openAllSignals(page);
await placeholderCheck(page, "fictional example (signals open)");
check("example: label says 'EXAMPLE DATA, fictional' and never 'Real public sources'", (await page.$eval('[data-testid="dataset"]', (e) => e.textContent)) === "EXAMPLE DATA, fictional" && !(await page.evaluate(() => document.body.innerText)).includes("Real public sources"));
check("fictional example: placeholder signals say 'Fictional seed signal, no source link'", (await page.$$eval("[data-no-source]", (els) => els.filter((e) => e.textContent.includes("Fictional seed signal, no source link")).length)) > 0);
await page.close();

// 6b. Labelled fictional example: cliff 70 must re-order the queue
page = await fresh();
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Load example").click());
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
const exBefore = await state(page);
check("example: labelled as fictional seed data", (await page.content()).includes("30 fictional seed archetypes"));
const exInput = await page.$('input[aria-label="Cliff proximity weight"]');
await setNumber(exInput, "70");
await new Promise((r) => setTimeout(r, 400));
const exAfter = await state(page);
check("example cliff 70: This week re-orders", exBefore.week.join(",") !== exAfter.week.join(","), `${exBefore.weekNames} => ${exAfter.weekNames}`);
console.log("example week balanced:", exBefore.weekNames.join(", "), "| cliff70:", exAfter.weekNames.join(", "));
await page.close();

// 7. 375px mobile layout
page = await fresh(375);
await (await page.$('input[type="file"]')).uploadFile(ROSTER);
await page.waitForSelector('[data-testid="closest"]', { timeout: 10000 });
const m = await page.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
  minFont: Math.min(...[...document.querySelectorAll("p,li,span,button")].filter((e) => e.offsetParent && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
}));
check("375px: no sideways scroll", m.sw <= m.cw, JSON.stringify(m));
check("375px: smallest visible text >= 12px", m.minFont >= 12, JSON.stringify(m));
if (SHOT) {
  await page.screenshot({ path: path.join(SHOT, "ping-when-375-top.png") });
  await page.evaluate(() => document.querySelector('[data-testid="closest"]').scrollIntoView());
  await page.screenshot({ path: path.join(SHOT, "ping-when-375-closest.png") });
}
await page.close();

check("no console errors", consoleErrors.length === 0, JSON.stringify(consoleErrors));
await browser.close();
console.log(`\n${pass} passed, ${fails.length} failed against ${BASE}`);
if (SHOT) writeFileSync(path.join(SHOT, "e2e-result.txt"), `${pass} passed, ${fails.length} failed\n`);
process.exit(fails.length ? 1 : 0);
