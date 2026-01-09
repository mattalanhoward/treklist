// src/pages/GearListView.jsx
import React, { useState, useEffect, useCallback } from "react";
import { FaPlus, FaEllipsisH, FaCheck } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { DragOverlay, closestCorners, pointerWithin } from "@dnd-kit/core";
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DndContextWrapper } from "../components/DndContextWrapper";
import api from "../services/api";
import DropdownMenu from "../components/DropdownMenu";
import ConfirmDialog from "../components/ConfirmDialog";
import GearListDetailsModal from "../components/GearListDetailsModal";
import PreviewCard from "../components/PreviewCard";
import PreviewColumn from "../components/PreviewColumn";
import PackStats from "../components/PackStats";
import SortableColumn from "../components/SortableColumn";
import SortableSection from "../components/SortableSection";
import { GEARLIST_SWATCHES as swatches } from "../config/colors";
import { defaultBackgrounds } from "../config/defaultBackgrounds";
import ShareModal from "../components/ShareModal";
import MoveItemModal from "../components/MoveItemModal";
import { useTranslation } from "react-i18next";
import { cldTransformUrl } from "../utils/cloudinary";
import { downscaleToTargetBytes } from "../utils/imageProcessing";
import { uploadBackgroundToCloudinary } from "../services/cloudinaryUpload";

export default function GearListView({
  listId,
  viewMode,
  list, // the GearList object from Dashboard
  categories, // array of Category
  items, // array of all items
  onRefresh,
  onReorderCategories,
  fetchLists,
  collapsed,
}) {
  const { t } = useTranslation("common");
  const [editingCatId, setEditingCatId] = useState(null);
  const [addingNewCat, setAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showAddModalCat, setShowAddModalCat] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  // State to control the “delete item” confirmation dialog:
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState({
    catId: null,
    itemId: null,
  });
  const [confirmCatOpen, setConfirmCatOpen] = useState(false);
  const [pendingDeleteCatId, setPendingDeleteCatId] = useState(null);
  const [itemsMap, setItemsMap] = useState({});
  // For inline‐title editing:
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(list.title);
  const [isUploading, setIsUploading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  // ⚡️ Optimistic UI for background color
  const [bgColor, setBgColor] = useState(list.backgroundColor || "");
  const [bgImage, setBgImage] = useState(list.backgroundImageUrl || "");
  const [shareOpen, setShareOpen] = useState(false);
  const closeShare = () => setShareOpen(false);
  const [busy, setBusy] = React.useState(false);
  const [moveItemTarget, setMoveItemTarget] = useState(null); // { catId, item }
  const [bgPreviewUrl, setBgPreviewUrl] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [customBgUrl, setCustomBgUrl] = useState(
    list.customBackground?.url || ""
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Delivery URLs (raw immediately, transformed once confirmed load)
  const [bgDeliveryUrl, setBgDeliveryUrl] = useState("");
  const [tileDeliveryUrl, setTileDeliveryUrl] = useState("");

  // Prevent "stale list prop" from overwriting optimistic background changes.
  // We keep showing the optimistic value until the server (list prop) catches up.
  const pendingBgRef = React.useRef({
    bgColor: null, // string | null (null = no pending)
    bgImage: null, // string | null
    customBgUrl: null, // string | null
  });

  const justUploadedRef = React.useRef(false);

  useEffect(() => {
    // clear pending state when switching lists
    pendingBgRef.current = { bgColor: null, bgImage: null, customBgUrl: null };
    justUploadedRef.current = false;
  }, [listId]);

  const BG_TRANSFORM = "f_auto,q_auto,w_2000";
  const THUMB_TRANSFORM = "f_auto,q_auto,w_200,h_200,c_fill";

  const preloadImage = useCallback((src) => {
    return new Promise((resolve, reject) => {
      if (!src) return resolve();
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  }, []);

  const isTransientUrl = (url) =>
    !url || url.startsWith("blob:") || url.startsWith("data:");

  // Background delivery URL: start with raw, then upgrade to transformed when available.
  useEffect(() => {
    let cancelled = false;

    const raw = bgPreviewUrl || bgImage || "";
    if (!raw) {
      setBgDeliveryUrl("");
      return;
    }

    // Always show raw immediately so we never go blank.
    setBgDeliveryUrl(raw);

    // Don’t attempt transforms for blob/data previews.
    if (isTransientUrl(raw)) return;

    if (justUploadedRef.current) return;
    const transformed = cldTransformUrl(raw, BG_TRANSFORM);
    if (!transformed || transformed === raw) return;

    const delays = [0, 800, 1800, 3500, 6500]; // retry for ~12s total

    (async () => {
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return;
        if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
        try {
          await preloadImage(transformed);
          if (cancelled) return;
          setBgDeliveryUrl(transformed);
          return;
        } catch {
          // keep raw; retry a few times
          if (cancelled) return;
          setBgDeliveryUrl(raw);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bgPreviewUrl, bgImage, preloadImage]);

  // Custom tile delivery URL: start with raw, then upgrade to transformed when available.
  useEffect(() => {
    let cancelled = false;

    const raw = bgPreviewUrl || customBgUrl || "";
    if (!raw) {
      setTileDeliveryUrl("");
      return;
    }

    // Always show raw immediately so tile never goes blank.
    setTileDeliveryUrl(raw);

    if (isTransientUrl(raw)) return;

    if (justUploadedRef.current) return;
    const transformed = cldTransformUrl(raw, BG_TRANSFORM);
    if (!transformed || transformed === raw) return;

    const delays = [0, 800, 1800, 3500, 6500];

    (async () => {
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return;
        if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
        try {
          await preloadImage(transformed);
          if (cancelled) return;
          setTileDeliveryUrl(transformed);
          return;
        } catch {
          if (cancelled) return;
          setTileDeliveryUrl(raw);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bgPreviewUrl, customBgUrl, preloadImage]);

  const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
  const navigate = useNavigate();

  const preloadBackgroundThumbs = useCallback(() => {
    if (typeof window !== "undefined" && window.__pp_bg_preloaded) return;
    if (typeof window !== "undefined") window.__pp_bg_preloaded = true;
    try {
      defaultBackgrounds.forEach(({ url }) => {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      });
    } catch {}
  }, []);

  useEffect(() => setTitleText(list.title), [list.title]);

  // keep local bgImage in sync with server (but don't stomp during upload)
  useEffect(() => {
    const serverUrl = list.backgroundImageUrl || "";
    const pending = pendingBgRef.current.bgImage;
    if (pending != null && serverUrl !== pending) return; // ignore stale props
    if (pending != null && serverUrl === pending)
      pendingBgRef.current.bgImage = null;
    setBgImage(serverUrl);
  }, [list.backgroundImageUrl, isUploading]);

  useEffect(() => {
    const serverColor = list.backgroundColor || "";
    const pending = pendingBgRef.current.bgColor;
    if (pending != null && serverColor !== pending) return;
    if (pending != null && serverColor === pending)
      pendingBgRef.current.bgColor = null;
    setBgColor(serverColor);
  }, [list.backgroundColor]);

  useEffect(() => {
    if (isUploading) return;
    const serverCustom = list.customBackground?.url || "";
    const pending = pendingBgRef.current.customBgUrl;
    if (pending != null && serverCustom !== pending) return;
    if (pending != null && serverCustom === pending)
      pendingBgRef.current.customBgUrl = null;
    setCustomBgUrl(serverCustom);
  }, [list.customBackground?.url, isUploading]);

  // NEW: auto-group every time `items` changes
  useEffect(() => {
    const map = {};
    items.forEach((it) => {
      map[it.category] = map[it.category] || [];
      map[it.category].push(it);
    });
    setItemsMap(map);
  }, [items]);

  // right after itemsMap state + useEffect that groups items
  const fetchItems = useCallback(
    async (catId) => {
      if (!catId) return; // guard against accidental calls with no cat
      const { data } = await api.get(
        `/dashboard/${listId}/categories/${catId}/items`
      );
      setItemsMap((m) => ({ ...m, [catId]: data }));
    },
    [listId]
  );

  // Use the parent’s onRefresh to re-fetch the whole payload
  const refreshListAfterEdit = useCallback(() => {
    if (typeof onRefresh === "function") {
      onRefresh();
    }
  }, [onRefresh]);

  const stats = React.useMemo(() => computeStats(itemsMap), [itemsMap]);

  // flatten ALL items into one array
  const allItems = Object.values(itemsMap).flat();

  // count
  const itemsCount = allItems.length;

  // split them into the four buckets
  const baseItems = allItems.filter((i) => !i.worn && !i.consumable);
  const wornItems = allItems.filter((i) => i.worn);
  const consumableItems = allItems.filter((i) => i.consumable);
  // “total” is just everything
  const totalItems = allItems;

  // build the breakdowns object
  const breakdowns = {
    base: baseItems,
    worn: wornItems,
    consumable: consumableItems,
    total: totalItems,
  };

  function computeStats(itemsMap) {
    let baseWeight = 0;
    let wornWeight = 0;
    let consumableWeight = 0;

    Object.values(itemsMap)
      .flat()
      .forEach((item) => {
        const w = item.weight || 0;
        const qty = item.quantity || 1;

        if (item.consumable) {
          // all of these go into consumableWeight
          consumableWeight += w * qty;
        } else if (item.worn) {
          // exactly one counts as “worn”
          wornWeight += w;
          // extras go back into base
          if (qty > 1) {
            baseWeight += w * (qty - 1);
          }
        } else {
          // pure base items
          baseWeight += w * qty;
        }
      });

    return {
      baseWeight,
      wornWeight,
      consumableWeight,
      totalWeight: baseWeight + wornWeight + consumableWeight,
    };
  }

  // Lifted‐up handlers for SortableItem
  const handleToggleWorn = useCallback((catId, itemId, newWorn) => {
    setItemsMap((m) => ({
      ...m,
      [catId]: m[catId].map((i) =>
        i._id === itemId ? { ...i, worn: newWorn } : i
      ),
    }));
  }, []);

  const handleToggleConsumable = useCallback((catId, itemId, newConsumable) => {
    setItemsMap((m) => ({
      ...m,
      [catId]: m[catId].map((i) =>
        i._id === itemId ? { ...i, consumable: newConsumable } : i
      ),
    }));
  }, []);

  const handleQuantityChange = useCallback(
    async (catId, itemId, newQty) => {
      // 1) Optimistic update
      setItemsMap((m) => ({
        ...m,
        [catId]: m[catId].map((i) =>
          i._id === itemId ? { ...i, quantity: newQty } : i
        ),
      }));

      try {
        // 2) Patch the server
        await api.patch(
          `/dashboard/${listId}/categories/${catId}/items/${itemId}`,
          {
            quantity: newQty,
          }
        );

        // 3) Re-fetch the full list so totalWeight (and any other derived data) is correct
        await fetchItems(catId);
      } catch (err) {
        // 4) Rollback on error
        toast.error(err.message || t("gearList.toasts.quantityUpdateFailed"));
        fetchItems(catId);
      }
    },
    [fetchItems, listId, t]
  );

  const handleDeleteClick = (catId, itemId) => {
    // Open the dialog, storing which catId/itemId is about to be deleted
    setPendingDelete({ catId, itemId });
    setConfirmOpen(true);
  };

  const actuallyDeleteItem = async () => {
    const { catId, itemId } = pendingDelete;
    try {
      await api.delete(
        `/dashboard/${listId}/categories/${catId}/items/${itemId}`
      );
      fetchItems(catId);
      toast.success(t("gearList.toasts.itemDeleted"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("gearList.toasts.itemDeleteFailed")
      );
    } finally {
      // Close the confirmation dialog (regardless of success/failure)
      setConfirmOpen(false);
      setPendingDelete({ catId: null, itemId: null });
    }
  };

  const cancelDeleteItem = () => {
    setConfirmOpen(false);
    setPendingDelete({ catId: null, itemId: null });
  };

  const pendingDeleteCategory = React.useMemo(
    () => categories.find((c) => c._id === pendingDeleteCatId),
    [categories, pendingDeleteCatId]
  );

  // — add category —
  const confirmAddCat = async () => {
    const title = newCatName.trim();
    if (!title) {
      toast.error(t("gearList.toasts.categoryNameEmpty"));
      return;
    }
    try {
      await api.post(`/dashboard/${listId}/categories`, {
        title,
        position: categories.length,
      });
      // pull it down again
      await onRefresh();

      // ✅ reset input state so the next "New Category" starts blank
      setNewCatName("");
      setAddingNewCat(false);

      toast.success(t("gearList.toasts.categoryAdded"));
    } catch (err) {
      // show the error message from the thrown Error
      toast.error(err.message || t("gearList.toasts.categoryAddFailed"));
    }
  };

  const cancelAddCat = () => {
    setNewCatName("");
    setAddingNewCat(false);
  };
  const handleDeleteCatClick = (catId) => {
    setPendingDeleteCatId(catId);
    setConfirmCatOpen(true);
  };

  const actuallyDeleteCat = async () => {
    const catId = pendingDeleteCatId;
    try {
      await api.delete(`/dashboard/${listId}/categories/${catId}`);

      // re-sync our entire `fullData` (including categories & items)
      await onRefresh();

      toast.success(t("gearList.toasts.categoryDeleted"));
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || t("gearList.toasts.categoryDeleteFailed")
      );
    } finally {
      setConfirmCatOpen(false);
      setPendingDeleteCatId(null);
    }
  };

  const cancelDeleteCat = () => {
    setConfirmCatOpen(false);
    setPendingDeleteCatId(null);
  };

  // — edit category name inline —
  const editCat = async (id, title) => {
    const newTitle = title.trim();
    if (!newTitle) {
      toast.error(t("gearList.toasts.categoryNameEmpty"));
      return;
    }

    // 🛑 If the title hasn’t actually changed, do nothing
    const currentCat =
      Array.isArray(categories) && categories.find((c) => c._id === id);

    if (currentCat && currentCat.title.trim() === newTitle) {
      // Just exit edit mode, no API call, no toast
      setEditingCatId(null);
      return;
    }

    try {
      await api.patch(`/dashboard/${listId}/categories/${id}`, {
        title: newTitle,
      });
      // re-pull the entire payload (list, cats, items)
      await onRefresh();
      setEditingCatId(null);
      toast.success(t("gearList.toasts.categoryRenamed"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("gearList.toasts.categoryRenameFailed")
      );
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over) return;

    // ─── CATEGORY REORDER ───
    if (active.id.startsWith("cat-") && over.id.startsWith("cat-")) {
      const oldIndex = categories.findIndex(
        (c) => `cat-${c._id}` === active.id
      );
      const newIndex = categories.findIndex((c) => `cat-${c._id}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Build the new ordered array
        const reordered = arrayMove(categories, oldIndex, newIndex).map(
          (catObj, idx) => ({ ...catObj, position: idx })
        );

        // Delegate to Dashboard: optimistic UI + persist
        await onReorderCategories(categories, reordered);
      }
      return;
    }

    // ─── ITEM REORDER WITHIN SAME CATEGORY ───
    if (active.id.startsWith("item-") && over.id.startsWith("item-")) {
      const [, sourceCatId, sourceItemId] = active.id.split("-");
      const [, destCatId, destItemId] = over.id.split("-");

      // same-category reorder
      if (sourceCatId === destCatId) {
        const oldArray = itemsMap[sourceCatId] || [];
        const oldIndex = oldArray.findIndex((i) => i._id === sourceItemId);
        const newIndex = oldArray.findIndex((i) => i._id === destItemId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(oldArray, oldIndex, newIndex).map(
            (it, idx) => ({ ...it, position: idx })
          );

          // update UI immediately
          setItemsMap((m) => ({ ...m, [sourceCatId]: reordered }));

          // persist each item’s new position
          for (let i = 0; i < reordered.length; i++) {
            const it = reordered[i];
            if (
              it.position !== oldArray.find((x) => x._id === it._id).position
            ) {
              await api.patch(
                `/dashboard/${listId}/categories/${sourceCatId}/items/${it._id}`,
                { position: i }
              );
            }
          }
        }
        return;
      }

      // ─── ITEM MOVED TO A DIFFERENT CATEGORY ───
      const sourceArr = itemsMap[sourceCatId] || [];
      const destArr = itemsMap[destCatId] || [];
      const removedIdx = sourceArr.findIndex((i) => i._id === sourceItemId);
      const insertedIdx = destArr.findIndex((i) => i._id === destItemId);

      if (removedIdx !== -1 && insertedIdx !== -1) {
        const movedItem = sourceArr[removedIdx];
        const newSource = sourceArr
          .filter((i) => i._id !== sourceItemId)
          .map((it, idx) => ({ ...it, position: idx }));
        const newDest = [
          ...destArr.slice(0, insertedIdx),
          movedItem,
          ...destArr.slice(insertedIdx),
        ].map((it, idx) => ({
          ...it,
          position: idx,
          category: it._id === movedItem._id ? destCatId : it.category,
        }));
        setItemsMap((m) => ({
          ...m,
          [sourceCatId]: newSource,
          [destCatId]: newDest,
        }));

        // 1) update moved item's category + position
        await api.patch(
          `/dashboard/${listId}/categories/${sourceCatId}/items/${sourceItemId}`,
          {
            category: destCatId,
            position: newDest.find((i) => i._id === sourceItemId).position,
          }
        );
        // 2) reindex source siblings
        for (let i = 0; i < newSource.length; i++) {
          const it = newSource[i];
          if (
            it.position !== sourceArr.find((x) => x._id === it._id).position
          ) {
            await api.patch(
              `/dashboard/${listId}/categories/${sourceCatId}/items/${it._id}`,
              { position: i }
            );
          }
        }
        // 3) reindex dest siblings
        for (let i = 0; i < newDest.length; i++) {
          const it = newDest[i];
          if (
            it._id !== sourceItemId &&
            it.position !== destArr.find((x) => x._id === it._id).position
          ) {
            await api.patch(
              `/dashboard/${listId}/categories/${destCatId}/items/${it._id}`,
              { position: i }
            );
          }
        }
      }
      return;
    }

    // ─── DROP INTO EMPTY CATEGORY ───
    if (active.id.startsWith("item-") && over.id.startsWith("cat-")) {
      const [, sourceCatId, sourceItemId] = active.id.split("-");
      const destCatId = over.id.replace("cat-", "");
      if (sourceCatId === destCatId) return;

      const sourceArr = itemsMap[sourceCatId] || [];
      const destArr = itemsMap[destCatId] || [];
      const removedIdx = sourceArr.findIndex((i) => i._id === sourceItemId);
      if (removedIdx === -1) return;

      const movedItem = sourceArr[removedIdx];
      const newSource = sourceArr
        .filter((i) => i._id !== sourceItemId)
        .map((it, idx) => ({ ...it, position: idx }));
      const newDest = [...destArr, movedItem].map((it, idx) => ({
        ...it,
        position: idx,
        category: it._id === movedItem._id ? destCatId : it.category,
      }));
      setItemsMap((m) => ({
        ...m,
        [sourceCatId]: newSource,
        [destCatId]: newDest,
      }));

      // persist
      await api.patch(
        `/dashboard/${listId}/categories/${sourceCatId}/items/${sourceItemId}`,
        {
          category: destCatId,
          position: newDest.length - 1,
        }
      );
      for (let i = 0; i < newSource.length; i++) {
        const it = newSource[i];
        if (it.position !== sourceArr.find((x) => x._id === it._id).position) {
          await api.patch(
            `/dashboard/${listId}/categories/${sourceCatId}/items/${it._id}`,
            { position: i }
          );
        }
      }
    }
  };

  const handleDragStart = ({ active }) => {
    // 1) Item‐drag preview
    if (active.id.startsWith("item-")) {
      const [, catId, itemId] = active.id.split("-");
      const itemArray = itemsMap[catId] || [];
      const found = itemArray.find((i) => i._id === itemId);
      if (found) {
        setActiveItem({ catId, item: found });
      }

      // 2) Category‐drag preview
    } else if (active.id.startsWith("cat-")) {
      const catId = active.id.replace(/^cat-/, "");
      const foundCat = categories.find((c) => c._id === catId);
      if (foundCat) {
        setActiveCategory(foundCat);
      }
    }
  };

  const axisModifier = (args) => {
    const { active, transform } = args;

    // 1) If there's no active draggable, or if it's an item, just return the raw transform:
    if (!active || !active.id || active.id.startsWith("item-")) {
      return transform;
    }

    // 2) If we're in column mode and dragging a category, lock X:
    if (viewMode === "column" && active.id.startsWith("cat-")) {
      return restrictToHorizontalAxis(args);
    }

    // 3) If we're in list mode and dragging a category, lock Y:
    if (viewMode === "list" && active.id.startsWith("cat-")) {
      return restrictToVerticalAxis(args);
    }

    // 4) Otherwise, no change:
    return transform;
  };

  // 1) Custom collision detector
  const collisionDetectionStrategy = (args) => {
    const { active } = args;

    // if it's a gear item, use closest-corners
    if (active && active.id?.startsWith("item-")) {
      return closestCorners(args);
    }

    // otherwise (categories) use pointerWithin (or whatever you prefer)
    return pointerWithin(args);
  };

  const handleMoveItemManual = async (
    fromCatId,
    itemId,
    toCatId,
    positionIndex
  ) => {
    if (!fromCatId || !itemId || !toCatId) return;

    const sourceArr = itemsMap[fromCatId] || [];
    const destArr = itemsMap[toCatId] || [];

    const removedIdx = sourceArr.findIndex((i) => i._id === itemId);
    if (removedIdx === -1) return;

    const movedItem = sourceArr[removedIdx];

    // ─── SAME-CATEGORY REORDER ───
    if (fromCatId === toCatId) {
      const oldArray = sourceArr;
      const safeIndex = Math.max(
        0,
        Math.min(positionIndex, oldArray.length - 1)
      );

      if (safeIndex === removedIdx) return;

      const reordered = arrayMove(oldArray, removedIdx, safeIndex).map(
        (it, idx) => ({ ...it, position: idx })
      );

      setItemsMap((m) => ({ ...m, [fromCatId]: reordered }));

      try {
        for (let i = 0; i < reordered.length; i++) {
          const it = reordered[i];
          const oldItem = oldArray.find((x) => x._id === it._id);
          if (!oldItem || oldItem.position === i) continue;

          await api.patch(
            `/dashboard/${listId}/categories/${fromCatId}/items/${it._id}`,
            { position: i }
          );
        }
      } catch (err) {
        toast.error(err.message || t("gearList.toasts.moveItemFailed"));
        fetchItems(fromCatId);
      }

      return;
    }

    // ─── CROSS-CATEGORY MOVE ───
    const newSource = sourceArr
      .filter((i) => i._id !== itemId)
      .map((it, idx) => ({ ...it, position: idx }));

    const insertIndex = Math.max(0, Math.min(positionIndex, destArr.length));
    const newDestRaw = [
      ...destArr.slice(0, insertIndex),
      movedItem,
      ...destArr.slice(insertIndex),
    ];

    const newDest = newDestRaw.map((it, idx) => ({
      ...it,
      position: idx,
      category: it._id === movedItem._id ? toCatId : it.category,
    }));

    setItemsMap((m) => ({
      ...m,
      [fromCatId]: newSource,
      [toCatId]: newDest,
    }));

    try {
      // 1) update moved item category + position
      await api.patch(
        `/dashboard/${listId}/categories/${fromCatId}/items/${itemId}`,
        {
          category: toCatId,
          position: newDest.find((i) => i._id === itemId).position,
        }
      );

      // 2) reindex source siblings
      for (let i = 0; i < newSource.length; i++) {
        const it = newSource[i];
        const oldItem = sourceArr.find((x) => x._id === it._id);
        if (!oldItem || oldItem.position === i) continue;

        await api.patch(
          `/dashboard/${listId}/categories/${fromCatId}/items/${it._id}`,
          { position: i }
        );
      }

      // 3) reindex dest siblings
      for (let i = 0; i < newDest.length; i++) {
        const it = newDest[i];
        const oldItem = destArr.find((x) => x._id === it._id);
        if (
          !oldItem ||
          it._id === itemId || // moved item already handled
          oldItem.position === i
        )
          continue;

        await api.patch(
          `/dashboard/${listId}/categories/${toCatId}/items/${it._id}`,
          { position: i }
        );
      }
    } catch (err) {
      toast.error(err.message || "Failed to move item");
      fetchItems(fromCatId);
      if (toCatId !== fromCatId) fetchItems(toCatId);
    }
  };

  // Rename list
  const handleTitleSubmit = async () => {
    const trimmed = titleText.trim();
    if (!trimmed) {
      setTitleText(list.title);
      return setIsEditingTitle(false);
    }
    try {
      await api.patch(`/dashboard/${listId}`, { title: trimmed });
      toast.success(t("gearList.toasts.listRenamed"));
      onRefresh();
      fetchLists();
    } catch (err) {
      toast.error(err.message || t("gearList.toasts.listRenameFailed"));
      setTitleText(list.title);
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleImageUpload = async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      toast.error(t("gearList.toasts.imageTooLargeUnder5MB"));
      e.target.value = "";
      return;
    }

    // 1) Instant preview (no waiting)
    const preview = URL.createObjectURL(file);
    setBgPreviewUrl(preview);

    setIsUploading(true);
    setUploadPct(0);

    try {
      // 2) Downscale/compress on client (big performance win)
      const { blob, mime } = await downscaleToTargetBytes(file, {
        maxSize: 3000,
        quality: 0.78,
        maxBytes: 1_500_000,
      });

      console.log("bg upload bytes", {
        original: file.size,
        processed: blob.size,
        ratio: (blob.size / file.size).toFixed(2),
      });

      const ext = mime === "image/webp" ? "webp" : "jpg";
      const filename = `bg-${Date.now()}.${ext}`;

      // 3) Direct upload to Cloudinary
      const { secureUrl, publicId } = await uploadBackgroundToCloudinary({
        blob,
        filename,
        onProgress: setUploadPct,
      });

      // 4) Persist to your DB (this is what you were stuck on)
      const { data } = await api.patch(
        `/dashboard/${listId}/preferences/image-direct`,
        { imageUrl: secureUrl, publicId }
      );

      // 5) Preload the transformed delivery URL so swap is smooth
      // Otherwise you get a blank frame while the remote image decodes.
      await preloadImage(secureUrl).catch(() => {});

      // 6) Swap from preview → Cloudinary URL, clear preview
      pendingBgRef.current.bgColor = ""; // we're clearing color
      pendingBgRef.current.bgImage = secureUrl; // optimistic background image
      pendingBgRef.current.customBgUrl = secureUrl; // optimistic custom tile
      setBgColor(""); // avoid any flash/overlay conflicts
      setBgImage(secureUrl);
      setCustomBgUrl(secureUrl);
      setBgPreviewUrl(""); // stop using blob preview once saved
      setUploadPct(100);
      justUploadedRef.current = true;
      await onRefresh?.();
    } catch (err) {
      console.error("Background upload failed:", err);
      toast.error(err.message || t("gearList.toasts.imageUploadFailed"));

      // Roll back preview on failure
      pendingBgRef.current = {
        bgColor: null,
        bgImage: null,
        customBgUrl: null,
      };
      setBgPreviewUrl("");
    } finally {
      setIsUploading(false);

      // clean up preview object URL
      try {
        URL.revokeObjectURL(preview);
      } catch {}

      // allow selecting the same file again
      if (e?.target) e.target.value = "";
    }
  };

  const handleColorSelect = async (color) => {
    const prevColor = bgColor;
    const prevImage = bgImage;

    // ✅ instant UI
    pendingBgRef.current.bgColor = color;
    pendingBgRef.current.bgImage = ""; // we're clearing the image
    setBgPreviewUrl("");
    setBgImage(""); // IMPORTANT: clear active image immediately
    setBgColor(color);

    try {
      await api.patch(`/dashboard/${listId}/preferences`, {
        backgroundColor: color,
      });
      onRefresh?.();
    } catch (err) {
      // rollback
      pendingBgRef.current = {
        bgColor: null,
        bgImage: null,
        customBgUrl: null,
      };
      setBgColor(prevColor);
      setBgImage(prevImage);
      toast.error(err.message || t("gearList.toasts.backgroundUpdateFailed"));
    }
  };

  // user picks one of the background images (default or custom)
  const handleBackgroundSelect = async (url) => {
    setBgPreviewUrl("");
    const previousImage = bgImage;
    const previousColor = bgColor;

    // ✅ instant UI
    pendingBgRef.current.bgColor = "";
    pendingBgRef.current.bgImage = url;
    setBgColor(""); // prevents flash
    setBgImage(url);

    // best-effort preload (don't block UI)
    preloadImage(cldTransformUrl(url, BG_TRANSFORM)).catch(() => {});

    try {
      await api.patch(`/dashboard/${listId}/preferences`, {
        backgroundImageUrl: url,
      });
      onRefresh?.();
    } catch (error) {
      pendingBgRef.current = {
        bgColor: null,
        bgImage: null,
        customBgUrl: null,
      };
      setBgImage(previousImage);
      setBgColor(previousColor);
      toast.error(error.message || t("gearList.toasts.backgroundUpdateFailed"));
    }
  };

  // Copy list
  const handleCopyList = async () => {
    try {
      const { data } = await api.post(`/dashboard/${listId}/copy`);
      toast.success(t("gearList.toasts.listCopied"));
      fetchLists(); // refresh sidebar (you’ll need to pass fetchLists in as a prop)
      localStorage.setItem("lastListId", data.list._id);
      navigate(`/dashboard/${data.list._id}`);
    } catch (err) {
      toast.error(err.message || t("gearList.toasts.listCopyFailed"));
    }
  };

  // Checklist View
  const handleCheckList = () => {
    if (!listId) return;
    navigate(`/dashboard/${listId}/checklist`);
  };

  // Delete list
  const openDeleteListConfirm = () => setConfirmDeleteOpen(true);
  const cancelDeleteList = () => setConfirmDeleteOpen(false);
  const actuallyDeleteList = async () => {
    try {
      await api.delete(`/dashboard/${listId}`);
      toast.success(t("gearList.toasts.listDeleted"));
      fetchLists();
      cancelDeleteList();
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message || t("gearList.toasts.listDeleteFailed"));
    }
  };

  // Gradient overlay definition
  const overlay = "linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3))";

  const effectiveBgImageRaw = bgPreviewUrl || bgImage || "";
  const effectiveBgImage = bgDeliveryUrl || effectiveBgImageRaw;
  const effectiveBgColor = bgColor || "";

  const tileSrc = bgPreviewUrl || customBgUrl;
  const tileBg = tileDeliveryUrl || tileSrc;
  const canSelectCustom = !!customBgUrl && !isUploading;

  const bgstyle = effectiveBgImage
    ? {
        // no overlay when using an image
        backgroundImage: `url(${effectiveBgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : effectiveBgColor
    ? {
        // when using only a color, you can keep your overlay if you like:
        backgroundColor: effectiveBgColor,
        backgroundImage: overlay,
      }
    : {};

  const headerPadding =
    viewMode === "list"
      ? "pl-6 sm:w-4/5 sm:mx-auto"
      : collapsed
      ? "pl-0 sm:pl-15"
      : "pl-0 sm:pl-6";

  return (
    <div style={bgstyle} className="flex flex-col h-full overflow-hidden">
      <div className="w-full bg-base-100 bg-opacity-80">
        <div
          className={[
            "flex justify-between items-center pr-6 py-2",
            headerPadding,
          ].join(" ")}
        >
          {/* Title + stats, inline-editable */}
          <div className="flex-1 flex items-center justify-center space-x-8 sm:flex-none sm:justify-start">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleText}
                autoFocus
                onChange={(e) => setTitleText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSubmit();
                  if (e.key === "Escape") {
                    setTitleText(list.title);
                    setIsEditingTitle(false);
                  }
                }}
                onBlur={handleTitleSubmit}
                className="hide-on-touch text-accent bg-transparent border-b border-accent focus:outline-none"
              />
            ) : (
              <>
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  className="hide-on-touch text-primary"
                >
                  {list.title}
                </h2>
                <PackStats
                  base={stats.baseWeight}
                  worn={stats.wornWeight}
                  consumable={stats.consumableWeight}
                  total={stats.totalWeight}
                  breakdowns={breakdowns}
                />{" "}
              </>
            )}
          </div>
          {/* Ellipsis menu */}
          <DropdownMenu
            trigger={
              <button
                onMouseEnter={preloadBackgroundThumbs}
                className="inline-flex items-center justify-center text-l text-primaryAlt hover:text-primaryAlt/80 leading-none"
                aria-label={t("gearList.menu.listOptionsA11y")}
              >
                <FaEllipsisH />
              </button>
            }
            menuWidth="w-56"
            items={[
              {
                key: "header-prefs",
                render: () => (
                  <div className="font-semibold text-primary uppercase">
                    {t("gearList.menu.headerPreferences")}{" "}
                  </div>
                ),
              },

              {
                key: "bg-presets",
                render: () => (
                  <div onClick={(e) => e.stopPropagation()}>
                    <div className="block text-sm text-primary mb-1">
                      {t("gearList.menu.background")}{" "}
                    </div>

                    {/* Current image + upload tile */}
                    <p className="text-sm text-primary/80 mb-1">
                      {t("gearList.menu.customImage")}
                    </p>
                    {isUploading && (
                      <p className="text-xs text-primary/70 mt-1">
                        Uploading… {uploadPct}%
                      </p>
                    )}
                    <div className="grid grid-cols-4 gap-2 mt-1 mx-auto w-full max-w-xs">
                      {tileSrc && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!canSelectCustom) return;
                            handleBackgroundSelect(customBgUrl);
                          }}
                          disabled={!canSelectCustom}
                          className={
                            `w-10 h-10 bg-cover bg-center rounded ` +
                            (bgImage === customBgUrl
                              ? "ring-2 ring-secondary"
                              : "ring-1 ring-transparent hover:ring-gray-300") +
                            (!canSelectCustom
                              ? " opacity-60 cursor-not-allowed"
                              : "")
                          }
                          style={{
                            backgroundImage: `url(${tileBg})`,
                          }}
                          title={
                            customBgUrl
                              ? "My uploaded background"
                              : "Uploading..."
                          }
                        />
                      )}

                      <label
                        className={
                          `w-10 h-10 rounded border border-dashed border-primary/60
     flex items-center justify-center text-primary/60 text-xl cursor-pointer ` +
                          (isUploading ? "opacity-50 cursor-not-allowed" : "")
                        }
                      >
                        +
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                    </div>

                    {/* Default images */}
                    <p className="mt-3 text-sm text-primary/80 mb-1">
                      {t("gearList.menu.defaultImages")}{" "}
                    </p>
                    <div className="grid grid-cols-4 gap-2 mt-1 mx-auto w-full max-w-xs">
                      {defaultBackgrounds.map(({ key, url }) => (
                        <button
                          key={key}
                          onClick={() => handleBackgroundSelect(url)}
                          className={
                            `w-10 h-10 bg-cover bg-center rounded ` +
                            (bgImage === url
                              ? "ring-2 ring-secondary"
                              : "ring-1 ring-transparent hover:ring-gray-300")
                          }
                          style={{
                            backgroundImage: `url(${cldTransformUrl(
                              url,
                              THUMB_TRANSFORM
                            )})`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                key: "color-swatches",
                render: () => (
                  <div onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <p className="mt-3 text-sm text-primary/80 mb-1">
                      {t("gearList.menu.colors")}
                    </p>
                    {/* Swatches Grid */}
                    <div className="grid grid-cols-4 gap-2 place-items-center mt-2">
                      {swatches.map(({ key, value, class: cls }) => (
                        <div key={key} className="relative group">
                          <button
                            onClick={() => handleColorSelect(value)}
                            className={`${cls} w-6 h-6 rounded-full flex items-center justify-center p-0`}
                          >
                            {bgColor === value && (
                              <FaCheck className="text-white text-sm" />
                            )}
                          </button>
                          {/* tooltip */}
                          <span
                            className="
         absolute 
         bottom-full 
         left-1/2 
         transform -translate-x-1/2 
         mb-1 
         px-2 py-0.5 
         text-sm 
         text-white 
         bg-black bg-opacity-75 
         rounded 
         opacity-0 
         pointer-events-none 
         group-hover:opacity-100 
         transition-opacity
       "
                          >
                            {key}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                key: "sep-1",
                render: () => <div className="border-t border-gray-200 my-2" />,
              },
              {
                key: "details",
                label: t("gearList.menu.viewEditDetails"),
                onClick: () => setShowDetailsModal(true),
              },
              {
                key: "checklist",
                label: t("gearList.menu.viewAsChecklist"),
                onClick: handleCheckList,
              },
              {
                key: "copy",
                label: t("gearList.menu.copyList"),
                onClick: handleCopyList,
              },
              {
                key: "sharelist",
                label: t("gearList.menu.shareList"),
                onClick: () => setShareOpen(true),
                disabled: busy,
              },
              {
                key: "delete",
                label: t("gearList.menu.deleteList"),
                onClick: openDeleteListConfirm,
                className: "text-error",
              },
            ]}
          />
        </div>
      </div>

      <ShareModal listId={listId} isOpen={shareOpen} onClose={closeShare} />

      {/* ───── Wrap everything in one DndContextWrapper ───── */}
      <DndContextWrapper
        items={categories.map((c) => `cat-${c._id}`)}
        strategy={
          viewMode === "list"
            ? verticalListSortingStrategy
            : horizontalListSortingStrategy
        }
        onDragStart={handleDragStart}
        onDragEnd={(event) => {
          handleDragEnd(event);
          // clear previews after dropAnimation
          setTimeout(() => {
            setActiveItem(null);
            setActiveCategory(null);
          }, 300);
        }}
        collisionDetection={collisionDetectionStrategy}
        modifiers={[axisModifier]}
        renderDragOverlay={() => (
          <DragOverlay
            style={{ pointerEvents: "none", zIndex: 1000 }}
            dropAnimation={{
              duration: 300,
              easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}
          >
            {activeItem ? (
              <PreviewCard
                item={activeItem.item}
                viewMode={viewMode}
                isPreview
              />
            ) : activeCategory ? (
              <PreviewColumn
                category={activeCategory}
                items={itemsMap[activeCategory._id] || []}
              />
            ) : null}
          </DragOverlay>
        )}
      >
        {viewMode === "list" ? (
          <div className="flex-1 overflow-y-auto px-2 py-2 sm:w-4/5 sm:mx-auto">
            {categories.map((cat) => (
              <SortableSection
                key={cat._id}
                category={cat}
                items={itemsMap[cat._id] || []}
                /* editing a category */
                editingCatId={editingCatId}
                setEditingCatId={setEditingCatId}
                onEditCat={(newTitle) => editCat(cat._id, newTitle)}
                /* delete a category */
                onDeleteCategory={handleDeleteCatClick}
                /* “Add Item” modal */
                showAddModalCat={showAddModalCat}
                setShowAddModalCat={setShowAddModalCat}
                /* re-loading an individual category */
                fetchItems={fetchItems}
                listId={listId}
                /* item-level actions */
                onDeleteItem={handleDeleteClick}
                onToggleWorn={handleToggleWorn}
                onToggleConsumable={handleToggleConsumable}
                onQuantityChange={handleQuantityChange}
                /* move item */
                onMoveItem={(catId, item) => setMoveItemTarget({ catId, item })}
                /* layout */
                viewMode={viewMode}
                onItemUpdated={refreshListAfterEdit}
              />
            ))}
            {/* Add New Category button */}
            <div className="px-4 mt-4">
              {addingNewCat ? (
                <input
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={t("gearList.addCategory.inlinePlaceholder")}
                  className="w-full p-2 border-b-2 border-accent focus:outline-none bg-neutral text-primary rounded"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAddCat();
                    if (e.key === "Escape") cancelAddCat();
                  }}
                  onBlur={() => {
                    if (newCatName.trim()) confirmAddCat();
                    else cancelAddCat();
                  }}
                />
              ) : (
                <button
                  onClick={() => {
                    setNewCatName(""); // ✅ ensure fresh start
                    setAddingNewCat(true);
                  }}
                  className="p-2 w-full border border-secondary rounded flex items-center justify-center space-x-2 bg-base-100 text-primary hover:bg-base-100/80"
                >
                  <FaPlus />
                  <span className="text-sm">
                    {t("gearList.addCategory.button")}
                  </span>{" "}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-nowrap items-start overflow-x-auto px-2 py-2 snap-x snap-mandatory sm:snap-none">
            {categories.map((cat) => (
              <SortableColumn
                key={cat._id}
                category={cat}
                items={itemsMap[cat._id] || []}
                /* editing a category */
                editingCatId={editingCatId}
                setEditingCatId={setEditingCatId}
                onEditCat={(newTitle) => editCat(cat._id, newTitle)}
                /* delete a category */
                onDeleteCategory={handleDeleteCatClick}
                /* “Add Item” modal */
                showAddModalCat={showAddModalCat}
                setShowAddModalCat={setShowAddModalCat}
                /* re-loading an individual category */
                fetchItems={fetchItems}
                listId={listId}
                /* item-level actions */
                onDeleteItem={handleDeleteClick}
                onToggleWorn={handleToggleWorn}
                onToggleConsumable={handleToggleConsumable}
                onQuantityChange={handleQuantityChange}
                /* move item */
                onMoveItem={(catId, item) => setMoveItemTarget({ catId, item })}
                /* layout */
                viewMode={viewMode}
                onItemUpdated={refreshListAfterEdit}
              />
            ))}
            {/* Add New Category column */}
            <div className="snap-center flex-shrink-0 mt-0 mb-0 w-90 sm:w-64 flex flex-col h-full px-2">
              {addingNewCat ? (
                <div className="">
                  <input
                    autoFocus
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder={t("gearList.addCategory.columnPlaceholder")}
                    className="w-full py-1 px-2 border-b-2 border-accent focus:outline-none bg-neutral text-primary rounded"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmAddCat();
                      if (e.key === "Escape") cancelAddCat();
                    }}
                    onBlur={() => {
                      if (newCatName.trim()) confirmAddCat();
                      else cancelAddCat();
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingNewCat(true)}
                  className="p-2 w-full border border-secondary rounded flex items-center justify-center space-x-2 bg-base-100 text-primary hover:bg-base-100/80"
                >
                  <FaPlus />
                  <span className="text-sm">
                    {t("gearList.addCategory.button")}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </DndContextWrapper>

      <MoveItemModal
        isOpen={!!moveItemTarget}
        onClose={() => setMoveItemTarget(null)}
        item={moveItemTarget?.item || null}
        fromCatId={moveItemTarget?.catId || null}
        categories={categories}
        itemsMap={itemsMap}
        onMove={async ({ toCatId, positionIndex }) => {
          if (!moveItemTarget) return;
          await handleMoveItemManual(
            moveItemTarget.catId,
            moveItemTarget.item._id,
            toCatId,
            positionIndex
          );
          setMoveItemTarget(null);
        }}
      />

      <GearListDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        list={list}
        breakdowns={breakdowns}
        itemsCount={itemsCount}
        onRefresh={onRefresh}
        onRefreshSidebar={fetchLists}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        title={t("gearList.confirm.removeItemTitle")}
        confirmText={t("gearList.confirm.removeItemConfirm")}
        cancelText={t("actions.cancel")}
        onConfirm={actuallyDeleteItem}
        onCancel={cancelDeleteItem}
      />

      <ConfirmDialog
        isOpen={confirmCatOpen}
        title={
          pendingDeleteCategory
            ? t("gearList.confirm.deleteCategoryTitle", {
                title: pendingDeleteCategory.title,
              })
            : t("gearList.confirm.deleteCategoryTitleGeneric")
        }
        message={t("gearList.confirm.deleteCategoryMessage")}
        confirmText={t("gearList.confirm.deleteCategoryConfirm")}
        cancelText={t("actions.cancel")}
        onConfirm={actuallyDeleteCat}
        onCancel={cancelDeleteCat}
      />

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title={t("gearList.confirm.deleteListTitle", { title: list.title })}
        message={t("gearList.confirm.deleteListMessage")}
        confirmText={t("actions.delete")}
        cancelText={t("actions.cancel")}
        onConfirm={actuallyDeleteList}
        onCancel={cancelDeleteList}
      />
    </div>
  );
}
