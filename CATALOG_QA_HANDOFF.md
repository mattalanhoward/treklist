# Catalog Accuracy QA — Autonomous Handoff

**Purpose:** After a large "REI-rule" variant re-split (primary spec = product, fit spec = variant), verify the WHOLE catalog for accuracy, brand by brand, fixing what's clearly wrong and logging what's ambiguous. Runs mostly on its own; **research (fetch the brand's real data) whenever a value can't be trusted from the DB alone.** Intended to run in a fresh chat (Fable is a good fit — fast, autonomous).

> Read the memory first: `feedback_catalog_variant_standard.md` (THE rule + edge rulings), `feedback_variant_link_pattern.md`, `gotcha_select_save_wipes_fields.md`, `catalog_variant_model.md`, and `project_catalog_importer.md` (status: de-consolidation COMPLETE). This doc is the operational plan.

---

## 0. Environment & safety (read before writing anything)

- **DB:** `treklist_local` on the Atlas cluster in `server/.env` (`MONGO_URI`, `MONGO_DB_NAME=treklist_local`). This is the **source of truth** — prod `TrekList` is stale; never copy prod→local; `_id`s differ.
- **Run from `server/`:** `cd server && node -e '...'` or `node src/scripts/<x>.js`. Scripts are **dry-run by default, `--commit` to write, and refuse any non-`treklist_local` DB.** Keep that pattern for any new script.
- **BACK UP before the first write:** `mongodump` to `server/backups/dump-treklist_local-<ts>-qa`. (See any existing `deconsolidate-*.js` header for the exact `mongodump` invocation, or copy the one in prior handoffs.)
- **GOTCHA — never `.save()` a projected (`.select()`) doc:** the pre-save hook re-normalizes from `this.*` and wipes unset fields. To touch a few fields use `Model.collection.updateOne(...)`. To touch attributes/variants and want validation, load the FULL doc, set fields, `doc.$locals.lenientAttributes = true`, `markModified('attributes'|'variants')`, `save()`.
- **Ref safety:** before deleting/archiving any CatalogItem, check `GlobalItem.productId` and `GearItem.productId` for references. If refs exist, **re-point them to the correct active item first** (and set `variantKey` where sensible), THEN delete. Verify 0 dangling refs after.
- **Fix discipline:** dry-run → eyeball → commit → verify (re-query). Fix only unambiguous issues; **log** anything requiring a judgment call for the user. Prefer surgical `updateOne` over rebuilds.
- **Fabricated data is worse than blank.** If a real value can't be found, blank it and log it — do NOT invent a weight/spec (see the weight-trust rule below).

Current baseline: **~2,428 active items, ~122 brands.** Latest good backup: `dump-treklist_local-20260704T153540-atom-cleanup`.

---

## 1. The standard being verified (what "correct" looks like)

**The rule:** the spec that defines what the gear *is* → its own product (in the name + a structured attribute). The spec that defines how it *fits* → a variant axis. **Color is never a variant/separate product.** Men's/Women's are separate products.

| Category | Product identity (name + attr) | Allowed variant axes | Notes |
|---|---|---|---|
| **Backpacks/Daypacks** | Volume (`volumeLiters`) | Torso/Belt size, Fabric | e.g. "Gorilla 50", "Atom RE30" |
| **Sleeping bags/quilts** | Temperature (`tempRatingF`,`tempRatingC`) | Size/Length, zip side | e.g. "Anthracite 20°" |
| **Tents** | Occupancy (`capacity`) | Fabric (only if same model sold in multiple fabrics) | mtnGLO/Platinum/Carbon = separate products |
| **Sleeping pads** | R-value/warmth (`rValue`) | Size (M/MW/LW…) | Duo/Max = own product; valve (Auto) = variant |
| **Apparel/footwear** | Model | Size; gender separate | color collapsed |
| **Cookware/bottles/filters** | Capacity where it varies | — | ml vs L units matter |

**Edge rulings already decided (don't re-litigate):**
- Down **Fill** that IS the warmth spec → splits per fill (Cumulus, Hyberg NIMBUS I–IV). Fill that's an **overfill option on a bag that already names a temp** (Katabatic Sawatch 15°F) → KEEP as variant.
- Atom "Version" (EP40/RE30/UL35) = fabric+**volume** → split by volume. Zpacks/Durston "Version/Floor/Interior/Pole Set" = genuine config → **keep**. **Bundle toggles** (Include stakes?, PVT Hipbelt Included, Quantity, "Custom" builder, Pack Color) → flatten to the base.
- Selector-page brands (Nemo/Sea to Summit/Zenbivy sell one page w/ a selector) were still SPLIT per temp; their split products **share the one brand page** as the buy-link.

**Brands intentionally NOT split (each temp is its own named model — leave separate):** Western Mountaineering, Katabatic named quilts, Cumulus named bags (Panyam/Teneqa), SIMOND.

---

## 2. Per-item checklist (the core of the job)

For **every active catalog item**, verify:

1. **Naming** — matches the brand's real product name AND embeds the primary spec (volume/temp/capacity/R-value). No leftover color suffix, no doubled text, no "Custom"/test junk.
2. **Own images** — `imageUrls` are THIS product's images, not a sibling's/parent's. **Split siblings must have DIFFERENT `imageUrls[0]`** (the #1 defect class from the split — the parent's image was copied to every variant). Research: fetch the product page/JSON and compare.
3. **Buy-link (offer `deepLink`)** — resolves to the correct product page; per-variant `deepLink`s (if present) route to the right size/version. Exactly **one direct offer per item**, no duplicate merchantIds, no orphan offers (offer whose `productId` points to a deleted item). Merchant naming consistent within a brand.
4. **Attributes** — the structured attribute matches the name (e.g. name "…20°F" ⇒ `tempRatingF:20`; "…50L" ⇒ `volumeLiters:50`; "…2P" ⇒ `capacity:"2-Person"`; "…6.5R" ⇒ `rValue:6.5`). `mainFabric` correct. **Runs clean through `validateAttributes(itemType, attrs, {strict:false})`.** `itemType` + `category`/`subcategory` correct so catalog filters return it.
5. **Weight** — matches the brand's PUBLISHED weight (trail/product weight, NOT shipping/packed/footprint weight). Per-size variant weights present and correct. **Sanity vs siblings:** a variant that's wildly off its neighbors is a red flag (see Dagger example below).
6. **Sizing / fabric variants** — the fit axes are complete and correct (e.g. a mat that Exped sells in M/MW/LW must have all three with per-size weights; a pack sold in S/M/L torso must carry them). No fit spec missing, no primary spec masquerading as a variant.
7. **No duplicates** — no colorway dup (`"- <Color>"`), no synth artifact (an item whose `itemGroupId` ends `-<value>` but whose `deepLink` points at a *different* value — this is how a bogus "Halka 70" got created), no superseded archived twin.

**Definition of done per brand:** every active item passes 1–7; a short findings note (fixed vs flagged) is recorded.

---

## 3. How to research each brand (fetch real data)

Trust the brand, not the DB. Platforms seen so far:

- **Shopify** (Big Agnes, HMG, Nemo, Sea to Summit, Zenbivy, Osprey*, Zpacks, Hyberg, Atom, Gossamer, Durston, Cumulus-via-GGG…): `curl -s -A "Mozilla/5.0…" https://<domain>/products.json?limit=250&page=N` for the list, and `https://<domain>/products/<handle>.json` for one product (gives `title`, `images[].src`, `variants[].grams`, `body_html`). Some stores block Node's fetch (Cloudflare) → **use `curl`**. (*Osprey `products.json` returns 403 — use its archived siblings / the item's existing Amazon offer instead.)
- **Woo Store API** (Farlite/EE/Atelier): `…/wp-json/wc/store/v1/products?per_page=100&page=N`.
- **JS-rendered / no clean feed** (Exped): the product **page HTML** carries a `Weight` spec div (`<h4>Weight</h4><div>M: 440 g<br>MW: 545 g<br>LW: 590 g</div>`) and per-size `?sku=` buttons — parse those. Deep-link slugs are authoritative but can be lossy (`sim-25` = 2.5R) and carry a `-0` CMS artifact.
- **Weight-trust rule:** feed `grams` is sometimes shipping/packed weight — cross-check against the description/spec ("trail weight"). Some brands publish `grams:0` and put the real weight only in text (Nemo, Big Agnes). Prefer the published trail/product weight.

---

## 4. Suggested run loop (autonomous)

1. Back up (once).
2. Build a **worklist**: `distinct brand` among active items. Prioritize the 17 that were re-split (see §6) — they carry the most risk — then sweep the rest.
3. **Per brand:**
   a. Pull the brand's feed/pages once (cache the product list).
   b. Load its active catalog items.
   c. Match each item → its real product (by handle in the offer `deepLink`, else by name/volume/temp).
   d. Run checks §2.1–2.7. Collect a per-item verdict.
   e. **Auto-fix** the safe classes: shared/wrong images (re-pull per product), missing size variants (parse per-size weights), wrong/missing attribute derivable from the name (tempRatingF/volumeLiters/capacity/rValue), duplicate/orphan offers, colorway/synth duplicate items (with ref re-point), obvious naming artifacts. Dry-run → verify → commit.
   f. **Log (don't auto-change)** anything needing judgment: implausible published weights, ambiguous fabric, model/spec you can't confirm from the source, anything that would delete a user-referenced item without a clean target.
   g. Re-audit the brand to confirm 0 remaining §2 violations.
4. Produce a **final report**: per-brand summary (items checked / fixed / flagged) + a consolidated list of flagged items for the user.

Reusable tooling already in `server/src/scripts/` — read their headers, they're the templates:
`deconsolidate-synth.js` (`--primary <axis>`, `--drop <re>`, `--vol-l`, per-variant deep-links), `deconsolidate-imgmatch.js` (image/weight match, `--handle-name`, token-swap), `deconsolidate-reuse.js` (un-archive stale siblings), `deconsolidate-brand.js` (feed-deeplink), `enrich-exped-mat-sizes.js` (per-size weights from the spec div; `--bags`), `fix-atom-packs.js` (per-version images + fabric). Add-only extractors for other brands' per-size weights/images will likely be needed.

---

## 5. Catalog-wide sweeps (run these once across ALL items)

- **Standard violation scan:** any active item with a variant axis in {Temperature, Temp Rating, Temp/Fill, Rating/Fill, Capacity, Volume, R-Value, Configuration}, OR Fill on an item whose name has no temp. Expected result: **0** (except Katabatic overfill + Atelier build-config, which are compliant).
- **Shared-image scan:** group active items by model family; flag any two split siblings sharing `imageUrls[0]`.
- **Offer hygiene:** items with 0 offers (should generally have ≥1), items with >1 direct offer of the same `deepLink` (dedupe), offers whose `productId` no longer exists (delete orphans), inconsistent `merchantId`/`merchantName` within a brand.
- **Ref integrity:** `GlobalItem`/`GearItem.productId` pointing to a non-existent or `isActive:false` item (dangling) — investigate.
- **Attribute validation:** run `validateAttributes` on every active item; list failures + items whose derived attr disagrees with the name.
- **Missing weights:** list active gear (packs/bags/tents/pads) with no `weightGrams` and no weighted variants — some are legit (configurable/unpublished), most are errors.
- **Duplicate names:** exact-name active dups, and `"- <Color>"` colorway dups.
- **Broken images (optional):** `HEAD` each `imageUrls[0]`; flag non-200. (There's a long-standing TODO to make this a server-side job.)

---

## 6. Brands re-split in this pass (highest risk — check first)

Big Agnes, Therm-a-Rest, HMG, Cumulus, Enlightened Equipment, Nemo, Sea to Summit, Osprey, Zpacks, Hyberg, CNOC, Katabatic (Flex only), Nashville, Dandee, Exped, Zenbivy, **Atom Packs**. Watch especially: Exped (lossy slugs, many mats/bags, config-mats), Zenbivy (verbose temp+fill names — confirm they read cleanly), Osprey (Amazon offers, feed blocked), selector-page brands (shared buy-links are expected, not a bug).

---

## 7. Known flagged errors to verify/fix (already spotted, not yet resolved)

- **Nemo "Dagger OSMO Lightweight Backpacking Tent"** carried the *footprint's* weights (210/300 g) — blanked. Find the real trail/packed weight and set it. (Good example of a weight that's obviously wrong vs its category.)
- **Big Agnes "Torchlight EXP 0° / Regular" (748 g)** and **"Sidewinder 20° / Long" (1678 g)** are corrupt in Big Agnes's own data (748 g is impossible between Small 1501 and Long 1810; 1678 is copied from the 0° Long). Derive from sibling-size deltas or blank + flag.
- **Dandee "Standard Ultralight Backpack"** volumes have no weight (brand doesn't publish) — research or leave blank + flag.
- **Atom "The Atom UL35"** has only 1 image (custom-only page) and links to `the-atom-custom` — acceptable but note; a better image would help.
- Spot-check that the **selector-page split products** (Nemo/S2S/Zenbivy) all point to a working brand page and carry the right `tempRatingF`.

---

## 8. Report format

Write findings to `server/reports/catalog-qa-<date>.md` (create the dir if needed) with:
- Per-brand table: `checked / auto-fixed / flagged`.
- A "Fixed" list (item, field, old→new, why).
- A "Flagged for user" list (item, issue, why it needs a human decision).
- Any new reusable script added.
- Final catalog-wide sweep results (§5), all expected to be ~0.

Then take a final `mongodump` (`…-qa-complete`) and summarize for the user.

---

### One-liners to start (from `server/`)

```js
// active items missing a weight, by brand:
node -e 'require("dotenv").config();const m=require("mongoose");const C=require("./src/models/catalogItem");(async()=>{await m.connect(process.env.MONGO_URI,{dbName:"treklist_local"});const a=await C.find({isActive:{$ne:false},itemType:{$in:["Backpack","Daypack","Sleeping Bag","Quilt","Backpacking Tent","Inflatable Sleeping Pad"]}}).select("brand name weightGrams variants").lean();const bad=a.filter(i=>!i.weightGrams&&!(i.variants||[]).length);const by={};bad.forEach(i=>by[i.brand]=(by[i.brand]||0)+1);console.log(JSON.stringify(by,null,1),"total",bad.length);await m.disconnect()})()'

// split siblings sharing the same first image (shared-image defect):
node -e 'require("dotenv").config();const m=require("mongoose");const C=require("./src/models/catalogItem");(async()=>{await m.connect(process.env.MONGO_URI,{dbName:"treklist_local"});const a=await C.find({isActive:{$ne:false}}).select("brand name imageUrls").lean();const byImg={};a.forEach(i=>{const k=(i.imageUrls||[])[0];if(k)(byImg[k]=byImg[k]||[]).push(i.brand+": "+i.name)});Object.values(byImg).filter(v=>v.length>1&&new Set(v.map(x=>x.split(":")[0])).size===1).slice(0,40).forEach(v=>console.log(v.join("  ||  ")));await m.disconnect()})()'
```
