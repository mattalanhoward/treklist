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

  // Find the BEST offer across all preferred regions
  // MongoDB will return the highest priority offer automatically due to sort
  const offer = await MerchantOffer.findOne({
    productId,
    region: { $in: regions },
  })
    .sort({ priority: -1, updatedAt: -1, createdAt: -1 })
    .lean();

  if (!offer) return null;

  return {
    deepLink: offer.deepLink,
    merchantName: offer.merchantName,
    network: offer.network,
    region: offer.region,
  };
}

module.exports = {
  resolveOfferForProduct,
};
