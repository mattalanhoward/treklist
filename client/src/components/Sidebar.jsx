// src/components/Sidebar.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../services/api";
import {
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaChevronDown,
  FaChevronUp,
  FaGripVertical,
} from "react-icons/fa";
import { useDraggable } from "@dnd-kit/core";
import GlobalItemModal from "./GlobalItemModal";
import GlobalItemEditModal from "./GlobalItemEditModal";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";

function SidebarDraggableItem({ item, onClickDetails, isLocked }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${item._id}`,
    data: { globalItem: item },
    disabled: isLocked,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center w-full py-1 px-2 bg-base-100/10 border border-primary/20 rounded-lg hover:bg-base-100/20 text-secondaryAlt ${isDragging ? "opacity-50" : ""}`}
    >
      {!isLocked && (
        <FaGripVertical
          {...attributes}
          {...listeners}
          className="hide-on-touch mr-2 cursor-grab text-primaryAlt flex-shrink-0"
        />
      )}
      <button
        type="button"
        onClick={onClickDetails}
        className="flex-1 text-left truncate cursor-pointer"
      >
        {item.itemType} – {item.name}
      </button>
    </div>
  );
}

export default function Sidebar({
  lists,
  fetchLists,
  currentListId,
  categories,
  onSelectList,
  onRefresh,
  collapsed,
  setCollapsed,
  onOpenAdmin = () => {},
  onOpenForum = () => {},
  onOpenWishlist = () => {},
  onOpenMyGear = () => {},
  onShowGearPane = () => {},
  isAdmin = false,
  isLocked = false,
}) {
  const { t } = useTranslation("common");

  const [newListTitle, setNewListTitle] = useState("");
  const newListInputRef = useRef(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGlobalItem, setEditingGlobalItem] = useState(null);

  const {
    region,
    sidebarGearListsCollapsed,
    setSidebarGearListsCollapsed,
    sidebarMyGearCollapsed,
    setSidebarMyGearCollapsed,
  } = useUserSettings();

  // Autofocus "New list" input when Gear Lists section opens (desktop only)
  useEffect(() => {
    if (collapsed) return;
    if (sidebarGearListsCollapsed) return;
    if (isMobile()) return;

    // Defer to next tick so the input is mounted/visible
    const id = window.setTimeout(() => {
      newListInputRef.current?.focus();
      newListInputRef.current?.select?.();
    }, 0);

    return () => window.clearTimeout(id);
  }, [collapsed, sidebarGearListsCollapsed]);

  // global gear items & debounced search
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch global items (small dataset: <200) + refresh on global update event

  // Refresh global items whenever a global item is edited anywhere
  useEffect(() => {
    const handleGlobalUpdated = () => {
      fetchGlobalItems();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("global-items:updated", handleGlobalUpdated);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("global-items:updated", handleGlobalUpdated);
      }
    };
  }, []);

  const fetchGlobalItems = async () => {
    try {
      const { data } = await api.get("/global/items");
      setItems(data);
    } catch (err) {
      console.error("Error fetching gear items:", err);
    }
  };

  useEffect(() => {
    fetchGlobalItems();
  }, []);

  function normalize(str = "") {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function toSearchText(item) {
    const parts = [
      item.name,
      item.brand,
      item.itemType,
      item.category?.name ?? item.category,
      item.subcategory?.name ?? item.subcategory,
      item.description,
      ...(Array.isArray(item.tags) ? item.tags : []),
    ];
    return normalize(parts.filter(Boolean).join(" "));
  }

  // === Gear‐list CRUD ===

  const createList = async () => {
    const title = newListTitle.trim();
    if (!title) return toast.error(t("sidebar.listNameEmpty"));

    try {
      const { data } = await api.post("/dashboard", { title, region });
      setNewListTitle("");
      await fetchLists();
      localStorage.setItem("lastListId", data.list._id);
      onSelectList(data.list._id);
      // toast.success(t("sidebar.listCreated"));
    } catch (err) {
      console.error("Error creating list:", err);
      toast.error(
        err.response?.data?.message || t("sidebar.couldNotCreateList"),
      );
    }
  };

  // === gear item actions ===

  const addToList = async (item) => {
    if (!currentListId || categories.length === 0) {
      return toast.error(t("sidebar.mustSelectListFirst"));
    }

    const cat = categories[0]; // or whichever category you're using

    try {
      // Fetch current items in this category to compute next position
      const { data: itemsInCat } = await api.get(
        `/dashboard/${currentListId}/categories/${cat._id}/items`,
      );

      const maxPos =
        itemsInCat && itemsInCat.length
          ? Math.max(
              ...itemsInCat.map((it) =>
                Number.isFinite(it.position) ? it.position : -1,
              ),
            )
          : -1;

      const nextPos = maxPos + 1;

      await api.post(
        `/dashboard/${currentListId}/categories/${cat._id}/items`,
        {
          globalItem: item._id,
          brand: item.brand,
          itemType: item.itemType,
          name: item.name,
          description: item.description,
          weight: item.weight,
          link: item.link,
          worn: item.worn,
          consumable: item.consumable,
          quantity: item.quantity,
          position: nextPos, // <-- append to end
        },
      );

      onRefresh();
    } catch (err) {
      console.error("Error adding item to list:", err);
      toast.error(t("sidebar.addToListFailed"));
    }
  };

  // === UI rendering helpers ===

  const sortedLists = useMemo(
    () =>
      [...lists].sort((a, b) =>
        a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
      ),
    [lists],
  );

  const filteredAndSortedItems = useMemo(() => {
    const q = normalize(searchQuery);
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const filtered =
      tokens.length === 0
        ? items
        : items.filter((item) => {
            const hay = toSearchText(item);
            return tokens.every((tok) => hay.includes(tok));
          });

    return [...filtered].sort((a, b) => {
      const aKey = normalize(`${a.itemType ?? ""} ${a.name ?? ""}`);
      const bKey = normalize(`${b.itemType ?? ""} ${b.name ?? ""}`);
      return aKey.localeCompare(bKey);
    });
  }, [items, searchQuery]);

  const widthClass = collapsed ? "w-0" : "w-full sm:w-80";
  const overlay = !collapsed
    ? // on mobile: take it out of the flow and cover
      "fixed top-12 left-0 right-0 bottom-0 z-[40] \
      sm:static sm:inset-auto sm:z-auto"
    : // when collapsed (or on desktop) nothing special
      "";

  // inside Sidebar.jsx, just above your component fn
  const isMobile = () =>
    typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div className={`h-full flex overflow-visible ${overlay}`}>
      <div
        className={`
          relative
          bg-neutral
          ${widthClass}
          ${collapsed ? "" : "min-w-[1.25rem]"}
          transition-[width] duration-300 ease-in-out
        `}
      >
        {/* collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={
            `absolute z-50 top-[0.3rem] sm:top-[0.4rem] text-primaryAlt hover:text-primaryAlt/80 p-1 transform ` +
            (collapsed ? "right-[-1rem] translate-x-full" : "right-4")
          }
        >
          {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
        </button>

        {!collapsed && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Admin header pinned at the top */}
            {isAdmin && (
              <section className="px-4 py-2 border-b border-base-100">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAdmin();
                    if (isMobile()) setCollapsed(true);
                  }}
                  className="flex items-center text-primaryAlt font-bold truncate"
                >
                  Admin
                </button>
              </section>
            )}
            {/* Gear Lists section */}
            <section
              className={
                "flex flex-col flex-none px-4 py-2 border-b border-base-100 overflow-hidden " +
                (sidebarGearListsCollapsed ? "" : "h-1/3")
              }
            >
              <div
                data-tour="sidebar-create-list"
                className="flex items-center text-primaryAlt rounded-lg p-1 -m-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onShowGearPane();
                    if (isMobile()) setCollapsed(true);
                  }}
                  className="font-bold truncate mr-1 text-left hover:underline transition-colors"
                >
                  {t("sidebar.gearListsTitle")}
                </button>
                <button
                  type="button"
                  aria-label="Toggle gear lists section"
                  onClick={() => setSidebarGearListsCollapsed((prev) => !prev)}
                  className="p-1 hover:text-primaryAlt/80"
                >
                  {sidebarGearListsCollapsed ? (
                    <FaChevronDown className="text-xs" />
                  ) : (
                    <FaChevronUp className="text-xs" />
                  )}
                </button>
              </div>
              {!sidebarGearListsCollapsed && (
                <>
                  <div className="flex mb-3">
                    <input
                    ref={newListInputRef}
                      className="flex-1 rounded-lg mt-2 py-1 px-2 bg-base-100 text-primary border-primary"
                      placeholder={t("sidebar.newListPlaceholder")}
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onKeyDown={(e) => {
     if (e.key === "Enter") {
       e.preventDefault();
       if (newListTitle.trim()) createList();
     } else if (e.key === "Escape") {
       setNewListTitle("");
     }
   }}
                    />
                    <button
                      aria-label="Create list"
                      onClick={createList}
                      disabled={!newListTitle.trim()}
                      className="ml-2 p-1 text-primaryAlt hover:text-primaryAlt/80"
                    >
                      <FaPlus />
                    </button>
                  </div>
                  <ul className="overflow-y-auto flex-1 space-y-1 text-secondaryAlt">
                    {sortedLists.map((l) => (
                      <li key={l._id} className="flex items-center">
                        <button
                          onClick={() => {
                            // Always call onSelectList to ensure view switches (e.g., from MyGear)
                            onSelectList(l._id);

                            // Collapse sidebar on mobile
                            if (isMobile()) {
                              setCollapsed(true);
                            }
                          }}
                          className={`flex-1 text-left py-1 px-2 rounded-lg whitespace-nowrap overflow-hidden truncate ${
                            l._id === currentListId
                              ? "bg-primaryAlt text-base-100"
                              : "hover:bg-primaryAlt hover:text-neutral"
                          }`}
                        >
                          {l.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* Gear Items / Global Items */}
            <section className="flex flex-col flex-1 px-4 py-2 overflow-hidden">
              <div
                data-tour="sidebar-my-gear"
                className="flex items-center text-primaryAlt rounded-lg p-1 -m-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenMyGear();
                    if (isMobile()) setCollapsed(true);
                  }}
                  className="font-bold truncate mr-1 text-left hover:underline transition-colors"
                >
                  {t("sidebar.myGearTitle")}
                </button>
                <button
                  type="button"
                  aria-label="Toggle my gear section"
                  onClick={() => setSidebarMyGearCollapsed((prev) => !prev)}
                  className="p-1 hover:text-primaryAlt/80"
                >
                  {sidebarMyGearCollapsed ? (
                    <FaChevronDown className="text-xs" />
                  ) : (
                    <FaChevronUp className="text-xs" />
                  )}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1 text-primaryAlt hover:text-primaryAlt/80"
                >
                  <FaPlus />
                </button>
              </div>

              {!sidebarMyGearCollapsed && (
                <>
                  <input
                    className="w-full rounded-lg py-1 px-2 mt-2 bg-base-100 text-primary border border-primary mb-3"
                    placeholder={t("sidebar.searchGearPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <ul className="overflow-y-auto flex-1 space-y-2">
                    {filteredAndSortedItems.map((item) => (
                      <li key={item._id}>
                        <SidebarDraggableItem
                          item={item}
                          onClickDetails={() => setEditingGlobalItem(item)}
                          isLocked={isLocked}
                        />
                      </li>
                    ))}
                    {filteredAndSortedItems.length === 0 && (
                      <li className="text-primaryAlt py-1 px-2">
                        {t("sidebar.noGearItems")}
                      </li>
                    )}
                  </ul>
                </>
              )}

              {showCreateModal && (
                <GlobalItemModal
                  categories={categories}
                  onClose={() => {
                    setShowCreateModal(false);
                    fetchGlobalItems();
                  }}
                  onCreated={() => {
                    setShowCreateModal(false);
                    fetchGlobalItems();
                    onRefresh();
                    window.dispatchEvent(new CustomEvent("global-items:updated"));
                  }}
                />
              )}

              {editingGlobalItem && (
                <GlobalItemEditModal
                  item={editingGlobalItem}
                  onClose={() => setEditingGlobalItem(null)}
                  onSaved={() => {
                    fetchGlobalItems();
                    setEditingGlobalItem(null);
                    onRefresh();
                  }}
                />
              )}
            </section>
            {/* Bottom actions group: Forum (future) Wishlist + Admin */}
            {/* <div className="mt-auto">
              <section className="px-4 py-2 border-t border-base-100">
                <button
                  type="button"
                  onClick={() => {
                    onOpenForum();
                    if (isMobile()) {
                      setCollapsed(true);
                    }
                  }}
                  className="flex items-center text-primaryAlt font-bold truncate"
                >
                  Forum
                </button>
              </section>

              <section className="px-4 py-2 border-t border-base-100">
                <button
                  type="button"
                  onClick={() => {
                    onOpenWishlist();
                    if (isMobile()) {
                      setCollapsed(true);
                    }
                  }}
                  className="flex items-center text-primaryAlt font-bold truncate"
                >
                  Wishlist
                </button>
              </section>

          
            </div> */}
          </div>
        )}
      </div>
    </div>
  );
}
