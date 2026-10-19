// End-to-end check in headless Chrome. Usage: BASE_URL=https://ping-when.vercel.app node scripts/e2e.mjs
// CHROME_PATH overrides the browser; ROSTER overrides the CSV (defaults to the 16-person demo roster).
import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ROSTER = path.resolve(process.env.ROSTER || "scripts/fixtures/ping-when-real-demo.csv");
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
check("upload: 5 scored people", scored.length === 5, JSON.stringify(scored));
check("upload: 11 needs-start-date", s.unscored === 11, String(s.unscored));
check("upload: all scored people in Closest at balanced weights", s.closest.length === 5 && s.week.length === 0, JSON.stringify(s));
check("upload: Parker-Holder in Closest", s.closestNames.some((n) => /Parker-Holder/.test(n)), JSON.stringify(s.closestNames));
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
check("reload: roster persists", [...s2.week, ...s2.closest].length === 5 && s2.unscored === 11);
check("reload: weights persist", [...s2.week, ...s2.closest].join(",") === after);

// 5. Export ranked queue
const client = await page.createCDPSession();
const dl = path.resolve("e2e-downloads");
await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
await page.click('[data-testid="export-ranked"]');
const file = path.join(dl, "ping-when-ranked-queue.csv");
for (let i = 0; i < 30 && !existsSync(file); i++) await new Promise((r) => setTimeout(r, 200));
const out = existsSync(file) ? readFileSync(file, "utf8").trim().split("\n") : [];
check("export: ranked CSV has header + 16 rows", out.length === 17, String(out.length));
check("export: 11 rows marked needs-start-date", out.filter((l) => l.includes("needs-start-date")).length === 11);
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
check("paste: 5 scored, 11 unscored, 0 errors", [...s.week, ...s.closest].length === 5 && s.unscored === 11 && !s.errorsHeading, JSON.stringify(s));
check("paste: same order as upload", [...s.week, ...s.closest].join(",") === before);
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
