// Re-fetch every source link in a roster CSV and check the note (title shown in the app) matches the
// target page's own title: the note minus its trailing "(Source)" tag must appear, in full, in the page's
// citation_title / og:title / <title> / h1. Usage: ROSTER=... node scripts/verify-titles.mjs
import { readFileSync, writeFileSync } from "node:fs";
const ROSTER = process.env.ROSTER || "/workspace/x-growth/ping-when-real-demo.csv";
function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const [head, ...body] = parseCsv(readFileSync(ROSTER, "utf8"));
const iu = head.indexOf("source_url"), inote = head.indexOf("note");
const pairs = [...new Map(body.filter((r) => r[iu]).map((r) => [r[iu] + "\u0000" + r[inote], [r[iu], r[inote]]])).values()];
const norm = (s) => s.normalize("NFKC").replace(/&amp;/g, "&").replace(/&#39;|&#x27;|&rsquo;|’/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const results = []; let fails = 0;
for (const [url, note] of pairs) {
  const want = note.replace(/\s*\([^()]*\)\s*$/, "");
  let got = [], status = 0;
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (ping-when title check)" }, signal: AbortSignal.timeout(20000) });
    status = res.status;
    const html = await res.text();
    const grab = (re) => [...html.matchAll(re)].map((m) => m[1]);
    got = [
      ...grab(/<meta[^>]+name=["']citation_title["'][^>]+content=["']([^"']+)/gi),
      ...grab(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/gi),
      ...grab(/<title[^>]*>([\s\S]*?)<\/title>/gi),
      ...grab(/<h1[^>]*>([\s\S]*?)<\/h1>/gi),
    ];
    var page = norm(html);
  } catch { status = -1; }
  const ok = status >= 200 && status < 400 && (got.some((g) => norm(g).includes(norm(want))) || (page ?? "").includes(norm(want)));
  const inMeta = got.some((g) => norm(g).includes(norm(want)));
  if (!ok) fails++;
  results.push({ ok, inMeta, status, url, shown: note, pageTitle: (got[0] ?? "").replace(/\s+/g, " ").trim() });
  console.log(`${ok ? "ok  " : "FAIL"} ${status} ${inMeta ? "meta" : "body"} ${url}\n     shown: ${note}\n     page:  ${(got[0] ?? "").replace(/\s+/g, " ").trim().slice(0, 160)}`);
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(results, null, 2));
console.log(`\n${pairs.length - fails}/${pairs.length} source titles match their pages`);
process.exit(fails ? 1 : 0);
