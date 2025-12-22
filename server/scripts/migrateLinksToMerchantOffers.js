const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");

// NOTE: script lives in server/scripts, models live in server/src/models
const CatalogItem = require("../src/models/catalogItem");
const MerchantOffer = require("../src/models/merchantOffer");

function marketplaceFromAmazonUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const h = host.replace(/^smile\./, "").replace(/^www\./, "");
    if (h === "amazon.com") return "us";
    if (h === "amazon.co.uk") return "uk";
    if (h === "amazon.de") return "de";
    if (h === "amazon.fr") return "fr";
    if (h === "amazon.it") return "it";
    if (h === "amazon.es") return "es";
    if (h === "amazon.nl") return "nl";
    if (h === "amazon.ca") return "ca";
    if (h === "amazon.se") return "se";
    if (h === "amazon.pl") return "pl";
    return null;
  } catch {
    return null;
  }
}

function slugifyMerchantId(network, merchantName) {
  const base = (merchantName || "unknown")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${network}-${base || "unknown"}`;
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGO_URI/MONGODB_URI in env.");

  await mongoose.connect(uri);
  console.log("Connected.");
  console.log("URI:", uri);
  console.log("DB name:", mongoose.connection.name);
  console.log("CatalogItem collection:", CatalogItem.collection.name);

  const total = await CatalogItem.collection.estimatedDocumentCount();
  console.log("CatalogItem docs:", total);

  const withLinks = await CatalogItem.collection.countDocuments({
    links: { $exists: true, $type: "array", $ne: [] },
  });
  console.log("Docs with legacy links:", withLinks);

  // ✅ Use the native collection cursor so legacy `links` are included even if schema no longer has them
  const cursor = CatalogItem.collection.find({});

  let migratedOffers = 0;
  let touchedItems = 0;
  let itemsWithLinks = 0;

  while (await cursor.hasNext()) {
    const raw = await cursor.next();

    const links = Array.isArray(raw.links) ? raw.links : [];
    if (!links.length) continue;

    itemsWithLinks += 1;

    const ops = [];

    for (const l of links) {
      const network = String(l.network || "")
        .trim()
        .toLowerCase();
      const region = String(l.region || "global")
        .trim()
        .toLowerCase();
      const deepLink = String(l.url || "").trim();

      if (!network || !deepLink) continue;

      const merchantName = l.merchantName
        ? String(l.merchantName).trim()
        : undefined;

      const externalProductIdRaw =
        l.externalId || raw.canonicalAsin || raw.externalIds?.asin || undefined;

      const externalProductId =
        externalProductIdRaw != null && String(externalProductIdRaw).trim()
          ? String(externalProductIdRaw).trim()
          : undefined;

      let merchantId;
      if (network === "amazon") {
        const marketplace = marketplaceFromAmazonUrl(deepLink);
        merchantId = marketplace ? `amazon-${marketplace}` : "amazon-unknown";
      } else {
        merchantId = slugifyMerchantId(network, merchantName);
      }

      // Use a filter that prevents accidental dupes
      ops.push({
        updateOne: {
          filter: {
            productId: raw._id,
            network,
            region,
            merchantId,
            deepLink,
          },
          update: {
            $set: {
              productId: raw._id,
              network,
              region,
              merchantId,
              merchantName:
                merchantName || (network === "amazon" ? "Amazon" : undefined),
              itemGroupId: raw.itemGroupId || undefined,
              externalProductId,
              deepLink,
              priority:
                typeof l.priority === "number"
                  ? l.priority
                  : Number(l.priority) || 0,
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length) {
      await MerchantOffer.bulkWrite(ops, { ordered: false });
      migratedOffers += ops.length;
      touchedItems += 1;
    }

    // Remove legacy links from the CatalogItem document
    await CatalogItem.collection.updateOne(
      { _id: raw._id },
      { $unset: { links: "" } }
    );
  }

  console.log(`Items that had legacy links: ${itemsWithLinks}`);
  console.log(`Touched items (>=1 offer upsert attempted): ${touchedItems}`);
  console.log(`Offer upserts attempted: ${migratedOffers}`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
