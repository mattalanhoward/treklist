# Catalog Accuracy QA — 2026-07-04 (autonomous run)

Baseline: 2,428 active items / 122 brands. Backup: `server/backups/dump-treklist_local-20260704T135631-qa`.
Baseline sweep: violations 0, zeroOffer 0, dupOffers 0, orphanOffers 0, attrInvalid 0;
sharedImages 119 groups, noWeight 76, exactDups 34, colorway-suffix names 78, merchantVariance 12, dangling refs 5.

## Catalog-wide (pre-pass)
- FIXED: 3 dangling GlobalItem.productId refs (Durston X-Dome Pro 1+, X-Dome 1+, Iceline Trekking Poles) re-pointed to their exact-name active items (targets were deleted during an earlier cleanup).
- DEFERRED to Big Agnes pass: GlobalItem+GearItem "Copper Spur HV UL - 3 Person" refs dangling; old-style "Copper Spur HV UL - 2p/3p" actives look like superseded twins of the new UL2/UL3 split family.

## Osprey — 40 → 45 active. CLEAN (all §2 checks 0)
Research sources: 15 archived pre-consolidation Osprey items (own per-volume images/ASINs/attrs), hand-kept per-volume ASIN ledger (`build-asin-ledger.js` EXTRA_ASINS), Amazon PDP scrape per ASIN (title-guarded).
- SPLIT "Talon" (volume was a "Size" variant axis = standard violation): renamed bare item → **Talon 22** (its canonical ASIN/images were the 22's), revived archived **Talon 26/33/44**; Talon 44 got Torso S/M (1570 g) / L/XL (1620 g) fit variants from the old matrix.
- SPLIT "Kyte LT" the same way → **Kyte LT 28** + revived **Kyte LT 35**.
- REVIVED **Tempest 44** (line is 22/26/33/44; 44 was archived-only).
- Shared-image defect fixed on 21 items: 10 via archived-twin adoption (Atmos AG 65, Atmos AG LT 65, Sirrus 34/36, Stratos 36, Tempest 26/33, Hikelite 28/32, Talon Velocity 30 — each also got its own per-volume ASIN deepLink), 11 via Amazon PDP gallery scrape of ledger ASINs (Eja 38/58, Exos 38/58, Stratos 34/44, Sirrus 44, Hikelite 26, Aura AG 65, Aura AG LT 50, Tempest Velocity 30).
- RENAMED "Kestrel 38L"→"Kestrel 38", "Sportlite 25L"→"Sportlite 25" (brand naming style).
- Fixed archived Tempest 26 twin attr volumeLiters 23→26.
- New scripts: `qa-audit.js` (read-only §5 sweeps, --brand), `qa-osprey-fix.js`, `qa-osprey-images.js`.
- NOTE (not changed): per-variant/volume Amazon offer routing still single-ASIN-per-item by design (revisit ~2026-07-07). Archived-twin weights sometimes differ a few % from actives (e.g. Sirrus 34: 1470 active vs 1361 archived) — kept active values; osprey.com is 403-blocked so couldn't adjudicate; flagged.

## Nemo — 78 active. CLEAN (remaining shared images = brand limitation)
Source: nemoequipment.com Shopify feed (95 products) + PDP spec JSON.
- FIXED #1 defect on **37 items**: per-variant featured images from the feed (image.variant_ids / variant.featured_image) so each split sibling (capacity/temp) shows its own photo — Aurora/Chogori/Dagger/Dragonfly-Bikepack-1P/Hornet/Hornet-Elite/Kunai tents, Dagger+Dragonfly footprint sizes, Disco/Riff/Forte/Tempo/Soul/Coda/Sonic temp splits (M+W).
- FIXED **Dagger OSMO 2P/3P weights** (§7 known error, were blank after footprint-weight incident): set to published MINIMUM (trail) weight from Nemo PDP spec JSON — 2P 1510 g, 3P 1740 g (sane vs Hornet 948 < Dragonfly 1260 < Dagger < Aurora 2130).
- RENAMED Coda 10°F→**10/20°F**, 25°F→**25/35°F**; Soul 15°F→**15/25°F**, 30°F→**30/40°F** — Nemo's real products are dual-rated (feed variant titles "10/20℉ / …"); attrs keep the lower bound (10/25/15/30) which matches existing tempRatingF.
- ACCEPTED (brand limitation, one photo per family, verified per-color-only variant images in feed): Dragonfly OSMO tents 1P/2P/3P + footprints, Dragonfly Bikepack tents, Tracker/Hornet/Kunai footprints share img0.
- NOTE: Nemo names contain U+202F (narrow no-break space) after ™ — match by _id/regex, not exact string.
- New reusable script: `qa-feed-variant-images.js` (--brand --feed; matches item primary spec → feed variant featured image; excludes other variants' photos).

## Big Agnes — 118 → 116 active. CLEAN
Source: bigagnes.com Shopify feed (286 products) + retailer cross-check (Campman/REI).
- FIXED **Torchlight EXP 0° / Regular** (§7 corrupt 748 g): set 1644 g — verified 3 lb 10 oz on Campman (Small 3lb5oz / Long 4lb corroborate DB 1501/1810). Base weight synced (default=Regular).
- BLANKED **Sidewinder 20° / Long** (§7: 1678 g copied from Sidewinder 0° Long in BA's own feed) — no published source found (the "Sidewinder SL 20" specs online are a different, older model). **FLAGGED for user.**
- FOUND+FIXED third feed corruption: **Greystone 20°** had Long=Regular=1089 g and no size axis; added Size[Regular,Long], Regular=1089 (fits 30°→816 / 0°→1497 progression), Long left unweighted. **FLAGGED for user.**
- ARCHIVED superseded old-gen "**Copper Spur HV UL - 2p/3p**" (BA dropped "HV" — current line is "Copper Spur UL2/UL3" per feed titles); re-pointed 1 GlobalItem ref + the 2 dangling Copper Spur refs → new UL2/UL3 items. 0 dangling refs remain.
- ACCEPTED shared images (verified BRAND LIMITATION — BA's own feed reuses identical files across siblings: Torchlight EXP 0/20/30, Sidewinder 0/20, Greystone 0/20/30, W's Anthracite/Greystone pairs, mtnGLO UL2/UL3, XL/Bikepack/Platinum/Sarvis/String Ridge footprint pairs).
- NOTE: "Pitchpine VST 1.5 Footprint" handle is `footprint-pitchpine-vst-3` — BA's own stale slug; title+page correct.

## Exped — 224 active. CLEAN (4 verified brand-reuse image groups remain)
Source: exped.com product pages (JS-rendered; gallery = rokka.io fe_nuxt_crop_product URLs, rewritten to the catalog's w-933 style).
- RENAMED 4 mats where the DB name was the lossy slug-decode and the ATTRIBUTE was right (verified via live page <title>): "Flex 1R"→**Flex 1.5R**, "Dura 6R"→**Dura 6.5R**, "Ultra 1.5R Mummy"→**Ultra 1R Mummy**, "Versa 1.5R"→**Versa 1R**.
- FIXED own-page galleries for 9 mat-family splits: LuxeMat Duo/Auto, MegaMat Ultra/Duo/Max/Auto/Max Duo, DeepSleep Duo/Auto (each had the base model's photo).
- Reordered MegaMat LuxeWool Cover Auto gallery (its page leads with the LuxeMat Auto photo; own packed-shot now first).
- ACCEPTED brand reuse (each item's OWN page leads with the same file): Cassira 2/3, Vega 2/3, Orion/Venus/Ceres/Polaris/Vela footprints (one generic 4S_Footprint photo), Bike+Hike Poncho pair.
- "Ultra -20°" is Exped's °C naming (attr -4°F correct); qa-audit now converts °C names (SIMOND "0°c" too) instead of flagging.
- New script: `qa-exped-images.js`.

## Sea to Summit — 209 → 202 active. CLEAN
Source: seatosummit.com Shopify feed (624 products) + seatosummit.com/.eu spec pages.
- FIXED per-temp images on **24 bag/quilt splits** (Spark ×4, Spark Pro, Spark W ×3, Trek ×3, Trek W, Ascent ×2, Ascent W ×2, Ember ×2, Basecamp, Traveller, Tanami…) via feed variant images; plus 3 more (Hamelin/Boab/Hamelin W 15°F) by temp-coded image filenames (feed had no variant links).
- ARCHIVED **7 superseded legacy twins** (no offer, no itemGroupId) after re-pointing 16 GlobalItem + 11 GearItem refs to the feed-sourced items with correct variantKeys: 5× per-volume "Lightweight Dry Bag" (→ consolidated item, vk 3L/5L/8L/13L/20L), Silk Blend Liner, 23 g "Ultra-Fine" head net (weight matched no real S2S product).
- FIXED **Lightweight Dry Bag variant weights** to brand-published specs (34/45/50/67/81/91/115 g for 1.5–35L) — feed grams were shipping weights (61–166 g).
- FIXED **Aeros Premium Pillow — Deluxe** weight 77 g (copied from Regular) → **175 g** (S2S EU spec).
- LEFT AS-IS (logged): Aeros Premium pillows + Pocket Towel sizes are separate items with per-size Amazon ASINs — consolidation blocked on variantKey-aware offers (same project as Osprey per-volume ASINs, revisit ~2026-07-07).
- "- Long/Short Handle" spork names are real products, not colorways.

## Zenbivy — 107 active. CLEAN (shared images = selector-page brand limitation)
Source: zenbivy.com Shopify feed (84 products).
- FIXED 23 items' galleries via feed variant images with token-rank disambiguation (fill lines): PrimaLoft®/Synthetic splits now show their synthetic-specific photos (Light Sheet/Quilt/Convertible, Core Quilt 30°F, Ultralight Sheet/Quilt synthetics), Overland/ZipBed pairs differentiated, UL Dirtbed/Ultralight Ultrasonic-900FP got own-handle photos.
- ACCEPTED remaining 12 shared groups: same-page temp/fill siblings — Zenbivy photographs per COLOR only (verified in feed); consistent with the selector-split design (shared buy-links are expected).
- FLAGGED (not changed): BOTH "Overland ZipBed" (2041 g Syn / 1615 g Down) AND "ZipBed Overland" (1996 g / 1497 g) are live, distinct products in Zenbivy's own feed (different product IDs, weights, handles — looks like two generations sold simultaneously). Left both active; user may want to archive one.
- ACCEPTED 22 no-weight items — all configurable bed/bundle products ("Build a … Bundle", "… Bed Bundle", UL Dirtbed™, Core/Light/Overland Beds) per blank-ok-for-configurable policy.

## Zpacks — 130 active. CLEAN
Source: zpacks.com Shopify feed (500 products).
- FIXED **Arc Haul Ultra buy-link bug**: all 8 volume items (40/50/60/70 × M/W) deep-linked to the 60L page; each now links to its own per-volume page (variant-link pattern) AND carries that page's own gallery (40/50/60/70 hero shots differ).
- FIXED Classic Sleeping Bag temp trio galleries (feed refresh).
- RENAMED "Zpacks Octa Fleece Hoody - Full Zip/Pullover" → "Octa Fleece Hoody - …" (doubled brand text).
- ACCEPTED 5 remaining shared-image groups (Mummy 10/20, Zip Around 10/20/30, Solo Quilt 10/20/30, Classic 10/20/30, Summer Quilt 30/40): one-page temp-selector products photographed once by the brand — the designed selector-share pattern.
- "- Full Zip"/"- Pullover" names are genuine configs, not colorways.

## HMG — 79 active. CLEAN (1 brand-limitation group)
Source: hyperlitemountaingear.com Shopify feed (118 products). HMG sells one page per model with a Volume selector (correct selector-share links).
- FIXED per-volume variant images on 20 items: NorthRim 70, Unbound 55, Porter 55/70/85, Roll-Top Food Bag 15, Roll-Top Stuff Sacks 3/5/10/15/25/43, + gallery refreshes (Windrider/Southwest/Junction).
- ACCEPTED: Ice Pack 40/55/70 — HMG's own feed uses one photo for all volumes.
- Added `--trailing-num-as-volume` flag to qa-feed-variant-images.js (HMG names volumes without "L").

## Therm-a-Rest — 51 → 48 active. CLEAN
Source: Cascade Designs combined Shopify store + thermarest.com PDP "Tech Specs" tables (new script `qa-tar-weights.js` parses per-size weight tables incl. R-value-row and kg layouts).
- ARCHIVED 3 US/EU double-listings (Trail Pro -eu, NeoLoft -eu, Compressible Pillow Cinch -eu; 0 refs) — US item kept; Pillow Cinch US inherited the EU twin's weight+size variants (283 g).
- BACKFILLED published per-size weights on **14 items** (Size variants + base): Corus 32F (560/620), Corus 20F (735/815), Polar Ranger -20F (1480/1560), Parsec 20F (820/886), Parsec 0F (1100/1194), Boost 650 20F (6 sizes 1021–1737), Boost 650 32F (804–1317), NeoLoft (710/850/910), Trail Pro (850/1080), Trail ProLite (680/880/910), Trail Pro MAX (1160/1240), Honcho Poncho (690), Honcho Poncho Down (529), + **Ohm 20F Regular 635 g** (SectionHiker+SportFits corroborated; Long unpublished → unweighted variant, FLAGGED).
- FLAGGED (no published weight, accessories): Synergy Luxe Sheets 30" Coupler, Trekker Pillow Case.

## MSR — 140 → 135 active. CLEAN (1 accessory flag)
Same Cascade store; US PDPs carry "Minimum Weight: x lb (y kg)" (new script `qa-msr-fix.js`).
- FIXED **12 dead buy-links**: offers pointed at region-gated `-eu` handles (404 for US) — re-pointed to the same-title US handles (LT/Remote/Access/FreeLite/DragonFly/Front Range); Tindheim 2/3 are EU-market-only → linked to the working `/en-eu/` URLs.
- ARCHIVED 2 duplicate stove listings (DragonFly -eu, "whisperlite-universal-stove" double; 0 refs) and the **discontinued NX generation trio** (Hubba Hubba NX 2, Hubba NX Solo, Mutha Hubba NX 3 — pages 404, 0 refs, superseded by LT/HD lines in catalog).
- BACKFILLED ~25 published minimum weights from US PDPs (Hubba Hubba LT/HD/Bikepack, Remote 2/3, Elixir 2/4, Advance Pro 2, Front Range, stoves/pots incl. DragonFly 401 g, WhisperLite Int'l 318 g…) + FreeLite 1/2/3 minimums 740/910/1070 g (REI/Switchback corroborated; brand page lists packaged) + Tindheim 2/3 2480/2910 g (brand-stated via UK retailers).
- FLAGGED: Snowshoe Carry Pack (no published weight).

## Small re-split brands
- **CNOC (15) — CLEAN.** Per-volume variant images fixed on Vecto 1L/3L + VectoX 3L (feed) and Hydriam/HydriamX flasks 350/500/750ml (per-size featured images from cnocoutdoors.com feed; offers stay on minimalgear).
- **Katabatic (21) — CLEAN.** Same bug class as Zpacks Arc Haul: all 5 Flex quilts deep-linked to the 15°F page. Re-pointed each to its own page (flex-5-f-quilt/-15/-22/-30/-40), adopted each page's gallery, renamed to brand form "Flex 15°F Quilt". FLAGGED: Flex 40°F variant weights identical to 30°F in Katabatic's own feed (848/826 g etc.) — brand data suspicious, left as-is.
- **Enlightened Equipment (7) — verified.** Items link per-temp Farlite pages and already carry each Farlite product's own images; Farlite reuses one photo per model line (Rev APEX trio, Enigma pair) = reseller limitation.
- **Nashville (7)** — Cutaway 20/30/40 share the brand's single photo (verified: one featured image for all volume variants) = brand limitation.
- **Dandee (10)** — Standard 20/27/35: brand sells ONE custom-build page (variants = "Customization Charge"); no per-volume weights or photos published. Weights stay blank + FLAGGED (§7 confirmed).
- **Atelier (7)** — Daybride 15 got its own EN-product gallery (was sharing the Hybride photo); Sakasek + Sakabouf weights set to 40 g (store-published 0.04 kg).
- **Cumulus (16), Atom Packs (15)** — already clean (Atom UL35 single custom-page image = known acceptable).

## Non-split brands & cross-brand sweeps
- **M/W same-name pairs renamed** with gender prefix (+gender attr where missing): Hoka Speedgoat 6/6 GTX/7, La Sportiva Wildcat/2.0 GTX, Salomon Speedcross 6 + GORE-TEX (one was mis-gendered: 524 g "Mens" = women's pair weight → Women's), Smartwool Merino 120/150/250 tops + 250 bottoms, Darn Tough Micro Crew ×2, Injinji Trail Mini-Crew (Darn Tough/Injinji genders verified via Amazon listing titles).
- **Hoka Women's Speedgoat 6 GTX had the non-GTX ASIN + image** → fixed to B0DKNVW7JK with own gallery. AirPods 4 ANC got its own gallery (shared the base model's).
- **Outdoor Research (451)**: 8 pairs were per-COLOR double-imports (both product IDs live in OR's feed — OR lists per color). Archived 8 color twins (0 refs), keeping the plausible-weight one (Snowcrew 635 g, Gradient Beanie 51 g).
- **Decathlon family (SIMOND/QUECHUA/FORCLAZ/Kiprun)**: stripped trailing colorway suffixes on **54 names** ("… - Black"); 1 collision archived (Groundsheet MT900 1P "Undyed" twin); archived 2 SIMOND colorway dups (Merino LS tee, W trousers) + 1 case-only dup tarp. Makalu I (M) 1070 g + Makalu II (L) 1410 g set from Decathlon specs.
- **Gossamer**: archived legacy Polycryo Footprint twin (feed item kept).
- **S2S/TaR/MSR merchant + Cascade dup work** — see brand sections.
- **Merchant naming normalized**: 1,158 direct offers re-keyed from legacy slugs (hyperlitemountaingear, zpacks, gossamergear, durstongear, outdoorresearch, sambob, hyberg, direct-farpointe) to the canonical `direct-<brand>` ids; 2 duplicate offers dropped. Remaining "variance" = genuinely multi-merchant brands (Tarptent direct+GGG, Cumulus GGG+Farlite, CNOC minimalgear+direct, currency items).

## Final catalog-wide sweep (§5) — all clean or explained
| Check | Result |
|---|---|
| Active items | **2,403** (from 2,428: +6 revived, −31 archived dups/twins/discontinued) |
| Standard violations (primary-spec variant axes) | **0** |
| Zero-offer / dup-offer / orphan-offer items | **0 / 0 / 0** |
| Dangling GlobalItem/GearItem refs | **0** (21/12 refs to archived items = designed archive-and-readd behavior) |
| validateAttributes failures | **0** |
| Shared imageUrls[0] groups | 52 — every one verified as the brand publishing a single photo for siblings (BA 12, Zenbivy 12, Nemo 6, Zpacks 5, Hyberg 5, Exped 4, EE 2, SIMOND 2 per-size, HMG/Nashville/Dandee/OR-gaiter/AirPods-family 1 each) |
| Name↔attr mismatches | 11 — all parser false-positives on "50+10L" dual-volume names (attrs correct) |
| Missing weights (weight-bearing types) | 33 — 22 Zenbivy configurable bundles (policy-OK) + 11 flagged below |
| Exact-name dups | 1 — flagged SIMOND pair below |
| Colorway-suffix names | 24 remaining are NOT colors ("- Long Handle", "- Full Zip", "- Wide", "- Past Season"…) |

## FLAGGED FOR USER (needs judgment)
1. **Big Agnes Sidewinder 20° / Long** — corrupt in BA's own feed (copied 0° value); blanked; no published source found.
2. **Big Agnes Greystone 20° / Long** — same class (Long=Regular in feed); size axis added, Long unweighted.
3. **Zenbivy "Overland ZipBed" AND "ZipBed Overland"** — two live distinct products in Zenbivy's feed (two generations?). Both kept; consider archiving one.
4. **Katabatic Flex 40°F** — variant weights identical to 30°F in the brand's own feed.
5. **Therm-a-Rest Ohm 20F / Long** — Regular set to 635 g (corroborated); Long unpublished.
6. **SIMOND "10°c … MT900" ×2** — same name, 700 g vs 630 g, two Awin products (likely Decathlon size listings M/L); left both.
7. **No published weight (left blank)**: Dandee Standard 20/27/35, SIMOND Makalu III (L) + MT500 Twinnable 10°/15°, MSR Snowshoe Carry Pack, TaR Synergy Luxe Sheets + Trekker Pillow Case, Gossamer SitLight, Vargo ExoTi Bags, Hyberg AER PACK (known), Durston X-Dome Pro 1+ (specs not yet published by Durston).
8. **Aeros pillows / Pocket Towel sizes as separate Amazon-ASIN items** — consolidation blocked on variantKey-aware offers (same bucket as Osprey per-volume ASIN routing, revisit ~2026-07-07).

## New reusable scripts (server/src/scripts/)
`qa-audit.js` (read-only §5 sweeps, --brand/--check), `qa-feed-variant-images.js` (--by-handle, --trailing-num-as-volume, token-rank fill disambiguation), `qa-osprey-fix.js`, `qa-osprey-images.js`, `qa-exped-images.js`, `qa-tar-weights.js`, `qa-msr-fix.js`, `qa-strip-color-suffix.js`.
