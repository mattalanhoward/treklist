/**
 * create-dji.js — DJI (store.dji.com), custom SSR e-commerce, NO open feed and curl is
 * bot-redirected (302 to locale). Done by RENDERED SCRAPE: WebFetch reads the store PDPs
 * and the dji.com/<slug>/specs marketing pages; the se-cdn.djiits.com image CDN is not
 * walled. Enumerated from the per-country sitemap (assets.djicdn.com/sitemap/store).
 *
 * Scope (user, 2026-08-13): the carry-able subset only — cameras, phone gimbals, wireless
 * mics, and ultralight-ish drones. NOT the 3,019-item full catalog (drones parts / motors
 * / props / ESC / solar / enterprise all skipped). 21 items across 4 NEW itemTypes
 * (Camera / Drone / Gimbal / Microphone → Electronics & Power / Photo & Video).
 *
 * Weights: device body (cameras), gimbal (gimbals), single transmitter TX (mics,
 * disclosed in the description), takeoff weight incl. battery (drones). Sourced per-PDP;
 * 4 that the SPA hid (Osmo 360 183 g, Osmo Nano 52 g, Mini 4K 246 g, orig. DJI Mic TX
 * 30 g) came from DJI's published figures via web search.
 *
 * deepLinks are locale-neutral (store.dji.com/product/<slug>, auto-geolocates per
 * visitor). Unmonetized direct offers for now (affiliate approval pending, cf. MEC).
 *
 *   node src/scripts/create-dji.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const BRAND = "DJI";
const PDP = "https://store.dji.com/product/";
const IMG = (h) => "https:" + h.replace(/\?format=webp$/, "");

// name, itemType, store slug, weight g, image (CDN path), attributes, note (appended to desc)
const ITEMS = [
  // ---- Cameras ----
  { n: "Osmo Pocket 3", t: "Camera", s: "osmo-pocket-3", w: 179, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/1a512ce2319f4309eb1c5bc4682273ed@ultra.jpg",
    a: { cameraType: "Pocket / Gimbal", sensorSize: "1-inch", maxVideoResolution: "4K", maxFrameRateFps: 120, stabilization: "Mechanical Gimbal", batteryLifeMin: 166 } },
  { n: "Osmo Pocket 4", t: "Camera", s: "osmo-pocket-4", w: 191, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/d94b26866e0ca4fcd4b0a312eddbd9b4@ultra.jpg",
    a: { cameraType: "Pocket / Gimbal", sensorSize: "1-inch", maxVideoResolution: "4K", maxFrameRateFps: 120, stabilization: "Mechanical Gimbal" } },
  { n: "Osmo 360", t: "Camera", s: "osmo-360-standard-combo", w: 183, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/b2065e9d8e1f834362c7ec88b3443edf@ultra.jpg",
    a: { cameraType: "360", sensorSize: "Dual lens", maxVideoResolution: "8K", stabilization: "Electronic (EIS)" } },
  { n: "Osmo Action 5 Pro", t: "Camera", s: "osmo-action-5-pro", w: 146, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/2f3e608557f64b064bf68c07c1a234c8@ultra.jpg",
    a: { cameraType: "Action", sensorSize: "1/1.3-inch", maxVideoResolution: "4K", maxFrameRateFps: 120, stabilization: "Electronic (EIS)", waterproofDepthM: 20, batteryLifeMin: 240 } },
  { n: "Osmo Action 4", t: "Camera", s: "osmo-action-4", w: 145, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/fa6ff9c44b34e9638cbff1d3d9bfbcce@ultra.jpg",
    a: { cameraType: "Action", sensorSize: "1/1.3-inch", maxVideoResolution: "4K", maxFrameRateFps: 120, stabilization: "Electronic (EIS)", waterproofDepthM: 18, batteryLifeMin: 160 } },
  { n: "Osmo Action 3", t: "Camera", s: "osmo-action-3", w: 145, img: "//se-cdn.djiits.com/tpc/uploads/spu/cover/8487377d5efe278820978a80013cfc33@ultra.png",
    a: { cameraType: "Action", sensorSize: "1/1.7-inch", maxVideoResolution: "4K", maxFrameRateFps: 120, stabilization: "Electronic (EIS)", waterproofDepthM: 16, batteryLifeMin: 160 } },
  { n: "Osmo Nano", t: "Camera", s: "osmo-nano", w: 52, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/614e0069ed59294a6f46a198daf1d848@ultra.jpg",
    a: { cameraType: "Action", sensorSize: "1/1.3-inch", maxVideoResolution: "4K", maxFrameRateFps: 120, stabilization: "Electronic (EIS)", waterproofDepthM: 10 } },

  // ---- Gimbals (phone stabilizers) ----
  { n: "Osmo Mobile 7", t: "Gimbal", s: "osmo-mobile-7", w: 300, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/1fde272fa0c6065b410b9e2954d79453@ultra.jpg",
    a: { payload: "Smartphone", axes: 3, maxPayloadG: 300, batteryLifeHrs: 10, foldable: true } },
  { n: "Osmo Mobile 7P", t: "Gimbal", s: "osmo-mobile-7p", w: 368, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/f2d4dd9b58d99cc71339fb56e80a1d2c@ultra.jpg",
    a: { payload: "Smartphone", axes: 3, maxPayloadG: 300, batteryLifeHrs: 10, foldable: true } },
  { n: "Osmo Mobile SE", t: "Gimbal", s: "osmo-mobile-se", w: 352, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/cc63bd53af7522969d4d52d25fa5aea9@ultra.jpg",
    a: { payload: "Smartphone", axes: 3, maxPayloadG: 290, batteryLifeHrs: 8, foldable: true } },

  // ---- Microphones (weight = single transmitter, disclosed) ----
  { n: "DJI Mic", t: "Microphone", s: "dji-mic", w: 30, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/fcf140123d4304e3684f2cc08c62ae98@ultra.jpg",
    a: { wireless: true, transmitters: 2, rangeM: 250, internalRecording: true, batteryLifeHrs: 5.5 }, tx: true },
  { n: "DJI Mic 2", t: "Microphone", s: "dji-mic-2", w: 28, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/80d0d2c23c4e3a0cddcc6d0ac78916e4@ultra.jpg",
    a: { wireless: true, transmitters: 2, rangeM: 250, internalRecording: true, batteryLifeHrs: 6 }, tx: true },
  { n: "DJI Mic 3", t: "Microphone", s: "dji-mic-3", w: 12.5, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/6ab616068e23d2c0cf9678276b6db4a0@ultra.jpg",
    a: { wireless: true, transmitters: 2, rangeM: 400, internalRecording: true, batteryLifeHrs: 8 }, tx: true },
  { n: "DJI Mic Mini", t: "Microphone", s: "dji-mic-mini", w: 10, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/241e8c793e5526746a3e73ced3e94a1a@ultra.jpg",
    a: { wireless: true, transmitters: 2, rangeM: 400, internalRecording: false, batteryLifeHrs: 11.5 }, tx: true },
  { n: "DJI Mic Mini 2", t: "Microphone", s: "dji-mic-mini-2", w: 11, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/e67675980682d1172803a9b23019bc36@ultra.jpg",
    a: { wireless: true, transmitters: 2, rangeM: 400, batteryLifeHrs: 11.5 }, tx: true },

  // ---- Drones (weight = takeoff weight incl. battery) ----
  { n: "DJI Neo", t: "Drone", s: "dji-neo", w: 135, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/f95526e58365e41bce29a7fdf48ff0b4@ultra.jpg",
    a: { takeoffWeightG: 135, maxFlightTimeMin: 18, maxVideoResolution: "4K", sensorSize: "1/2-inch", obstacleSensing: "Downward" } },
  { n: "DJI Flip", t: "Drone", s: "dji-flip", w: 249, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/ff214d869bc96008e29aaed683700be4@ultra.jpg",
    a: { takeoffWeightG: 249, maxFlightTimeMin: 31, maxRangeKm: 10, maxVideoResolution: "4K", sensorSize: "1/1.3-inch", obstacleSensing: "Multi-directional" } },
  { n: "DJI Mini 4 Pro", t: "Drone", s: "dji-mini-4-pro", w: 249, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/56164c524942bae3dbead828f388a8bf@ultra.jpg",
    a: { takeoffWeightG: 249, maxFlightTimeMin: 34, maxRangeKm: 20, maxVideoResolution: "4K", sensorSize: "1/1.3-inch", obstacleSensing: "Omnidirectional" } },
  { n: "DJI Mini 4K", t: "Drone", s: "dji-mini-4k", w: 246, img: "//se-cdn.djiits.com/tpc/uploads/spu/cover/3e3d9bcda7e0444fe98fb0e66b7c77a1@ultra.png",
    a: { takeoffWeightG: 246, maxFlightTimeMin: 31, maxRangeKm: 10, maxVideoResolution: "4K", sensorSize: "1/2.3-inch", obstacleSensing: "Downward" } },
  { n: "DJI Mini 3", t: "Drone", s: "dji-mini-3", w: 248, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/034549ecfb292e6d6b28653e8d0ff289@ultra.jpg",
    a: { takeoffWeightG: 248, maxFlightTimeMin: 38, maxRangeKm: 10, maxVideoResolution: "4K", sensorSize: "1/1.3-inch", obstacleSensing: "Downward" } },
  { n: "DJI Air 3S", t: "Drone", s: "dji-air-3s", w: 724, img: "//se-cdn.djiits.com/tpc/uploads/carousel/image/d4a1adddd5c1ebe61cbd4b5b54107345@ultra.jpg",
    a: { takeoffWeightG: 724, maxFlightTimeMin: 45, maxRangeKm: 20, maxVideoResolution: "4K", sensorSize: "1-inch", obstacleSensing: "Omnidirectional" } },
];

function describe(it) {
  const a = it.a;
  if (it.t === "Camera") {
    const bits = [a.sensorSize && `${a.sensorSize} sensor`, a.maxVideoResolution && `up to ${a.maxVideoResolution}${a.maxFrameRateFps ? `/${a.maxFrameRateFps}fps` : ""}`,
      a.stabilization === "Mechanical Gimbal" ? "3-axis mechanical gimbal stabilization" : a.stabilization === "Electronic (EIS)" ? "electronic image stabilization" : null,
      a.waterproofDepthM ? `waterproof to ${a.waterproofDepthM} m without a case` : null].filter(Boolean);
    return `The DJI ${it.n} is a compact ${a.cameraType === "360" ? "360° " : a.cameraType === "Action" ? "action " : "vlogging "}camera — ${bits.join(", ")}. Weight ${it.w} g.`;
  }
  if (it.t === "Gimbal") {
    return `The DJI ${it.n} is a 3-axis smartphone gimbal stabilizer${a.batteryLifeHrs ? ` with ~${a.batteryLifeHrs} h battery life` : ""}, folding for travel. Weight ${it.w} g (gimbal only).`;
  }
  if (it.t === "Microphone") {
    return `The DJI ${it.n} is a 2.4 GHz wireless microphone system (${a.transmitters} transmitters + receiver)${a.rangeM ? `, up to ${a.rangeM} m range` : ""}${a.internalRecording ? ", with onboard backup recording" : ""}. Weight ${it.w} g per transmitter (TX only — the full kit with receiver and charging case weighs more).`;
  }
  // Drone
  return `The DJI ${it.n} is a foldable camera drone — ${a.takeoffWeightG} g takeoff weight${a.maxFlightTimeMin ? `, up to ${a.maxFlightTimeMin} min flight time` : ""}${a.maxRangeKm ? `, ${a.maxRangeKm} km transmission range` : ""}${a.sensorSize ? `, ${a.sensorSize} camera sensor` : ""}. Takeoff weight includes the battery, propellers and microSD card.`;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, updated = 0; const byType = {};

  // Clean up pre-existing INACTIVE DJI stragglers (old "Other"-typed entries with stale
  // offers: "Osmo Action 4/5", "Mic 3 Transmitter") so every item below inserts fresh
  // with a correct DJI store offer (avoids inheriting a stale deepLink on the name match).
  const stale = await C.find({ brand: BRAND, isActive: false }).select("_id name").lean();
  if (stale.length) {
    console.log(`Cleanup: ${stale.length} inactive DJI stragglers → ${stale.map((s) => s.name).join(", ")}`);
    if (COMMIT) {
      const ids = stale.map((s) => s._id);
      await O.deleteMany({ productId: { $in: ids } });
      await C.deleteMany({ _id: { $in: ids } });
    }
  }

  for (const it of ITEMS) {
    const name = it.n.startsWith("DJI") || it.n.startsWith("Osmo") ? it.n : `DJI ${it.n}`;
    const { category, subcategory } = categoryForItemType(it.t, name);
    byType[it.t] = (byType[it.t] || 0) + 1;
    const desc = describe(it);
    const set = {
      name, brand: BRAND, itemType: it.t, category, subcategory,
      description: desc, imageUrls: [IMG(it.img)], isActive: true,
      weightGrams: it.w, attributes: it.a,
      variantAxes: [], variants: [], defaultVariantKey: null,
    };
    const existing = await C.findOne({ name, brand: BRAND });
    console.log(`${existing ? "UPD" : "NEW"} ${it.t.padEnd(11)} ${name.padEnd(20)} ${String(it.w).padStart(4)}g  ${JSON.stringify(it.a)}`);
    if (COMMIT) {
      if (existing) { await C.collection.updateOne({ _id: existing._id }, { $set: set }); updated++; }
      else {
        const doc = new C({ ...set, createdBy: ADMIN_ID }); doc.$locals.lenientAttributes = true;
        try { await doc.save(); } catch (e) { console.log(`  !! ${name}: ${e.message}`); continue; }
        await O.create({ network: "direct", region: "global", merchantId: "direct-dji", merchantName: BRAND, productId: doc._id, deepLink: PDP + it.s, priority: 0 });
        created++;
      }
    }
  }
  console.log(`\nby itemType:`, JSON.stringify(byType));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: created ${created}, updated ${updated} (of ${ITEMS.length})`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
