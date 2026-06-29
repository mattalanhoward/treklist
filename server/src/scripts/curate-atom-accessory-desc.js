/**
 * curate-atom-accessory-desc.js
 *
 * Trims the dimension/weight spec tables out of the Atom accessory descriptions
 * (Thinny, Roo RE, Hipbelt Pocket, Pack Liner) — that data now lives in
 * structured attributes. Clean 1–2 sentence intros, written via collection
 * updateOne ($set description) to stay hook-safe.
 *
 *   node src/scripts/curate-atom-accessory-desc.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const DESC = {
  "The Thinny - 3mm (1/8 inch) Foam Sleeping Mat": "The Atom Packs Thinny is an ultralight sleeping mat made from 3mm closed-cell foam — perfect for boosting the R-rating of your existing mat, protecting it from the ground while cowboy camping, or doubling as a sit pad. A great multipurpose addition to your kit, available in three sizes.",
  "The Roo RE": "In town or on trail: you decide. The Roo RE is our go-everywhere bum bag — use it on its own or as a complement to your backpack, with everything you need right at your fingertips. Available in two sizes.",
  "The Hipbelt Pocket": "Made from strong, ultralight Robic, the Hipbelt Pocket is super-handy and completely removable — add extra storage to any of our padded hip belts as you need it. Not compatible with our webbing hip belts.",
  "Pack Liner": "Designed to fit the shape of Atom Packs, the Pack Liner is a simple, reliable way to keep your gear dry. Made from ultralight, waterproof D50T fabric with bonded seams, it creates a waterproof barrier inside your pack.",
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, description] of Object.entries(DESC)) {
    const it = await C.findOne({ name, isActive: true, brand: /atom/i }).select("_id description").lean();
    if (!it) { console.log(`!! ${name}`); continue; }
    console.log(`${name.slice(0, 30).padEnd(31)} ${it.description.length} -> ${description.length}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description } });
    n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/4`);
  await mongoose.disconnect();
})();
