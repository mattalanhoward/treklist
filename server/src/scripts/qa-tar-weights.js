/**
 * qa-tar-weights.js — Therm-a-Rest weight backfill. The Cascade Shopify feed has
 * grams=0 for many products; the PDP "Tech Specs" tab embeds a per-size table:
 *   "Tech Specs <Size> <Size> ... Weight 1 lbs 13 oz (820 g) ... (886 g) ..."
 * This script fetches each no-weight active TaR item's PDP (offer deepLink),
 * parses sizes + per-size weights, sets Size variants + base weight (Regular
 * preferred). Dry-run default; --commit. Local-only.
 */
require("dotenv").config();
const { execFileSync } = require("child_process");
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const MerchantOffer = require("../models/merchantOffer");

const COMMIT = process.argv.includes("--commit");
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SIZES = ["Regular Short", "Regular Wide", "Regular", "Short Wide", "Short", "Long Wide", "Long", "Large", "Small", "One Size", "X-Large"];

function parseSpecs(html) {
  // several "Tech Specs" occurrences exist (tab headers); find the one whose window is the table
  let from = 0, i;
  while ((i = html.indexOf("Tech Specs", from)) !== -1) {
    const r = parseSpecsAt(html, i);
    if (r) return r;
    from = i + 10;
  }
  return null;
}
function parseSpecsAt(html, i) {
  const txt = html.slice(i, i + 60000).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // single-config layout: "Tech Specs Weight: 24 oz (690 g) ..."
  let m = txt.match(/^Tech Specs\s*Weight:?\s[^()]{0,40}\((\d+(?:\.\d+)?)\s*g\)/);
  if (m) return [{ size: "One Size", g: Math.round(parseFloat(m[1])) }];
  const wIdx = txt.search(/(?<!Fill) Weight /);
  if (wIdx < 0) return null;
  let head = txt.slice(10, wIdx).trim();
  const sizes = [];
  while (head.length) { // header = size columns; stop at first non-size row label (e.g. "R-Value 4.7 …")
    const s = SIZES.find((x) => head.startsWith(x));
    if (!s) break;
    sizes.push(s); head = head.slice(s.length).trim();
  }
  if (!sizes.length) return null;
  const after = txt.slice(wIdx + 8, wIdx + 8 + 220 * sizes.length);
  const gs = [];
  const re = /\((\d+(?:\.\d+)?)\s*(k?g)\)/g;
  while ((m = re.exec(after)) && gs.length < sizes.length) gs.push(Math.round(parseFloat(m[1]) * (m[2] === "kg" ? 1000 : 1)));
  if (gs.length !== sizes.length) return null;
  return sizes.map((s, k) => ({ size: s, g: gs[k] }));
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  const items = await CatalogItem.find({ brandLC: "therm-a-rest", isActive: { $ne: false } }).lean();
  const targets = items.filter((i) => !i.weightGrams && !(i.variants || []).some((v) => v.weightGrams));
  console.log(targets.length, "no-weight TaR items");
  for (const it of targets) {
    const o = await MerchantOffer.findOne({ productId: it._id, network: "direct" }).lean();
    if (!o) { console.error("NOOFFER", it.name); continue; }
    // offers link to cascadedesigns.com; the parseable Tech Specs table is on thermarest.com
    const handle = (o.deepLink.match(/\/products\/([a-z0-9-]+)/) || [])[1];
    const url = `https://www.thermarest.com/products/${handle}`;
    let html;
    try { html = execFileSync("curl", ["-sL", "-A", UA, "--max-time", "30", url], { maxBuffer: 32 * 1024 * 1024 }).toString(); }
    catch (e) { console.error("FETCH FAIL", it.name); continue; }
    const specs = parseSpecs(html);
    if (!specs) { console.error("NO SPEC TABLE", it.name, url.split("/").pop()); continue; }
    const set = {};
    if (specs.length === 1) set.weightGrams = specs[0].g;
    else {
      set.variantAxes = [{ name: "Size", values: specs.map((s) => s.size) }];
      set.variants = specs.map((s) => ({ key: s.size, options: { Size: s.size }, weightGrams: s.g }));
      const def = specs.find((s) => s.size === "Regular") || specs[0];
      set.defaultVariantKey = def.size;
      set.weightGrams = def.g;
    }
    console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} ${it.name}: ${specs.map((s) => `${s.size}=${s.g}g`).join(", ")}`);
    if (COMMIT) await CatalogItem.collection.updateOne({ _id: it._id }, { $set: set });
    await new Promise((r) => setTimeout(r, 700));
  }
  await mongoose.disconnect();
})();
