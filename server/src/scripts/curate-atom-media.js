/**
 * curate-atom-media.js
 *
 * Polishes the 5 Atom pack models: a clean 1–2 sentence description (from
 * atompacks.co.uk) with a consistent medium-torso weight note, and a curated
 * 6-image set. Writes via collection.updateOne ($set) — NOT doc.save() — to avoid
 * the pre-save hook touching other fields. (See gotcha-select-save-wipes-fields.)
 *
 *   node src/scripts/curate-atom-media.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const NOTE = "\n\n* Listed weights are based on a Medium torso size; your configuration may vary.";
const IMG = "https://cdn.shopify.com/s/files/1/0275/4317/5261/files/";

const MODELS = {
  "The Atom": {
    desc: "On the trail, it's not just about what you pack—it's about what you choose to leave behind. The Atom is a thoughtfully crafted ultralight pack that embodies the essence of less: hipbeltless, frameless, effortless.",
    imgs: ["DOM_1531.jpg", "DOM_1499.jpg", "DOM_1500.jpg", "DOM_1501.jpg", "DOM_1502.jpg", "DOM_1503.jpg"],
  },
  "The Prospector": {
    desc: "The Prospector (previously known as The Mo) took 12,000 miles of hiking to design: a lightweight, fully featured load hauler, purpose-built to support you on your next adventure.",
    imgs: ["Prospector_50_standard.jpg", "Prospector_50_standard-2.jpg", "Prospector_50_standard-3.jpg", "Prospector_50_standard-4.jpg", "Prospector_50_standard-5.jpg", "Prospector_50_standard-6.jpg"],
  },
  "The Pulse": {
    desc: "The Pulse (previously known as The Atom+) is an ultralight pack that adapts as your trip changes — as your gear, food and water needs shift over a long thru-hike, the Pulse keeps up.",
    imgs: ["Pulse_A_standard.jpg", "Pulse_A_standard-2.jpg", "Pulse_A_standard-3.jpg", "Pulse_A_standard-4.jpg", "Pulse_A_standard-5.jpg", "Pulse_A_standard-6.jpg"],
  },
  "The Notch": {
    desc: "The Notch is a compact yet robust thru-hiking pack, created to be a resilient companion over thousands of miles on the trail.",
    imgs: ["Notch_40_standard.jpg", "Notch_40_standard_-2.jpg", "Notch_40_standard_-3.jpg", "Notch_40_standard_-4.jpg", "Notch_40_standard_-5.jpg", "Notch_40_standard_-6.jpg"],
  },
  "The Nanu": {
    desc: "The Nanu is our go-everywhere day bag — as at home on the commute as it is in the mountains. A stiff sewn-in foam back panel gives great support and shape at any volume.",
    imgs: ["TheNanuRobic-01.jpg", "TheNanuRobic-02.jpg", "TheNanuRobic-03.jpg", "TheNanuRobic-04.jpg", "TheNanuRobic-05.jpg", "TheNanuRobic-06.jpg"],
  },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, cfg] of Object.entries(MODELS)) {
    const doc = await C.findOne({ name, isActive: true, brand: /atom/i }).select("_id").lean();
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    const description = cfg.desc + NOTE;
    const imageUrls = cfg.imgs.map((f) => IMG + f);
    console.log(`${name.padEnd(15)} desc=${description.length}ch imgs=${imageUrls.length}`);
    if (COMMIT) await C.collection.updateOne({ _id: doc._id }, { $set: { description, imageUrls } });
    n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/5`);
  await mongoose.disconnect();
})();
