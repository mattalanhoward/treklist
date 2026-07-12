// src/utils/weightDisclosure.js
// Builds the honest "precision disclosure" line shown under a weight hero
// (add-gear decision 13 / memory rule feedback_flat_weight_disclosure):
//   "Manufacturer spec · flat across sizes · verified Jul 2026"
// Never lets the number look more precise than it is.

// Month-year "verified" stamp for the disclosure line.
export function verifiedStamp(dateish, locale) {
  const d = dateish ? new Date(dateish) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString(locale || undefined, { month: "short", year: "numeric" });
  } catch {
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
}

/**
 * @param {object}   opts
 * @param {Function} opts.t         i18n translator (common namespace)
 * @param {string}   opts.locale    active locale (for the verified stamp)
 * @param {boolean}  opts.hasVariants
 * @param {Array}    opts.variants  variant docs (checked for distinct weights)
 * @param {string}   opts.updatedAt catalog item updatedAt (verified stamp)
 * @returns {string} the disclosure line
 */
export function buildWeightDisclosure({ t, locale, hasVariants, variants, updatedAt }) {
  const parts = [t("catalogPreview.disclosure.manufacturerSpec", "Manufacturer spec")];
  if (hasVariants && Array.isArray(variants)) {
    // "flat across sizes": variants carry no distinct per-variant weight.
    const vw = variants.map((v) => v.weightGrams).filter((n) => typeof n === "number");
    if (vw.length === 0 || new Set(vw).size <= 1) {
      parts.push(t("catalogPreview.disclosure.flatAcrossSizes", "flat across sizes"));
    }
  }
  const stamp = verifiedStamp(updatedAt, locale);
  if (stamp) {
    parts.push(t("catalogPreview.disclosure.verified", "verified {{date}}", { date: stamp }));
  }
  return parts.join(" · ");
}
