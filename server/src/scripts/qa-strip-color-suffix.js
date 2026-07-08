/**
 * qa-strip-color-suffix.js — Decathlon-family (SIMOND/QUECHUA/FORCLAZ/Kiprun/
 * Decathlon) names carry the feed's trailing colorway (" - Black"). Color is never
 * product identity → strip the suffix when it is a pure color from the vocabulary.
 * If stripping collides with another active same-brand item (true colorway twins),
 * keep the first, re-point refs, archive the twin. Dry-run default; --commit.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const CatalogItem = require("../models/catalogItem");
const GlobalItem = require("../models/globalItem");
const GearItem = require("../models/gearItem");
const COMMIT = process.argv.includes("--commit");
if (process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const BRANDS = ["simond", "quechua", "forclaz", "kiprun", "decathlon"];
const COLORS = ["black", "grey", "gray", "blue", "red", "brown", "beige", "pink", "white",
  "orange", "yellow", "khaki", "navy", "green", "purple", "turquoise", "burgundy", "undyed",
  "light grey", "dark grey", "smoky black", "purple sage", "off-white", "ochre", "carbon grey"];
const RE = new RegExp(`\\s+-\\s+(${COLORS.join("|").replace(/ /g, "\\s")})$`, "i");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: "treklist_local" });
  const items = await CatalogItem.find({ brandLC: { $in: BRANDS }, isActive: { $ne: false } }).select("name brandLC").lean();
  const nameSet = {};
  items.forEach((i) => (nameSet[`${i.brandLC}||${i.name}`] = i));
  const claimed = {};
  for (const i of items) {
    const m = i.name.match(RE);
    if (!m) continue;
    const stripped = i.name.replace(RE, "").trim();
    const key = `${i.brandLC}||${stripped}`;
    const clash = nameSet[key] || claimed[key];
    if (clash) {
      // colorway twin: keep the existing/first, archive this one after re-point
      const g = await GlobalItem.countDocuments({ productId: i._id });
      const gi = await GearItem.countDocuments({ productId: i._id });
      console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} TWIN "${i.name}" -> archive (dup of "${stripped}", refs ${g}/${gi})`);
      if (COMMIT) {
        if (g) await GlobalItem.collection.updateMany({ productId: i._id }, { $set: { productId: clash._id } });
        if (gi) await GearItem.collection.updateMany({ productId: i._id }, { $set: { productId: clash._id } });
        await CatalogItem.collection.updateOne({ _id: i._id }, { $set: { isActive: false } });
      }
    } else {
      claimed[key] = i;
      console.log(`${COMMIT ? "[COMMIT]" : "[dry]"} "${i.name}" -> "${stripped}"`);
      if (COMMIT) await CatalogItem.collection.updateOne({ _id: i._id }, { $set: { name: stripped } });
    }
  }
  await mongoose.disconnect();
})();
