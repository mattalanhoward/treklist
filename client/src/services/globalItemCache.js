// client/src/services/globalItemCache.js
import api from "./api";

// --- simple module-level cache so StrictMode remounts don't double-fetch ---
const GLOBAL_ITEM_CACHE = new Map(); // id -> { data, ts } OR { promise, ts }
const TTL_MS = 5 * 60 * 1000;

export async function fetchGlobalItemCached(id) {
  if (!id) return null;

  const cached = GLOBAL_ITEM_CACHE.get(id);
  const now = Date.now();

  if (cached?.data && cached.ts && now - cached.ts < TTL_MS) return cached.data;
  if (cached?.promise) return await cached.promise;

  const promise = api
    .get(`/global/items/${id}`)
    .then((res) => res?.data || null)
    .catch(() => null)
    .finally(() => {
      const entry = GLOBAL_ITEM_CACHE.get(id);
      if (entry && entry.promise && !entry.data) GLOBAL_ITEM_CACHE.delete(id);
    });

  GLOBAL_ITEM_CACHE.set(id, { promise, ts: now });

  const data = await promise;
  if (data) GLOBAL_ITEM_CACHE.set(id, { data, ts: now });
  return data;
}

export function setGlobalItemCache(id, data) {
  if (!id) return;
  GLOBAL_ITEM_CACHE.set(id, { data, ts: Date.now() });
}

export function invalidateGlobalItemCache(id) {
  if (!id) return;
  GLOBAL_ITEM_CACHE.delete(id);
}

export function clearGlobalItemCache() {
  GLOBAL_ITEM_CACHE.clear();
}
