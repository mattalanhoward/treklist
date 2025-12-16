// src/components/Sidebar.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import {
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaEllipsisH,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import GlobalItemModal from "./GlobalItemModal";
import GlobalItemEditModal from "./GlobalItemEditModal";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";

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
  onShowGearPane = () => {},
  isAdmin = false,
}) {
  const { t } = useTranslation("common");

  const [newListTitle, setNewListTitle] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGlobalItem, setEditingGlobalItem] = useState(null);

  const {
    region,
    sidebarGearListsCollapsed,
    setSidebarGearListsCollapsed,
    sidebarMyGearCollapsed,
    setSidebarMyGearCollapsed,
  } = useUserSettings();

  // global gear items & debounced search
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // 1) update debouncedSearch 1000 ms after user stops typing
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 1000);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Refresh global items whenever a global item is edited anywhere
  useEffect(() => {
    const handleGlobalUpdated = () => {
      fetchGlobalItems(debouncedSearch);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("global-items:updated", handleGlobalUpdated);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("global-items:updated", handleGlobalUpdated);
      }
    };
  }, [debouncedSearch]);

  // 2) fetch whenever debouncedSearch changes
  const fetchGlobalItems = async (query) => {
    try {
      const { data } = await api.get("/global/items", {
        params: { search: query },
      });
      setItems(data);
    } catch (err) {
      console.error("Error fetching gear items:", err);
    }
  };

  useEffect(() => {
    fetchGlobalItems(debouncedSearch);
  }, [debouncedSearch]);

  // ─── Auto‐select first list if none is selected ───
  useEffect(() => {
    if (!currentListId && lists.length > 0) {
      onSelectList(lists[0]._id);
    }
  }, [lists, currentListId, onSelectList]);

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
      toast.success(t("sidebar.listCreated"));
    } catch (err) {
      console.error("Error creating list:", err);
      toast.error(
        err.response?.data?.message || t("sidebar.couldNotCreateList")
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
        `/dashboard/${currentListId}/categories/${cat._id}/items`
      );

      const maxPos =
        itemsInCat && itemsInCat.length
          ? Math.max(
              ...itemsInCat.map((it) =>
                Number.isFinite(it.position) ? it.position : -1
              )
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
          price: item.price,
          link: item.link,
          worn: item.worn,
          consumable: item.consumable,
          quantity: item.quantity,
          position: nextPos, // <-- append to end
        }
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
        a.title.toLowerCase().localeCompare(b.title.toLowerCase())
      ),
    [lists]
  );

  const filteredAndSortedItems = useMemo(() => {
    const lower = searchQuery.trim().toLowerCase();
    const filtered =
      lower === ""
        ? items
        : items.filter((item) =>
            `${item.itemType} ${item.name}`.toLowerCase().includes(lower)
          );
    return [...filtered].sort((a, b) =>
      `${a.itemType} ${a.name}`
        .toLowerCase()
        .localeCompare(`${b.itemType} ${b.name}`.toLowerCase())
    );
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
            // top offset is ALWAYS 0.3rem mobile / 0.4rem desktop
            `absolute top-[0.3rem] sm:top-[0.4rem] text-primaryAlt hover:text-primaryAlt/80 p-1 transform ` +
            // only right/translate changes when collapsed vs open
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
                  onClick={onOpenAdmin}
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
              <div className="flex items-center text-primaryAlt">
                <button
                  type="button"
                  onClick={onShowGearPane}
                  className="font-bold truncate mr-1 text-left"
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
                      className="flex-1 rounded-lg mt-2 py-1 px-2 bg-base-100 text-primary border-primary"
                      placeholder={t("sidebar.newListPlaceholder")}
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
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
                            // If this list is already active:
                            if (l._id === currentListId) {
                              // Just collapse on mobile (nice UX), but don't trigger a re-select.
                              if (isMobile()) {
                                setCollapsed(true);
                              }
                              return;
                            }

                            // 1) Select the new list
                            onSelectList(l._id);

                            // 2) if on mobile, collapse sidebar
                            if (isMobile()) {
                              setCollapsed(true);
                            }

                            // 3) Persist or clear storage (can actually be left to Dashboard, but harmless here)
                            if (l._id) {
                              localStorage.setItem("lastListId", l._id);
                            } else {
                              localStorage.removeItem("lastListId");
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
              <div className="flex items-center text-primaryAlt">
                <button
                  type="button"
                  onClick={onShowGearPane}
                  className="font-bold truncate mr-1 text-left"
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
                  disabled={!currentListId || categories.length === 0}
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
                      <li
                        key={item._id}
                        className="flex items-center py-1 px-2 bg-base-100/10 border border-primary/20 rounded-lg hover:bg-base-100/20"
                      >
                        <span className="flex-1 truncate text-secondaryAlt">
                          {item.itemType} – {item.name}
                        </span>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => setEditingGlobalItem(item)}
                            title={t("sidebar.editGlobalTemplate")}
                            className="text-secondaryAlt hover:text-secondaryAlt/80 rounded-lg"
                          >
                            <FaEllipsisH />
                          </button>
                        </div>
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
            <div className="mt-auto">
              {/* Forum (future feature) */}
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

              {/* Wishlist (future feature) */}
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

              {/* Admin header pinned at the bottom */}
              {/* {isAdmin && (
                <section className="px-4 py-2 border-t border-base-100">
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="flex items-center text-primaryAlt font-bold truncate"
                  >
                    Admin
                  </button>
                </section>
              )} */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
