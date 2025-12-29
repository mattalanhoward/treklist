// server/src/services/affiliateResolver.js
const MerchantOffer = require("../models/merchantOffer");
const { buildRegionPreferenceChain } = require("../utils/regionPrefs");

/**
 * Resolve the best affiliate offer for a given product + user region.
 *
 * @param {Object} params
 * @param {string|import("mongoose").Types.ObjectId} params.productId - CatalogItem _id
 * @param {string} [params.userRegion="global"] - e.g. "us", "uk", "nl", "de"
 * @returns {Promise<null | {
 *   deepLink: string,
 *   merchantName?: string,
 *   network: string,
 *   region: string
 * }>}
 */
async function resolveOfferForProduct({ productId, userRegion = "global" }) {
  if (!productId) return null;

  const regions = buildRegionPreferenceChain(userRegion);

  // Try regions in order until we find offers
  for (const region of regions) {
    const offer = await MerchantOffer.findOne({ productId, region })
      .sort({ priority: -1, updatedAt: -1, createdAt: -1 })
      .lean();
    if (offer) {
      return {
        deepLink: offer.deepLink,
        merchantName: offer.merchantName,
        network: offer.network,
        region: offer.region,
      };
    }
  }

  // Nothing found in any region
  return null;
}

module.exports = {
  resolveOfferForProduct,
};
