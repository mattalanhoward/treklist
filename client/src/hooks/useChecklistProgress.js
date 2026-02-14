// client/src/hooks/useChecklistProgress.js
import { useEffect, useMemo, useState, useRef, useCallback } from "react";

/**
 * Local-only checklist state, keyed by user/list/revision.
 * Migrates checked state when revision changes to preserve user progress.
 */
export default function useChecklistProgress({
  userId = "anon",
  listId,
  revision,
}) {
  const storageKey = useMemo(
    () => `checklist:${userId}:${listId}:${revision || ""}`,
    [userId, listId, revision]
  );

  const previousStorageKeyRef = useRef(null);
  const [checked, setChecked] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper to search localStorage for previous revisions and migrate the most recent one
  const findAndMigratePreviousRevision = useCallback(() => {
    try {
      const prefix = `checklist:${userId}:${listId}:`;
      const keys = [];

      // Find all matching keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && key !== storageKey) {
          keys.push(key);
        }
      }

      // Sort by timestamp (most recent last), then search backwards for non-empty data
      if (keys.length > 0) {
        keys.sort();
        // Search from most recent to oldest
        for (let i = keys.length - 1; i >= 0; i--) {
          const data = localStorage.getItem(keys[i]);
          if (data) {
            const parsed = JSON.parse(data);
            // Skip empty objects - keep searching for actual checked items
            if (Object.keys(parsed).length > 0) {
              return parsed;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error migrating checklist state:", err);
    }
    return {};
  }, [userId, listId, storageKey]);

  // When the key changes, try to migrate checked state from previous revision
  useEffect(() => {
    const previousKey = previousStorageKeyRef.current;

    // If this is the first render or we're on the same key, just hydrate normally
    if (!previousKey || previousKey === storageKey) {
      previousStorageKeyRef.current = storageKey;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          // If data exists in localStorage (even if empty object), use it
          // This preserves explicit resets and prevents unwanted migration
          const parsed = JSON.parse(raw);
          setChecked(parsed);
          setIsInitialized(true);
          return;
        }
        // No data at all - search for most recent previous revision to migrate
        const migrated = findAndMigratePreviousRevision();
        setChecked(migrated);
        setIsInitialized(true);
      } catch {
        setChecked({});
        setIsInitialized(true);
      }
      return;
    }

    // Revision changed - try to migrate checked state from previous key
    try {
      // Try to load from new key first
      const newData = localStorage.getItem(storageKey);
      if (newData) {
        // If new key exists, use it (even if empty - respects explicit resets)
        const parsed = JSON.parse(newData);
        setChecked(parsed);
        previousStorageKeyRef.current = storageKey;
        return;
      }

      // New key doesn't exist, try to migrate from previous in-memory key
      let oldData = localStorage.getItem(previousKey);
      if (oldData) {
        const oldChecked = JSON.parse(oldData);
        // Migrate if there's actual progress to preserve
        if (Object.keys(oldChecked).length > 0) {
          setChecked(oldChecked);
          previousStorageKeyRef.current = storageKey;
          return;
        }
      }

      // Previous ref key is also empty, search for most recent non-empty revision
      const migrated = findAndMigratePreviousRevision();
      setChecked(migrated);
    } catch {
      setChecked({});
    }

    previousStorageKeyRef.current = storageKey;
  }, [storageKey, findAndMigratePreviousRevision]);

  useEffect(() => {
    // Only save after initialization to avoid overwriting with empty state
    if (!isInitialized) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {}
  }, [storageKey, checked, isInitialized]);

  const toggle = (id) => setChecked((m) => ({ ...m, [id]: !m[id] }));
  const reset = () => setChecked({});

  return { checked, toggle, reset, storageKey };
}
