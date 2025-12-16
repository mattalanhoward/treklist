// server/src/services/gearItemAffiliateResolver.js
const GearItem = require("../models/gearItem");
const GlobalItem = require("../models/globalItem");
const { resolveOfferForProduct } = require("./affiliateResolver");

/**
 * Resolve an affiliate link for a given GearItem, considering:
 * - direct GearItem.productId
 * - fallback to GlobalItem.productId
 * - final fallback to legacy GlobalItem.affiliate.deepLink
 *
 * @param {Object} params
 * @param {string} params.gearItemId
 * @param {string} [params.userRegion="global"]
 * @returns {Promise<null | {
 *   deepLink: string,
 *   price?: number,
 *   currency?: string,
 *   merchantName?: string,
 *   network?: string,
 *   region?: string,
 *   source: "offer" | "globalItemAffiliate"
 * }>}
 */
async function resolveAffiliateForGearItem({
  gearItemId,
  userRegion = "global",
}) {
  if (!gearItemId) return null;

  // Load GearItem with its GlobalItem reference
  const gearItem = await GearItem.findById(gearItemId)
    .select("productId globalItem link")
    .lean()
    .exec();

  if (!gearItem) return null;

  // 1) Try direct productId on GearItem
  if (gearItem.productId) {
    const offer = await resolveOfferForProduct({
      productId: gearItem.productId,
      userRegion,
    });
    if (offer) {
      return { ...offer, source: "offer" };
    }
  }

  // 2) Fallback to GlobalItem.productId
  if (gearItem.globalItem) {
    const globalItem = await GlobalItem.findById(gearItem.globalItem)
      .select("productId affiliate link")
      .lean()
      .exec();

    if (globalItem && globalItem.productId) {
      const offer = await resolveOfferForProduct({
        productId: globalItem.productId,
        userRegion,
      });
      if (offer) {
        return { ...offer, source: "offer" };
      }

      // 3) Legacy fallback: GlobalItem.affiliate.deepLink
      if (globalItem.affiliate && globalItem.affiliate.deepLink) {
        return {
          deepLink: globalItem.affiliate.deepLink,
          merchantName: globalItem.affiliate.merchantName,
          network: globalItem.affiliate.network,
          region: globalItem.affiliate.region,
          source: "globalItemAffiliate",
        };
      }
    }

    // If no productId but there IS a legacy affiliate blob, still use it
    if (globalItem && globalItem.affiliate && globalItem.affiliate.deepLink) {
      return {
        deepLink: globalItem.affiliate.deepLink,
        merchantName: globalItem.affiliate.merchantName,
        network: globalItem.affiliate.network,
        region: globalItem.affiliate.region,
        source: "globalItemAffiliate",
      };
    }
  }

  // 4) Final fallback: direct link on GearItem (user custom URL)
  if (gearItem.link) {
    return {
      deepLink: gearItem.link,
      source: "globalItemAffiliate",
    };
  }

  return null;
}

module.exports = {
  resolveAffiliateForGearItem,
};
