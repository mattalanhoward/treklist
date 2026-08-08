# Mountain Hardwear — scrape checklist (PARKED 2026-08-08)

**Why parked:** MH is Salesforce Commerce Cloud + **PerimeterX** + Cloudflare. No open
feed; `curl`/node hard-blocked (302 challenge); and **WebFetch (our scraper) gets
redirected to the MH homepage** on product pages — so we can't pull specs/images with
our tooling. The user's own scraper (residential IP / PerimeterX bypass) gets through.
**Plan:** user screenshots each product's spec block + a product image; we then build
`create-mh.js` + import (same pattern as the Decathlon feed / Neve+Mont weights).

**Scope (user):** backpacking gear only (tents / sleeping bags / packs) + the Ghost
Whisperer down line. Skipped: Mineral King 3P, Trango 2P/3P, AMG 75/105 (per user),
plus all other apparel, car-camping/expedition kit, kids.

**Per item, capture:** weight (tents = min/trail g; bags = total g, per size Reg/Long if
shown; jackets = garment g + fill weight/power; packs = g per torso size), temperature
rating, fill power + down/synthetic, volume (packs), and one clean product image URL.

⚠ URLs may drift (MH recycles product IDs seasonally) — if one 404s, search the model
name on the site. The `%2F` / `/-` encodings below are from search results; the plain
model name is the reliable key.

## Tents (2)
- [ ] Nimbus UL 2 Person Tent — https://www.mountainhardwear.com/p/nimbus-ul-2-person-tent-2102631.html
- [ ] Aspect 2 Person Tent — https://www.mountainhardwear.com/p/aspect-2-person-tent-2102501.html

## Sleeping Bags — Bishop Pass (down, 650-fill) (6)
- [ ] Bishop Pass 0F/−18C — https://www.mountainhardwear.com/p/bishop-pass-0f/-18c-2105561.html
- [ ] Bishop Pass 15F/−9C — https://www.mountainhardwear.com/p/bishop-pass-15f/-9c-2105571.html
- [ ] Bishop Pass 30F/−1C — https://www.mountainhardwear.com/p/bishop-pass-30f%2F-1c-2105581.html
- [ ] Women's Bishop Pass 0F/−18C — https://www.mountainhardwear.com/p/womens-bishop-pass-0f%2F-18c-2105591.html
- [ ] Women's Bishop Pass 15F/−9C — https://www.mountainhardwear.com/p/womens-bishop-pass-15f%2F-9c-sleeping-bag-2105601.html
- [ ] Women's Bishop Pass 30F/−1C — https://www.mountainhardwear.com/p/womens-bishop-pass-30f/-1c-2105611.html

## Sleeping Bags — Phantom (down, 800/1000-fill) (2)
- [ ] Phantom 0F/−18C — https://www.mountainhardwear.com/p/phantom-0f%2F-18c-2063651.html
- [ ] Phantom 15F/−9C — https://www.mountainhardwear.com/p/phantom-15f%2F-9c-down-sleeping-bag-2063661.html

## Sleeping Bags — Lamina (synthetic, Temperlite) (7)
- [ ] Lamina −20F/−29C — https://www.mountainhardwear.com/p/lamina--20f/-29c-2095141.html
- [ ] Lamina 0F/−18C — https://www.mountainhardwear.com/p/lamina-0f/-18c-2095151.html
- [ ] Lamina 15F/−9C — https://www.mountainhardwear.com/p/lamina-15f/-9c-2095161.html
- [ ] Lamina 30F/−1C — https://www.mountainhardwear.com/p/lamina-30f%2F-1c-2095171.html
- [ ] Women's Lamina 0F/−18C — https://www.mountainhardwear.com/p/womens-lamina-0f%2F-18c-2095251.html
- [ ] Women's Lamina 15F/−9C — https://www.mountainhardwear.com/p/womens-lamina-15f%2F-9c-2095191.html
- [ ] Women's Lamina 30F/−1C — https://www.mountainhardwear.com/p/womens-lamina-30f%2F-1c-2025481.html

## Packs (2)
- [ ] Scrambler 25L Backpack — https://www.mountainhardwear.com/p/scrambler-25l-backpack-2110141.html
- [ ] Scrambler 35L Backpack — https://www.mountainhardwear.com/p/scrambler-35l-backpack-2110151.html

## Ghost Whisperer — down insulation (Insulated Jacket, gendered) (8)
- [ ] Men's Ghost Whisperer Hoody — https://www.mountainhardwear.com/p/mens-ghost-whisperer-hooded-down-jacket-2104451.html
- [ ] Women's Ghost Whisperer Hoody — https://www.mountainhardwear.com/p/womens-ghost-whisperer-hooded-down-jacket-2104731.html
- [ ] Men's Ghost Whisperer Jacket — https://www.mountainhardwear.com/p/mens-ghost-whisperer-down-jacket-2104461.html
- [ ] Women's Ghost Whisperer Jacket — https://www.mountainhardwear.com/p/womens-ghost-whisperer-jacket-2104741.html
- [ ] Men's Ghost Whisperer UL Hoody — https://www.mountainhardwear.com/p/mens-ghost-whisperer-ul-hooded-down-jacket-2092051.html
- [ ] Women's Ghost Whisperer UL Hoody — https://www.mountainhardwear.com/p/womens-ghost-whisperer-ultralight-hooded-down-jacket-2092701.html
- [ ] Men's Ghost Whisperer Vest — https://www.mountainhardwear.com/p/mens-ghost-whisperer-vest-2104471.html
- [ ] Women's Ghost Whisperer Vest — https://www.mountainhardwear.com/p/womens-ghost-whisperer-vest-2104751.html

**Total: 27 items.**
