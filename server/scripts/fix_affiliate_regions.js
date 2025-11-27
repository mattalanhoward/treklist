// scripts/fix_affiliate_regions.js
const mongoose = require("mongoose");
const MerchantOffer = require("../src/models/merchantOffer");
const AffiliateProduct = require("../src/models/affiliateProduct");

(async () => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/treklist";
  await mongoose.connect(uri);

  // Normalize MerchantOffer
  await MerchantOffer.updateMany({}, [
    {
      $set: {
        region: { $toUpper: "$region" },
        itemGroupId: { $toString: "$itemGroupId" },
        merchantId: { $toString: "$merchantId" },
      },
    },
  ]);

  // Normalize AffiliateProduct
  await AffiliateProduct.updateMany({}, [
    {
      $set: {
        region: { $toUpper: "$region" },
        itemGroupId: { $toString: "$itemGroupId" },
        brandLC: { $toLower: "$brand" },
      },
    },
  ]);

  console.log("Normalization complete.");
  await mongoose.disconnect();
})();
