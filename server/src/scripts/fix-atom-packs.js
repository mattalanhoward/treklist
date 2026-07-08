/**
 * fix-atom-packs.js — after splitting Atom Packs by volume (Version codes), every
 * volume inherited the parent's single image and some lacked the right fabric. This
 * re-pulls each active pack's OWN images from its product JSON (deepLink + ".json")
 * and sets mainFabric from the version code (UL=Robic, X=X-Pac, RE/EP=ECOPAK).
 *
 *   node src/scripts/fix-atom-packs.js [--commit]   (local DB only)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

function fabricFor(name) {
  if (/\bUL\d+/.test(name)) return "210D Robic";           // ultralight
  if (/\bX\d+/.test(name)) return "X-Pac";                  // X-Pac
  if (/\bRE\d+/.test(name)) return "Challenge ECOPAK (recycled)";
  if (/\bEP\d+/.test(name)) return "Challenge ECOPAK EPX";
  return null;
}
async function productImages(deepLink) {
  const url = deepLink.split("?")[0].replace(/\/$/, "") + ".json";
  try {
    const { stdout } = await execFileP("curl", ["-s", "--max-time", "30", "-A",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", url], { maxBuffer: 20 * 1024 * 1024 });
    const p = JSON.parse(stdout).product;
    return (p?.images || []).map((i) => i.src).filter(Boolean);
  } catch { return []; }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const packs = await C.find({ brandLC: "atom packs", isActive: { $ne: false },
    itemType: { $in: ["Backpack", "Daypack"] } });

  let imgFixed = 0, fabFixed = 0;
  for (const P of packs) {
    const offer = await O.findOne({ productId: P._id }).lean();
    const imgs = offer?.deepLink ? await productImages(offer.deepLink) : [];
    const fabric = fabricFor(P.name);
    const oldImg = (P.imageUrls || [])[0] || "—";
    const newImg = imgs[0] || oldImg;
    const imgChange = imgs.length && imgs[0] !== oldImg;
    const fabChange = fabric && P.attributes?.mainFabric !== fabric;

    console.log(`"${P.name}"  ${imgChange ? `img→${imgs.length} (${newImg.split("/files/")[1]?.slice(0, 24)})` : "img ok"}  ${fabChange ? `fabric: ${P.attributes?.mainFabric || "—"}→${fabric}` : "fabric ok"}`);
    if (COMMIT && (imgChange || fabChange)) {
      if (imgChange) { P.imageUrls = imgs; imgFixed++; }
      if (fabChange) { P.attributes = { ...(P.attributes || {}), mainFabric: fabric }; P.markModified("attributes"); fabFixed++; }
      P.$locals.lenientAttributes = true;
      await P.save();
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — images fixed:${imgFixed}  fabrics fixed:${fabFixed}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
