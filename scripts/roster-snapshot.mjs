// Snapshot the ranked queue a deployment produces for a roster CSV. Usage:
// BASE_URL=https://ping-when.vercel.app ROSTER=... OUT=snap.csv node scripts/roster-snapshot.mjs
import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ROSTER = path.resolve(process.env.ROSTER || "/workspace/x-growth/ping-when-real-demo.csv");
const OUT = path.resolve(process.env.OUT || "roster-snapshot.csv");
const CHROME = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await (await page.$('input[type="file"]')).uploadFile(ROSTER);
await page.waitForSelector('[data-testid="export-ranked"]', { timeout: 15000 });
const dl = path.resolve("e2e-downloads/snap"); mkdirSync(dl, { recursive: true });
const file = path.join(dl, "ping-when-ranked-queue.csv"); rmSync(file, { force: true });
const client = await page.createCDPSession();
await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
await page.click('[data-testid="export-ranked"]');
for (let i = 0; i < 50 && !existsSync(file); i++) await new Promise((r) => setTimeout(r, 200));
const csv = readFileSync(file, "utf8");
writeFileSync(OUT, csv);
console.log(`rows=${csv.trim().split("\n").length - 1} -> ${OUT}`);
await browser.close();
