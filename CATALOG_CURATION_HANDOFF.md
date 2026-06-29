# Catalog Curation Handoff

_Last updated: 2026-06-29. Working DB: `treklist_local` (Mongo via `server/.env` `MONGO_URI`). All work is LOCAL data + code committed on `dev` (unpushed)._

## BRAND PIPELINE — to add (researched 2026-06-29)
Goal: make the catalog very complete. **Curated so far (done): Hyberg, Durston, Atom, Zpacks.**

### Brand-direct Shopify `products.json` (same toolchain as the others)
| Brand | Domain | Status |
|---|---|---|
| **Nashville Pack** | nashvillepack.com | ✅ **DONE** 2026-06-29. Feed polluted with Mageworx APO "service products" + MTO/Blem/One-Offs + accessories → archived 52, kept **5** (Cutaway [Fabric×Volume], Tiempo→Daypack, 2 liners [DCF/D50T], DCF Groundsheet). `curate-nashville.js`. |
| **Dandee Packs** | dandeepacks.com | ✅ **DONE** 2026-06-29. Cottage sundry shop → archived 23 junk, kept **20** gear+small-bags (15 attributed). `curate-dandee.js`. |
| **Hilltop Packs** | hilltoppacks.com | ⏸ DEFERRED (user). 250+ mixed: packs + fabric-by-yard/hardware → filter to packs+gear when done. |
| **Darn Tough** | darntough.com | ❌ DECLINED (user doesn't want ~250 sock models). |
Process per brand: probe → `analyze-feed.js` → `ingest-shopify-catalog.js --brand --merchant-name [--exclude/--skip-food]` → `dedupe-ggg --group` → `ai-type-untyped --group` → curate (variants/weights/attrs, trim descriptions).

### ⚠️ No open feed — need affiliate network or back-door (enterprise/Cloudflare/custom)
- **Osprey** (Cloudflare challenge, SFCC), **Smartwool** (VF Corp, Cloudflare), **Rab** (enterprise) → need **AvantLink/Impact/Awin** product feed (most US outdoor brands live on AvantLink/Impact, NOT Awin). **Manual copy-paste entry also works** (user pastes specs/images/URL → build item like Bandit Lite).
- **Tarptent** (custom nginx cart, no products.json) → reseller back-door (outdoorline.eu) or scrape.
- **Cumulus** (Cloudflare-blocked, known) → reseller back-door (GGG/outdoorline) or affiliate.

### Sourcing reality
- **Amazon = NOT a catalog source.** Creators API / PA-API are per-ASIN lookup, rate-limited, ToS forbids permanent storage (code caches `amazonSnapshot` 24h + TTL). It's a **buy-link/price layer** for items you already have (attach an ASIN). Weights are shipping weights (wrong).
- **Awin** = bulk feeds but only per **approved merchant**; user has **Decathlon only** today. Apply for more, but big US brands are usually AvantLink/Impact.
- _User affiliate networks: Awin (Decathlon). AvantLink/Impact = TBD (the unlock for Osprey/Smartwool/Rab)._


## Session 2026-06-29 (afternoon) — accessory exclusion + first weights
- **Policy decisions SET** (see below): (1) hand-curate weights for real gear, blank ok for true no-weight accessories; (2) **exclude all accessories** (not needed for a gear-planning app) and keep a note of every exclusion.
- **mongodump insurance taken**: `server/backups/dump-treklist_local-20260629T094659/`.
- **Accessory exclusion committed**: archived **98** accessory items (pouches, spare parts, cordage/hardware, consumables, off-domain electronics/climbing, wallets/cash, junk-name orphans, collection pages) + **retyped 10** real-gear items (cups→Pot, rain kilts→Rain Pants, vests→Insulated Jacket, etc.). **19 borderline items kept** (gaiters, booties, pack cover, sit pads, microspikes, trowel, food bags…). Full list: `server/reports/exclusions-2026-06-29T07-58-07-933Z.txt`. Script: `curate-accessories.js` (dry-run default; reversible — archive = `isActive:false`).
- **First weights curated (hyberg)**: NIMBUS I–IV → Size M/L/XL variants; ZEFYR/VALGUS/RADA×2/Zolo×2/ExploMid I → single weights — all **verified by hand from each item's own spec-table text**. Also archived 3 hidden pack-pocket accessories (Hipbelt Pocket, Shoulder Strap Pocket, PILGER Lite). Script: `curate-weights-hyberg.js`.
- **Hyberg weights FINISHED via brand-site fetch** (method chosen by user). Pulled full untruncated spec tables from `https://hyberg.de/products/<handle>.json` `body_html` and read weights by hand. `curate-weights-hyberg2.js`: 18 single-Size-axis items (LONER Lite/SLUMBER/LONER APEX/SLUMBER APEX quilts, ARCON/ATTILA/ATTILA ULTRA packs, ZIP Bag) + 2 Material×Size packs (EGOIST LITE, ATTILA LITE). **AER PACK left blank** (empty description + grams=0, no published weight). Only Hyberg flags left: AER PACK + 2 Warm Booties (genuine Other).
- **LONER/SLUMBER over-split CONSOLIDATED** (`consolidate-hyberg-quilts.js`): 14 separate per-fill product items → **4 Fill×Size variant parents** (LONER Lite Down 12v, SLUMBER Down 9v, LONER APEX Synthetic 12v, SLUMBER APEX Synthetic 6v). ⚠️ Hyberg sells each fill as a SEPARATE product URL and **MerchantOffer has NO variantKey** (per-variant buy-links unsupported) → user chose single COLLECTION-page link per line (loner-lite / quilts / loner-apex / climashield-apex). 10 member items + their offers deleted (0 user refs, 0 orphan offers after). **NIMBUS (I–IV) + VALGUS left split** — same over-split pattern, not in the asked scope; consolidate them the same way if wanted.
- **zpacks quick-wins** (`curate-zpacks-and-category.js`): typed 8 borderline-kept items (DupleXL DISC→Tent, Carbon Staff→Trekking Poles, food bags→Dry Bag, Adotec→Bear Canister, Down Hood→Insulated Jacket, Whistle/Foam Sit Pad→Other); archived 6 mis-typed accessories that had escaped the sweep (tent-pole sacks/sling, mesh tent pocket, sleeping pad strap, Arc backpack belt). **Also fixed a retype bug**: catalog-wide backfilled `category` for 29 typed items that lacked it (category isn't auto-derived on `save()` — the earlier retypes + legacy Decathlon sleeping bags/boots).
- **STATE NOW: ~688 active / ~80 review flags** (was 261 at session start). Remaining: **zpacks 13 no-weight = CONFIGURABLE PACKS (deferred-by-design → user weight-override, see PACK WEIGHTS note in memory)**; **legacy/other ~49 no-weight = low-priority heterogeneous long-tail** (Smartwool/MH/Decathlon/Leki/guidebooks/permits — each a different site, no Shopify-.json shortcut; some weight-optional like Permit/Guidebook/Deodorant). Both are the natural next pass.

## ⚠️ WEIGHT-DATA TRUST ISSUE (found 2026-06-29 PM via user spot-check)
- User spot-checked 3 Hyberg pack weights (EVENT/AGUILA/AGUILA LITE) — **all 3 wrong**. Root cause: the **abandoned AI-extraction pass** (see WEIGHT/DESCRIPTION CLEANUP note in memory) left **placeholder/guessed weights** that got committed (e.g. AGUILA/AGUILA LITE/RINCO all == 400g; EVENT 470; SKINI 320). Audited ALL Hyberg items vs the brand site (`hyberg.de/products/<handle>.json` body_html) → **13 single weights were wrong, now FIXED** (`fix-hyberg-weights.js`). This session's hand-read weights + pre-existing VARIANT items (booties, dry/stuff bags, PAKKID) verified CORRECT.
- 🔴 **IMPLICATION: other brands curated in that same 2026-06-28 AI pass may also have bad weights** (Atom, Durston, Atelier, legacy). RE-VERIFY against brand sites before trusting any single-value weight from that era. The Shopify `/<handle>.json` body_html audit pattern in `fix-hyberg-weights.js`/`consolidate-hyberg-quilts.js` is reusable. Variant items built by hand from spec tables proved reliable; lone round numbers (400/500) are the smell.

## Where things stand
- **913 active catalog items**, 967 offers. This is the clean, focused catalog after removing GGG.
- **GGG was removed** (it was the mud: 1029 items / 376 review flags). Backed up at `server/backups/ggg-*.json` — re-addable in one command, or selectively by brand.
- **Prod `TrekList` is STALE** — 610 old items, none of this session's work (no variants, no new brands, no curation). Do **not** copy prod→local; it would erase everything.
- ⚠️ **local and prod `_id`s DIFFER** (verified). Users' `productId` refs point at prod `_id`s. → migration must be archive-and-readd (below), not an in-place `_id` update.
- ⚠️ **Manual curation is NOT replayable from scripts** — the Durston variant/weight work, consolidations, etc. exist only as data in local. local is the source of truth.

## The goal
A clean, consistent catalog, then migrate to prod. **Clean bar** = every active item has: an offer (already 100%) + valid `itemType` (specific or a genuine "Other") + `category` + a weight (or is a true no-weight accessory) + sane variants + no junk names.

## TWO POLICY DECISIONS — ✅ SET 2026-06-29
1. **No-weight items:** hand-curate the weight for real gear (from description/brand site); blank is OK for genuine no-weight accessories.
2. **"Other" accessories:** **exclude all** (archive) — not needed for a gear-planning app — and keep a note of what was excluded (`reports/exclusions-*.txt`).

## How to curate
- **Remove junk → Archive it** (admin catalog table "Archive" button = `isActive:false`). The migration only uploads **active** items, so archived = excluded from prod. Reversible. No need to hard-delete (local has no users).
- **Edit fields**: admin catalog table (`client/src/pages/AdminView.jsx`) / `GlobalItemEditModal.jsx`, or directly in the DB.
- **Add variants** (weight-VARYING only — color/torso-size that don't change weight should collapse): set on the CatalogItem:
  - `variantAxes: [{ name, values: [...] }]` (1+ axes)
  - `variants: [{ key: "<axis vals joined by ' / '>", options: { <axisName>: val, ... }, weightGrams }]`
  - `defaultVariantKey`, and `weightGrams` = the default variant's weight
  - Save with `doc.$locals.lenientAttributes = true`.
- **Weight convention used so far:** "Complete Pack" / "Complete Tent" (as-shipped). Many makers bury weights & size tables in the DESCRIPTION text (feed `grams`=0); descriptions are backfilled to full length (2000 chars).

## Tools (`server/src/scripts/`, dry-run default, `--db/--confirm` prod guard)
- **`consistency-report.js`** — re-run anytime; writes a per-source/per-reason review list to `server/reports/`. Buckets: NO-WEIGHT, UNTYPED, TYPE-BUT-NO-CATEGORY, SUSPICIOUS-WEIGHT, FLAT-VARIANTS, JUNK-NAME, OTHER, + POSSIBLE OVER-SPLIT (has false positives on distinct models).
- **`ai-type-untyped.js --group <slug> --commit`** — AI-types untyped items (object-keyed schema; reuses anthropicService).
- **`consolidate-variants.js`** — folds sibling size items into one variant item (explicit per-cluster configs; only removes unreferenced).
- **`dedupe-ggg.js --group <slug>`** — feed-vs-existing dedupe (existing wins; exact auto, fuzzy reported).
- **`backfill-descriptions.js`** — surgical description-only refresh from feeds (already run).
- **`ingest-shopify-catalog.js`** — the importer. Flags: `--platform woo`, `--brand`, `--merchant-name`, `--skip-food`, `--skip-brands`, `--exclude <regex>`, `--collapse-color`. Re-running MERGES by `itemGroupId` (refreshes facts, preserves curated `itemType`/`category`/`attributes`). ⚠️ Re-running would NOT overwrite manual variant/weight curation? — it refreshes `weightGrams`/`variants` from feed, so re-importing a curated brand CAN clobber hand weights. Be careful; prefer not to re-import curated brands.
- **`analyze-feed.js --domain <host>`** — pre-import analysis (classification/food/overlap).

## Known issues to work through (per source, from the report)
- **Hyberg (~40 to fix):** biggest gap = weightless quilts/packs (NIMBUS/LONER/SLUMBER quilts; AER/ARCON/ATTILA/ZEFYR/EGOIST packs; ExploMid tent). Weights are in their descriptions → extract by hand (or a careful per-item read; an AI extractor hallucinated earlier, so VERIFY against the text). **LONER Lite (4 fills) and SLUMBER (3 fills) are over-split** → consolidate into fill variants, but each line also splits Down vs APEX-synthetic (2 products each). PILGER weights ambiguous ("23g 31g", no labels). Warm Booties typed "Other".
- **Atelier (~12):** remove non-products → `CUSTOMIZATION FEES`, `Frais de personnalisation`, `Carte Cadeau`. Sakasek/Sakabouf packs show **40g = wrong** (fabric weight, not pack) → need real specs. A few French-named items untyped.
- **Atom (~9):** frames / padded hipbelt / foam mat / Roo (Zero Waste) genuinely weightless (feed `grams`=0 — hand-curate or accept). Rest of "Other" are real accessories. `X-Dome Pro 1+`-equivalent: none here.
- **Durston:** clean. `X-Dome Pro 1+` weightless (upcoming/pre-release — leave). Spare parts/stickers = "Other" (archive the stickers/logo/customization junk). Tents + packs fully modeled.
- **Zpacks (~95):** mostly genuine "Other" accessories + some no-weight. Solo Quilt / Classic Sleeping Bag = 21-variant parents (good).
- **Legacy/other (~78):** your CLEANEST set (95% typed) — most flags are genuine "Other" accessories. Low priority.
- **NOTE:** earlier-flagged consolidation clusters Cumulus Aerial / Katabatic Flex / Vargo BOT / Adventure Medical Kit were all GGG-sourced → **gone with GGG**. Only Hyberg LONER/SLUMBER remains.

## Atom Packs DONE — ✅ 2026-06-29
- Consolidated the per-config items into **5 variant pack models** (`consolidate-atom-packs.js`): The Atom (RE30/RE40/UL35/Custom), Prospector (EP50/EP60/Custom), Pulse (EP40/EP50/Custom), Notch (EP40/EP50/Custom), Nanu (RE25/X25/Custom). Variant axis "Version"; each variant keeps its published **medium-torso weight** (user overrides for their torso) + **per-variant attributes** (volumeLiters + mainFabric swap on selection). Parent offers → `<model>-custom` builder pages (Nanu has no builder → its product page). Redundant config items **archived** (not deleted — they had local gear refs).
- Earlier (`curate-atom.js`): Nanu weight 600→510, Thinny blank→Size variants (87/116/145g), Roo RE hip-pack attrs, Pack Liner attrs. The Atom stray custom-build weight 1336g fixed via the consolidation.
- **Accessories kept (4):** un-archived **The Hipbelt Pocket**; kept Roo RE (1.5/2.5L), Pack Liner, The Thinny. All other Atom accessories/frames/old-Roo-dupes/test-copy/Mo-factory-2nd stay archived. **Active Atom = 9** (5 models + 4 accessories).

## Durston DONE — ✅ 2026-06-29
- Durston was already well-modeled (variants + per-variant weights survived from a prior session — Kakwa Fabric×Torso 770–860g, Wapta Torso×WaistBelt 385–540g, X-Mid Pro Floor×Stakes, X-Dome Interior×PoleSet, all correct vs the handoff). **Gap was attributes — now filled** for all 13 active items from durstongear.com specs (WebFetch + cross-check). Scripts: `curate-durston-attrs-tents.js`, `curate-durston-attrs-rest.js`.
- 8 tents: capacity/season/tentType/wall/materials/dims; **per-variant** floor material on X-Mid Pro (Woven=silnylon / Dyneema=DCF) and floor+pole material on X-Dome (Interior + Pole Set axes). X-Dome Pro 1+ left minimal (pre-release, no published specs).
- 3 packs (brand "Durston Gear", no itemGroupId — match by name+brand): Wapta 30 (ALUULA, removable padded belt), Kakwa 40/55 (internal frame, **per-variant mainFabric** Ultra 200X / UltraGrid). Iceline poles: weight corrected **134 g (per pole) → 268 g (the pair, as sold)** + full pole attrs. Groundsheets: material.
- Brand consistent (all "Durston Gear"). Descriptions already short (148–460 chars) so NOT trimmed (no 2000-char dumps like Hyberg). 13/13 have attributes, brand, images intact.

## ⚠️ INCIDENT + RECOVERY (2026-06-29 PM) — read this
- A `trim-hyberg-descriptions.js` early version loaded docs with `.select("name description")` then `.save()`. The CatalogItem **pre-save hook re-normalizes every field from `this.*`**, so unloaded fields (brand/brandLC/category/subcategory/imageUrls/itemGroupId/tags…) were written back as blanks → wiped on the 34 trimmed Hyberg items. **NEVER call `.save()` on a doc loaded with `.select(...)` on this model** — use `collection.updateOne({$set})` (now fixed in the trim script). See memory [[gotcha-select-save-wipes-fields]].
- Recovery: restored `catalogitems` + `merchantoffers` from the morning mongodump (clean base), then **replayed all committed scripts in order** to rebuild. ⚠️ During recovery a `mongorestore --drop --nsTo treklist_restore` ALSO clobbered `treklist_local.catalogitems` (the nsTo didn't protect the source) — that's WHY a full replay was needed; be careful with mongorestore ns-remap + `--drop`.
- **Fresh backup of the recovered/curated state: `server/backups/dump-treklist_local-RECOVERED-20260629T120025/`** (this is now the newest good snapshot — prefer it over the 09:46 one).
- Full session is reproducible from git: run `curate-accessories` → `curate-weights-hyberg` → `curate-weights-hyberg2` → `consolidate-hyberg-quilts` → `curate-zpacks-and-category` → `fix-hyberg-weights` → `curate-bandit-pakkid` → `curate-hyberg-attrs-{backpacks,quilts,sleepingbags,rest}` → `curate-hyberg-misc` → `consolidate-hyberg-nimbus-valgus` → `trim-hyberg-descriptions` (all `--commit`).

## Hyberg ATTRIBUTES filled — ✅ 2026-06-29
- Structured `attributes` filled on **40/43** active Hyberg items, hand-read from hyberg.de spec tables (no AI), modelled on Bandit Lite. Scripts: `curate-hyberg-attrs-{backpacks,quilts,sleepingbags,rest}.js`. Backpacks (volume/gender/frame/hipbelt/water/fabric/torso/load/hydration); Quilts (insulation/temp/fillPower/footbox — **consolidated quilts carry PER-FILL tempRatingC + fillWeightG/Climashield level via variant.attributes**); VALGUS bags; ExploMid tents + Zolo/SKINI tarps; dry/stuff bags; RADA hip packs; Ti mug/spoon. Per-variant material on EGOIST LITE/ATTILA LITE/PAKKID. Retypes: RINCO/ZEFYR → Daypack (18L < Backpack min 20L); "Stake Bag" Tent Stakes → Dry Bag/Stuff Sack (mis-typed). Unfillable: AER PACK (no brand desc), 2 Warm Booties (itemType "Other" has no schema).
- **Descriptions TRIMMED** (`trim-hyberg-descriptions.js`): all 34 active Hyberg descriptions cut from ~2000 chars to the first 1–2 sentences of the marketing intro (specs now live in attributes). Deterministic (real prose, no AI). ⚠️ Reversible but `backfill-descriptions.js` would RE-EXPAND them from the feed — don't re-run backfill on Hyberg unless you want the long text back.
- **NIMBUS + VALGUS consolidated** (`consolidate-hyberg-nimbus-valgus.js`): NIMBUS I–IV → NIMBUS Down Quilt (Fill×Size, per-Fill temp/fill-weight); VALGUS I/II/III → VALGUS Down Sleeping Bag (Fill, per-Fill temp). **Archived dated dupes**: Warm Booties (2024), AGUILA LITE (2025), ATTILA ULTRA (2024 version). Active Hyberg 43 → **35**.
- 🔴 Same brand-spec attribute-fill is a candidate for Atom/Durston/Atelier next.

## Per-variant attributes — ✅ BUILT 2026-06-29
- Variant sub-schema now has an optional `attributes` map (`catalogItem.js`). Both modals (`GlobalItemEditModal.jsx`, `CatalogItemPreviewModal.jsx`) merge `selectedVariant.attributes` OVER the base `attributes` in their specs memo, so selecting a variant swaps those fields. First use: **Bandit Lite** (Material: Aluula 410g / Dyneema 420g, `mainFabric` differs per material) + **PAKKID** (Material×Size: Dyneema 30/33, TX50Ultra 38/41). Script: `curate-bandit-pakkid.js`. Catalog route already selects `variants` wholesale so attributes reach the client. **Add-from-catalog now denormalizes the CHOSEN variant's attributes** onto the owned GlobalItem (`globalItems.js` bulk-add merges `variant.attributes` over base, alongside variant weight + variantKey). So picking Dyneema then adding stores Dyneema fabric+weight. ⚠️ The edit-existing PATCH path saves variantKey+weight but NOT re-resolved attributes — display stays correct (re-resolves from variantKey + catalog variants), but stored `attributes` can go stale if a user CHANGES variant on an already-owned item. Wire the same merge into the update route if that matters. Bandit Lite also got 8 brand photos (was 1 custom).

## Migration plan (when the catalog is clean) — archive-and-readd
1. `mongodump TrekList` (backup; rollback = `mongorestore --drop`).
2. Deploy code `dev → main` (variant UI + importer; inert on current data; also ships waiting F2 JWT fix).
3. Archive ALL current prod catalog items: `updateMany({}, {$set:{isActive:false}})` — preserves user `productId` refs (their gear is denormalized; refs resolve to hidden items; offers untouched → nothing breaks; worst case = a hidden item).
4. Insert the local **active** catalog + its MerchantOffers into prod, keeping local `_id`s (no collision — prod ids differ).
5. Verify: active catalog = the new set; a sample existing user's gear still renders + has its buy button; 0 orphan offers.
   - Tradeoffs (acceptable): existing users don't retroactively get variants on already-owned items; ~610 archived ghosts linger.

## Immediate insurance to take
- `mongodump treklist_local` (the whole curated catalog only exists in this one DB).
- Push the `dev` commits (code is local-only on this machine).
