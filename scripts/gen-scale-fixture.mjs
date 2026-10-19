// Writes scripts/fixtures/scale-2000.csv: 2,000 FICTIONAL people (one row each) for scale tests.
// Deterministic (seeded LCG). 1,900 have a start_date; every 20th row has none (100 incomplete).
// No source URLs (fictional rows never get links). Names are "Scale Fixture NNNN".
import { writeFileSync } from "node:fs";
let seed = 20261019;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const types = ["release", "funding", "layoff", "talk", "oss", "building", "reorg"];
const pad = (n) => String(n).padStart(2, "0");
const lines = ["name,role,employer,start_date,type,date,source_url,note"];
for (let i = 1; i <= 2000; i++) {
  const y = 2021 + Math.floor(rnd() * 5), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
  const start = i % 20 === 0 ? "" : `${y}-${pad(m)}-${pad(d)}`;
  const t = types[Math.floor(rnd() * types.length)];
  const sd = new Date(Date.UTC(2026, 9, 19) - Math.floor(rnd() * 200) * 86400000).toISOString().slice(0, 10);
  lines.push(`Scale Fixture ${String(i).padStart(4, "0")},Fictional role,Fictional Org ${1 + (i % 37)},${start},${t},${sd},,Fictional scale-test signal ${i}`);
}
writeFileSync(new URL("./fixtures/scale-2000.csv", import.meta.url), lines.join("\n") + "\n");
console.log("wrote 2000 fictional rows");
