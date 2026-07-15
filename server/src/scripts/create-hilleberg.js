/**
 * create-hilleberg.js — Hilleberg (hilleberg.com/eng), a Nuxt SSR site with no open
 * product feed. BUT every page's `__NUXT_DATA__` payload is plain JSON containing the
 * ENTIRE structured tent catalog (379 spec records) — so one page fetch gives us all
 * tents with full specs (occupants, minMetric weight, fabric, type, label, area,
 * height, doors, prices, image). No per-page scraping needed. (Same Nuxt-SSR family
 * as Exped/import-exped.js, but the data turned out to be one clean JSON blob.)
 *
 * ⚠ __NUXT_DATA__ is a deduplicated flat array: object field values are INDICES into
 * the array — resolve with arr[idx]. Enumeration gotcha: the sitemap is sparse and
 * category/numbered-size pages return HTTP 500; only single-name + family pages
 * (/eng/products/tent/<ProductGroup>) return 200, and any one of them carries the
 * full catalog in its payload. We fetch the Nallo family page for that.
 *
 * Scope: 48 distinct published tents in the payload → keep the 44 that fit the
 * Backpacking Tent schema (Black/Red/Yellow Label, ≤4 person). EXCLUDE the 4 Blue
 * Label group shelters (Altai/Atlas/Stalon, 6–14 person, 11–26 kg — expedition
 * base-camp tipis, not backpacking, and over the schema's 4-person cap). Colors
 * collapsed (dedupe by model name; color is never a variant). Capacity IS the product
 * identity (each size = its own item, per the locked standard) — and Hilleberg's data
 * is already per-size (Nallo 2 / Nallo 3 / Nallo 2 GT are separate records), so no
 * splitting needed. GT (extended-vestibule) variants are distinct models → kept separate.
 *
 * Weight = `minMetric` (Hilleberg's "minimum weight", the standard catalog figure).
 * Direct Hilleberg offers, deepLink to the family page.
 *
 *   node src/scripts/create-hilleberg.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const CATALOG_PAGE = "https://hilleberg.com/eng/products/tent/Nallo"; // any family page carries the full catalog

const CAP = { 1: "1-Person", 2: "2-Person", 3: "3-Person", 4: "4-Person" };
function tentTypeOf(type) {
  if (/tunnel|ridge/i.test(type)) return "Non-Freestanding";
  if (/free.?standing/i.test(type)) return "Freestanding";
  if (/self.?supporting/i.test(type)) return "Semi-Freestanding";
  return undefined;
}

async function fetchPayload() {
  let html;
  for (let t = 0; t < 5 && !html; t++) {
    try {
      const res = await fetch(CATALOG_PAGE, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) html = await res.text();
    } catch (e) { /* retry */ }
    if (!html) await new Promise((r) => setTimeout(r, 800 * (t + 1)));
  }
  if (!html) throw new Error("could not fetch Hilleberg catalog page");
  const m = html.match(/id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error("no __NUXT_DATA__ in page");
  return JSON.parse(m[1]);
}

(async () => {
  const arr = await fetchPayload();
  const R = (v) => (typeof v === "number" && v >= 0 && v < arr.length ? arr[v] : v);
  const specs = arr.filter((e) => e && typeof e === "object" && !Array.isArray(e) && "occupants" in e && "minMetric" in e);

  // published, non-blue, real tents (≤4 person). "Akto Anniversary" excluded
  // (user, 2026-07-09): a limited-edition dup of the Akto (same 1P/1300g spec) whose
  // CDN image 404s.
  const kept = specs
    .map((s) => {
      const o = {};
      for (const k of Object.keys(s)) o[k] = R(s[k]);
      return o;
    })
    .filter((r) => /label/i.test(r.category || "") && r.status === "published" && Number(r.archived) === 0 && !/blue/i.test(r.category) && +r.occupants >= 1 && +r.occupants <= 4 && !/akto anniversary/i.test(r.name));

  // dedupe by model name (collapse colors)
  const byName = {};
  for (const r of kept) if (!(r.name in byName)) byName[r.name] = r;
  const rows = Object.values(byName);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = r.name;
    const existing = await C.findOne({ name, brand: /hilleberg/i, isActive: true }).lean();
    if (existing) { console.log(`${name}: already active — skip`); continue; }

    const occ = +r.occupants;
    const min = parseInt(r.minMetric) || null;
    const season = /three/i.test(r.construction || "") ? "3-Season" : "4-Season";
    const label = (r.category || "").replace(" Label", "");
    const area = parseFloat(r.innerAreaMetric) || undefined;
    const height = parseInt(r.innerHeightMetric) || undefined;
    const doors = [1, 2].includes(+r.entranceNumber) ? +r.entranceNumber : undefined;
    const vests = +r.vestNumber > 0 ? +r.vestNumber : +r.gtVestNumber > 0 ? +r.gtVestNumber : undefined;

    const attributes = {
      capacity: CAP[occ],
      seasonRating: season,
      wallType: "Double Wall",
      poleMaterial: "Aluminum",
    };
    const tt = tentTypeOf(r.type || "");
    if (tt) attributes.tentType = tt;
    if (area) attributes.floorAreaSqM = area;
    if (height) attributes.peakHeightCm = height;
    if (doors) attributes.doors = doors;
    if (vests != null) attributes.vestibules = vests;
    if (r.fabric) attributes.flyMaterial = r.fabric;

    // image: bump the CDN thumbnail (…-300-…) to a larger render when available
    let img = r.Image;
    const big = img && img.replace(/-300-/, "-1200-");

    const desc =
      `The Hilleberg ${name} is a ${occ}-person, ${season.toLowerCase()} ` +
      `${/tunnel/i.test(r.type) ? "tunnel" : /dome/i.test(r.type) ? "dome" : /ridge/i.test(r.type) ? "ridge" : ""} tent from the ${label} Label line, ` +
      `built for ${season === "4-Season" ? "all-season/expedition" : "3-season lightweight"} use. ` +
      `Double-wall, linked inner + outer for simultaneous pitching. Outer fabric: ${r.fabric || "Kerlon"}. ` +
      `Minimum weight ${min ? min + " g" : "n/a"}${area ? `, inner floor area ${area} m²` : ""}.`;

    const deepLink = `https://hilleberg.com/eng/products/tent/${encodeURIComponent(r.productGroup || r.itemGroup || name)}`;

    console.log(`${name.padEnd(18)} ${CAP[occ].padEnd(9)} ${season}  ${(tt || "?").padEnd(18)} ${min ?? "?"}g  ${r.fabric}  $${r.usd || "?"}`);

    if (COMMIT) {
      // verify the upscaled image exists, else fall back to the thumbnail
      let imageUrl = img;
      if (big && big !== img) {
        try { const h = await fetch(big, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" } }); if (h.ok) imageUrl = big; } catch (e) { /* keep thumb */ }
      }
      if (!imageUrl) { console.log(`   !! ${name}: no image — skip`); continue; }
      const doc = new C({
        name, brand: "Hilleberg", itemType: "Backpacking Tent",
        category: "Shelter", subcategory: "Tents",
        description: desc, imageUrls: [imageUrl], createdBy: ADMIN_ID, isActive: true,
        ...(min ? { weightGrams: min } : {}),
        attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-hilleberg", merchantName: "Hilleberg", productId: doc._id, deepLink, priority: 0 });
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created}/${rows.length} created`);
  await mongoose.disconnect();
})();
