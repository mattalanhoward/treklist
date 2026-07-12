// Admin-curated featured brand for the add-gear browse zero state.
//
// OPTIONAL and config-driven (decision 6): the featured row is hidden entirely
// when this is null, and it must never influence search relevance — it shows in
// the browse zero state only. Ships hidden (v1); there is no admin config
// surface for it yet.
//
// To feature a brand, set an object:
//   { name, brand, imageUrl?, category? }
//   - name:     display label (e.g. "Atom Packs")
//   - brand:    must match a catalog `brand` value exactly (drives the drill-in)
//   - imageUrl: optional small logo/thumbnail
//   - category: optional top-level category to scope the drill-in
export const FEATURED_BRAND = null;
