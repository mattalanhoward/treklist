// src/pages/GearListView.jsx
import React, { useState, useEffect, useCallback } from "react";
import { FiShare2, FiInfo, FiLock, FiUnlock, FiMoreHorizontal, FiPlus, FiCheck, FiX } from "react-icons/fi";
import { BsBackpack4 } from "react-icons/bs";
import StatWithDetails from "../components/StatWithDetails";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { DragOverlay } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
import Spinner from "../components/ui/Spinner";

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
  dndRef,
  sidebarDragOverCatId,
  onBackToLists,
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const [editingCatId, setEditingCatId] = useState(null);
  const [addingNewCat, setAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showAddModalCat, setShowAddModalCat] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeWidth, setActiveWidth] = useState(null);
  const [activeHeight, setActiveHeight] = useState(null);
  const [newItemId, setNewItemId] = useState(null);
  const listContainerRef = React.useRef(null);

  // State to control the "delete item" confirmation dialog:
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
  const [uploadPct, setUploadPct] = useState(0);

  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Optimistic UI for background color/image
  const [bgColor, setBgColor] = useState(list.backgroundColor || "");
  const [bgImage, setBgImage] = useState(list.backgroundImageUrl || "");

  // Blob preview (ONLY used to prevent any flash during upload swap)
  const [bgPreviewUrl, setBgPreviewUrl] = useState("");
  const bgPreviewUrlRef = React.useRef("");

  const [customBgUrl, setCustomBgUrl] = useState(
    list.customBackground?.url || "",
  );

  const [shareOpen, setShareOpen] = useState(false);
  const closeShare = () => setShareOpen(false);

  const [moveItemTarget, setMoveItemTarget] = useState(null); // { catId, item }
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeletingList, setIsDeletingList] = useState(false);

  // Lock state to prevent accidental edits
  const [isLocked, setIsLocked] = useState(list.isLocked || false);

  // New-list callout: show once after creation, dismissed via localStorage
  const [showCallout, setShowCallout] = useState(
    () => localStorage.getItem("newListCallout") === listId,
  );
  useEffect(() => {
    setShowCallout(localStorage.getItem("newListCallout") === listId);
  }, [listId]);
  const dismissCallout = () => {
    localStorage.removeItem("newListCallout");
    setShowCallout(false);
  };


  // Prevent "stale list prop" from overwriting optimistic background changes.
  // We keep showing the optimistic value until the server (list prop) catches up.
  const pendingBgRef = React.useRef({
    bgColor: null, // string | null (null = no pending)
    bgImage: null, // string | null
    customBgUrl: null, // string | null
  });

  // Upload request token: if user switches lists mid-upload, ignore results.
  const uploadReqIdRef = React.useRef(0);

  const THUMB_TRANSFORM = "f_auto,q_auto,w_200,h_200,c_fill";

  const clearBgPreview = useCallback(() => {
    setBgPreviewUrl("");
    const u = bgPreviewUrlRef.current;
    if (u) {
      try {
        URL.revokeObjectURL(u);
      } catch {}
      bgPreviewUrlRef.current = "";
    }
  }, []);

  useEffect(() => {
    // Switching lists should cancel any in-flight upload UI and clear pending optimistics
    pendingBgRef.current = { bgColor: null, bgImage: null, customBgUrl: null };
    uploadReqIdRef.current += 1; // invalidates any in-flight async steps

    setIsUploading(false);
    setUploadPct(0);

    // clear any active blob preview (and revoke it)
    clearBgPreview();
  }, [listId, clearBgPreview]);

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

  const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

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

  // Keep local bgImage in sync with server (but don't stomp pending optimistic values)
  useEffect(() => {
    const serverUrl = list.backgroundImageUrl || "";
    const pending = pendingBgRef.current.bgImage;

    if (pending != null && serverUrl !== pending) return; // ignore stale props
    if (pending != null && serverUrl === pending)
      pendingBgRef.current.bgImage = null;

    setBgImage(serverUrl);
  }, [list.backgroundImageUrl]);

  useEffect(() => {
    const serverColor = list.backgroundColor || "";
    const pending = pendingBgRef.current.bgColor;

    if (pending != null && serverColor !== pending) return;
    if (pending != null && serverColor === pending)
      pendingBgRef.current.bgColor = null;

    setBgColor(serverColor);
  }, [list.backgroundColor]);

  useEffect(() => {
    if (isUploading) return; // avoid stomping while upload is in-flight
    const serverCustom = list.customBackground?.url || "";
    const pending = pendingBgRef.current.customBgUrl;

    if (pending != null && serverCustom !== pending) return;
    if (pending != null && serverCustom === pending)
      pendingBgRef.current.customBgUrl = null;

    setCustomBgUrl(serverCustom);
  }, [list.customBackground?.url, isUploading]);

  // Sync lock state with server
  useEffect(() => {
    setIsLocked(list.isLocked || false);
  }, [list.isLocked]);

  // Auto-group every time `items` changes
  useEffect(() => {
    const map = {};
    items.forEach((it) => {
      map[it.category] = map[it.category] || [];
      map[it.category].push(it);
    });
    setItemsMap(map);
  }, [items]);

  const fetchItems = useCallback(
    async (catId) => {
      if (!catId) return;
      const { data } = await api.get(
        `/dashboard/${listId}/categories/${catId}/items`,
      );
      setItemsMap((m) => ({ ...m, [catId]: data }));
    },
    [listId],
  );

  const refreshListAfterEdit = useCallback(() => {
    if (typeof onRefresh === "function") onRefresh();
  }, [onRefresh]);

  function baseColorClass(grams) {
    if (grams < 5_000) return "text-green-600";
    if (grams < 15_000) return "text-orange-500";
    return "text-red-500";
  }

  function computeStats(itemsMapArg) {
    let baseWeight = 0;
    let wornWeight = 0;
    let consumableWeight = 0;

    Object.values(itemsMapArg)
      .flat()
      .forEach((item) => {
        const w = item.weight || 0;
        const qty = item.quantity || 1;

        if (item.consumable) {
          consumableWeight += w * qty;
        } else if (item.worn) {
          wornWeight += w;
          if (qty > 1) baseWeight += w * (qty - 1);
        } else {
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

  const stats = React.useMemo(() => computeStats(itemsMap), [itemsMap]);

  // flatten ALL items into one array
  const allItems = Object.values(itemsMap).flat();
  const itemsCount = allItems.length;

  const baseItems = allItems.filter((i) => !i.worn && !i.consumable);
  const wornItems = allItems.filter((i) => i.worn);
  const consumableItems = allItems.filter((i) => i.consumable);

  const breakdowns = {
    base: baseItems,
    worn: wornItems,
    consumable: consumableItems,
    total: allItems,
  };

  // Lifted-up handlers for SortableItem
  const handleToggleWorn = useCallback((catId, itemId, newWorn) => {
    setItemsMap((m) => ({
      ...m,
      [catId]: m[catId].map((i) =>
        i._id === itemId ? { ...i, worn: newWorn } : i,
      ),
    }));
  }, []);

  const handleToggleConsumable = useCallback((catId, itemId, newConsumable) => {
    setItemsMap((m) => ({
      ...m,
      [catId]: m[catId].map((i) =>
        i._id === itemId ? { ...i, consumable: newConsumable } : i,
      ),
    }));
  }, []);

  const handleQuantityChange = useCallback(
    async (catId, itemId, newQty) => {
      // Optimistic
      setItemsMap((m) => ({
        ...m,
        [catId]: m[catId].map((i) =>
          i._id === itemId ? { ...i, quantity: newQty } : i,
        ),
      }));

      try {
        await api.patch(
          `/dashboard/${listId}/categories/${catId}/items/${itemId}`,
          { quantity: newQty },
        );
        await fetchItems(catId);
      } catch (err) {
        toast.error(err.message || t("gearList.toasts.quantityUpdateFailed"));
        fetchItems(catId);
      }
    },
    [fetchItems, listId, t],
  );

  const handleDeleteClick = (catId, itemId) => {
    setPendingDelete({ catId, itemId });
    setConfirmOpen(true);
  };

  const actuallyDeleteItem = async () => {
    const { catId, itemId } = pendingDelete;
    try {
      await api.delete(
        `/dashboard/${listId}/categories/${catId}/items/${itemId}`,
      );
      fetchItems(catId);
      // toast.success(t("gearList.toasts.itemDeleted"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("gearList.toasts.itemDeleteFailed"),
      );
    } finally {
      setConfirmOpen(false);
      setPendingDelete({ catId: null, itemId: null });
    }
  };

  const cancelDeleteItem = () => {
    setConfirmOpen(false);
    setPendingDelete({ catId: null, itemId: null });
  };

  const handleToggleLock = async () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked); // optimistic update

    try {
      await api.patch(`/dashboard/${listId}/lock`, { isLocked: newLocked });
      onRefresh?.();
      toast.success(
        newLocked
          ? t("gearList.toasts.listLocked")
          : t("gearList.toasts.listUnlocked"),
      );
    } catch (err) {
      setIsLocked(!newLocked); // rollback
      toast.error(t("gearList.toasts.lockToggleFailed"));
    }
  };

  const pendingDeleteCategory = React.useMemo(
    () => categories.find((c) => c._id === pendingDeleteCatId),
    [categories, pendingDeleteCatId],
  );

  // Add category
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
      await onRefresh();

      setNewCatName("");
      setAddingNewCat(false);

      // toast.success(t("gearList.toasts.categoryAdded"));
    } catch (err) {
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
      await onRefresh();
      // toast.success(t("gearList.toasts.categoryDeleted"));
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message ||
          t("gearList.toasts.categoryDeleteFailed"),
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

  // Edit category name inline
  const editCat = async (id, title) => {
    const newTitle = title.trim();
    if (!newTitle) {
      toast.error(t("gearList.toasts.categoryNameEmpty"));
      return;
    }

    const currentCat =
      Array.isArray(categories) && categories.find((c) => c._id === id);

    if (currentCat && currentCat.title.trim() === newTitle) {
      setEditingCatId(null);
      return;
    }

    try {
      await api.patch(`/dashboard/${listId}/categories/${id}`, {
        title: newTitle,
      });
      await onRefresh();
      setEditingCatId(null);
      // toast.success(t("gearList.toasts.categoryRenamed"));
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          t("gearList.toasts.categoryRenameFailed"),
      );
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over) return;

    // CATEGORY REORDER
    if (active.id.startsWith("cat-") && over.id.startsWith("cat-")) {
      const oldIndex = categories.findIndex(
        (c) => `cat-${c._id}` === active.id,
      );
      const newIndex = categories.findIndex((c) => `cat-${c._id}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(categories, oldIndex, newIndex).map(
          (catObj, idx) => ({ ...catObj, position: idx }),
        );
        await onReorderCategories(categories, reordered);
      }
      return;
    }

    // ITEM REORDER WITHIN SAME CATEGORY
    if (active.id.startsWith("item-") && over.id.startsWith("item-")) {
      const [, sourceCatId, sourceItemId] = active.id.split("-");
      const [, destCatId, destItemId] = over.id.split("-");

      if (sourceCatId === destCatId) {
        const oldArray = itemsMap[sourceCatId] || [];
        const oldIndex = oldArray.findIndex((i) => i._id === sourceItemId);
        const newIndex = oldArray.findIndex((i) => i._id === destItemId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(oldArray, oldIndex, newIndex).map(
            (it, idx) => ({ ...it, position: idx }),
          );

          setItemsMap((m) => ({ ...m, [sourceCatId]: reordered }));

          for (let i = 0; i < reordered.length; i++) {
            const it = reordered[i];
            const oldIt = oldArray.find((x) => x._id === it._id);
            if (oldIt && it.position !== oldIt.position) {
              await api.patch(
                `/dashboard/${listId}/categories/${sourceCatId}/items/${it._id}`,
                { position: i },
              );
            }
          }
        }
        return;
      }

      // ITEM MOVED TO A DIFFERENT CATEGORY
      const sourceArr = itemsMap[sourceCatId] || [];
      const destArr = itemsMap[destCatId] || [];
      const removedIdx = sourceArr.findIndex((i) => i._id === sourceItemId);
      const insertedIdx = destArr.findIndex((i) => i._id === destItemId);

      if (removedIdx !== -1 && insertedIdx !== -1) {
        const movedItem = sourceArr[removedIdx];
        const newSource = sourceArr
          .filter((i) => i._id !== sourceItemId)
          .map((it, idx) => ({ ...it, position: idx }));

        // Determine if we should insert before or after the over item
        // by comparing the dragged item's center with the over item's center
        let finalIdx = insertedIdx;
        const activeTranslated = active.rect.current.translated;
        const overRect = over.rect;
        if (activeTranslated && overRect) {
          const activeCenterY = activeTranslated.top + activeTranslated.height / 2;
          const overCenterY = overRect.top + overRect.height / 2;
          if (activeCenterY > overCenterY) {
            finalIdx = insertedIdx + 1;
          }
        }

        const newDest = [
          ...destArr.slice(0, finalIdx),
          movedItem,
          ...destArr.slice(finalIdx),
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

        await api.patch(
          `/dashboard/${listId}/categories/${sourceCatId}/items/${sourceItemId}`,
          {
            category: destCatId,
            position: newDest.find((i) => i._id === sourceItemId).position,
          },
        );

        for (let i = 0; i < newSource.length; i++) {
          const it = newSource[i];
          const oldIt = sourceArr.find((x) => x._id === it._id);
          if (oldIt && it.position !== oldIt.position) {
            await api.patch(
              `/dashboard/${listId}/categories/${sourceCatId}/items/${it._id}`,
              { position: i },
            );
          }
        }

        for (let i = 0; i < newDest.length; i++) {
          const it = newDest[i];
          const oldIt = destArr.find((x) => x._id === it._id);
          if (
            it._id !== sourceItemId &&
            oldIt &&
            it.position !== oldIt.position
          ) {
            await api.patch(
              `/dashboard/${listId}/categories/${destCatId}/items/${it._id}`,
              { position: i },
            );
          }
        }
      }
      return;
    }

    // DROP INTO EMPTY CATEGORY
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

      await api.patch(
        `/dashboard/${listId}/categories/${sourceCatId}/items/${sourceItemId}`,
        {
          category: destCatId,
          position: newDest.length - 1,
        },
      );

      for (let i = 0; i < newSource.length; i++) {
        const it = newSource[i];
        const oldIt = sourceArr.find((x) => x._id === it._id);
        if (oldIt && it.position !== oldIt.position) {
          await api.patch(
            `/dashboard/${listId}/categories/${sourceCatId}/items/${it._id}`,
            { position: i },
          );
        }
      }
    }
  };

  const handleDragStart = ({ active }) => {
    const node = active.node?.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      setActiveWidth(rect.width);
      setActiveHeight(rect.height);
    }

    if (active.id.startsWith("item-")) {
      const [, catId, itemId] = active.id.split("-");
      const itemArray = itemsMap[catId] || [];
      const found = itemArray.find((i) => i._id === itemId);
      if (found) setActiveItem({ catId, item: found });
    } else if (active.id.startsWith("cat-")) {
      const catId = active.id.replace(/^cat-/, "");
      const foundCat = categories.find((c) => c._id === catId);
      if (foundCat) setActiveCategory(foundCat);
    }
  };

  // Expose drag handlers to Dashboard's DndContext via mutable ref
  React.useEffect(() => {
    if (!dndRef) return;
    dndRef.current = {
      handleDragStart: isLocked ? undefined : handleDragStart,
      handleDragEnd: isLocked
        ? undefined
        : (event) => {
            handleDragEnd(event);
            setTimeout(() => {
              setActiveItem(null);
              setActiveCategory(null);
              setActiveWidth(null);
              setActiveHeight(null);
            }, 300);
          },
      getItemsMap: () => itemsMap,
      insertOptimistic: (targetCatId, insertPos, globalItem) => {
        const tempId = `temp-${Date.now()}`;
        const tempItem = {
          _id: tempId,
          globalItem: globalItem._id,
          productId: globalItem.productId,
          brand: globalItem.brand,
          itemType: globalItem.itemType,
          name: globalItem.name,
          description: globalItem.description,
          weight: globalItem.weight,
          link: globalItem.link,
          worn: globalItem.worn,
          consumable: globalItem.consumable,
          quantity: globalItem.quantity || 1,
          hasOffer: globalItem.hasOffer,
          position: insertPos,
        };
        setItemsMap((prev) => {
          const catItems = [...(prev[targetCatId] || [])];
          catItems.splice(insertPos, 0, tempItem);
          return {
            ...prev,
            [targetCatId]: catItems.map((it, idx) => ({
              ...it,
              position: idx,
            })),
          };
        });
        setNewItemId(tempId);
        setTimeout(() => setNewItemId(null), 400);
      },
      getPreviewWidth: () => {
        if (viewMode === "list" && listContainerRef.current) {
          return listContainerRef.current.clientWidth;
        }
        // Column mode: match SortableColumn width (w-90 = 344px mobile, sm:w-64 = 256px)
        return window.innerWidth >= 640 ? 256 : 344;
      },
    };
  });

  const handleMoveItemManual = async (
    fromCatId,
    itemId,
    toCatId,
    positionIndex,
  ) => {
    if (!fromCatId || !itemId || !toCatId) return;

    const sourceArr = itemsMap[fromCatId] || [];
    const destArr = itemsMap[toCatId] || [];

    const removedIdx = sourceArr.findIndex((i) => i._id === itemId);
    if (removedIdx === -1) return;

    const movedItem = sourceArr[removedIdx];

    // SAME-CATEGORY REORDER
    if (fromCatId === toCatId) {
      const oldArray = sourceArr;
      const safeIndex = Math.max(
        0,
        Math.min(positionIndex, oldArray.length - 1),
      );
      if (safeIndex === removedIdx) return;

      const reordered = arrayMove(oldArray, removedIdx, safeIndex).map(
        (it, idx) => ({ ...it, position: idx }),
      );

      setItemsMap((m) => ({ ...m, [fromCatId]: reordered }));

      try {
        for (let i = 0; i < reordered.length; i++) {
          const it = reordered[i];
          const oldItem = oldArray.find((x) => x._id === it._id);
          if (!oldItem || oldItem.position === i) continue;

          await api.patch(
            `/dashboard/${listId}/categories/${fromCatId}/items/${it._id}`,
            { position: i },
          );
        }
      } catch (err) {
        toast.error(err.message || t("gearList.toasts.moveItemFailed"));
        fetchItems(fromCatId);
      }

      return;
    }

    // CROSS-CATEGORY MOVE
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
      await api.patch(
        `/dashboard/${listId}/categories/${fromCatId}/items/${itemId}`,
        {
          category: toCatId,
          position: newDest.find((i) => i._id === itemId).position,
        },
      );

      for (let i = 0; i < newSource.length; i++) {
        const it = newSource[i];
        const oldItem = sourceArr.find((x) => x._id === it._id);
        if (!oldItem || oldItem.position === i) continue;

        await api.patch(
          `/dashboard/${listId}/categories/${fromCatId}/items/${it._id}`,
          { position: i },
        );
      }

      for (let i = 0; i < newDest.length; i++) {
        const it = newDest[i];
        const oldItem = destArr.find((x) => x._id === it._id);
        if (!oldItem || it._id === itemId || oldItem.position === i) continue;

        await api.patch(
          `/dashboard/${listId}/categories/${toCatId}/items/${it._id}`,
          { position: i },
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
      setIsEditingTitle(false);
      return;
    }
    try {
      await api.patch(`/dashboard/${listId}`, { title: trimmed });
      // toast.success(t("gearList.toasts.listRenamed"));
      onRefresh();
      fetchLists();
    } catch (err) {
      toast.error(err.message || t("gearList.toasts.listRenameFailed"));
      setTitleText(list.title);
    } finally {
      setIsEditingTitle(false);
    }
  };

  /**
   * Flash-free upload behavior:
   * - Show blob preview immediately (so user sees it instantly).
   * - Upload + persist in background.
   * - Set bgImage/customBgUrl to secureUrl right away, BUT keep blob preview active.
   * - Preload secureUrl; only then clear preview → seamless swap, no extra flashes.
   * - NO transformed URL swap here (that was causing the post-100% flashes).
   */
  const handleImageUpload = async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      toast.error(t("gearList.toasts.imageTooLarge"));
      if (e?.target) e.target.value = "";
      return;
    }

    const reqId = ++uploadReqIdRef.current;

    // Create blob preview and KEEP it until secureUrl is preloaded
    const previewUrl = URL.createObjectURL(file);
    bgPreviewUrlRef.current = previewUrl;
    setBgPreviewUrl(previewUrl);

    setIsUploading(true);
    setUploadPct(0);

    try {
      // Downscale/compress on client
      const { blob, mime } = await downscaleToTargetBytes(file, {
        maxSize: 3000,
        quality: 0.78,
        maxBytes: 1_500_000,
      });

      const ext = mime === "image/webp" ? "webp" : "jpg";
      const filename = `bg-${Date.now()}.${ext}`;

      // Direct upload to Cloudinary
      const { secureUrl, publicId } = await uploadBackgroundToCloudinary({
        blob,
        filename,
        onProgress: setUploadPct,
      });

      // If user switched lists mid-upload, ignore results
      if (uploadReqIdRef.current !== reqId) return;

      // Persist to DB
      await api.patch(`/dashboard/${listId}/preferences/image-direct`, {
        imageUrl: secureUrl,
        publicId,
      });

      // Mark optimistic targets (prevents stale props from stomping)
      pendingBgRef.current.bgColor = "";
      pendingBgRef.current.bgImage = secureUrl;
      pendingBgRef.current.customBgUrl = secureUrl;

      // Update state now, but preview still "wins" for rendering until we clear it.
      setBgColor("");
      setBgImage(secureUrl);
      setCustomBgUrl(secureUrl);

      // Kick a refresh, but DON'T await it (keeps UI snappy)
      onRefresh?.();
      fetchLists?.();

      // Preload the final url; only then clear preview (no flash)
      // If it takes a while, user still sees the preview (not a spinner).
      (async () => {
        const delays = [0, 400, 900, 1600, 2600]; // ~5.5s total
        for (let i = 0; i < delays.length; i++) {
          if (uploadReqIdRef.current !== reqId) return;
          if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
          try {
            await preloadImage(secureUrl);
            if (uploadReqIdRef.current !== reqId) return;
            clearBgPreview(); // <- the actual swap happens here
            return;
          } catch {
            // retry while keeping preview visible
          }
        }
        // If it still hasn't loaded, leave preview up (no flash),
        // but the list is saved; next navigation/refresh will show the Cloudinary URL.
        // (We purposely do NOT clear preview here to avoid blanking the bg.)
      })();
    } catch (err) {
      console.error("Background upload failed:", err);
      toast.error(err.response?.data?.message || err.message || t("gearList.toasts.imageUploadFailed"));

      pendingBgRef.current = {
        bgColor: null,
        bgImage: null,
        customBgUrl: null,
      };

      // Clear preview (and revoke) on failure
      clearBgPreview();
    } finally {
      if (uploadReqIdRef.current === reqId) setIsUploading(false);
      // allow selecting the same file again
      if (e?.target) e.target.value = "";
    }
  };

  const handleColorSelect = async (color) => {
    const prevColor = bgColor;
    const prevImage = bgImage;

    pendingBgRef.current.bgColor = color;
    pendingBgRef.current.bgImage = ""; // clearing active image

    // If we were showing a blob preview, stop it now (color should win)
    clearBgPreview();

    setBgImage("");
    setBgColor(color);

    try {
      await api.patch(`/dashboard/${listId}/preferences`, {
        backgroundColor: color,
      });
      onRefresh?.();
      fetchLists?.();
    } catch (err) {
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
    // stop any upload preview (explicit selection should win)
    clearBgPreview();

    const previousImage = bgImage;
    const previousColor = bgColor;

    pendingBgRef.current.bgColor = "";
    pendingBgRef.current.bgImage = url;

    setBgColor("");
    setBgImage(url);

    // Best-effort preload (don’t block UI)
    preloadImage(url).catch(() => {});

    try {
      await api.patch(`/dashboard/${listId}/preferences`, {
        backgroundImageUrl: url,
      });
      onRefresh?.();
      fetchLists?.();
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
      // toast.success(t("gearList.toasts.listCopied"));
      fetchLists();
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
      fetchLists();
      cancelDeleteList();
      navigate("/dashboard");
      // toast.success(t("gearList.toasts.listDeleted"));
    } catch (err) {
      toast.error(err.message || t("gearList.toasts.listDeleteFailed"));
    } finally {
      setIsDeletingList(false);
      setConfirmDeleteOpen(false);
    }
  };

  // Gradient overlay definition
  const overlay = "linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3))";

  // Preview always wins while it's present (prevents any flash during swap)
  const effectiveBgImage = bgPreviewUrl || bgImage || "";
  const effectiveBgColor = bgColor || "";

  // Apply consistent transformations to background images for optimal delivery
  // f_auto ensures proper format (WebP for modern browsers, JPEG fallback)
  // q_auto optimizes quality for performance
  const BG_TRANSFORM = "f_auto,q_auto";
  const transformedBgImage = effectiveBgImage
    ? cldTransformUrl(effectiveBgImage, BG_TRANSFORM)
    : "";

  // Tile uses preview while uploading so the user sees their image instantly
  // Apply transformations to custom URL but not to blob preview
  const tileBg = bgPreviewUrl || (customBgUrl ? cldTransformUrl(customBgUrl, THUMB_TRANSFORM) : "");

  const canSelectCustom = !!customBgUrl && !isUploading;

  const bgstyle = transformedBgImage
    ? {
        backgroundImage: `url(${transformedBgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : effectiveBgColor
      ? {
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
    <div
      style={bgstyle}
      className="relative flex flex-col h-full overflow-hidden"
    >
      <div className="w-full bg-base-100 bg-opacity-80">
        <div
          className={[
            "flex justify-between items-center pr-6 py-2",
            headerPadding,
          ].join(" ")}
        >
          {isDeletingList && (
            <div className="absolute inset-0 z-50 bg-black/40 cursor-wait">
              <Spinner
                centered
                tone="white"
                size="lg"
                label={t("gearList.deletingListLabel") || "Deleting list…"}
              />
            </div>
          )}
          {/* Title + stats, inline-editable */}
          <div className="flex-1 flex items-center sm:flex-none sm:space-x-8">
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
                <div className="flex items-center gap-1.5">
                  {onBackToLists && (
                    <>
                      <button
                        type="button"
                        onClick={onBackToLists}
                        className="hide-on-touch text-xs text-primaryAlt hover:underline transition-colors flex-shrink-0"
                      >
                        {t("listsOverview.title")}
                      </button>
                      <span className="hide-on-touch text-xs text-primaryAlt/60">/</span>
                    </>
                  )}
                  <h2
                    onClick={() => !isLocked && setIsEditingTitle(true)}
                    className={`hide-on-touch text-primary ${isLocked ? "cursor-default" : "cursor-text"}`}
                  >
                    {list.title}
                  </h2>
                </div>
                <div className="hidden sm:block">
                  <PackStats
                    base={stats.baseWeight}
                    worn={stats.wornWeight}
                    consumable={stats.consumableWeight}
                    total={stats.totalWeight}
                    breakdowns={breakdowns}
                  />
                </div>
                {/* Mobile-only: list name */}
                <div className="sm:hidden w-full flex items-center pl-3">
                  <span className="truncate text-primary font-medium text-sm">{list.title}</span>
                </div>
              </>
            )}
          </div>

          {/* Share + Details + Lock + Ellipsis menu grouped together */}
          <div className="flex items-center gap-4">
            {/* Share button - desktop only */}
            <button
              onClick={() => setShareOpen(true)}
              className="hidden sm:inline-flex items-center justify-center text-primaryAlt hover:text-primaryAlt/80 leading-none"
              aria-label={t("gearList.menu.shareList")}
            >
              <FiShare2 />
            </button>

            {/* Details button - desktop only */}
            <button
              onClick={() => setShowDetailsModal(true)}
              className="hidden sm:inline-flex items-center justify-center text-primaryAlt hover:text-primaryAlt/80 leading-none"
              aria-label={t("gearList.menu.viewEditDetails")}
            >
              <FiInfo />
            </button>

            {/* Lock toggle button - desktop only */}
            <button
              onClick={handleToggleLock}
              className="hidden sm:inline-flex items-center justify-center text-primaryAlt hover:text-primaryAlt/80 leading-none"
              aria-label={
                isLocked
                  ? t("gearList.menu.unlockListA11y")
                  : t("gearList.menu.lockListA11y")
              }
            >
              {isLocked ? <FiLock /> : <FiUnlock />}
            </button>

            {/* Base weight - mobile only, next to ellipsis */}
            <div className="sm:hidden">
              <StatWithDetails
                icon={BsBackpack4}
                raw={stats.baseWeight}
                label={t("packStats.base")}
                items={[]}
                colorClass={baseColorClass(stats.baseWeight)}
                disablePopover
              />
            </div>

            {/* Ellipsis menu */}
            <DropdownMenu
            trigger={
              <button
                data-tour="list-preferences-menu"
                onMouseEnter={preloadBackgroundThumbs}
                className="inline-flex items-center justify-center text-primaryAlt hover:text-primaryAlt/80 leading-none"
                aria-label={t("gearList.menu.listOptionsA11y")}
              >
                <FiMoreHorizontal />
              </button>
            }
            menuWidth="w-56"
            items={[
              {
                key: "header-prefs",
                render: () => (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary uppercase">
                      {t("gearList.menu.headerPreferences")}
                    </span>
                    <button
                      onClick={handleToggleLock}
                      className="sm:hidden p-1 text-primary hover:text-primary/80"
                      aria-label={
                        isLocked
                          ? t("gearList.menu.unlockListA11y")
                          : t("gearList.menu.lockListA11y")
                      }
                    >
                      {isLocked ? <FiLock /> : <FiUnlock />}
                    </button>
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

                    <p className="text-sm text-primary/80 mb-1">
                      {t("gearList.menu.customImage")}
                    </p>

                    {isUploading && (
                      <p className="text-xs text-primary/70 mt-1">
                        Uploading… {uploadPct}%
                      </p>
                    )}

                    <div className="grid grid-cols-4 gap-2 mt-1 mx-auto w-full max-w-xs">
                      {(bgPreviewUrl || customBgUrl) && (
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
                              THUMB_TRANSFORM,
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
                    <p className="mt-3 text-sm text-primary/80 mb-1">
                      {t("gearList.menu.colors")}
                    </p>

                    <div className="grid grid-cols-4 gap-2 place-items-center mt-2">
                      {swatches.map(({ key, value, class: cls }) => (
                        <div key={key} className="relative group">
                          <button
                            onClick={() => handleColorSelect(value)}
                            className={`${cls} w-6 h-6 rounded-full flex items-center justify-center p-0`}
                          >
                            {bgColor === value && (
                              <FiCheck className="text-white text-sm" />
                            )}
                          </button>

                          <span
                            className="
absolute bottom-full left-1/2 transform -translate-x-1/2
mb-1 px-2 py-0.5 text-sm text-white bg-black bg-opacity-75 rounded
opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity
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
      </div>

      <ShareModal listId={listId} isOpen={shareOpen} onClose={closeShare} />

      <SortableContext
        items={categories.map((c) => `cat-${c._id}`)}
        strategy={
          viewMode === "list"
            ? verticalListSortingStrategy
            : horizontalListSortingStrategy
        }
      >
        {viewMode === "list" ? (
          <div ref={listContainerRef} className="flex-1 overflow-y-auto px-2 py-2 sm:w-4/5 sm:mx-auto">
            {showCallout && (
              <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
                <span>{t("gearList.newListCallout")}</span>
                <button
                  type="button"
                  onClick={dismissCallout}
                  aria-label="Dismiss"
                  className="ml-2 text-primary/60 hover:text-primary flex-shrink-0"
                >
                  <FiX size={14} />
                </button>
              </div>
            )}
            {categories.map((cat) => (
              <SortableSection
                key={cat._id}
                category={cat}
                items={itemsMap[cat._id] || []}
                editingCatId={editingCatId}
                setEditingCatId={setEditingCatId}
                onEditCat={(newTitle) => editCat(cat._id, newTitle)}
                onDeleteCategory={handleDeleteCatClick}
                showAddModalCat={showAddModalCat}
                setShowAddModalCat={setShowAddModalCat}
                fetchItems={fetchItems}
                listId={listId}
                onDeleteItem={handleDeleteClick}
                onToggleWorn={handleToggleWorn}
                onToggleConsumable={handleToggleConsumable}
                onQuantityChange={handleQuantityChange}
                onMoveItem={(catId, item) => setMoveItemTarget({ catId, item })}
                viewMode={viewMode}
                onItemUpdated={refreshListAfterEdit}
                isLocked={isLocked}

                sidebarDragOver={sidebarDragOverCatId === cat._id}
                newItemId={newItemId}
              />
            ))}

            {!isLocked && (
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
                      setNewCatName("");
                      setAddingNewCat(true);
                    }}
                    className="p-2 w-full border border-secondary rounded flex items-center justify-center space-x-2 bg-base-100 text-primary hover:bg-base-100/80"
                  >
                    <FiPlus />
                    <span className="text-sm">
                      {t("gearList.addCategory.button")}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-nowrap items-start overflow-x-auto px-2 py-2 snap-x snap-mandatory sm:snap-none">
            {categories.map((cat) => (
              <SortableColumn
                key={cat._id}
                category={cat}
                items={itemsMap[cat._id] || []}
                editingCatId={editingCatId}
                setEditingCatId={setEditingCatId}
                onEditCat={(newTitle) => editCat(cat._id, newTitle)}
                onDeleteCategory={handleDeleteCatClick}
                showAddModalCat={showAddModalCat}
                setShowAddModalCat={setShowAddModalCat}
                fetchItems={fetchItems}
                listId={listId}
                onDeleteItem={handleDeleteClick}
                onToggleWorn={handleToggleWorn}
                onToggleConsumable={handleToggleConsumable}
                onQuantityChange={handleQuantityChange}
                onMoveItem={(catId, item) => setMoveItemTarget({ catId, item })}
                viewMode={viewMode}
                onItemUpdated={refreshListAfterEdit}
                isLocked={isLocked}

                sidebarDragOver={sidebarDragOverCatId === cat._id}
                newItemId={newItemId}
              />
            ))}

            {!isLocked && (
              <div className="snap-center flex-shrink-0 mt-0 mb-0 w-90 sm:w-64 flex flex-col h-full px-2">
                {addingNewCat ? (
                  <div>
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
                    data-tour="gearlist-add-category"
                    onClick={() => setAddingNewCat(true)}
                    className="p-2 w-full border border-secondary rounded flex items-center justify-center space-x-2 bg-base-100 text-primary hover:bg-base-100/80"
                  >
                    <FiPlus />
                    <span className="text-sm">
                      {t("gearList.addCategory.button")}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </SortableContext>

      {/* Internal drag overlay for category/item reordering */}
      <DragOverlay
        style={{ pointerEvents: "none", zIndex: 1000 }}
        dropAnimation={{
          duration: 250,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {activeItem ? (
          <PreviewCard
            item={activeItem.item}
            viewMode={viewMode}
            width={activeWidth}
          />
        ) : activeCategory ? (
          <PreviewColumn
            category={activeCategory}
            items={itemsMap[activeCategory._id] || []}
            width={activeWidth}
            height={activeHeight}
          />
        ) : null}
      </DragOverlay>

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
            positionIndex,
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
