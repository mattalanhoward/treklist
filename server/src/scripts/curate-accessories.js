/**
 * curate-accessories.js
 *
 * Policy (set by user 2026-06-29): exclude accessories that aren't needed for a
 * gear-planning app, and KEEP a note of everything excluded. Worn/used standalone
 * gear stays; pack add-ons / parts / pouches / consumables / off-domain items go.
 *
 * Acts only on items currently in the Other / untyped / Wallet buckets, so a
 * well-typed gear item with a coincidentally-matching name is never touched.
 *
 *   node src/scripts/curate-accessories.js            # dry-run (default)
 *   node src/scripts/curate-accessories.js --commit   # apply + write exclusion log
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const COMMIT = process.argv.includes("--commit");

// --- ARCHIVE: accessory / not-needed-for-gear-planning -----------------------
const ARCHIVE = [
  // atelier
  "Sangles amovibles", "Zipped tote bag", "Sacs fourre-tout",
  // atom
  "The Hipbelt Pocket",
  // durston (spare parts, poles-as-parts, stickers, kits)
  "Spare X-Dome Parts", "Iceline Pole Parts", "Spare Kakwa Parts", "Spare Wapta Parts",
  "Z-Flick Tent Pole", "Durston Logo Sticker 3-Pack", "Reflective Ironwire", "X-Mid Stargazer Kit",
  // hyberg
  "Elastic Straps", "RIDO",
  // legacy (pouches/parts/consumables/off-domain/junk-names)
  "Standard Pillow Case", "500ml", "750ml", "1000ml", "Earplugs",
  "Food Storage Quart Freezer Slider Bags", "Food Storage Gallon Freezer Slider Bags",
  "BIC Mini Lighter", "GripTight ONE", "AAA Batteries", "Men's Solution Harness",
  "Vision Helmet", "Lanyard Scorpio Vertigo", "Bear Bag Line 40′", "Wag Bag",
  "Mic 3 Transmitter", "Windscreen For Trekking Stove - MT500",
  "Osmo Action 4", "Osmo Action 5", "HERO13 Black", "Ace Pro 2",
  // zpacks "Other"
  "Ultralight Dog Bowl", "Shoulder Pouch w/ Zipper", "Bear Bagging Kit", "Top Side Pocket",
  "Belt Pouch", "Shoulder Pouch", "Banana Boat Sunscreen (3 pack)",
  // zpacks untyped (pack add-ons, pouches, cordage, hardware, consumables, collections)
  "50 Feet 2 mm Z-Line Reflective Cord", "Zpacks x Vaucluse Ventilation Frame + Sleeve",
  "Zpacks Tiny Oval Carabiner (4 Pack)", "Travel Zip Pouch DISC", "Mini Hair Brush w/ Mirror",
  "XL Airplane Case", "Airplane Case", "Itty Bitty Ditty Bag", "Bikepacking Collection",
  "Zpacks x Glacial Gear Wool Trail Rag", "Granger's Repel Plus DWR Spray - 275 ml",
  "3\" Tenacious Tape Mesh Patches", "Camera Pack", "Nero V Top Strap",
  "Spare set of Multi-Pack Straps", "Travel Utility Zip", "Pair of Shoulder Strap Pads",
  "Stick-on Key Zip Pouch", "Tablet Zip Pouch", "Phablet Zip Pouch", "Phone Zip Pouch",
  "Wallet Zip Pouch", "Multi-Pack", "Tri-Fold Minimalist Wallet", "Lumbar Pad",
  "Front Utility Pack Accessory", "Double-Hook Apparatus", "Pots & Mugs",
  "Cord & Cord Hardware", "Shelters", "Stakes", "Pair of titanium Plexamid arches",
  "Glasses Zip Pouch", "Ice Axe Loops (Both Sides of Pack)", "Passport Zip Pouch",
  "Replacement Long Sternum Strap", "Detachable 1\" Webbing Belt", "Roll Top Closure Straps",
  "Document Zip Pouch", "Replacement Sternum Strap", "Stake Sack", "Potty Pack with Trowel",
];

// --- RETYPE: real gear, just mis-typed/untyped -------------------------------
const RETYPE = {
  "Evernew Titanium UL 570ml Cup": "Backpacking Pot",
  "Evernew Titanium UL 400ml Cup": "Backpacking Pot",
  "Toaks Light 650ml Cup w/ Lid": "Backpacking Pot",
  "Vertice Rain Kilt": "Rain Pants",
  "DCF Rain Kilt": "Rain Pants",
  "Zpacks Ventum Wind Shell Jacket": "Rain Jacket",
  "Men's Running & Trail Running Windproof Jacket - KIPRUN Run 900 Wind": "Rain Jacket",
  "Women's Long-sleeved Merino Wool Trekking Thermal Jacket - MT900": "Base Layer Top",
  "Clearance - Goose Down Vest - Jet Black - Extra Large": "Insulated Jacket",
  "Clearance - Goose Down Vest - Burnt Orange - Large": "Insulated Jacket",
};

// --- BORDERLINE: accessory-ish but plan-relevant; KEPT (listed for review) ----
const BORDERLINE_KEEP = [
  "Deuce of Spades #2", "Foam Seat Pad", "Foam Sit Pad", "Zpacks Pack Cover",
  "Zpacks Rain Gaiters", "Zpacks Down Booties", "Warm Booties (2024)", "Warm Booties",
  "Zpacks Ultralight Camp Shoes", "Zpacks Down Hood", "Ultralight Titanium Whistle",
  "Carbon Fiber Staff", "Adotec Grizzly Bear Resistant Bag - 14L", "Large Food Bag",
  "Big Food Bag", "Zero Pump Air Pump", "MICROspikes", "Mountaineering Survival Bag",
  "DupleXL DISC",
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  // Only operate on the accessory-prone buckets so we never touch typed gear.
  const bucket = { isActive: true, $or: [
    { itemType: { $in: ["Other", "Wallet"] } },
    { itemType: { $exists: false } }, { itemType: null }, { itemType: "" },
  ] };
  const items = await C.find(bucket).select("name itemType weightGrams itemGroupId isActive").lean();
  const byName = {};
  for (const it of items) (byName[it.name] = byName[it.name] || []).push(it);

  // Wallet bucket: archive all (user explicit), in addition to named ARCHIVE list.
  const walletItems = items.filter((it) => it.itemType === "Wallet");
  const archiveNameSet = new Set(ARCHIVE);

  const toArchive = items.filter((it) => archiveNameSet.has(it.name) || it.itemType === "Wallet");
  const toRetype = items.filter((it) => RETYPE[it.name]);

  // sanity: report any ARCHIVE/RETYPE names not found
  const found = new Set(items.map((it) => it.name));
  const missingArchive = ARCHIVE.filter((n) => !found.has(n));
  const missingRetype = Object.keys(RETYPE).filter((n) => !found.has(n));

  const src = (it) => { const m = (it.itemGroupId || "").match(/^([a-z]+)-/); return m ? m[1] : "legacy"; };
  const w = (it) => (typeof it.weightGrams === "number" ? it.weightGrams + "g" : "—");

  const log = [];
  const out = (s = "") => { log.push(s); console.log(s); };
  out(`CURATE-ACCESSORIES — ${mongoose.connection.name} — ${new Date().toISOString()}`);
  out(`Mode: ${COMMIT ? "COMMIT" : "DRY-RUN"}`);
  out(`Bucket (Other/Wallet/untyped) active items: ${items.length}\n`);

  out(`== ARCHIVE (${toArchive.length}) — excluded accessories ==`);
  for (const it of toArchive.sort((a, b) => src(a).localeCompare(src(b))))
    out(`  [${src(it).padEnd(8)}] ${w(it).padStart(6)}  ${it.name}`);

  out(`\n== RETYPE (${toRetype.length}) — kept, re-typed as real gear ==`);
  for (const it of toRetype) out(`  ${it.name}  →  ${RETYPE[it.name]}`);

  out(`\n== BORDERLINE — KEPT (${BORDERLINE_KEEP.length}) — tell me to cut any ==`);
  for (const n of BORDERLINE_KEEP) { const hit = (byName[n] || [])[0]; if (hit) out(`  ${w(hit).padStart(6)}  ${n}`); }

  if (missingArchive.length) out(`\n!! ARCHIVE names not found (check spelling): ${missingArchive.join(" | ")}`);
  if (missingRetype.length) out(`!! RETYPE names not found: ${missingRetype.join(" | ")}`);

  if (COMMIT) {
    let a = 0, r = 0;
    for (const it of toArchive) { await C.updateOne({ _id: it._id }, { $set: { isActive: false } }); a++; }
    for (const it of toRetype) {
      const doc = await C.findById(it._id);
      doc.itemType = RETYPE[it.name];
      doc.$locals.lenientAttributes = true;
      await doc.save();
      r++;
    }
    out(`\nAPPLIED: archived ${a}, retyped ${r}.`);
    const dir = path.join(__dirname, "../../reports");
    const file = path.join(dir, `exclusions-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
    fs.writeFileSync(file, log.join("\n"));
    out(`Exclusion log: ${file}`);
  } else {
    out(`\n(dry-run) re-run with --commit to apply + write the exclusion log.`);
  }

  await mongoose.disconnect();
})();
