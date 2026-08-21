/**
 * create-insta360.js — Insta360 (store.insta360.com), custom SSR e-commerce, NO open feed
 * and curl is bot-redirected to a locale. Done by RENDERED/curl SCRAPE:
 *  - WEIGHTS/SPECS: the online-manual hardware pages are server-rendered with a
 *    `window.__INITIAL_DATA__` JSON blob holding the family comparison table — curlable
 *    at onlinemanual.insta360.com/<model>/en-us/specs/hardware (X-series one page covers
 *    X3/X4/X4 Air/X5/X6; acepro2 covers Ace/Ace Pro/Ace Pro 2; go3s covers GO 3/3S/Ultra;
 *    micair/micpro). Flow gimbal weights from published specs (no table on that page).
 *  - IMAGES: og:image from each store PDP (curlable after redirect); 2 mics + Ace Pro
 *    pulled via WebFetch/entity-fix.
 *  - marketing insta360.com is 403-walled to our fetcher (unlike DJI); manual + store work.
 *
 * Scope (user, 2026-08-13, "basically the same as DJI"): carry-able cameras / phone
 * gimbals / wireless mics only. Skipped Link webcams (desktop), GO Ultra + GO 2 (not in
 * US store / discontinued), all accessories/combos/refurb. Reuses the Camera / Gimbal /
 * Microphone itemTypes added for DJI (→ Electronics & Power / Photo & Video) — NO schema
 * change. Locale-neutral store deepLinks, UNMONETIZED (the affiliate params in the URL the
 * user pasted were stray, not theirs — dropped).
 *
 * Weights: 360/action camera body; GO = wearable camera unit (Action Pod adds weight,
 * disclosed); gimbal body; single transmitter TX for mics (disclosed).
 *
 *   node src/scripts/create-insta360.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const BRAND = "Insta360";
const PDP = "https://store.insta360.com/product/";

// name (after "Insta360 "), itemType, store slug, weight g, image URL, attributes, extras
const ITEMS = [
  // ---- 360 cameras (dual-lens) ----
  { n: "X3", t: "Camera", s: "x3", w: 180, img: "https://res.insta360.com/static/0b49eda99d3ee25ada8ece8f7cc40f5f/X3.jpg",
    a: { cameraType: "360", sensorSize: "Dual lens", maxVideoResolution: "5.7K", stabilization: "Electronic (EIS)", waterproofDepthM: 10 } },
  { n: "X4", t: "Camera", s: "x4", w: 203, img: "https://res.insta360.com/static/090a8e529ad559cd3e6fccb0b83e52e3/X4.jpg",
    a: { cameraType: "360", sensorSize: "Dual lens", maxVideoResolution: "8K", stabilization: "Electronic (EIS)", waterproofDepthM: 10 } },
  { n: "X4 Air", t: "Camera", s: "x4-air", w: 165, img: "https://res.insta360.com/static/0ad9c3fedafad00938ba865fd26a6831/B2.jpg",
    a: { cameraType: "360", sensorSize: "Dual lens", maxVideoResolution: "8K", stabilization: "Electronic (EIS)", waterproofDepthM: 15 } },
  { n: "X5", t: "Camera", s: "x5", w: 200, img: "https://res.insta360.com/static/d7c51133e61456113302d092d7afcbe5/%E7%A4%BE%E5%AA%92Thumbnail%E9%85%8D%E5%9B%BE.jpeg",
    a: { cameraType: "360", sensorSize: "Dual lens", maxVideoResolution: "8K", stabilization: "Electronic (EIS)", waterproofDepthM: 15 } },
  { n: "X6", t: "Camera", s: "x6", w: 196, img: "https://wassets.insta360.com/store/c1d5e5a174d5499d9f8f04aa618052a2/x6.jpg",
    a: { cameraType: "360", sensorSize: "Dual lens", maxVideoResolution: "8K", stabilization: "Electronic (EIS)", waterproofDepthM: 20 } },

  // ---- action cameras ----
  { n: "Ace Pro", t: "Camera", s: "ace-pro", w: 180, img: "https://res.insta360.com/static/102173575887985d00b8333de0cf370a/AcePro%26Ace.jpg",
    a: { cameraType: "Action", sensorSize: "1/1.3-inch", maxVideoResolution: "8K", stabilization: "Electronic (EIS)", waterproofDepthM: 10 } },
  { n: "Ace Pro 2", t: "Camera", s: "ace-pro-2", w: 182, img: "https://res.insta360.com/static/29e2a58966be15bff212990b01652ca2/AcePro2-Thumbnail.jpg",
    a: { cameraType: "Action", sensorSize: "1/1.3-inch", maxVideoResolution: "8K", stabilization: "Electronic (EIS)", waterproofDepthM: 12 } },

  // ---- GO wearable cameras (weight = camera unit; Action Pod adds ~96 g, disclosed) ----
  { n: "GO 3", t: "Camera", s: "go-3", w: 35.5, pod: 96.3, img: "https://res.insta360.com/static/67718149f692bd8cbdc45eaf3f47e4ad/GO3.jpg",
    a: { cameraType: "Action", sensorSize: "1/2.3-inch", maxVideoResolution: "2.7K", stabilization: "Electronic (EIS)", waterproofDepthM: 10 } },
  { n: "GO 3S", t: "Camera", s: "go-3s", w: 39.1, pod: 96.3, img: "https://res.insta360.com/static/a256aaff697749a301dbab589f76b968/GO3S.jpg",
    a: { cameraType: "Action", sensorSize: "1/2.3-inch", maxVideoResolution: "4K", stabilization: "Electronic (EIS)", waterproofDepthM: 10 } },

  // ---- Flow phone gimbals ----
  { n: "Flow", t: "Gimbal", s: "flow", w: 369, img: "https://res.insta360.com/static/abb2ff495f8d82bfad83db15e64a07d0/Flow.jpg",
    a: { payload: "Smartphone", axes: 3, maxPayloadG: 300, batteryLifeHrs: 12, foldable: true } },
  { n: "Flow Pro", t: "Gimbal", s: "flow-pro", w: 366, img: "https://res.insta360.com/static/ff1d72fe62a7e8d1ea2a4ebb2ae5d015/FlowPro.jpg",
    a: { payload: "Smartphone", axes: 3, maxPayloadG: 300, batteryLifeHrs: 12, foldable: true } },
  { n: "Flow 2 Pro", t: "Gimbal", s: "flow-2-pro", w: 357, img: "https://res.insta360.com/static/78cb416d70ba241bfd996b8c8b4032dd/%E5%85%B6%E4%BB%96.jpeg",
    a: { payload: "Smartphone", axes: 3, maxPayloadG: 300, batteryLifeHrs: 10, foldable: true } },

  // ---- wireless mics (weight = single transmitter, disclosed) ----
  { n: "Mic Air", t: "Microphone", s: "mic-air", w: 7.9, tx: true, img: "https://res.insta360.com/dynamic/store/2b7a95fbf845d43f903b51eeee47a024/404_5d6c0633-98f3-4c3e-8e18-a631c94764ff.png",
    a: { wireless: true, transmitters: 2, rangeM: 300, batteryLifeHrs: 10 } },
  { n: "Mic Pro", t: "Microphone", s: "mic-pro", w: 19.7, tx: true, img: "https://wassets.insta360.com/store/4299ac6efa344db79933e1fa29ff8f36/676_bca950b3-df80-49b0-8a56-ec4567aa6812.png",
    a: { wireless: true, transmitters: 2, rangeM: 400, internalRecording: true } },
];

function describe(it) {
  const a = it.a;
  if (it.t === "Camera") {
    const is360 = a.cameraType === "360";
    const bits = [
      is360 ? "dual-lens 360°" : "action",
      a.maxVideoResolution && `up to ${a.maxVideoResolution} video`,
      a.sensorSize && a.sensorSize !== "Dual lens" ? `${a.sensorSize} sensor` : null,
      "FlowState stabilization",
      a.waterproofDepthM ? `waterproof to ${a.waterproofDepthM} m without a case` : null,
    ].filter(Boolean);
    let d = `The Insta360 ${it.n} is a compact ${bits.join(", ")}. Weight ${it.w} g`;
    d += it.pod ? ` (camera unit; the Action Pod adds ~${it.pod} g and is needed for most shooting).` : ".";
    return d;
  }
  if (it.t === "Gimbal") {
    return `The Insta360 ${it.n} is a 3-axis smartphone gimbal stabilizer with AI subject tracking${a.batteryLifeHrs ? ` and ~${a.batteryLifeHrs} h battery` : ""}, folding for travel. Weight ${it.w} g.`;
  }
  // Microphone
  return `The Insta360 ${it.n} is a wireless microphone system (${a.transmitters} transmitters + receiver)${a.rangeM ? `, up to ${a.rangeM} m range` : ""}${a.internalRecording ? ", with onboard backup recording" : ""}. Weight ${it.w} g per transmitter (TX only — the full kit with receiver and case weighs more).`;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, updated = 0; const byType = {};

  // Remove any pre-existing INACTIVE Insta360 stragglers so items insert fresh.
  const stale = await C.find({ brand: BRAND, isActive: false }).select("_id name").lean();
  if (stale.length) {
    console.log(`Cleanup: ${stale.length} inactive Insta360 stragglers → ${stale.map((s) => s.name).join(", ")}`);
    if (COMMIT) { const ids = stale.map((s) => s._id); await O.deleteMany({ productId: { $in: ids } }); await C.deleteMany({ _id: { $in: ids } }); }
  }

  for (const it of ITEMS) {
    const name = `Insta360 ${it.n}`;
    const { category, subcategory } = categoryForItemType(it.t, name);
    byType[it.t] = (byType[it.t] || 0) + 1;
    const set = {
      name, brand: BRAND, itemType: it.t, category, subcategory,
      description: describe(it), imageUrls: [it.img], isActive: true,
      weightGrams: it.w, attributes: it.a,
      variantAxes: [], variants: [], defaultVariantKey: null,
    };
    const existing = await C.findOne({ name, brand: BRAND });
    console.log(`${existing ? "UPD" : "NEW"} ${it.t.padEnd(11)} ${name.padEnd(22)} ${String(it.w).padStart(5)}g  ${JSON.stringify(it.a)}`);
    if (COMMIT) {
      if (existing) { await C.collection.updateOne({ _id: existing._id }, { $set: set }); updated++; }
      else {
        const doc = new C({ ...set, createdBy: ADMIN_ID }); doc.$locals.lenientAttributes = true;
        try { await doc.save(); } catch (e) { console.log(`  !! ${name}: ${e.message}`); continue; }
        await O.create({ network: "direct", region: "global", merchantId: "direct-insta360", merchantName: BRAND, productId: doc._id, deepLink: PDP + it.s, priority: 0 });
        created++;
      }
    }
  }
  console.log(`\nby itemType:`, JSON.stringify(byType));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: created ${created}, updated ${updated} (of ${ITEMS.length})`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
