/**
 * consistency-report.js  (READ-ONLY)
 *
 * Audits the active catalog against the "clean" bar and writes a per-source,
 * per-reason list of every item that needs review — so an import can be checked
 * item-by-item before the prod migration. Writes nothing; outputs a text file.
 *
 *   node src/scripts/consistency-report.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const SOURCES = ["zpacks", "garagegrowngear", "durstongear", "hyberg", "atelierlonguedistance", "atompacks"];
const sourceOf = (it) => {
  const m = (it.itemGroupId || "").match(/^([a-z]+)-/);
  return m && SOURCES.includes(m[1]) ? m[1] : "legacy/other";
};

// itemTypes that should not be ultralight-trivial — a tiny weight = bad data.
const HEAVY = { "Backpacking Tent": 250, "Backpack": 120, "Sleeping Bag": 200, "Quilt": 200 };
const JUNK_NAME = /\(custom\)|\btest\b|\bcopy\b|sample sale|gift card|\bdummy\b/i;

function variantWeights(it) {
  return (it.variants || []).map((v) => v.weightGrams).filter((w) => typeof w === "number");
}

function flagsFor(it, hasOffer) {
  const f = [];
  const vw = variantWeights(it);
  const hasWeight = typeof it.weightGrams === "number" || vw.length > 0;
  if (!hasWeight) f.push("NO-WEIGHT");
  if (!it.itemType) f.push("UNTYPED");
  else if (it.itemType === "Other") f.push("OTHER");
  if (it.itemType && it.itemType !== "Other" && !it.category) f.push("TYPE-BUT-NO-CATEGORY");
  if (!hasOffer) f.push("NO-OFFER");
  if (it.itemType && HEAVY[it.itemType] && typeof it.weightGrams === "number" && it.weightGrams < HEAVY[it.itemType])
    f.push(`SUSPICIOUS-WEIGHT(${it.weightGrams}g)`);
  if (typeof it.weightGrams === "number" && it.weightGrams > 4000) f.push(`SUSPICIOUS-WEIGHT(${it.weightGrams}g)`);
  if ((it.variants || []).length >= 2 && new Set(vw).size <= 1) f.push("FLAT-VARIANTS(no distinct weights)");
  if (JUNK_NAME.test(it.name || "")) f.push("JUNK-NAME");
  return f;
}

// crude over-split detector: same source+brand, shared base noun after stripping
// brand / size / model / color tokens.
function baseName(it) {
  let n = (it.name || "").toLowerCase().replace(/\s+by\s+.*$/, "");
  for (const w of (it.brandLC || "").split(/\s+/)) if (w) n = n.replace(new RegExp("\\b" + w + "\\b", "g"), " ");
  return n.replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(x-?mid|x-?dome|pro|ul|re|ep|\d+l?|\d+ml|\d+°?f?|small|medium|large|mini|slim|tall|big|plus|short|s|m|l|xl|xxl)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const items = await C.find({ isActive: true }).select("name brand brandLC itemType category weightGrams variants itemGroupId").lean();
  const offerSet = new Set((await O.find({}).select("productId").lean()).map((o) => String(o.productId)));

  // group + flag
  const bySource = {};
  for (const it of items) {
    const s = sourceOf(it);
    (bySource[s] = bySource[s] || []).push({ it, flags: flagsFor(it, offerSet.has(String(it._id))) });
  }

  const lines = [];
  const out = (s = "") => lines.push(s);
  out(`CONSISTENCY REPORT — ${mongoose.connection.name} — ${new Date().toISOString()}`);
  out(`Active items: ${items.length}`);
  out("Clean bar: has offer + valid itemType + category + weight; sane variants; no junk names.\n");

  const order = [...SOURCES, "legacy/other"];
  for (const s of order) {
    const rows = bySource[s] || [];
    if (!rows.length) continue;
    const flagged = rows.filter((r) => r.flags.length);
    out("=".repeat(78));
    out(`SOURCE: ${s}   (${rows.length} items, ${flagged.length} need review)`);
    out("=".repeat(78));

    // by reason
    const REASONS = ["NO-WEIGHT", "UNTYPED", "TYPE-BUT-NO-CATEGORY", "NO-OFFER", "SUSPICIOUS-WEIGHT", "FLAT-VARIANTS", "JUNK-NAME", "OTHER"];
    for (const reason of REASONS) {
      const hit = flagged.filter((r) => r.flags.some((f) => f.startsWith(reason)));
      if (!hit.length) continue;
      out(`\n  ${reason} (${hit.length}):`);
      for (const { it, flags } of hit) {
        const extra = flags.filter((f) => f.startsWith("SUSPICIOUS") || f.startsWith("FLAT")).join(" ");
        out(`     ${(it.name || "").replace(/ by .*/, "").slice(0, 46).padEnd(48)} ${it.itemType || "—"} | ${it.weightGrams ?? "—"}g ${extra}`);
      }
    }

    // over-split candidates within this source
    const fam = {};
    for (const { it } of rows) { const b = baseName(it); if (b) (fam[it.brandLC + "::" + b] = fam[it.brandLC + "::" + b] || []).push(it.name.replace(/ by .*/, "")); }
    const split = Object.entries(fam).filter(([, v]) => v.length >= 3);
    if (split.length) {
      out(`\n  POSSIBLE OVER-SPLIT (same base name, review if these should be one variant item):`);
      for (const [k, v] of split.sort((a, b) => b[1].length - a[1].length))
        out(`     ${k.split("::")[0]} — ${v.length}x: ${v.slice(0, 8).join(" | ")}${v.length > 8 ? " …" : ""}`);
    }
    out("");
  }

  const dir = path.join(__dirname, "..", "..", "reports");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `consistency-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  fs.writeFileSync(file, lines.join("\n"));

  // console summary
  console.log("Per-source review counts:");
  for (const s of order) {
    const rows = bySource[s] || []; if (!rows.length) continue;
    const flagged = rows.filter((r) => r.flags.length).length;
    console.log(`  ${s.padEnd(22)} ${String(rows.length).padStart(4)} items, ${String(flagged).padStart(4)} need review`);
  }
  console.log(`\nFull item-by-item report written to:\n  ${file}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
