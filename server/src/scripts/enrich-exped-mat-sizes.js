/**
 * enrich-exped-mat-sizes.js — the original Exped scrape captured only ONE size per
 * mat (M), so the split R-value pads (Ultra 6.5R, etc.) have no Size variant even
 * though Exped sells M/MW/LW. This re-scrapes each Exped mat's product page, reads
 * the per-size weights from the "Weight" spec div (e.g. "M: 440 g / MW: 545 g /
 * LW: 590 g") and the per-size SKUs from the variation buttons, and adds a Size
 * variant axis (each variant keeps its own weight + ?sku deep-link).
 *
 *   node src/scripts/enrich-exped-mat-sizes.js [--commit]   (local DB only)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

async function fetchHtml(url) {
  const { stdout } = await execFileP("curl", ["-s", "--max-time", "30", "-A",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", url], { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

// sensible display order; default = M (standard) when present, else the first.
const SIZE_RANK = { XS: 0, S: 1, UNO: 1, M: 2, MW: 3, "DUO M": 3, L: 4, LW: 5, "DUO LW": 5, LXW: 6, XLW: 6, DUO: 7, "DUO QUEEN": 8, TRIO: 9 };
const sizeRank = (s) => {
  const lit = String(s).match(/^([\d.]+)L$/); // drybag liter sizes sort numerically
  if (lit) return 10 + parseFloat(lit[1]);
  return s in SIZE_RANK ? SIZE_RANK[s] : 10;
};

// parse "<h4>Weight</h4><div>M: 440 g<br>MW: 545 g<br>LW: 590 g</div>" → [{size,weight}]
// drybags label sizes in liters: "1 l: 20 g<br>3 l: 32 g" → size "1L", "3L" (skip "Set")
function parseSizeWeights(html) {
  const m = html.match(/>Weight<\/h4>\s*<div>([\s\S]*?)<\/div>/i);
  if (!m) return [];
  return [...m[1].matchAll(/([A-Za-z0-9][\w .]*?):\s*([\d.]+)\s*g/g)]
    .map((x) => {
      let size = x[1].trim();
      const lit = size.match(/^([\d.]+)\s*l$/i);
      if (lit) size = `${lit[1]}L`;
      return { size, weight: Math.round(parseFloat(x[2])) };
    })
    .filter((s) => !/^set$/i.test(s.size));
}
// parse variation buttons → { size: sku }
function parseSkus(html, baseUrl) {
  const out = {};
  for (const x of html.matchAll(/sku=(\d+)"[^>]*title="([^"]+)"/g)) {
    let size = x[2].trim().split(/\s+/).pop(); // "Ultra 6.5R MW" → "MW"
    if (/^[\d.]+$/.test(size)) size = `${size}L`; // "Drybag Versa 1" → "1L"
    if (!out[size]) out[size] = `${baseUrl}?sku=${x[1]}`;
  }
  return out;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const TYPES = process.argv.includes("--bags")
    ? ["Sleeping Bag", "Quilt"]
    : process.argv.includes("--packs")
      ? ["Backpack", "Daypack", "Pillow"]
      : process.argv.includes("--drybags")
        ? ["Dry Bag / Stuff Sack", "Pack Liner"]
        : ["Inflatable Sleeping Pad", "Foam Sleeping Pad"];
  const mats = await C.find({ brandLC: "exped", isActive: { $ne: false }, itemType: { $in: TYPES } });
  console.log(`Exped ${process.argv.includes("--bags") ? "bags" : "mats"}: ${mats.length}\n`);

  let added = 0, single = 0, failed = 0;
  for (const P of mats) {
    const offer = await O.findOne({ productId: P._id }).lean();
    const url = (offer?.deepLink || "").split("?")[0]; // base page (offer URL may be a size ?sku from an earlier run)
    if (!url) { console.log(`  ⚠ ${P.name}: no offer URL`); failed++; continue; }
    let html; try { html = await fetchHtml(url); } catch { console.log(`  ⚠ ${P.name}: fetch failed`); failed++; continue; }
    const sizes = parseSizeWeights(html).sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
    const skus = parseSkus(html, url);
    if (sizes.length < 2) { console.log(`  · ${P.name}: single size (${sizes[0]?.weight ?? P.weightGrams}g)`); single++; continue; }

    const variants = sizes.map((s) => ({ key: s.size, options: { Size: s.size },
      weightGrams: s.weight, deepLink: skus[s.size] || undefined }));
    const def = variants.find((v) => v.key === "M") || variants.find((v) => v.key === "UNO") || variants[0];
    console.log(`  ✚ ${P.name}: Size[${sizes.map((s) => `${s.size}:${s.weight}g`).join(" ")}]  default:${def.key}${skus[sizes[0].size] ? " +sku links" : ""}`);
    if (COMMIT) {
      P.variantAxes = [{ name: "Size", values: sizes.map((s) => s.size) }];
      P.variants = variants;
      P.defaultVariantKey = def.key;
      P.weightGrams = def.weightGrams;
      P.$locals.lenientAttributes = true;
      await P.save();
    }
    added++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — sized:${added}  single:${single}  failed:${failed}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
