# Add-Gear Modal Redesign — Implementation Handoff

**Status:** Spec complete (wireframe v4, 2026-07-11). Ready to build. Not started.
**Spec (visual, canonical):** `docs/add-gear-modal-wireframe-v4.html` — open it in a browser. Same content is published at https://claude.ai/code/artifact/cd11d606-3f36-42d9-b992-88a8b7114a07 (v4). The wireframe's legend markers 1–17 and the footer "Locked decisions / Mobile build contract" ARE the spec; this doc adds code context.

## Goal

Replace the current two-stacked-modal add flow with a single-surface flow:
- **Desktop:** one modal, two-pane master–detail (result list left, preview pane right). Click row = preview, checkbox = batch add. No stacked modal ever.
- **Mobile:** full-screen takeover; tap row = bottom sheet (the mobile preview pane); checkbox = batch with a sticky commit bar. **Mobile is the marketing wedge** — TrekList is advertised as a big improvement over competitors (LighterPack) in the mobile browser. The "Mobile build contract" below is non-negotiable.

## Current code (what you're replacing/reworking)

- `client/src/components/SmartItemSearch.jsx` (~1,636 lines) — the current search/add modal ("Add gear item(s)", Import/Custom tabs, search box + AI camera scan, URL paste, results list, inline "Create X as a custom item" row, "Request a Gear Item" footer). Much of this survives conceptually; the layout changes.
- `client/src/components/CatalogItemPreviewModal.jsx` — the stacked "Catalog item" detail modal. Its content becomes the right-hand preview pane (desktop) / bottom sheet (mobile). The stacked modal is eliminated.
- Entry points: `client/src/pages/GearListView.jsx` (category "Add item" → destination is that category) and the My Gear sidebar "+" (destination My Gear).
- Theming: Tailwind + CSS-variable themes (`client/src/themes.css`, `client/tailwind.config.js`). Use the token classes (`text-primary`, `bg-secondary/10`, etc.) — never hardcode hex, all themes must work. Default theme: navy #172B4D primary, steel #44546F secondary, electric blue #0C66E4 accent, white cards, `rounded-lg`, pill chips.
- A global g/oz unit toggle already exists (region-defaulted) — all weights in this feature must respect it.

## Locked decisions (do not re-litigate — user-approved 2026-07-11)

1. **Click = preview, checkbox = add.** Only the checkbox batches. "Full details" is a link inside the pane/sheet.
2. **Row data contract:** brand eyebrow, name, thumbnail, one key spec line, **weight** (the hero number) in every result row.
3. **Added ≠ locked.** Items already in My Gear / on the list stay checkable (shown with an "In my gear"/"Added" pill). Fixes a real complaint: same item in two categories was blocked. Quantity stepper on the list still covers same-category duplicates.
4. **Commit button names count + destination:** "Add 2 to Hiking" / "Add 2 to My Gear". Disabled at zero.
5. **Inline custom-create row** at the end of every result set: "＋ Create '«query»' as a custom item" → opens the Custom tab pre-filled. Tabs stay for now (merging = v2).
6. **Browse zero state** (empty search): 14 locked category tiles (name + count, never icon-only; ragged last row accepted). Tile click = results scoped to that category with subcategory chips. Plus an **optional, config-driven featured-brand slot**: admin-set (e.g. Atom Packs), row hidden entirely when unset — ship v1 hidden if no admin config exists yet; labelled "Featured"; browse zero state only, never influences search relevance.
7. **Facet row:** active category chip + subcategory chips + count ("51 of 17,400 items"); horizontal scroll; Brand chip is a later drop-in.
8. **Search modes:** name / store-URL paste / Decathlon item ID / AI photo scan. Desktop: labelled "Search by:" chip row in zero state. Mobile: **rotating placeholder inside the field instead** (chips there read as filters).
9. **Search-results pane auto-focuses the top-ranked result** — pane is never empty.
10. **Virtualized result list** (desktop and mobile).
11. **Keyboard path (desktop):** ↑/↓ move row focus (pane follows), Space toggles checkbox, Enter commits the batch.
12. **Report an issue:** quiet ⚑ flag under the specs in pane/sheet → anchored **popover** (never a modal). Pre-selects nothing; "Weight is incorrect" shows the precision disclosure before filing. Auto-attaches itemId, variant, shown values, date. Server: dedupe by item+field with counter → queue surfaced in admin catalog view (`client/src/pages/AdminView.jsx`).
13. **Weight-precision disclosure** under the weight hero ("Manufacturer spec · flat across sizes · verified Jul 2026") — see memory rule `feedback_flat_weight_disclosure`.
14. **Variant-on-batch-add (CONFIRMED 2026-07-12):** checking a variant row without picking a size adds the **default fit** and flags the gear item **"size not set"** (visible + editable on the gear item later). Never blocks the batch. Do NOT make the checkbox expand a size picker.
15. **Browse grid is the 14 category tiles only** — the ragged last row is accepted; do NOT pad with utility/filler tiles. The camera stays as the small button beside the search bar.

## "Request a gear item" — CUT (confirmed 2026-07-12)

Remove the feature end-to-end: the "Request a Gear Item" link/UI in SmartItemSearch, any request modal/component, its server route(s)/model if one exists (search the codebase), and its strings from all 6 locale files. The inline custom-create row is the user-facing replacement.

**Replacement demand signal — zero-result search log (build this):**
- Client: when a catalog search returns 0 results, fire a fire-and-forget log call (debounce; final settled query only, not per-keystroke; no result also = after filters).
- Server: upsert `{ query (normalized lowercase), count++, lastSeenAt }` in a small collection; no auth-identifying data needed beyond the query.
- Admin: small table in the admin view (query · count · last seen, sorted by count) — feeds the brand backlog.

## Entry points — one component, two modes

The current modal is invoked from **four** places. All must switch to the new component; build it once with a mode/destination API:

| Call site | Mode | Commit label |
|---|---|---|
| Category "Add item" (GearListView) | `add` (batch) | "Add N to «Category»" |
| Sidebar add | `add` (batch) | "Add N to «Category»" (or list default) |
| My Gear add (sidebar "+" / My Gear page) | `add` (batch) | "Add N to My Gear" |
| **Swap item** (swap icon on a gear card) | `swap` (**single-select**) | "Swap for this" |

**Swap mode differences:** checkboxes hidden entirely; row tap previews as usual; the pane (desktop) / sheet (mobile) primary button reads "Swap for this" and replaces the source gear item, keeping category, quantity, and worn/consumable flags where compatible. No commit bar / batch footer count in swap mode.

## Item Details modal — stays, but aligns

`client/src/components/GlobalItemEditModal.jsx` ("Item Details": opened by clicking an item name/brand on the gear list; read-only on public shared lists) is **not** replaced by this work — different job (edit an owned item's instance: weight override, variant, delete) vs the add-flow preview (read-only catalog data, pre-add). Two alignment tasks while in the area:
- Adopt the pane's visual language: weight hero + precision disclosure instead of a bare number field (user's own measured weight override remains editable).
- Add the ⚑ "Report an issue" flag there too (owners notice bad catalog data most) — same popover + server queue as decision 12. Hide on the public read-only variant.

## Mobile build contract (the marketing claims live here)

- Search input font-size **16px minimum** (smaller triggers iOS Safari auto-zoom on focus; app base font is 14px, so this needs an explicit override).
- Container height `100dvh` (the `h-d-screen` token already exists in tailwind.config), commit bar padded by `env(safe-area-inset-bottom)`.
- **Takeover and sheet each push a history entry**: Android back / iOS swipe-back closes sheet → then takeover → never navigates away from the app.
- Commit bar hides while the virtual keyboard is open.
- Rows ≥ 56px tall; checkbox draws ~22px with a 44×44 hit area; size chips ≥ 44px wide.
- **After add, don't eject:** sheet-add closes the sheet, flips the row to "In list ✓", keeps the list open. Batch commit closes the takeover with a toast "Added 2 to Hiking — **Undo**". Toast+undo, never a confirm dialog.
- Bottom sheet: swipe-down, scrim tap, or back gesture dismisses.

## Suggested phasing (one session each, review between)

1. **Desktop two-pane modal** — rework SmartItemSearch layout; fold CatalogItemPreviewModal content into the pane; row contract; batch select; destination-echo Add; keyboard nav; variant default + "size not set" flag (decision 14). Remove "Request a Gear Item" end-to-end while in the file (see CUT section). (Largest phase.)
2. **Zero state + facets** — category tiles, featured-brand slot (config-driven, hidden when unset), subcategory chips, search-mode chips/placeholder.
3. **Mobile takeover** — sheet, commit bar, history entries, safe-area/keyboard/16px rules, toast+undo.
4. **Swap mode + wire all four entry points** (see Entry points table).
5. **Report-an-issue + zero-result log** — report popover UI + server model/route + admin queue table; zero-result search log + its admin table (same admin surface); add the report flag to GlobalItemEditModal ("Item Details — stays, but aligns").

## Gotchas (from project memory — real incidents)

- **Translations:** any user-facing copy change must update all 6 locale files (`client/src/locales/{en,de,es,fr,it,nl}/common.json`) — standing rule, don't ask.
- **Never `.select()` + `.save()` a CatalogItem** (pre-save hook re-normalizes from `this.*` and wipes unprojected fields — caused a data-loss incident). Use `collection.updateOne`.
- Two hasOffer functions must stay in sync: `addOfferFlags` (`server/src/routes/gearLists.js`) and `addOfferFlagsToItems` (`server/src/routes/gearItems.js`).
- `GearItem.productId` may be null on older items; fall back via globalItem.
- Catalog variant standard (LOCKED): purpose-spec (volume/temp/R-value) = separate products; fit-spec (size/length) = variants; color never; gender separate.
- There are uncommitted WIP files in the working tree (catalog curation scripts etc.) — don't sweep them into feature commits.

## Verification

- Drive the real flow (desktop + mobile viewport) — add from search, add from browse, add an "Added" item, batch add, custom-create from zero results, undo a batch.
- Mobile: test in responsive mode at 390×844; verify no horizontal scroll, back-button behavior, keyboard interactions.
- Run existing lint/build (`client`: vite build) before committing.
