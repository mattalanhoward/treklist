# Admin Gear-Catalog Editor — Redesign Handoff

_Created 2026-07-02. Goal: hand this to a planning model to produce an implementation plan, then build. It is a requirements + current-state + data-model + gotchas brief. Nothing here is built yet._

## 1. Why (the problem)

The admin catalog editor is **one long monolithic modal** (`client/src/pages/AdminView.jsx`, ~1900+ lines; the Edit/Create modal). It works for flat items but has two blocking gaps:

1. **No variant editor.** Many catalog items have a variant matrix (`variantAxes` + `variants[]`) — e.g. Osprey packs (Volume × Torso), Katabatic Flex Quilt (Temperature × Size × Fill, 60 variants), CNOC (Thread × Volume), Nemo bags (Temp × Length). **The modal cannot view or edit variants at all**, so you can't set per-variant `weightGrams`/attributes. This is why the **Nemo items (and others) are stuck weightless** — the data structure exists but there's no UI to fill it. Confirmed gap: the form state (`AdminView.jsx` ~line 306) has no `variants`/`variantAxes`/`defaultVariantKey`, AND the backend PATCH whitelist (`server/src/routes/adminCatalogItems.js` ~line 540) does not accept them either. So variants are 100% unmanaged in the admin.
2. **Monolithic modal is hard to scan.** Item details, attributes (per-type, required + optional), weight/dims, description, images, prefill, and offers are all in one tall scroll. Wants a **tabbed** layout.

Immediate user need: **clear the "yellow"/incomplete items** — rows flagged as needing attention (missing weight, missing required attributes, or broken image URL). The variant editor + a completeness view are what unblock this.

## 2. What to build (high level)

Redesign the **Edit/Create Catalog Item** experience into a **tabbed editor** with a dedicated **Variants tab** (and a variant-row editor modal), plus surface item **completeness** so incomplete ("yellow") items are findable and fixable. Keep the existing create/edit/prefill/offer capabilities; add variant management; split into tabs.

### Proposed tabs (single item editor)
1. **Details** — name, brand, model number, category, subcategory, itemType. (Category/subcategory/itemType drive which attributes + which variant axes make sense.)
2. **Attributes** — the per-itemType structured attributes (required + optional), rendered from the schema (see §4). This is the base/default attributes.
3. **Variants** — the crux (see §5). Manage `variantAxes` + `variants[]`; per-variant `weightGrams` + optional per-variant attribute overrides; set `defaultVariantKey`. Bulk weight entry.
4. **Media & Description** — image URLs (reorder, primary = first), description, prefill-from-Amazon.
5. **Offers** — the MerchantOffer editor (network/region/URL/merchant/external id, priority, add/remove). Already exists — move into a tab.

A "completeness" indicator per tab (e.g. red dot if required fields/weights missing) helps clear yellow items.

## 3. Current architecture (where things live)

- **Frontend:** `client/src/pages/AdminView.jsx` — the admin catalog table + the Edit/Create modal (`form` state ~L306; modal render further down). Table columns incl. Name/Brand/Weight/Image-status. `client/src/components/VariantSelector.jsx` = a **read-only** pill display of axes (used in the customer add/preview modals) — it is NOT an editor and renders every axis value with no disabling of invalid combos.
- **Backend routes:** `server/src/routes/adminCatalogItems.js`
  - `GET /api/admin/catalog-items` (list; filters: q, category, brand, isActive, skip/limit, sort)
  - `GET /api/admin/catalog-items/item-types` (valid itemTypes) · `GET .../brands` (distinct brands, added 2026-07-01)
  - `POST /api/admin/catalog-items` (create) · `PATCH /api/admin/catalog-items/:id` (update; **allowedFields whitelist ~L540 — MUST add variantAxes/variants/defaultVariantKey**) · `PATCH .../:id/archive`
- **Model:** `server/src/models/catalogItem.js` — pre-save `normalize` hook validates + rewrites attributes (see §6 gotchas). `server/src/models/merchantOffer.js`.
- **Attribute + taxonomy config:** `server/src/config/attributeSchemas.js` (`validateAttributes`, `getSchemaForItemType`, `getAllItemTypes`) and `server/src/config/inferItemType.js` (`categoryForItemType`, `CATEGORY_BY_ITEM_TYPE`, gender/footwear helpers).

## 4. Data model (the editor must respect this)

**CatalogItem** (key fields):
```
name (req), brand, brandLC, itemType (enum, drives attribute schema + category),
category, subcategory, description, imageUrls[], tags[], dimensions{length,width,height,unit:"cm",note},
weightGrams (base/default weight), canonicalAsin, itemGroupId, createdBy (req), isActive,
attributes { ... }                     // BASE attributes, validated against itemType schema
variantAxes: [ { name, values:[...] } ] // e.g. [{name:"Volume",values:["50L","65L"]},{name:"Torso Size",values:["S/M","L/XL"]}]
variants: [ { key, options:{<axisName>:val,...}, weightGrams, sku, attributes:{...} } ]
                                        // key = axis values joined by " / " in axis order
defaultVariantKey                       // which variant is the default (its weight/attrs are the item's shown default)
```
- **Variant `attributes` merge OVER base `attributes`** on the client (both customer modals do this) — so a variant can override e.g. `volumeLiters`, `torsoFitRange`, `fillPower`, `loadCapacityKg`, and the UI swaps them when that variant is selected.
- Convention: **color does NOT get an axis** (collapse it); only weight/spec-varying axes (Volume, Torso Size, Temperature, Fill, Thread, Size, Length). Ragged matrices exist (e.g. Osprey Talon: only the 44L has torso sizes) — handled by a single combined axis with explicit variants, because the read-only selector can't disable invalid combos.

**MerchantOffer** (one per item, linked by `productId` = CatalogItem `_id`):
```
network (req: "amazon"|"awin"|"direct"), region (req, e.g. "global"), merchantId (req), merchantName,
productId (ref CatalogItem), externalProductId (ASIN / Awin id), deepLink (req), priority
```
- ⚠ **Offers do NOT route per-variant.** `pickBestOffer()` returns one offer per item regardless of selected variant; `variantKey` is not on the offer. So one buy-link per item today. (There's a documented future task — `project-per-variant-offer-routing` — to add variant-level offers; the redesign's Variants tab should leave room for a per-variant offer/ASIN field later, but it's out of scope for v1.)

**Attribute schemas** (`attributeSchemas.js`): per-itemType `fields` map, each field: `{ type: number|enum|boolean|string, required, label, unit, min, max, options:[...] }`. `validateAttributes(itemType, attrs, {strict})` returns `{valid, errors, cleaned, derived}` — **it only keeps fields defined in the schema** (unknown keys dropped) and enforces enums/min/max. Examples: Backpack (volumeLiters req, gender req, frameType enum, …), Quilt (insulationType, tempRatingC/F, fillPower enum, widthSize…), Water Bottle (capacity req, material enum [Plastic/Steel/Aluminum/Glass/Silicone] — note: no TPU), Daypack (no backPanelType/mainFabric; volumeLiters max 40), Toiletry (empty fields = freeform-stripped, see §6).

## 5. The Variants tab (the core new feature) — requirements

The editor must let an admin, for a given item:
- **Define axes**: add/rename/remove a variant axis (name + ordered values). Common axes: Volume, Torso Size, Temperature, Fill, Thread, Size, Length. Support 1–3 axes.
- **Generate/edit the variant matrix**: from the axes, show the variant rows (cartesian product OR an explicit ragged set). For each variant row, edit: **`weightGrams`** (the main gap), `sku`, and **optional per-variant attribute overrides** (a subset of the itemType's attribute fields — e.g. volumeLiters, tempRatingC, fillPower, loadCapacityKg, torsoFitRange).
- **Bulk weight entry**: a fast way to type weights for all variants (a grid/table, tab-through). This is the primary workflow for clearing weightless items (Nemo's 49, etc.).
- **Set `defaultVariantKey`** (dropdown of variant keys); the item's base `weightGrams` should track the default variant's weight.
- **Ragged support**: allow variants that don't cover the full cartesian (e.g. only some volumes have torso sizes) — either a single combined "Size" axis with explicit rows, or a way to delete invalid combos. Document which pattern the build uses so it stays consistent.
- **Key generation**: `key` = the axis values joined by `" / "` in axis order; `options` = `{axisName: value}`. Keep these in sync automatically when axes/values change (renaming a value should migrate variant keys/options).
- **Guardrails**: warn if a variant has no weight (feeds the "completeness" indicator); prevent duplicate keys; keep `defaultVariantKey` valid after edits.

**Backend for variants:** add `variantAxes`, `variants`, `defaultVariantKey` to the PATCH (and POST) allowed-fields; validate each variant's `attributes` with `validateAttributes` (lenient — see §6) so per-variant enum/number rules hold; keep `defaultVariantKey` referencing an existing variant. Consider a dedicated `PATCH /api/admin/catalog-items/:id/variants` sub-endpoint to keep payloads focused.

## 6. Critical gotchas / rules (learned this session — the builder MUST know these)

1. **Pre-save hook rewrites attributes.** `catalogItem.js normalize` runs `validateAttributes(itemType, this.attributes)` and sets `this.attributes = result.cleaned` — so **any attribute key not in the itemType schema is silently dropped**, and invalid enum/number values **throw a ValidationError** (blocking save). The editor must only offer schema-valid fields/values. Set `doc.$locals.lenientAttributes = true` when saving partially-filled items (relaxes required-field errors but still enforces enums).
2. **Never `.save()` a doc loaded with `.select(...)`.** The pre-save hook re-normalizes ALL fields from `this.*`, so unloaded fields get written back blank (data-loss incident 2026-06-29). Load full docs, or use `collection.updateOne({$set})`.
3. **Merging one attribute without clobbering others:** use a dotted `$set` via `updateOne`, e.g. `{$set:{"attributes.gender":"Mens"}}` — the update middleware only validates/strips attributes when BOTH `attributes` and `itemType` are in the `$set`, so a dotted single-key set passes through untouched.
4. **`category`/`subcategory` are NOT auto-derived on save.** Use `categoryForItemType(itemType, name)` (from `inferItemType.js`) to set them when itemType changes. (Its gender regex now handles curly + straight apostrophes.)
5. **Gender = attribute + gendered category, NOT a variant axis.** Men's/Women's are separate items (category "Men's/Women's Clothing" + `attributes.gender`). Do not model gender as a variant axis.
6. **Empty-schema itemTypes (e.g. Toiletry) strip freeform attributes** on save — set such attributes via `updateOne` with an attributes-only `$set` (no itemType in the `$set`).
7. **Exact-name matching breaks on special chars** (®, curly ’) — the CNOC "42mm Vesica®" consolidation missed archiving because of the ®. Any name-based logic must normalize/escape these.
8. **Weight-trust rule (user priority):** never store fabricated/shipping weights. If a source weight is unreliable (uniform across sizes that should differ, or clearly a shipping weight), leave it blank and flag it rather than guess. The variant editor's job is to let the user enter the *real* per-variant weights by hand.
9. **`weightGrams` may be a decimal** in some inputs — round to sensible grams on entry.

## 7. Nice-to-haves / adjacent

- **Completeness view / "yellow" filter**: surface items missing weight, missing required attributes, or with a broken primary image (there's already a client-side `<img>` probe; a server-side `imageStatus` field is a noted future improvement in memory). A filter "show incomplete" would let the user clear yellow items in a session.
- **Image management**: reorder, set primary, validate URLs (many are Amazon `m.media-amazon` refreshed daily by the `amazonImageRefresh` cron; Shopify CDN images are stable).
- **Per-variant offer/ASIN** field (future, gated on the per-variant-offer schema work — see `CATALOG_ASIN_LEDGER.json` which already stores the extra per-volume ASINs for that day).
- **Bulk actions** from the table (archive, retype) — already partly present.

## 8. Scope note for v1
The one thing that unblocks the user now is **the Variants tab with bulk per-variant weight entry + the backend accepting variant fields**. Tabs + completeness view are the surrounding UX. Per-variant offers are explicitly future.
