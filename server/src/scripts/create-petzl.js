/**
 * create-petzl.js — Petzl (petzl.com), Salesforce Commerce Cloud + PerimeterX/Cloudflare
 * — NO open feed and curl/node are hard-blocked (302 to a bot challenge). BUT the
 * consumer site RENDERS via a real browser: WebFetch (headless Chrome) reads the product
 * pages fine, and the SFC image CDN (petzl.com/sfc/servlet.shepherd/...) is NOT walled
 * (loads via curl). So this brand is done by **rendered scrape**, not a feed.
 *
 * Scope (user): recreational headlamps. Specs (weight/lumens/beam/battery/IP/price/image)
 * were scraped per PDP from petzl.com/US/en/Sport/Headlamps/<SLUG> (2026-08-07) and
 * encoded below. The 10 mainstream models; skipped Tikkid (kids), Duo (pro/rope-access),
 * and the Aria RGB hunting lights as out of backpacking scope.
 *
 *   node src/scripts/create-petzl.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const IMG = "https://www.petzl.com/sfc/servlet.shepherd/version/download/";
const PDP = "https://www.petzl.com/US/en/Sport/Headlamps/";
const HYB = "Hybrid", USB = "Rechargeable (USB-C)";

// name, slug, weight g, lumens, beam m, battery type, mAh (rechargeable), IP, price $, image id
const H = [
  { n: "Actik Core", s: "ACTIK-CORE", w: 88, lm: 625, bm: 115, bat: HYB, mah: 1250, price: 87.95, img: "068Tx000006KwpDIAS" },
  { n: "Actik", s: "ACTIK", w: 98, lm: 625, bm: 115, bat: HYB, price: 64.95, img: "068Tx000006KhqIIAS" },
  { n: "Tikka", s: "TIKKA", w: 94, lm: 450, bm: 75, bat: HYB, price: 34.95, img: "068Tx00000BWDtSIAX" },
  { n: "Tikkina", s: "TIKKINA", w: 92, lm: 300, bm: 65, bat: HYB, price: 19.95, img: "068Tx000006L3h3IAC" },
  { n: "Tikka Core", s: "TIKKA-CORE", w: 84, lm: 450, bm: 75, bat: HYB, mah: 1250, price: 62.95, img: "068Tx000006L5Z9IAK" },
  { n: "Swift RL", s: "SWIFT-RL", w: 92, lm: 1200, bm: 168, bat: USB, mah: 2250, price: 134.95, img: "068Tx00000DjjT1IAJ" },
  { n: "Swift RL Classic", s: "SWIFT-RL-CLASSIC", w: 95, lm: 1200, bm: 168, bat: USB, mah: 2250, price: 134.95, img: "068Tx00000HaXN3IAN" },
  { n: "Swift LT", s: "SWIFT-LT", w: 43, lm: 380, bm: 70, bat: USB, mah: 880, price: 54.95, img: "068Tx00000C0noEIAR" },
  { n: "Nao RL", s: "NAO-RL", w: 145, lm: 1500, bm: 200, bat: USB, mah: 3200, price: 199.95, img: "068Tx000004eCOUIA2" },
  { n: "Nao LT", s: "NAO-LT", w: 90, lm: 600, bm: 75, bat: HYB, mah: 1250, price: 99.95, img: "068Tx00000M54SwIAJ" },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let done = 0;
  for (const h of H) {
    const name = `Petzl ${h.n}`;
    const attributes = {
      maxLumens: h.lm, maxBeamDistance: h.bm, batteryType: h.bat, ipRating: "IPX4",
      ...(h.mah ? { batteryCapacityMah: h.mah } : {}),
    };
    const desc =
      `The Petzl ${h.n} headlamp: ${h.w} g, up to ${h.lm} lumens with a ${h.bm} m beam, ` +
      `${h.bat === USB ? "USB-C rechargeable" : "runs on AAA batteries or the CORE rechargeable battery"}` +
      `${h.mah ? ` (${h.mah} mAh)` : ""}. IPX4 weather-resistant. Approx. US$${h.price.toFixed(2)}.`;
    console.log(`Headlamp  ${name.padEnd(24)} ${h.w}g ${h.lm}lm ${h.bm}m ${h.bat}`);
    if (COMMIT) {
      if (await C.findOne({ name, brand: "Petzl" })) { console.log("  exists — skip"); continue; }
      const doc = new C({
        name, brand: "Petzl", itemType: "Headlamp", category: "Electronics & Power", subcategory: "Headlamps",
        description: desc, imageUrls: [IMG + h.img], createdBy: ADMIN_ID, isActive: true,
        weightGrams: h.w, attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`  !! ${name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-petzl", merchantName: "Petzl", productId: doc._id, deepLink: PDP + h.s, priority: 0 });
      done++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${COMMIT ? done + " created" : H.length + " headlamps"}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
