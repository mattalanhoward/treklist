#!/usr/bin/env node
/**
 * backfill-copiedfrom.js
 *
 * Populates GearList.copiedFrom for lists that were copied BEFORE the copy
 * routes started recording provenance.
 *
 * There is no stored link, so a copy is matched to its source by title and then
 * VERIFIED by item overlap — title alone is not enough, because users rename
 * copies (we found one renamed "West Highland Way Wild Camping (copy)" to
 * "East Highland Way Wild Camping (copy)").
 *
 * Matching:
 *   1. Candidate titles: "<T> (copy)" -> T (public copy route)
 *                        "Copy of <T>" -> T (own-list copy route)
 *      A renamed copy has no usable title, so it is matched on overlap alone.
 *   2. Candidates must pre-date the copy and not be owned by... anyone in
 *      particular — self-copies are legitimate.
 *   3. Score = share of the copy's IMPORTED items that appear in the candidate.
 *      Imported items are the ones that came in with the copy, so this stays
 *      accurate even when the user deleted most of them (a stripped-down copy
 *      still scores 1.0 as long as what survived came from the source).
 *
 * Anything below MIN_SCORE is left alone and reported, rather than guessed.
 *
 * Usage:
 *   node scripts/backfill-copiedfrom.js                  # dry run, MONGO_DB_NAME
 *   node scripts/backfill-copiedfrom.js --db TrekList    # dry run against prod
 *   node scripts/backfill-copiedfrom.js --db TrekList --apply
 */

require("dotenv").config();
const mongoose = require("mongoose");

const GearList = require("../src/models/gearList");
const GearItem = require("../src/models/gearItem");
const GlobalItem = require("../src/models/globalItem");
const ShareToken = require("../src/models/ShareToken");
const User = require("../src/models/user");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dbFlagIndex = args.indexOf("--db");
const DB_NAME =
  dbFlagIndex >= 0 ? args[dbFlagIndex + 1] : process.env.MONGO_DB_NAME;

// Share of the copy's imported items that must be present in the candidate.
const MIN_SCORE = 0.6;
// How far either side of the list's creation an imported GlobalItem counts as
// "arrived with this copy".
const IMPORT_WINDOW_MS = 120_000;
// When the title offers no clue, this many items must line up before a
// contents-only match is trusted.
const MIN_FINGERPRINT_NO_TITLE = 10;

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const itemKey = (i) => `${norm(i.brand)}::${norm(i.name)}`;

function candidateTitles(title) {
  const t = String(title || "").trim();
  const out = [];
  const copySuffix = /\s*\(copy\)\s*$/i;
  if (copySuffix.test(t)) out.push(t.replace(copySuffix, "").trim());
  const copyPrefix = /^copy of\s+/i;
  if (copyPrefix.test(t)) out.push(t.replace(copyPrefix, "").trim());
  return out.filter(Boolean);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  console.log(`Connected to ${DB_NAME}${APPLY ? "" : "  (DRY RUN)"}\n`);

  const allLists = await GearList.find({})
    .select("title owner createdAt copiedFrom isSample isFeatured")
    .lean();

  // Sample lists are seeded at signup, not copied. They are also the main
  // source of false positives: a user's sample list is created moments before
  // they copy something, so imported items land inside the time window.
  const targets = allLists.filter((l) => !l.copiedFrom?.at && !l.isSample);
  const skippedSamples = allLists.filter(
    (l) => !l.copiedFrom?.at && l.isSample
  ).length;
  console.log(
    `${allLists.length} lists total, ${targets.length} candidates ` +
      `(${skippedSamples} sample lists skipped)\n`
  );

  // Item names per list, for overlap scoring.
  const itemsByList = new Map();
  const allItems = await GearItem.find({})
    .select("gearList globalItem brand name")
    .lean();
  for (const it of allItems) {
    const k = String(it.gearList);
    if (!itemsByList.has(k)) itemsByList.set(k, []);
    itemsByList.get(k).push(it);
  }

  const importedGlobals = await GlobalItem.find({ importedFromShare: true })
    .select("owner brand name createdAt")
    .lean();
  const importedByOwner = new Map();
  for (const g of importedGlobals) {
    const k = String(g.owner);
    if (!importedByOwner.has(k)) importedByOwner.set(k, []);
    importedByOwner.get(k).push(g);
  }
  const importedGlobalIds = new Set(
    importedGlobals.map((g) => String(g._id))
  );

  const users = await User.find({}).select("email").lean();
  const emailById = new Map(users.map((u) => [String(u._id), u.email]));

  // A public copy could only ever be made from a list with a share token, so
  // this is the strongest filter available — and it correctly resolves
  // copy-chains, where several lists have identical contents but only the
  // genuinely shared one could have been the source.
  const shareTokens = await ShareToken.find({}).select("list").lean();
  const sharedListIds = new Set(shareTokens.map((t) => String(t.list)));

  const listsByTitle = new Map();
  const listsByOwner = new Map();
  for (const l of allLists) {
    const k = norm(l.title);
    if (!listsByTitle.has(k)) listsByTitle.set(k, []);
    listsByTitle.get(k).push(l);

    const o = String(l.owner);
    if (!listsByOwner.has(o)) listsByOwner.set(o, []);
    listsByOwner.get(o).push(l);
  }

  const matched = [];
  const unmatched = [];

  for (const copy of targets) {
    // Fingerprint: what arrived with this copy.
    const rows = itemsByList.get(String(copy._id)) || [];
    const importedRows = rows.filter((r) =>
      importedGlobalIds.has(String(r.globalItem))
    );

    const created = new Date(copy.createdAt).getTime();

    // Attribute each imported item to the NEAREST list the user created, not to
    // every list inside the window — otherwise two copies made a couple of
    // minutes apart contaminate each other's fingerprints.
    const ownerListTimes = (listsByOwner.get(String(copy.owner)) || []).map(
      (l) => new Date(l.createdAt).getTime()
    );
    const arrivedWithCopy = (importedByOwner.get(String(copy.owner)) || []).filter(
      (g) => {
        const t = new Date(g.createdAt).getTime();
        if (Math.abs(t - created) > IMPORT_WINDOW_MS) return false;
        const nearest = ownerListTimes.reduce(
          (acc, lt) => (Math.abs(t - lt) < Math.abs(t - acc) ? lt : acc),
          ownerListTimes[0]
        );
        return nearest === created;
      }
    );

    // The list must still hold at least one item that came in with a copy.
    // Without that anchor the time window alone can attribute someone else's
    // import to this list (this is what mis-flagged sample lists).
    if (importedRows.length === 0) continue;

    const fingerprint = new Set([
      ...importedRows.map(itemKey),
      ...arrivedWithCopy.map(itemKey),
    ]);
    if (fingerprint.size === 0) continue;

    // Candidates: same-titled lists (minus the copy marker), plus every list
    // that pre-dates this one when the title gives us nothing.
    const titles = candidateTitles(copy.title);
    const titleCandidates = titles.flatMap((t) => listsByTitle.get(norm(t)) || []);

    const scoreAgainst = (candidates) => {
      const out = [];
      for (const cand of candidates) {
        if (String(cand._id) === String(copy._id)) continue;
        if (new Date(cand.createdAt).getTime() > created) continue;

        // Only a shared list, or one of the user's own, could have been copied.
        const isShared = sharedListIds.has(String(cand._id));
        const isSelf = String(cand.owner) === String(copy.owner);
        if (!isShared && !isSelf) continue;

        const candKeys = new Set(
          (itemsByList.get(String(cand._id)) || []).map(itemKey)
        );
        if (candKeys.size === 0) continue;

        let hits = 0;
        for (const k of fingerprint) if (candKeys.has(k)) hits += 1;

        out.push({
          cand,
          score: hits / fingerprint.size,
          hits,
          candSize: candKeys.size,
          isShared,
          isSelf,
        });
      }
      return out;
    };

    // Try the title first, but fall back to contents when the same-titled lists
    // were never shareable — the source is often titled differently from the
    // copy ("Alta Via 1 (copy)" came from "Alta Via 1 Hut-to-Hut").
    let scored = titleCandidates.length ? scoreAgainst(titleCandidates) : [];
    let titleMatched = scored.length > 0;
    if (!titleMatched) scored = scoreAgainst(allLists);

    // Copy-chains produce several candidates with identical contents. Prefer,
    // in order: better overlap, an actually-shared list, a featured list, then
    // the oldest — i.e. the most upstream plausible original.
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.isShared) - Number(a.isShared) ||
        Number(Boolean(b.cand.isFeatured)) - Number(Boolean(a.cand.isFeatured)) ||
        new Date(a.cand.createdAt) - new Date(b.cand.createdAt)
    );
    let best = scored[0] || null;
    let rejection = null;

    // With no title to go on, contents alone must carry the match. A handful of
    // generic items (socks, a lighter) matches almost any list, so demand a
    // substantial fingerprint AND a single unambiguous winner.
    if (best && !titleMatched) {
      const topRivals = scored.filter(
        (s) => s.score >= best.score - 1e-9
      );
      const distinctTitles = new Set(topRivals.map((s) => norm(s.cand.title)));

      if (fingerprint.size < MIN_FINGERPRINT_NO_TITLE) {
        rejection = `only ${fingerprint.size} items to match on and the title gives no hint`;
        best = null;
      } else if (distinctTitles.size > 1) {
        rejection = `${distinctTitles.size} different lists tie at ${(topRivals[0].score * 100).toFixed(0)}%`;
        best = null;
      }
    }

    const row = {
      copy,
      best,
      titleMatched,
      rejection,
      fingerprintSize: fingerprint.size,
    };

    if (best && best.score >= MIN_SCORE) matched.push(row);
    else unmatched.push(row);
  }

  console.log(`MATCHED ${matched.length}:\n`);
  for (const m of matched.sort((a, b) => b.best.score - a.best.score)) {
    const srcOwner = emailById.get(String(m.best.cand.owner)) || "?";
    const renamed = norm(m.best.cand.title) !== norm(candidateTitles(m.copy.title)[0] || "");
    console.log(
      `  "${m.copy.title}" (${emailById.get(String(m.copy.owner)) || "?"})\n` +
        `      <- "${m.best.cand.title}" by ${srcOwner}\n` +
        `      score ${(m.best.score * 100).toFixed(0)}% (${m.best.hits}/${m.fingerprintSize} of copied items found in a ${m.best.candSize}-item list)` +
        `${m.titleMatched ? "" : "  [TITLE DIFFERS — matched on contents]"}` +
        `${renamed && m.titleMatched ? "" : ""}`
    );
  }

  console.log(`\nUNMATCHED ${unmatched.length} (left untouched):\n`);
  for (const u of unmatched) {
    console.log(
      `  "${u.copy.title}" (${emailById.get(String(u.copy.owner)) || "?"}) — ` +
        `${u.fingerprintSize} imported items, ` +
        (u.rejection
          ? `ambiguous: ${u.rejection}`
          : u.best
            ? `best guess "${u.best.cand.title}" at ${(u.best.score * 100).toFixed(0)}%`
            : "no candidate")
    );
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to persist.");
  } else {
    let written = 0;
    for (const m of matched) {
      await GearList.updateOne(
        { _id: m.copy._id },
        {
          $set: {
            copiedFrom: {
              list: m.best.cand._id,
              owner: m.best.cand.owner || null,
              title: m.best.cand.title || null,
              ownerEmail: emailById.get(String(m.best.cand.owner)) || null,
              // A different owner means it came through a share link; a
              // self-copy did not.
              viaShareLink:
                String(m.best.cand.owner) !== String(m.copy.owner),
              at: m.copy.createdAt, // the copy happened when the list was made
            },
          },
        },
        // updatedAt means "when the user last edited this list" and is shown in
        // the admin panel. Backfilling metadata must not disturb it.
        { timestamps: false }
      );
      written += 1;
    }
    console.log(`\nWrote copiedFrom to ${written} lists.`);
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
