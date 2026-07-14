// src/utils/weightDisclosure.js
// Builds the honest "precision disclosure" line shown under a weight hero
// (add-gear decision 13 / memory rule feedback_flat_weight_disclosure):
//   "Manufacturer spec · flat across sizes"
// Never lets the number look more precise than it is. The "verified {date}"
// stamp was dropped — it implied a hands-on verification that never happened.

/**
 * @param {object}   opts
 * @param {Function} opts.t         i18n translator (common namespace)
 * @param {boolean}  opts.hasVariants
 * @param {Array}    opts.variants  variant docs (checked for distinct weights)
 * @returns {string} the disclosure line
 */
export function buildWeightDisclosure({ t, hasVariants, variants }) {
  const parts = [t("catalogPreview.disclosure.manufacturerSpec", "Manufacturer spec")];
  if (hasVariants && Array.isArray(variants)) {
    // "flat across sizes": variants carry no distinct per-variant weight.
    const vw = variants.map((v) => v.weightGrams).filter((n) => typeof n === "number");
    if (vw.length === 0 || new Set(vw).size <= 1) {
      parts.push(t("catalogPreview.disclosure.flatAcrossSizes", "flat across sizes"));
    }
  }
  return parts.join(" · ");
}
