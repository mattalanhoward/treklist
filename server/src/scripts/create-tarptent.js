/**
 * create-tarptent.js — Tarptent (tarptent.com), WordPress + WooCommerce with an OPEN
 * Store API (`/wp-json/wc/store/v1/products`, 148 products, richly populated: weight,
 * variations, images, permalinks, categories). BUT the whole site sits behind an nginx
 * bot-wall that 403s BOTH `curl` and node `fetch` by TLS/UA fingerprint (styled
 * "403 - Forbidden", `x-proxy-cache-info: DT:1`). Only a REAL browser gets through —
 * WebFetch (Anthropic headless Chrome) AND local Playwright headless Chromium both 200.
 *
 * So the generic node-fetch importer can't hit the feed. The 2 JSON pages were dumped
 * to `tarptent-raw.json` (this dir) via a one-off Playwright step (see the handoff);
 * this script reads that dump offline — the LiteAF/hand-mapped pattern, not live fetch.
 *
 * SCOPE — Tarptent makes only shelters. Of the 148 feed products, the complete tents
 * are the 35 in MODELS below (à-la-carte flys/interiors, poles/stakes/stuff-sacks,
 * hats, seam-sealing/repair/service = components/noise, excluded per the archive-parts
 * rule). We import 33: the 2 "Retired Tents" (ProTrail Li, Rainshadow 3) are skipped as
 * discontinued (MEC-Centaurus precedent), and Aeon Li (Sale-only, OOS, being cleared)
 * is left on its existing GGG listing.
 *
 * VARIANTS — Tarptent publishes ONE headline trail weight per tent; the Pole Type /
 * Interior Type / Floor Type options do NOT carry differentiated per-variant weights,
 * links, or images (variation children all echo the parent weight; single WooCommerce
 * product page → single buy-link). So — per the flat-weight-disclosure rule and the
 * Hilleberg precedent — each tent is ONE CatalogItem carrying the headline weight, with
 * the available configuration options named in the description. (No per-variant axes;
 * revisit if the user wants them + brand-published per-config weights.)
 *
 * RECONCILE — supersede the GGG back-door Tarptent items with brand-direct (same
 * precedent as replacing Amazon/GGG with brand-direct): skip creating any tent that
 * already has an active `direct-tarptent` offer (protects the existing curated Rainbow),
 * and separately archive the 4 GGG items whose model we re-create direct (Notch, Double
 * Rainbow, StratoSpire 2, ProTrek) — run archive-tarptent-ggg.js after this.
 *
 *   node src/scripts/create-tarptent.js [--commit]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const OZ = 28.349523125;
const g = (oz) => Math.round(Number(oz) * OZ);

// Per-model classification (hand-mapped from Tarptent domain + each tent's
// short_description). cap=persons, wall, type=tentType, season, pole=poleMaterial.
// `skip:"retired"` = discontinued, don't import. Fabric derived from the name suffix.
const T = { tp: "Trekking Pole Tent", sf: "Semi-Freestanding", fs: "Freestanding", nf: "Non-Freestanding" };
const MODELS = {
  // Trekking-pole tents
  203:    { cap: 1, wall: "Double Wall", type: T.tp, season: "3-Season" },   // Notch
  49837:  { cap: 1, wall: "Double Wall", type: T.tp, season: "3-Season" },   // Notch Li
  56296:  { cap: 1, wall: "Double Wall", type: T.tp, season: "3-Season" },   // StratoSpire 1
  262:    { cap: 2, wall: "Double Wall", type: T.tp, season: "3-Season" },   // StratoSpire 2
  17164:  { cap: 2, wall: "Double Wall", type: T.tp, season: "3-Season" },   // StratoSpire 2 Li
  132916: { cap: 2, wall: "Double Wall", type: T.tp, season: "3-Season" },   // StratoSpire 2 Ultra
  160997: { cap: 1, wall: "Single Wall", type: T.tp, season: "3-Season" },   // ProTrek
  61377:  { skip: "retired" },                                               // ProTrail Li
  113111: { cap: 1, wall: "Single Wall", type: T.tp, season: "3-Season" },   // Dipole 1 Li
  113288: { cap: 2, wall: "Single Wall", type: T.tp, season: "3-Season" },   // Dipole 2 Li
  130337: { cap: 1, wall: "Double Wall", type: T.tp, season: "3-Season" },   // Dipole 1 DW
  147167: { cap: 2, wall: "Double Wall", type: T.tp, season: "3-Season" },   // Dipole 2 DW
  189:    { cap: 1, wall: "Double Wall", type: T.tp, season: "3+ Season" },  // Scarp 1
  18857:  { cap: 2, wall: "Double Wall", type: T.tp, season: "3+ Season" },  // Scarp 2
  158031: { cap: 2, wall: "Single Wall", type: T.tp, season: "3-Season" },   // MesoSpire 2
  178899: { cap: 2, wall: "Double Wall", type: T.tp, season: "3-Season" },   // MesoSpire 2 DW
  // Arch-pole tents (single arch pole; convertible-freestanding)
  200:    { cap: 1, wall: "Single Wall", type: T.sf, season: "3-Season" },   // Rainbow (skipped: exists direct)
  178989: { cap: 1, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Rainbow DW
  98960:  { cap: 1, wall: "Single Wall", type: T.sf, season: "3-Season" },   // Rainbow Li
  17633:  { cap: 2, wall: "Single Wall", type: T.sf, season: "3-Season" },   // Double Rainbow
  129460: { cap: 2, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Double Rainbow DW
  178192: { cap: 2, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Double Rainbow DW Li
  132920: { cap: 2, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Double Rainbow DW Ultra
  56963:  { cap: 2, wall: "Single Wall", type: T.sf, season: "3-Season" },   // Double Rainbow Li
  132475: { cap: 3, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Triple Rainbow DW
  182338: { cap: 1, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Moment DW
  197:    { cap: 1, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Moment DW 30D Nylon
  123641: { cap: 1, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Moment DW Li
  178183: { cap: 1, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Moment DW Ultra
  // Dome / larger arch shelters
  159965: { cap: 1, wall: "Double Wall", type: T.fs, season: "3+ Season" },  // ArcDome 1
  158639: { cap: 2, wall: "Double Wall", type: T.fs, season: "3+ Season" },  // ArcDome 2
  141511: { cap: 2, wall: "Double Wall", type: T.fs, season: "3+ Season" },  // ArcDome 2 Ultra
  281:    { cap: 4, wall: "Double Wall", type: T.nf, season: "3-Season" },   // Hogback
  275:    { cap: 3, wall: "Double Wall", type: T.sf, season: "3-Season" },   // Cloudburst 3
  100223: { skip: "retired" },                                               // Rainshadow 3 (Sil-Poly)
};

const CAP = { 1: "1-Person", 2: "2-Person", 3: "3-Person", 4: "4-Person" };
function fabricOf(name) {
  if (/\bLi\b/.test(name)) return "Dyneema Composite Fabric (DCF)";
  if (/Ultra/.test(name)) return "UltraTNT (Ultra series)";
  if (/30D Nylon/.test(name)) return "30D Silicone-coated Nylon";
  return "Silicone-coated Polyester (SilPoly)";
}
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

(async () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "tarptent-raw.json"), "utf8"));
  const byId = Object.fromEntries(raw.map((p) => [p.id, p]));

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0;
  const ids = Object.keys(MODELS).map(Number).sort((a, b) => (byId[a]?.name || "").localeCompare(byId[b]?.name || ""));
  for (const id of ids) {
    const m = MODELS[id];
    const p = byId[id];
    if (!p) { console.log(`#${id}: NOT IN FEED — skip`); continue; }
    if (m.skip) { console.log(`${p.name.padEnd(26)} — SKIP (${m.skip})`); skipped++; continue; }
    const name = p.name;

    // skip if an active item of this name already has a direct-tarptent offer (protect curated)
    const existing = await C.find({ name, brand: /tarptent/i, isActive: true }).lean();
    let hasDirect = false;
    for (const e of existing) {
      const o = await O.findOne({ productId: e._id, merchantId: "direct-tarptent" }).lean();
      if (o) hasDirect = true;
    }
    if (hasDirect) { console.log(`${name.padEnd(26)} — SKIP (already direct-tarptent)`); skipped++; continue; }

    const weightGrams = p.weight ? g(p.weight) : undefined;
    const fabric = fabricOf(name);
    const attributes = {
      capacity: CAP[m.cap],
      seasonRating: m.season,
      tentType: m.type,
      wallType: m.wall,
      poleMaterial: m.type === T.tp ? "Trekking Poles" : "Aluminum",
      flyMaterial: fabric,
    };

    // configuration options offered on the product page (from the feed attributes)
    const opts = (p.attributes || [])
      .filter((a) => a.has_variations && (a.terms || []).length)
      .map((a) => `${a.name}: ${a.terms.map((t) => t.name).join(", ")}`);

    const short = strip(p.short_description);
    const desc =
      `${short ? short + " " : ""}` +
      `The Tarptent ${name} is a ${m.cap}-person, ${m.season.toLowerCase()} ${m.wall.toLowerCase()} ` +
      `${m.type === T.tp ? "trekking-pole" : m.type === T.fs ? "freestanding" : "single-arch-pole"} shelter ` +
      `(${fabric}).` +
      (opts.length ? ` Available configurations — ${opts.join("; ")}.` : "") +
      (weightGrams ? ` Weight ${weightGrams} g is Tarptent's listed trail weight for the standard configuration; per-option weights are not individually published.` : "");

    const images = (p.images || []).map((i) => i.src).filter(Boolean).slice(0, 6);
    const deepLink = p.permalink;

    console.log(`${name.padEnd(26)} ${CAP[m.cap].padEnd(9)} ${m.season.padEnd(9)} ${m.wall.padEnd(12)} ${(m.type).padEnd(18)} ${weightGrams ?? "?"}g  imgs=${images.length}`);

    if (COMMIT) {
      if (!images.length) { console.log(`   !! ${name}: no images — skip`); continue; }
      const doc = new C({
        name, brand: "Tarptent", itemType: "Backpacking Tent",
        category: "Shelter", subcategory: "Tents",
        description: desc, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(weightGrams ? { weightGrams } : {}),
        attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-tarptent", merchantName: "Tarptent", productId: doc._id, deepLink, priority: 0 });
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: created ${created}, skipped ${skipped}`);
  await mongoose.disconnect();
})();
