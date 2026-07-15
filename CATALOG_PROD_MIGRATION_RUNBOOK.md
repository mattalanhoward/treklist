# Catalog Prod Migration Runbook

_Migrate the curated catalog from **`treklist_local`** → **prod** using **archive-and-re-add**.
Writes ONLY to `catalogitems` and `merchantoffers`. Never touches `gearitems`,
`globalitems`, `users`, or `gearlists`._

**Script:** [`server/src/scripts/migrate-catalog-to-prod.js`](server/src/scripts/migrate-catalog-to-prod.js)
**Companion:** [`server/src/scripts/normalize-itemtypes.js`](server/src/scripts/normalize-itemtypes.js)

> This runbook is a **manual checklist**. Nothing here has been run against prod.
> Run the **Dress Rehearsal (§4)** — a full migration + rollback against a local
> copy of prod — before you touch prod in §5.

---

## 1. What this does (and the two hazards it defuses)

**Archive-and-re-add**, in order, against the destination DB:

- **[A] Archive** every existing prod `catalogitems` doc (`isActive → false`).
  Nothing is deleted — user gear references (`gearItem.productId`,
  `globalItem.productId → CatalogItem._id`) keep resolving.
- **[B] Re-add** every curated local item via `replaceOne({_id}, doc, {upsert})`.
  Same `_id` = overwrite in place (re-activates + updates content); new `_id` = insert.
- **[C] Offers**: for each re-added item, delete its stale dest offers, then upsert
  every local offer by `_id`. Offers for **archived-only** items are **left alone**
  so a user who owns a discontinued item keeps its buy-link.

**Hazard 1 — `_id` overlap.** Many curated local docs originated from prod and share
prod's `_id`. Re-adding *by `_id`* overwrites in place, so every gear reference still
points at a live doc. (Verified in rehearsal: overlap items replaced, refs 0-dangling.)

**Hazard 2 — the pre-save hook wipes fields.** The `CatalogItem` Mongoose model's
pre-save/pre-update hooks re-normalize every field from the doc and silently blank
anything not present (data-loss incident 2026-06-29,
`gotcha_select_save_wipes_fields`). **This script uses the raw `mongodb` driver only**
— no Mongoose models, so those hooks never run. `normalize-itemtypes.js` (§5.4) *does*
use Mongoose but only `$set`s `itemType`, which the update hook handles without
touching attributes (confirmed in rehearsal: `brand` and all other fields survived).

**The offer unique index** `{productId, network, region, merchantId}` is why Phase C
deletes-before-upsert: a curated offer with a fresh `_id` but the same
product+network+region+merchant as a surviving prod offer would throw `E11000`.
Deleting the stale one first avoids it. (Verified in rehearsal.)

---

## 2. Preconditions (do these once, before anything)

### 2.1 Confirm the EXACT prod DB name — ⚠️ do not assume

The `MONGO_URI` default db path is **`treklist`** (lowercase), but a memory note
records the normalize step as `--db TrekList` (CamelCase). MongoDB db names are
**case-sensitive** — these are different databases. `treklist_local` (the curated
source) lives on the **same Atlas cluster** as prod, so a wrong name is a live hazard.

**Resolve it authoritatively by listing the cluster's databases:**

```bash
cd /Users/matthewhoward/Projects/treklist

# CLUSTER_URI = MONGO_URI with the /treklist db path stripped (keeps credentials).
# mongodump/mongorestore/mongosh need a path-less URI so we can name --db explicitly.
export CLUSTER_URI="$(grep '^MONGO_URI=' server/.env \
  | sed -E 's/^MONGO_URI=//; s#(@[^/]+)/[^?]*#\1/#')"

# Eyeball it — should end in `mongodb.net/?retryWrites=...` (no db between / and ?):
echo "$CLUSTER_URI" | sed -E 's#//[^@]*@#//***:***@#'

# List databases + their catalog/offer counts:
mongosh "$CLUSTER_URI" --quiet --eval '
  db.adminCommand("listDatabases").databases
    .filter(d => /trek/i.test(d.name))
    .forEach(d => {
      const x = db.getSiblingDB(d.name);
      print(d.name.padEnd(20),
        "cat:", x.catalogitems.countDocuments({}),
        "active:", x.catalogitems.countDocuments({isActive:true}),
        "offers:", x.merchantoffers.countDocuments({}));
    });'
```

Whichever db shows the **live production** catalog (the large, real one that is **not**
`treklist_local`) is your prod db. Set it and use it everywhere below:

```bash
export PROD_DB="treklist"     # ← REPLACE with the exact name listDatabases printed
export SRC_DB="treklist_local"
```

> If `listDatabases` shows **both** a `treklist` and a `TrekList`, STOP and figure out
> which the deployed app actually connects to (check the hosting env's
> `MONGO_DB_NAME`) before proceeding. Do not guess.

### 2.2 Tools

`mongodump`, `mongorestore`, `mongosh`, `node` on PATH (all present on this machine).
The migration script uses the `mongodb` driver bundled in `server/node_modules`, so run
it from the `server/` directory.

---

## 3. Step 1 — Fresh prod backup (REQUIRED, do not skip)

Dump prod's two writable collections **plus** `gearitems`/`globalitems` as a read-only
reference snapshot. `server/backups/` is git-ignored.

```bash
cd /Users/matthewhoward/Projects/treklist
export STAMP="$(date +%Y%m%dT%H%M%S)"
export PROD_DUMP="server/backups/dump-prod-${PROD_DB}-${STAMP}"

for coll in catalogitems merchantoffers gearitems globalitems; do
  mongodump --uri "$CLUSTER_URI" --db "$PROD_DB" --collection "$coll" --out "$PROD_DUMP"
done

# Confirm the dump exists and is non-empty:
find "$PROD_DUMP" -name '*.bson' -exec ls -lh {} \;
```

### 3.1 Rollback command — WRITE THIS DOWN NOW (verbatim)

This is the exact command to restore prod's catalog to its pre-migration state. It
`--drop`s and restores **only** the two writable collections; `gearitems`/`globalitems`
in the dump are **not** restored (they were never written).

```bash
# ⛑  ROLLBACK — restores catalogitems + merchantoffers ONLY, from the §3 backup:
mongorestore --uri "$CLUSTER_URI" --drop \
  --nsInclude "${PROD_DB}.catalogitems" \
  --nsInclude "${PROD_DB}.merchantoffers" \
  "$PROD_DUMP"
```

Keep `$PROD_DUMP`, `$PROD_DB`, and `$CLUSTER_URI` recorded somewhere outside this shell
in case the session dies. (Rehearsed in §4 — it reverts counts and content exactly and
leaves gear/global untouched.)

---

## 4. DRESS REHEARSAL (do this before §5 — no prod writes)

Restore the prod backup **and** the curated source into a **local mongod**
(`127.0.0.1:27017`, already running), then run the entire migration + rollback there.
Zero Atlas write risk.

```bash
cd /Users/matthewhoward/Projects/treklist/server
export LOCAL="mongodb://127.0.0.1:27017"
export REH_PROD="treklist_prod_rehearsal"
export REH_SRC="treklist_local_rehearsal"
export REH_SRC_DUMP="../$PROD_DUMP-src"   # separate dir for the source dump
```

### 4.1 Load a copy of prod into the local mongod

```bash
mongorestore --uri "$LOCAL" --drop \
  --nsFrom "${PROD_DB}.*" --nsTo "${REH_PROD}.*" \
  "../$PROD_DUMP"
```

### 4.2 Load a copy of the curated source into the local mongod

```bash
# Dump the curated source from Atlas (read-only)…
for coll in catalogitems merchantoffers; do
  mongodump --uri "$CLUSTER_URI" --db "$SRC_DB" --collection "$coll" --out "$REH_SRC_DUMP"
done
# …and restore it locally under the rehearsal name:
mongorestore --uri "$LOCAL" --drop \
  --nsFrom "${SRC_DB}.*" --nsTo "${REH_SRC}.*" \
  "$REH_SRC_DUMP"
```

### 4.3 Record the pre-migration signature (to compare after rollback)

```bash
mongosh "$LOCAL" --quiet --eval '
  const p = db.getSiblingDB("'"$REH_PROD"'");
  print("PRE  cat total/active:",
    p.catalogitems.countDocuments({}), "/",
    p.catalogitems.countDocuments({isActive:true}),
    "offers:", p.merchantoffers.countDocuments({}),
    "gearitems:", p.gearitems.countDocuments({}));'
```

### 4.4 Dry run, then commit, against the LOCAL copy

```bash
# DRY RUN (no writes — prints planned counts):
node src/scripts/migrate-catalog-to-prod.js \
  --uri "$LOCAL" --source-db "$REH_SRC" --dest-db "$REH_PROD"

# COMMIT to the local copy (rehearsal dest is non-local ⇒ needs --confirm-dest):
node src/scripts/migrate-catalog-to-prod.js \
  --uri "$LOCAL" --source-db "$REH_SRC" --dest-db "$REH_PROD" \
  --commit --confirm-dest "$REH_PROD"
```

### 4.5 normalize-itemtypes on the local copy

```bash
MONGO_URI="$LOCAL" node src/scripts/normalize-itemtypes.js --db "$REH_PROD"          # preview
MONGO_URI="$LOCAL" node src/scripts/normalize-itemtypes.js --db "$REH_PROD" \
  --commit --confirm "$REH_PROD"
```

### 4.6 Verify the local copy

```bash
node src/scripts/migrate-catalog-to-prod.js \
  --uri "$LOCAL" --source-db "$REH_SRC" --dest-db "$REH_PROD" --verify

# Pick one real user list id from the copy, then render it:
mongosh "$LOCAL" --quiet --eval '
  const p = db.getSiblingDB("'"$REH_PROD"'");
  const gi = p.gearitems.findOne({productId: {$ne:null}});
  print("sample gearList id:", gi && gi.gearList);'

node src/scripts/migrate-catalog-to-prod.js \
  --uri "$LOCAL" --source-db "$REH_SRC" --dest-db "$REH_PROD" \
  --verify --list <PASTE_gearList_id>
```

**Expect:** V1 per-category counts src == dest (0 mismatches); V2 ~0 active items
without an offer; V3 images + offers present; V4 gearitems/globalitems 0 dangling;
V5 every list item resolves (archived items show `[archived]` but still resolve).

### 4.7 Practice the rollback once (on the local copy)

```bash
mongorestore --uri "$LOCAL" --drop \
  --nsFrom "${PROD_DB}.catalogitems" --nsTo "${REH_PROD}.catalogitems" \
  --nsFrom "${PROD_DB}.merchantoffers" --nsTo "${REH_PROD}.merchantoffers" \
  "../$PROD_DUMP"

# POST signature must equal the PRE signature from §4.3:
mongosh "$LOCAL" --quiet --eval '
  const p = db.getSiblingDB("'"$REH_PROD"'");
  print("POST cat total/active:",
    p.catalogitems.countDocuments({}), "/",
    p.catalogitems.countDocuments({isActive:true}),
    "offers:", p.merchantoffers.countDocuments({}),
    "gearitems:", p.gearitems.countDocuments({}));'
```

`gearitems` must be unchanged; catalog total/active and offers must match §4.3.
**Only proceed to §5 once the rehearsal migration, verify, and rollback all pass.**

### 4.8 Clean up rehearsal dbs

```bash
mongosh "$LOCAL" --quiet --eval '
  db.getSiblingDB("'"$REH_PROD"'").dropDatabase();
  db.getSiblingDB("'"$REH_SRC"'").dropDatabase();
  print("rehearsal dbs dropped");'
```

---

## 5. Prod migration

> Uses `$MONGO_URI` from `server/.env` (the script selects the db explicitly via
> `--source-db`/`--dest-db`, so the URI's default db path is irrelevant to it).

```bash
cd /Users/matthewhoward/Projects/treklist/server
```

### 5.1 Dry run against prod (writes nothing)

```bash
node src/scripts/migrate-catalog-to-prod.js \
  --uri "$MONGO_URI" --source-db "$SRC_DB" --dest-db "$PROD_DB"
```

Read the printed **Source catalog active** count — that is the target. Sanity-check
`[B]` overlap + inserts ≈ source count, and `[A]` archive count ≈ current prod active.

### 5.2 Commit

```bash
node src/scripts/migrate-catalog-to-prod.js \
  --uri "$MONGO_URI" --source-db "$SRC_DB" --dest-db "$PROD_DB" \
  --commit --confirm-dest "$PROD_DB"
```

### 5.3 normalize-itemtypes on prod

Normalizes any legacy itemType strings left on **archived** prod items (e.g. the old
`"Backpacking Stove (Canister)"` → `"Stove (Canister)"`). Re-added items are already
normalized. `normalize-itemtypes.js` reads `MONGO_URI` from `.env` and selects the db
via `--db`.

```bash
node src/scripts/normalize-itemtypes.js --db "$PROD_DB"                          # preview
node src/scripts/normalize-itemtypes.js --db "$PROD_DB" --commit --confirm "$PROD_DB"
```

### 5.4 Verify prod (read-only)

```bash
node src/scripts/migrate-catalog-to-prod.js \
  --uri "$MONGO_URI" --source-db "$SRC_DB" --dest-db "$PROD_DB" --verify
```

Then render one real user list (§6.3).

---

## 6. Verification queries

### 6.1 Per-category active counts match source (built into `--verify` V1)

```bash
node src/scripts/migrate-catalog-to-prod.js \
  --uri "$MONGO_URI" --source-db "$SRC_DB" --dest-db "$PROD_DB" --verify
```

`V1` prints per-category `src` vs `dest` and flags any `**MISMATCH**` — expect 0.

### 6.2 Offer + image spot-check (built into `--verify` V2/V3)

`V2` = active items with **no** offer (expect ~0). `V3` = a random sample of active
items with their `imageUrls[0]` and resolved offer deep-link. Bump the sample with
`--sample 20`. Ad-hoc cross-check in mongosh:

```bash
mongosh "$CLUSTER_URI" --quiet --eval '
  const p = db.getSiblingDB("'"$PROD_DB"'");
  print("active items:", p.catalogitems.countDocuments({isActive:true}));
  print("items missing imageUrls[0]:",
    p.catalogitems.countDocuments({isActive:true, "imageUrls.0": {$exists:false}}));
  print("resolved offers:", p.merchantoffers.countDocuments({productId:{$type:"objectId"}}));'
```

### 6.3 One real user list still renders (built into `--verify` V5)

```bash
# Find a real list that references catalog items:
mongosh "$CLUSTER_URI" --quiet --eval '
  const p = db.getSiblingDB("'"$PROD_DB"'");
  const gi = p.gearitems.findOne({productId:{$ne:null}});
  print("gearList id:", gi && gi.gearList);'

node src/scripts/migrate-catalog-to-prod.js \
  --uri "$MONGO_URI" --source-db "$SRC_DB" --dest-db "$PROD_DB" \
  --verify --list <PASTE_gearList_id>
```

Expect `resolved: N/N` — every item resolves (archived ones show `[archived]` but still
resolve, which is the whole point of archive-not-delete). Then spot-check the live app:
open that list in the dashboard (desktop + mobile) and confirm items, weights, images,
and buy-links render. `V4` also confirms 0 dangling `gearitems`/`globalitems` refs.

---

## 7. Rollback (if anything looks wrong)

Restore the §3 backup over the two writable collections. `gearitems`/`globalitems`/
`users`/`gearlists` were never written, so nothing else needs reverting.

```bash
mongorestore --uri "$CLUSTER_URI" --drop \
  --nsInclude "${PROD_DB}.catalogitems" \
  --nsInclude "${PROD_DB}.merchantoffers" \
  "$PROD_DUMP"

# Confirm revert:
mongosh "$CLUSTER_URI" --quiet --eval '
  const p = db.getSiblingDB("'"$PROD_DB"'");
  print("cat total/active:",
    p.catalogitems.countDocuments({}), "/",
    p.catalogitems.countDocuments({isActive:true}),
    "offers:", p.merchantoffers.countDocuments({}));'
```

The migration is **idempotent**, so a partial failure can be handled either way: re-run
§5.2 from the top, **or** roll back with the command above and start over.

---

## 8. Post-migration cleanup

- Prune `server/backups/` (≈4.4 GB of historical local dumps) **after** you're
  confident in the migration and no longer need the rollback point.
- Update memory `project_add_gear_modal_redesign.md` / `project_catalog_importer.md`:
  mark the prod ARCHIVE-AND-READD migration DONE, note the `$PROD_DUMP` path, and drop
  the "prod still has old stove itemType string" reminder.
- Do the live-site phone verification of the add-gear flow (the other launch blocker).

---

## Appendix — script reference

```
migrate-catalog-to-prod.js
  --uri <uri>            Mongo connection (default: $MONGO_URI). Script picks db explicitly.
  --source-db <name>     REQUIRED. Curated source (treklist_local). No default.
  --dest-db <name>       REQUIRED. Destination (prod). No default.
  --commit               Write. Omit = DRY RUN (default; prints planned counts only).
  --confirm-dest <name>  REQUIRED to --commit to any non-local dest; must equal --dest-db.
  --verify               Read-only checks (V1 category counts, V2 no-offer, V3 spot-check,
                         V4 referential integrity, V5 render a list). Never writes.
  --list <gearListId>    With --verify: render one real user list.
  --sample <n>           With --verify: sample size for V3 (default 8).
  --source-uri/--dest-uri  Override per-endpoint URI (used only in the rehearsal).
```

Guarantees, all exercised in the rehearsal:
- Raw `mongodb` driver only for writes (`replaceOne`/`updateMany`/`deleteMany`/`bulkWrite`);
  **no Mongoose `.save()`**, so no pre-save field-wipe.
- Writes **only** `catalogitems` + `merchantoffers` in `--dest-db`. Reads gear/global
  only under `--verify`.
- `--source-db`/`--dest-db` required & must differ; non-local `--commit` needs `--confirm-dest`.
- Idempotent: re-runnable from the top after a partial failure.
```
