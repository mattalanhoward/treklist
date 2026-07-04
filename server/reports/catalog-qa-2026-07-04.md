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
