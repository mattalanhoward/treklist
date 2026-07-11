# Catalog Review — 2026-07-10 (adversarial semantic review, WHOLE CATALOG)

Reviewer: Claude (Fable), per `CATALOG_REVIEW_HANDOFF.md`, extended per user to the full 3,790 active items. DB: `treklist_local` (read-only review, nothing changed).
Method — Round 1 (this session's 8 brands): re-fetched every brand's live feed, joined to DB items by offer deepLink, re-read every weighted item's source text with an independent parser, spot-verified against rendered PDPs, replayed scope filters. Round 2 (whole catalog): weight-plausibility bands per itemType over all 3,090 weighted items, footwear pair/single audit, name-vs-type contradiction sweep, within-brand near-dup scan, catalog-wide description hygiene, source re-verification of every post-QA-import brand (Hilleberg, FF, Arc'teryx, Patagonia, Black Diamond, Cumulus), and current-state checks on the 2026-07-04 QA's flagged items.

**Bottom line:** Round 1 — ~98 of the ~751 newest items carry a wrong/untrustworthy weight (88 = Snow Peak shipping weights). Round 2 — the pre-existing catalog is largely sound (Hilleberg 43/43, FF 74/74, Arc 121/126, Pata 25/31 verified against sources; near-dupes essentially zero) with three systemic exceptions: **Black Diamond feed grams are unreliable for a subset (4 of 6 spot-checks wrong by 12–44%)**, **footwear weights mix per-pair and per-shoe conventions across brands**, and **~25 pre-existing accessory mis-types** the July-4 QA never swept for. See "ROUND 2" section below.

---

## SEVERITY 1 — wrong user-facing weights

### 1.1 Snow Peak: all 88 weights untrustworthy (systemic)
- **86/88** came from Shopify `variant.grams` — which for Snow Peak is **shipping weight incl. packaging**, not product weight. Spot-checked against snowpeak.com PDP specs:
  - Trek 700 Titanium: stored **222g**, spec **"4.8 oz (136 g)"** (+63%)
  - LiteMax Titanium Stove: stored **127g**, spec **"1.9 oz (56 g)"** (+127%)
  - Corroborating smell: exact 1-lb values (454g) on 12pc Cutlery Set, Shimo Stein, GigaPower Stove Recta; Titanium Spork 27g (real ~17g); Ti-Single 450 100g (real ~70g). A few match reality by luck (GigaPower 2.0 Auto 91g ≈ real 90g) — not distinguishable in bulk.
- The other **2/88** were parsed from descriptions and both grabbed the wrong figure:
  - **Shimo Can Cooler in 500ml = 680g** ← "secure **24oz** canned drinks" (24×28.35)
  - **Earthen Zen Pot = 397g** ← "the heat-resistant, **14 oz.** pot" (capacity; page even says "for use at home")
- **Fix:** null all Snow Peak `weightGrams`, or re-scrape: the PDP spec block renders server-side ("Weight: 4.8 oz (136 g)") and is parseable — a `HEAD`-style enrich pass over the 100 deepLinks would recover real weights.

### 1.2 GramXpert: both eLite quilts stored at 2 g
- `eLite quilt` and `eLite quilt 7D/10D`: **weightGrams = 2**. The regex fell through to the first standalone gram figure: *"Add **2g** for 70cm zipper length."* The real per-size/per-fill weight table does not survive into the feed text (site-rendered), so there is no scrapeable single weight — null these two (or hand-enter a representative config from the site table). Other two quilts (simpLite, Underquilt) are honestly weightless; remaining 19 weighted GramXpert items verified correct.

### 1.3 Flextail: two tolerance-figure grabs
- **ZERO PUMP = 1g** ← "Weight (without battery): 1.2 oz (33**±1 g**)". Real: ~34g.
- **EVO REPELLER = 10g** ← "Weight: 17.28oz (495**±10 g**)". Real: ~495g.
- Other 25 weighted Flextail items verified correct (incl. title-weights like "ZERO LANTERN - 56g").

### 1.4 Nitecore: bundle SKUs carry one component's weight
Bundles list the weight of a single component from the marketing copy:
- "NU25 MCT Headlamp **with NB10000**" = 50g (headlamp alone); "NU25 MCT **with NB Air**" = 50g; "NU25 MCT UL **with NB10000**" = 47g
- "UT27 MCT **with NB10000**" = 140g and "NU20 Classic **with NB10000**" = 140g (the power bank alone); "HC60 UHE **with Carbon 6K kit**" = 140g (headlamp alone)
- **Fix:** drop the bundles entirely (see 2.1) or null their weights. All ~20 weighted *standalone* Nitecore items verified correct against their descriptions.

---

## SEVERITY 2 — scope & duplicates

### 2.1 Nitecore: 20+ non-scope items (scope was "headlamps + power banks only")
Mechanism: `resolveType` regex-matches /headlamp/ against the **name**, and accessory names all contain "…for Nitecore Headlamps"; no accessory exclusion exists (TOAKS/Flextail had one).
- **11 accessories typed Headlamp:** Battery Cap (Tail Cap); NHC10 Helmet Clips; BM06 Bike Mount; Bracket for H Series; Bracket for NU/UT Series; Headband for H Series; NVG Helmet Mount Bracket; HLB1500 Battery Pack; Carbon Battery 6K kit; Carbon Battery 12K kit; **Replacement Lens** (the known one).
- **4 signal/safety lights typed Headlamp:** NU05 v2, NU06 LE, NU06 MI, NU07 LE (helmet/MOLLE signal lights, not headlamps). (NU11 cap light is borderline-acceptable.)
- **~8 bundle SKUs** (see 1.4, plus "UT27 Pro w/ Extra HLB-1500 Battery", "HU2000 + NB20000", "NU43 + Carbon 6K").
- **2 gadget hybrids typed Power Bank:** NWL30 (3-in-1 lantern/repeller), SCL10 (camera light).

### 2.2 Cross-name duplicates (exact-name dedupe couldn't catch these)
Pre-existing Amazon-linked items duplicating new direct-link imports:
- Nitecore: **NB20000** ↔ "Nitecore NB20000 Gen 3 Dual USB-C Power Bank"; **NU20 Classic** ↔ "Nitecore NU20 Classic 360 Lumen…"; **NB Air 5000mAh** ↔ "Nitecore NB Air Ultra Lightweight…"; **NB Plus 10,000mAh** ↔ "Nitecore NB Plus 10,000mAh Lightweight…"
- Flextail: **Zero Pump Air Pump** (Amazon, 51g) ↔ **ZERO PUMP**; **Zero Power 10,000 C** (Amazon, 141g) ↔ **ZERO POWER 10,000C** (145g)
- Flextail source-site duplicate: **ZERO MATTRESS R05** ↔ **ZERO MATTRESS R05 Regular 183cm** (two live Shopify listings of the same product, both 710g)
- Decide: **TINY HELIO 600Z** vs **TINY HELIO 600Z 2025** (old vs current model year — keep both or replace).

### 2.3 Icebreaker: the drop-filter has a hole INSIDE the stated core scope
Items with `product_type: "Accessories"` fell through every rule (rules test product_type; hats/gloves/neckwear under "Accessories" match nothing) → dropped despite scope = "…neckwear, hats, gloves":
- 200 Oasis Glove Liners, 260 Tech Glove Liners, Quantum Gloves, Sierra Gloves (explains why DB has **1** Icebreaker glove item), Flexi Beanie, Flexi Headband, Flexi Chute (neck tube), Pocket Hat, 200 Oasis Beanie, ZoneKnit Arm Sleeves, … (~15 items).

### 2.4 Icebreaker: the "athleisure" cut also removed their flagship hike layers (decision needed)
Dropped alongside genuine lifestyle: **Merino 150 Tech Lite tees** (their hiking tee line), **260 Quantum zip hoodies**, **RealFleece 200/300 Descender** midlayers, **200 Oasis Long Sleeve Half Zips** (same fabric line as the kept Oasis base layers), **MerinoFine Ace hoodies (UPF sun hoodies)**, **Elevation Stretch Pants**, Speed Winter tights, Cool-Lite/ZoneKnit shorts.
Inconsistency: Smartwool's equivalents WERE kept (30 Hiking Shirts, 14 Insulated Jackets, 14 Fleece Jackets). Either re-admit Icebreaker's technical tops/bottoms lines or accept the asymmetry deliberately.

### 2.5 Smartwool sock collapse over-merged distinct models
The model key (line+cushion+cut) fails because most Smartwool titles omit cushion:
- 35 hike-crew products → **one** item whose representative is **"Hike Crew Socks 3-Pack"** (a pack, not a model); "Hike Light Cushion Crew" — their best-selling hiking sock — has no item at all.
- Intraknit™ Ski OTC (premium seamless line) merged into pattern-print ski socks; "Trail Run", "Run Cold Weather", "Run" all merged as line="run".
- Gender key: effectively everything hashed to **W** (tags contain "women" broadly), so men's models merged under women's representatives and sock categories skew Women's Clothing.
- Representatives include **Kids'** socks ("Kids' Hike Critter Cache Crew", "Kids' Wintersport Ski Day OTC") and prints ("Fox Meadow", "Galactic").
**Fix suggestion:** re-collapse keyed on Smartwool's real model attributes (parse cushion/construction from body_html specs, keep gender from title prefix only), pick non-pack non-print representatives, exclude Kids'.

### 2.6 Kids' items imported (no kids filter on Smartwool/Simond)
- Smartwool: **12** Kids' items (2 socks, 3 base layers, 4 beanies, gloves, balaclava, neck gaiter). Icebreaker filtered kids; Smartwool didn't.
- Simond: **3 kids' climbing harnesses** (Rock Junior, First Klimb Junior, Spider Kid).
Decide: drop (adult backpacking catalog) or keep deliberately.

### 2.7 Snow Peak: ~25 lifestyle/car-camping items admitted
The name filter + 1500g guard let through (all also carry bogus shipping weights per 1.1): Shimo Stein / Tumbler / Tumbler Set / Can Cooler 350+500; Kanpai Bottle 350/500 + Titanium 350 Kanpai; Titanium Sake Cup + Sake Bottle; Milk Bottle 350ml; **Charcuterie Plate**; Field Barista Kettle/Coffee Drip/Set + Field Coffee Master/Brewer; Summer Stacking Mug Set (771g); **Earthen Zen Pot** (donabe, "for use at home"); Classic Kettle 1.8 (726g); 12pc Titanium Cutlery Set; Tableware Plate/Bowl/Dish series; Stainless Vacuum mug sets; Hotlips 2 Piece Set (silicone lip guards = accessory); **Burner Sheet** (accessory, typed *Stove*); **Folding Torch** (culinary torch, typed *Stove*); **Bamboo Spatula** (typed *Backpacking Pot*); Kuwagata (verify what it is).
Conversely, wrongly **dropped**: **Wabuki Chopsticks** + Titanium/Anodized Chopsticks (TOAKS chopsticks were kept as Utensil — inconsistent), and Titanium Flask 150/250mL (while Flask M + Curved Flask were kept).

---

## SEVERITY 3 — item types

### 3.1 Via Ferrata Set: 2 of 3 members are plain lanyards
"Double climbing and mountaineering lanyard" and "Climbing Single Lanyard 75 cm" (Simond) are positioning lanyards without energy absorbers — not via ferrata sets. Only "Via ferrata lanyard, Vitalink 4.0" belongs. Retype the two (Other / pack-accessory-style) or drop.

### 3.2 TOAKS alcohol/wood stoves as "Backpacking Stove (Canister)" — consistent, so it's a catalog-wide decision
All 10 existing Vargo alcohol/wood stoves (Decagon Alcohol, Hexagon Wood, Fire Box, Sobata, …) are ALSO typed Canister. So TOAKS made nothing worse. Either accept (consistent) or add an "Alcohol/Wood Stove" type and migrate ~18 items in one pass.
Found while checking: **Vargo TRIAD MULTI-FUEL STOVE is typed "Stove Fuel"** — it's a stove, clear pre-existing mis-type.

### 3.3 Hiking Shoes (new type): all 5 members are named "Boots"
All Quechua ("Men's Walking Boots Arpenaz…", "Women's Walking Boots Nh50", "…Hiking Boots Nh500…"). Two say "Low"/"Low-rise" (fine as shoes); verify the others aren't mids that belong in the existing Hiking Boots type. Ties into the pending Decathlon Hiking-Shoes decision.

### 3.4 Small type notes
- BD "Vario Chest Harness" under Climbing Harness (it's a chest-harness add-on) — acceptable or retype.
- Simond "Mini hiking auxiliary crampons - bobcat" is arguably a Traction Device, not a Crampon.
- Snow Peak "Deep Backpacker's Cup with Lid" typed Backpacking Pot (product_type Cookware) — Coffee Mug fits better.
- Flextail junk item: **"Mosquito Repellent Mats for FLEXTAIL REPELLER (only on our site)"** — consumable refill + junky name; scope said exclude accessories → drop.
- Reclassified-"Other" spot-check (innernets→Tent, pockets→Pack Accessory, booties→Camp Shoes, pumps→Air Pump, etc.): **all sensible**; the 28 remaining "Other" are genuinely misc as claimed.

---

## SEVERITY 4 — description & data hygiene

### 4.1 TOAKS: 43 descriptions are 100% raw CSS
`strip()` removes tags but keeps `<style>` **content**, and TOAKS body_html leads with a big related-products style block → 43 items' entire 1000-char description is CSS (`.related-products { margin-top: 2em; } …`), 3 more partially. User-visible garbage. Fix strip to drop `<style>/<script>` blocks and re-set TOAKS descriptions from the feed.

### 4.2 Mid-word truncation at the 1000-char cap
102 items end mid-word (TOAKS 46, Nitecore 55, Flextail 1) — e.g. "…an optimal m". Cosmetic; slice at a word/sentence boundary when re-setting.

### 4.3 Odds & ends
- Smartwool name with a literal stray "?": `Women's Ski Galactic Ski Print OTC Socks?` (also doubled word "Ski … Ski").
- **Smartwool `attributes.gender` is missing on all 217 items** (Icebreaker has Mens 58 / Womens 65 / none 66). Categories still carry the gender split, but it's inconsistent with Icebreaker; worth backfilling from name prefix (`collection.updateOne`, not `.save()`).
- variantAxes size ordering: verified correct on Smartwool/Icebreaker samples (XS→XXL, S→XL) — fix-size-ordering did its job. No HTML-entity garbage found anywhere.
- GramXpert flat weights silently = smallest size/fabric (Dry bag 30g = size S of 30/49/53; Wallet 7g = DCF of 6.7–11.5; Solo Tarp 185g = 20D of 135–195; Peg bag 3g = M DCF). Per the weight-disclosure convention, add a qualifier to the description ("weight for size S / DCF").

---

## VERIFIED CLEAN (no action)
- **TOAKS weights: 78/79 verified** against labeled specs (best import of the batch; the "capacity-grab" fear did not materialize — spec blocks list Weight before Capacity).
- **Neve Gear: 5/5 weights verified**; temp-variant products honestly weightless with a see-product-page note.
- **Nitecore standalone weights: verified correct** (marketing "Weighing only X oz" is reliably the first oz figure).
- **Flextail other 25 weights verified**; GramXpert other 19 verified.
- New-type memberships otherwise clean: Climbing Helmet, Climbing Harness (bar kids/chest notes), Ice Axe, Crampon, Air Pump, Bivy Sack, Camp Shoes, Traction Device, Hammock, Camp Chair, Trowel, Pack Accessory, Sit Pad, Insect Repellent (bar the mats).
- Icebreaker kept-set typing correct; no name+brand exact duplicates; descriptions free of HTML entities.

---
---

# ROUND 2 — WHOLE-CATALOG SWEEP (added same day, per user: review everything, not just the new ~751)

Coverage note: the 2026-07-04 QA (`catalog-qa-2026-07-04.md`) already deep-passed Osprey/Nemo/BA/Exped/S2S/Zenbivy/Zpacks/HMG/TaR/MSR + structural sweeps at 2,403 items. Round 2 therefore focused on (a) cross-catalog *semantic* checks the QA never ran, and (b) the ~1,387 items imported after it.

## R2-SEVERITY 1 — weights

### R2-1.1 Black Diamond: feed grams unreliable for a subset (systemic risk, ~302 weighted items)
Import is faithful (301/302 stored == feed grams), but the feed itself is a mix of true spec and inflated/placeholder values. PDP spot-checks:
- **Cyborg Pro Crampons: stored 1430g vs PDP "Weight: 1150 g"** (+24%)
- **Super Light Mitts: stored 410g vs PDP "Weight: 284 g"** (+44%)
- **Spot 400 Headlamp: stored 116g vs PDP "[AAA] 86 g"** (+35%)
- **Men's Airnet Harness: stored 320g vs PDP "286 g"** (+12%)
- Correct: Capitan Helmet MIPS 320g (=S/M spec), Icon 700 370g, Distance 1500 475g.
- Placeholder smell in feed: identical-weight clusters across unrelated products (250g ×8, 320g ×8, 300g ×7, 420g ×6…), exact-1-lb values (BD X AllTrails Fineline shells ×2 at 454g, Alpenglow Hoody 10th Mtn 454g), twin 930g logo hoodies.
- **Fix:** BD PDPs render "Weight: NNN g" server-side — run a spec re-scrape over the ~300 BD items (same pattern as the Snow Peak fix). 4/6 wrong in adversarial sampling ⇒ assume a large minority affected.

### R2-1.2 Footwear: mixed per-pair / per-shoe conventions (~30 items, comparison-breaking)
- PAIR weights (2× the published single-shoe spec, arithmetic-confirmed): Hoka Speedgoat 6 GTX M 578g (spec 289g/shoe), Brooks Cascadia 19 607g (303), Salomon Speedcross 6 595g (298), La Sportiva Wildcat 709/800g, Topo Traverse 600g, Saucony Peregrine 538g, Kiprun 556g + the women's counterparts.
- SINGLE-shoe weights: all 40 Altra items (by design, with disclosure), Salewa Crow GTX 675g.
- Unknown: Simond/Quechua boots (Decathlon in-store data; MT900 W Leather 1100g reads like a pair).
- **Fix:** pick ONE convention for the `Trail Running Shoes`/`Hiking Boots`/`Hiking Shoes` types (suggest per-pair, since most brands publish pairs), normalize + disclose per the weight-precision rule.

### R2-1.3 Point weight errors (verified against source)
- **Vargo DECAGON ALCOHOL STOVE: stored 5g, PDP "1.2 ounces (34 grams)".**
- **Arc'teryx Venta Glove: stored 663g** — FF's page text says "2.3 oz (663 g)", an impossible pair; Arc'teryx lists ~65g. Fix to ~65g.
- **Patagonia Capilene Midweight trio (W Crewneck, W Zip-Neck, M Bottoms): all stored 147g** from the same copy-pasted "4.3 oz (147 g)" on FF pages (4.3oz=122g; three different garments can't share one weight). Verify vs patagonia.com; likely ~122g each.
- Suspicious, unverified (source publishes nothing or round-lb): Vargo ExoTi Ultra 40 1361g + ExoTi BYOB 1361g + UltraFly 1 Tent 907g + Para-Bottle 454g (GGG-era shipping-value smell); Dandee Lightweight Poncho 59g (Dandee publishes no weights per QA — value looks invented; a DCF poncho is ~140g+).

### R2-1.4 Verified CLEAN in round 2 (no action)
- **Hilleberg 43/43** exactly match live `minMetric` (re-fetched __NUXT_DATA__).
- **Feathered Friends 74/74** — oz↔g arithmetic-consistent; the Puffin YF trio flags resolved against the "Average Weight" table rows (stored 1304/1162/1049 = 2lb14oz / 2lb9oz / 2lb5oz ✓).
- **Arc'teryx 121/126, Patagonia 25/31** internally consistent (remainder = the 4 flagged above + weightless).
- **Cumulus UL bags are real**: Magic 100 = 240g, Vencer 100 = 180g, Aerial 180 = 301g per GGG spec text (the old fill-weight-as-total bug from 2026-06-28 was fixed; the `magic-125` deepLink slug is GGG's stale handle — title/specs are Magic 100).
- **OR Tundra Aerogel Sock 549g** = OR's own spec ("19.36 oz/549 g") — not an error.
- LiteAF, Bonfus, Altra, Simond: zero band-sweep outliers (all were hand-verified at import).

## R2-SEVERITY 2 — pre-existing item-type errors (~25, the July QA never swept name-vs-type)
- Gossamer Gear typed **Backpack**: Ultralight Backpacking **Trowel** (→Trowel), Backpacking **Pocket Knife** (→Pocket Knife), Static Backpack Compression Cord (→Other). GG typed **Trekking Poles**: Pole Baskets, Pole Tips, Pole Rubber Boots (accessories →Other/Pack Accessory). GG "Seam Grip SIL Tent Sealant" typed **Backpacking Tent** (→Other). "The Crotch Pot" typed Backpacking Pot (→Other), "Smart Water Bottle Upgrade Kit" typed Water Bottle (→Other).
- Vargo typed **Backpacking Tent**: Titanium Nail Peg ×2 + Crevice Stake (→Tent Stakes). Vargo TRIAD stove typed **Stove Fuel** (→ stove type; from round 1).
- Sea to Summit typed **Backpacking Tent**: Hangout Mode Poleset, Ground Control Guy Cords, Telos/Alto Gear Lofts (→Other/Tent Stakes).
- Outdoor Research: 5 fleece **beanies/headband** typed Fleece Jacket (→Hat/Headwear); Tundra Trax **Booties** M+W typed Gloves (→Camp Shoes); "Merino 150 Sensor Liners" (glove liners) typed Base Layer Top (→Gloves).
- Zenbivy: 3D + UL **Inflation Sacks** typed Inflatable Sleeping Pad (→Air Pump); **Mesh Storage Sack** typed Sleeping Bag (→Dry Bag / Stuff Sack).
- Arc'teryx: **Andessa Down Jacket + Andessa Down Mid Jacket (W)** typed Rain Jacket (→Insulated Jacket).
- HMG: "UltaMid 4 Mesh Insert, No Floor" typed **Mosquito Head Net**; UltaMid 2/4 Inserts + MSR Front Range Bug/Floor Insert typed Ground Sheet while this session's convention maps inners→Backpacking Tent — pick one convention.
- Minor/debatable: Zpacks Ventum Wind Shell as Rain Jacket (not waterproof), Zpacks Down Hood as Insulated Jacket (→Hat/Headwear), Exped Tarp Pole 240 as Tent Stakes, Atelier Sakasek/Sakabouf (40g sacoches) as Backpack, TaR Trail Pro MAX + Zenbivy Flex Mattress as Foam vs Inflatable.

## R2-SEVERITY 3 — duplicates & flagged-state
- **MSR "Front Range™ 4-Person" vs "4 Person Ultralight Tarp Shelter"** — same product twice, one weightless (740g on the other). Merge.
- **Zenbivy "Overland ZipBed" vs "ZipBed Overland" twins (25° and 30°)** — still both live, still awaiting the user decision from the 07-04 QA.
- **Katabatic Flex 30°F vs 40°F: full variant matrices identical** (848/826/885/857…) — brand's own feed data, unchanged since QA flag. Recommend blanking the 40° weights or re-checking katabatic.com.
- SIMOND exact-name dups from QA: now resolved (0 found). Near-dup scan across all brands: only the MSR pair above — dedupe state is otherwise good.

## R2-SEVERITY 4 — hygiene & scope (catalog-wide)
- **54 descriptions contain raw HTML entities** (FarPointe, OR gaiters, etc.).
- **44 descriptions truncated at the old 600-char cap** (Cumulus 14, SMD 7, BA 6, EE 5, WM 3, Tarptent 3…) — pre-dating the 2000-cap fix; the 2026-06-28 backfill missed them (likely no itemGroupId). Plus round 1's 105 at the 1000 cap and 6 at 2000.
- **53 items have EMPTY descriptions** across 32 brands (Flextail 7, Rab 4, BearVault 3, S2S 4, Macpac 3…).
- GramXpert has 1 CSS-contaminated description (besides TOAKS' 46).
- Scope outliers to decide: S2S **Detour/Passage** stainless car-camping dinnerware line (~8 items, 1–2kg), BD lifestyle logo apparel (Heritage Wordmark/Mini Stacked hoodies), BA Guard Station 8 (11.4kg basecamp tent), Nemo Jazz Double (4kg car-camping bag).

---
---

# EXECUTION LOG — fixes applied 2026-07-10 (same day)

User decisions: **footwear = pair weight across the board**; execute the fix list.
Backup first: `server/backups/dump-treklist_local-20260710T213412-pre-review-fixes` (4,794 items + 4,809 offers).
All writes via `collection.updateOne` / guarded scripts (dry-run → --commit). New scripts in `server/src/scripts/`:
`fix-review-weights.js`, `fix-review-types.js`, `fix-review-archives.js`, `scrape-snowpeak-weights.js`, `scrape-bd-weights.js`, `fix-review-descriptions.js`, `fix-smartwool-socks.js` (+ `create-icebreaker.js` patched with the Accessories branch).

## Weights
- **Snow Peak PDP re-scrape: 62 corrected, 4 already right, 8 nulled (no spec on page), 0 failures** — e.g. Trek 700 222→136g, LiteMax 127→56g, Titanium Flask M 318→82g, Curved Flask 408→95g, Spork 27→16g.
- **Black Diamond PDP re-scrape: 299 of 308 corrected** (feed grams were near-universally inflated), 3 already right, 4 kept (no spec), 2 skipped (no BD link). Follow-up patch for BD's own page bugs: Stone Gloves 10→118g, Transition Gloves 12→93g (dual Weight lines, took the real one); Alpenglow Hoody 10th Mtn + First Light 1.0 Stretch Vest → weight UNSET (BD's page literally says "0 g").
- Point fixes: Flextail ZERO PUMP 1→34g, EVO REPELLER 10→495g; Vargo Decagon 5→34g, ExoTi Ultra 40 1361→1130g, ExoTi BYOB 1361→820g, UltraFly 1 907→726g, Para-Bottle 454→332g; Arc'teryx Venta Glove 663→65g. Nulled: GramXpert eLite ×2, Dandee Poncho, Patagonia Capilene ×3.
- **Footwear pair normalization**: Altra ×36 doubled (disclosure text updated to "per pair"), Salewa Crow GTX 675→1350g, Quechua ×6 + Kiprun MT Cushion 2 doubled (were single-shoe values), pair-disclosure stamped on the already-pair brands (23 items). Remaining Decathlon boots ≥400g assumed pair; re-verify on the next store-photo pass.

## Types (43 retyped) + attributes
Everything in R2-SEV-2 applied (GG trowel/knife/cord/pole parts, Vargo pegs + TRIAD, S2S tent accessories, OR beanies/booties/liners, Zenbivy pump sacks + storage sack, Arc Andessa ×2, HMG/MSR inserts→Backpacking Tent, Zpacks Down Hood, Exped Tarp Pole, Atelier sacoches→Hip Pack) + Simond VF lanyards ×2→Other, Snow Peak Kuwagata→Other (it's a canister-puncture tool), Deep Backpacker's Cup→Coffee Mug. Smartwool `attributes.gender` backfilled (81 items + all 69 rebuilt socks; note: the round-1 "all 217 missing" was an artifact of my dump script — real gap was 81 + socks).

## Archives / merges / scope (85 archived total)
- Nitecore: 26 archived (11 accessories, 4 signal lights, 9 bundles, NWL30, SCL10). Strays remaining: 0.
- Duplicate merges (offers repointed to winner, loser archived): Nitecore ×4 (NB20000, NU20 Classic, NB Air, NB Plus — Amazon offers now on the full items), Flextail ×3 (Zero Pump, Zero Power 10000, ZERO MATTRESS R05 dup listing), MSR Front Range tarp pair.
- Smartwool Kids ×12; Flextail repellent-mats refill; Snow Peak lifestyle cull ×38 (incl. stragglers Field Barista Kettle in Black, Field Coffee Master Set, Ti-Single 300 Cup Cover, Food Canister, Kanpai lids ×2, Tableware Set L).
- Snow Peak re-admits ×5 (Wabuki/Ti/Anodized chopsticks → Utensil; Ti Flask 250/150 → Water Bottle) with scraped real weights.

## Rebuilds
- **Smartwool socks: 19 bad representatives archived → 69 canonical models imported** (cushion parsed from title-or-body prose, names built to Smartwool's own convention — "Women's Hike Light Cushion Crew Socks", Intraknit/Classic Edition/Second Cut kept distinct, gender from title prefix, prints/packs/kids collapsed).
- **Icebreaker Accessories hole: 8 recovered** (4 gloves incl. the 200 Oasis/260 Tech liners, 3 hats, 1 neck gaiter) via the patched resolveType.

## Descriptions
TOAKS 51 re-set from feed with `<style>`-content stripped (CSS count now 0), Nitecore 39 + Flextail 1 + GramXpert 1 re-set, 21 GGG-sourced 600-cap truncations re-set full-length, 54 entity-decoded (0 remain), all remaining exact-cap truncations re-cut at word/sentence boundaries.

## Post-fix verification
3,769 active items; 0 CSS descriptions; 0 entity descriptions; 0 active items without an offer; 0 Nitecore strays; Snow Peak extremes now sane (16g spork → 583g Personal Cooker 3); footwear all ≥436g (pairs).

## FOLLOW-UP ROUND (user feedback on this log, applied same day)
- **Stove type rework (user decision):** "Backpacking Stove (Canister)" renamed **"Stove (Canister)"** + new **Stove (Alcohol) / Stove (Wood) / Stove (Liquid Fuel)** — schema (server+client), classifier + itemTypeDetector, 6 locale files, decathlon-store-specs.json, and a rename entry in normalize-itemtypes.js **for the PROD run at migration time** (prod items keep the old string until then). DB migrated via `fix-stove-types.js`: 25 canister / 8 alcohol / 13 wood / 5 liquid fuel (MSR WhisperLite/DragonFly/XGK were mislabeled canister); 6 stove ACCESSORIES riding the /stove/ name rule → Other (MSR adapter/igniter/base, GigaPower Windscreen, TOAKS tripod + grill).
- **Vargo Sobata ×3 = knives** (user catch) → Pocket Knife. **Kuwagata archived** (user call).
- **Sock size ordering** (user screenshot): the rebuilt socks + new Icebreaker accessories imported Shopify's raw order — `fix-size-ordering.js` re-run, 68 reordered.
- **Flextail "mats" clarified**: the archived item was "Mosquito Repellent Mats for FLEXTAIL REPELLER" = consumable refill cartridges for their repeller devices, NOT sleeping pads (all 8 Flextail pads intact).
- **Jetboil probed**: Incapsula bot-wall, no feed, not on GGG → backlog as manual-entry brand (like Katadyn/Sawyer); Decathlon store-specs already carries Zip 2.0.

## DECISIONS ROUND (user answers 2026-07-11, applied same day)
- **Zenbivy ZipBed twins: BOTH generations archived** (car camping) — 4 items via `fix-review-decisions.js`.
- **Katabatic Flex: ALL FIVE quilts re-weighted from katabaticgear.com spec tables** (`fix-katabatic-flex.js`; the user's Flex 40 spec sheet validated the parser exactly). The stored matrices were shipping-inflated across the whole family — e.g. Flex 22 Regular/850 975→678g, Flex 40 base 848→490g. 60 variant weights + 5 base weights corrected.
- **Icebreaker technical lines re-admitted** (user: "add those 5 back"): Tech Lite tees, 260 Quantum zips, RealFleece Descender, 200 Oasis half-zips, Elevation Stretch Pants — 50 imported via the patched `create-icebreaker.js`, then 24 print-colorway duplicates collapsed (Icebreaker lists Tech Lite prints as separate products) → net ~26; sizes reordered. Icebreaker now 223 active.
- **Culled (32)**: entire S2S Detour + Passage stainless lines (28; Frontier UL line kept), BD logo hoodies ×2, BA Guard Station 8, Nemo Jazz Double.
- **Nitecore TINY HELIO 600Z + 2025: both kept** (user).
- Committed to git this round.

## STILL OPEN (user decisions / future passes)
1. ~~Simond kids' climbing harnesses ×3~~ — **archived (user, 2026-07-11)**; catalog now has zero kids' items.
2. ~~Zenbivy Overland remainder~~ — **entire Overland series archived (user, 2026-07-11)**: 4 ZipBed twins + 6 remaining (Double Quilts/Sheet/Double/Bundles). Zenbivy 97 active.
3. Hiking-Shoes-named-"Boots" (folds into the pending Decathlon decision).
2. Decathlon footwear pair-vs-single: confirm on the next store-photo batch (values ≥400g assumed pair).
3. 53 empty descriptions (32 brands) — needs per-brand source fetches; low value.
4. TINY HELIO 600Z vs 2025 model-year pair kept deliberately.

---

## Suggested fix order (combined)
1. **Snow Peak weights**: null or PDP-re-scrape (88 items) — biggest single-brand defect.
2. **Black Diamond PDP spec re-scrape** (~300 items; 4/6 spot-checks wrong) — biggest pre-existing risk.
3. **Footwear weight convention**: normalize ~30 shoe/boot items to one convention + disclosure.
4. Point fixes: GramXpert eLite ×2, Flextail ZERO PUMP + EVO REPELLER, Vargo Decagon, Arc Venta, Patagonia Capilene ×3, Nitecore bundles (null or drop); investigate Vargo round-lb items + Dandee poncho.
5. Purge/retype: Nitecore accessories/signal lights/bundles (~20), Flextail mats, the ~25 pre-existing mis-types (R2-Sev-2 list), 2 Simond VF lanyards.
6. Merge dupes: 7 pairs from round 1 + MSR Front Range tarp; decide Zenbivy twins + Katabatic Flex 40.
7. Descriptions: TOAKS CSS re-set (46), 600-cap re-backfill (44), empty descs (53), entity cleanup (54), boundary-truncate everywhere.
8. Icebreaker Accessories-hole re-import + technical-tops decision; Smartwool kids filter + sock re-collapse + gender backfill.
9. Snow Peak scope cull (~25 lifestyle) + chopsticks re-admit; S2S Detour/BD-lifestyle/basecamp-tent scope decisions.
