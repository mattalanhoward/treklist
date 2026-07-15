# Catalog Review Handoff — for a fresh reviewer (Fable)

**Date:** 2026-07-10  **DB:** `treklist_local` (prod `TrekList` untouched)  **Goal:** validate the catalog before an early-next-week production migration.

## READ THIS FIRST — what kind of review this is

This is an **adversarial *semantic* spot-check**, NOT a structural re-run. The person who built this catalog made every classification and weight-parsing decision and is a poor judge of their own calls. Your job is to **challenge the data's correctness on samples** and surface wrongness.

**Already verified by automated sweep — do NOT repeat (you'll find nothing):**
- 0 items missing an offer; ~3 missing images; 0 invalid item types
- Brand casing normalized; size variant axes ordered (XS→XXL / numeric); dedupe done
- Duplicate name+brand pairs: ~0

Spend your budget on the four risk areas below, not on re-confirming structure.

## How to query the DB

```js
const BASE = "/Users/matthewhoward/Projects/treklist/server";
require(BASE + "/node_modules/dotenv").config({ path: BASE + "/.env" });
const mongoose = require(BASE + "/node_modules/mongoose");
const C = require(BASE + "/src/models/catalogItem");
const O = require(BASE + "/src/models/merchantOffer");
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME }); // must be treklist_local
```
Item shape: `name, brand, itemType, category, subcategory, weightGrams, imageUrls[], description, attributes{}, variantAxes[{name,values[]}], variants[{key,options,weightGrams,deepLink}], isActive`.

## What was added/changed this session (your review target)

**8 brands imported (~751 net items).** Each has a `server/src/scripts/create-<brand>.js` with the source URL + parsing logic — read it to see how weights/types were derived, then verify against the live source.

| Brand | Script | Source (platform) | Weight source | ~count |
|---|---|---|---|---|
| GramXpert | create-gramxpert.js | gramxpert.eu (Woo) | parsed from HTML description | 30 |
| Smartwool | create-smartwool.js | smartwool.com/en-us (Shopify) | **none — weightless** | 225 |
| Icebreaker | create-icebreaker.js | icebreaker.com/en-us (Shopify) | **none — weightless** | 189 |
| Neve Gear | create-neve.js | nevegear.com.au (Shopify) | parsed from description | 11 |
| Flextail | create-flextail.js | flextail.com (Shopify) | parsed from title/description | 34 |
| Snow Peak | create-snowpeak.js | snowpeak.com (Shopify) | parsed from desc (oz→g) | 100 |
| TOAKS | create-toaks.js | toaksoutdoor.com (Shopify) | parsed from desc (oz→g) | 84 |
| Nitecore | create-nitecore.js | nitecorestore.com (Shopify) | parsed from desc (oz→g) | 77 |

Also this session: Simond climbing/mountaineering (create-simond-climbing.js / create-simond-mountaineering.js, scraped from simond.com, Awin links); Black Diamond climbing reclassified out of "Other" (reclassify-bd-climbing.js); Decathlon enrich/create/pad-consolidation (enrich-decathlon.js, create-decathlon-new.js, consolidate-decathlon-pads.js).

**11 new itemTypes created this session** (schema in `server/src/config/attributeSchemas.js`, category map in `server/src/config/inferItemType.js`, translations in `client/src/locales/*/common.json`): Hiking Shoes, Climbing Helmet, Climbing Harness, Via Ferrata Set, Ice Axe, Crampon, Air Pump, Bivy Sack, Camp Shoes, Traction Device, Insect Repellent, Hammock, Camp Chair, Trowel, Pack Accessory, Sit Pad.

---

## THE FOUR RISK AREAS (spend your time here)

### 1. Weight-parsing heuristics — HIGHEST RISK
Several brands parsed weight from free text with a fallback of "first `NNg`/`NN oz` figure." This can grab a **dimension, down-fill weight, capacity, or a different variant's weight** instead of the item weight.
- **Method:** for GramXpert, Neve, Flextail, Snow Peak, TOAKS, Nitecore — sample ~10 weighted items each. Open the item's offer `deepLink` (the live product page), find the real spec weight, compare to `weightGrams`. Flag mismatches > ~10% or obviously wrong (e.g., a 400 mL mug listed as 1 g).
- Known-suspect pattern: titanium cookware where the description lists both capacity ("900 ml") and weight; multi-size products where per-size weights appear (may have grabbed the wrong size).

### 2. Scope / filter decisions — did we drop legit items or admit junk?
- **Icebreaker** was scoped to a merino *core* (base layers, socks, underwear, neckwear, hats, gloves) and **all tops/tees/pants/shorts/sweaters/jackets/dresses were dropped as "athleisure."** Check the dropped set isn't hiding legit backpacking pieces (e.g., a technical merino hoodie).
- **Snow Peak** used a **1500 g weight guard + car-camping name filter** to exclude furniture/tents/cast-iron. Check it didn't exclude real backpacking cookware, and that no lifestyle items (growlers, dining sets) slipped in.
- **Smartwool socks** were collapsed by a structural "model key" (line+cushion+cut) to kill colorway proliferation (252→21). Verify distinct sock *models* weren't wrongly merged.
- **Nitecore** was scoped to Headlamps + Power Banks only — check for stray accessories (there is ≥1 known: a "Replacement Lens" typed as Headlamp).

### 3. Semantic item-type correctness (the 11 new types + 65 reclassified "Other")
- **TOAKS stoves** are **alcohol/wood**, but were mapped to `Backpacking Stove (Canister)` (only stove type available). **Decision needed:** accept, or add an "Alcohol/Wood Stove" type. (Check how existing Vargo/Trangia alcohol stoves are typed for consistency.)
- Spot-check the reclassified "Other" mappings make sense: innernets→Backpacking Tent, hip-belt pockets→Pack Accessory, sit pads→Sit Pad, down booties→Camp Shoes, pumps→Air Pump, repellers→Insect Repellent.
- Sample each NEW itemType (query `itemType: "<type>"`) and confirm every member truly belongs.

### 4. Description & data hygiene
- Sample descriptions for HTML/entity garbage, mid-sentence truncation, or wrong-product text.
- Check a few `variantAxes` on apparel render in a sensible size order (should be fixed, but confirm on Smartwool/Icebreaker).

---

## KNOWN / OUT OF SCOPE — do not flag these

- **Decathlon footwear/cookware/water** — a pending in-store-photo batch; intentionally incomplete.
- **`direct-<brand>` offers** on all 8 new brands (+ some Simond) are **placeholder direct links** — affiliate re-pointing is a separate business task, not a data defect.
- **Deferred brands** (Cicerone = Magento no-feed; Katadyn + Sawyer = JS-blocked no-feed) — not imported by design.
- **28 items still `itemType: "Other"`** — verified as genuinely miscellaneous (BD batteries/chargers, fire starters, a coffee filter, sunglasses cases, a whistle, mat covers/sheets, a Garmin inReach, wallets, etc.). Only flag if you find one that clearly maps to a real type.
- **Production migration** (archive-and-readd to `TrekList`) is post-review.

## Output format

Report findings ranked by severity: **file/brand → item → what's wrong → evidence (source URL or value)**. Prioritize (1) wrong weights and (2) wrong item types, since those are user-facing on gear lists. An empty finding list for a risk area is a valid result — say so.
