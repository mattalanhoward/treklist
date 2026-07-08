// src/components/Sidebar.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import { FaGripVertical } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight, FiPlus, FiChevronDown, FiChevronUp, FiLayers, FiSettings, FiBookmark, FiUsers } from "react-icons/fi";
import { BsBackpack4 } from "react-icons/bs";
import { useDraggable } from "@dnd-kit/core";
import GlobalItemModal from "./GlobalItemModal";
import GlobalItemEditModal from "./GlobalItemEditModal";
import CreateListModal from "./CreateListModal";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { getCommunities } from "../services/community";
import { SHOW_COMMUNITY } from "../config/features";

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
  onOpenMyGear = () => {},
  onShowGearPane = () => {},
  onOpenTemplates = () => {},
  onOpenCommunity = () => {},
  isAdmin = false,
  isLocked = false,
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();

  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGlobalItem, setEditingGlobalItem] = useState(null);

  const {
    region,
    sidebarGearListsCollapsed,
    setSidebarGearListsCollapsed,
    sidebarMyGearCollapsed,
    setSidebarMyGearCollapsed,
  } = useUserSettings();

  const [communities, setCommunities] = useState([]);
  const [communitiesCollapsed, setCommunitiesCollapsed] = useState(false);

  function fetchCommunities() {
    getCommunities().then(setCommunities).catch(() => {});
  }

  useEffect(() => {
    fetchCommunities();
    window.addEventListener("community:favorites-updated", fetchCommunities);
    return () => window.removeEventListener("community:favorites-updated", fetchCommunities);
  }, []);

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

    const owned = items.filter((item) => !item.importedFromShare);

    const filtered =
      tokens.length === 0
        ? owned
        : owned.filter((item) => {
            const hay = toSearchText(item);
            return tokens.every((tok) => hay.includes(tok));
          });

    return [...filtered].sort((a, b) => {
      const aKey = normalize(`${a.itemType ?? ""} ${a.name ?? ""}`);
      const bKey = normalize(`${b.itemType ?? ""} ${b.name ?? ""}`);
      return aKey.localeCompare(bKey);
    });
  }, [items, searchQuery]);

  const widthClass = collapsed ? "w-0 sm:w-12" : "w-full sm:w-80";
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
          transition-[width] duration-300 ease-in-out
        `}
      >
        {/* Circular edge toggle — desktop only */}
        <button
          onClick={() => {
            if (collapsed) {
              window.dispatchEvent(new CustomEvent("sidebar:expanded"));
              setCollapsed(false);
            } else {
              setCollapsed(true);
            }
          }}
          className="hidden sm:flex absolute z-50 top-14 right-0 translate-x-1/2 w-5 h-5 rounded-full bg-neutral border border-base-100 shadow-sm items-center justify-center text-primaryAlt hover:text-primary hover:border-primary/40 transition-colors"
          title={collapsed ? "Open sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <FiChevronRight className="w-3 h-3" />
          ) : (
            <FiChevronLeft className="w-3 h-3" />
          )}
        </button>

        {/* Content crossfade wrapper — clips both layers during the width transition */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Icon rail — desktop only, fades in near the end of a collapse */}
          <div
            className={`hidden sm:flex flex-col items-center pt-3 gap-1 absolute inset-0 transition-opacity duration-150 ease-in-out ${
              collapsed ? "opacity-100 delay-150" : "opacity-0 delay-0 pointer-events-none"
            }`}
          >
            {isAdmin && (
              <button
                type="button"
                title={t("sidebar.a11y.admin")}
                onClick={() => {
                  onOpenAdmin();
                }}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-primaryAlt hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <FiSettings className="w-4 h-4" />
              </button>
            )}
            {SHOW_COMMUNITY && (
              <button
                type="button"
                title={t("sidebar.a11y.community")}
                onClick={() => onOpenCommunity(null)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-primaryAlt hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <FiUsers className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              title={t("sidebar.gearListsTitle")}
              onClick={() => {
                onShowGearPane();
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-primaryAlt hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <FiLayers className="w-4 h-4" />
            </button>
            <button
              type="button"
              title={t("sidebar.templatesTitle")}
              onClick={() => {
                onOpenTemplates();
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-primaryAlt hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <FiBookmark className="w-4 h-4" />
            </button>
            <button
              type="button"
              title={t("sidebar.myGearTitle")}
              onClick={() => {
                onOpenMyGear();
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-primaryAlt hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <BsBackpack4 className="w-4 h-4" />
            </button>
          </div>

          {/* Labeled content — fades out immediately on collapse, fades in near the end of an expand */}
          <div
            className={`h-full flex flex-col absolute inset-0 transition-opacity duration-150 ease-in-out ${
              collapsed ? "opacity-0 delay-0 pointer-events-none" : "opacity-100 delay-150"
            }`}
          >
            {/* Top bar — Admin link for admins only */}
            {isAdmin && (
              <section className="flex items-center px-4 border-b border-base-100 flex-shrink-0 h-10">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAdmin();
                    if (isMobile()) setCollapsed(true);
                  }}
                  className="flex items-center text-primaryAlt font-bold truncate"
                >
                  {t("sidebar.a11y.admin")}
                </button>
              </section>
            )}
            {/* Community section */}
            {SHOW_COMMUNITY && (
            <section className="flex flex-col flex-none px-4 py-2 border-b border-base-100 overflow-hidden">
              <div data-tour="sidebar-community" className="flex items-center text-primaryAlt rounded-lg p-1 -m-1">
                <button
                  type="button"
                  onClick={() => {
                    onOpenCommunity(null);
                    if (isMobile()) setCollapsed(true);
                  }}
                  className="flex items-center gap-2 font-bold truncate mr-1 text-left hover:underline transition-colors"
                >
                  <FiUsers className="w-3.5 h-3.5 flex-shrink-0" />
                  {t("sidebar.a11y.community")}
                </button>
                <button
                  type="button"
                  aria-label={t("sidebar.a11y.toggleCommunities")}
                  onClick={() => setCommunitiesCollapsed((p) => !p)}
                  className="p-1 hover:text-primaryAlt/80"
                >
                  {communitiesCollapsed ? (
                    <FiChevronDown className="text-xs" />
                  ) : (
                    <FiChevronUp className="text-xs" />
                  )}
                </button>
              </div>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                  communitiesCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                }`}
              >
                <div
                  className={`overflow-hidden transition-opacity duration-150 ease-in-out ${
                    communitiesCollapsed ? "opacity-0" : "opacity-100"
                  }`}
                >
                  {(() => {
                    const favorites = communities.filter((c) => c.favorited);
                    if (favorites.length === 0) {
                      return (
                        <p className="text-xs opacity-40 px-2 mt-2">
                          Star a community to pin it here.
                        </p>
                      );
                    }
                    return (
                      <ul className="overflow-y-auto max-h-48 space-y-1 text-secondaryAlt mt-2">
                        {favorites.map((c) => (
                          <li key={c._id}>
                            <button
                              type="button"
                              onClick={() => { onOpenCommunity(c.slug); if (isMobile()) setCollapsed(true); }}
                              className="w-full text-left block py-1 px-2 rounded-lg whitespace-nowrap overflow-hidden truncate text-sm hover:bg-primaryAlt hover:text-neutral"
                            >
                              {t(`communities.${c.slug}.name`, { defaultValue: c.name })}
                            </button>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              </div>
            </section>
            )}
            {/* Gear Lists section */}
            <section
              className="flex flex-col flex-none px-4 py-2 border-b border-base-100 overflow-hidden"
            >
              <div
                data-tour="sidebar-lists-header"
                className="flex items-center text-primaryAlt rounded-lg p-1 -m-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onShowGearPane();
                    if (isMobile()) setCollapsed(true);
                  }}
                  className="flex items-center gap-2 font-bold truncate mr-1 text-left hover:underline transition-colors"
                >
                  <FiLayers className="w-3.5 h-3.5 flex-shrink-0" />
                  {t("sidebar.gearListsTitle")}
                </button>
                <button
                  type="button"
                  aria-label={t("sidebar.a11y.toggleGearLists")}
                  onClick={() => setSidebarGearListsCollapsed((prev) => !prev)}
                  className="p-1 hover:text-primaryAlt/80"
                >
                  {sidebarGearListsCollapsed ? (
                    <FiChevronDown className="text-xs" />
                  ) : (
                    <FiChevronUp className="text-xs" />
                  )}
                </button>
                <div className="flex-1" />
                <button
                  data-tour="sidebar-create-list"
                  type="button"
                  aria-label={t("sidebar.a11y.createNewList")}
                  onClick={() => setShowCreateListModal(true)}
                  className="p-1 text-primaryAlt hover:text-primaryAlt/80"
                >
                  <FiPlus />
                </button>
              </div>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                  sidebarGearListsCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                }`}
              >
                <div
                  className={`overflow-hidden transition-opacity duration-150 ease-in-out ${
                    sidebarGearListsCollapsed ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <ul className="overflow-y-auto max-h-48 space-y-1 text-secondaryAlt mt-2">
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
                </div>
              </div>
            </section>

            {/* Templates link */}
            <section className="px-4 pt-2 pb-2 border-b border-base-100 flex-shrink-0">
              <div
                data-tour="sidebar-templates"
                className="flex items-center text-primaryAlt rounded-lg p-1 -m-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenTemplates();
                    if (isMobile()) setCollapsed(true);
                  }}
                  className="flex items-center gap-2 font-bold truncate text-left hover:underline transition-colors"
                >
                  <FiBookmark className="w-3.5 h-3.5 flex-shrink-0" />
                  {t("sidebar.templatesTitle")}
                </button>
              </div>
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
                  className="flex items-center gap-2 font-bold truncate mr-1 text-left hover:underline transition-colors"
                >
                  <BsBackpack4 className="w-3.5 h-3.5 flex-shrink-0" />
                  {t("sidebar.myGearTitle")}
                </button>
                <button
                  type="button"
                  aria-label={t("sidebar.a11y.toggleMyGear")}
                  onClick={() => setSidebarMyGearCollapsed((prev) => !prev)}
                  className="p-1 hover:text-primaryAlt/80"
                >
                  {sidebarMyGearCollapsed ? (
                    <FiChevronDown className="text-xs" />
                  ) : (
                    <FiChevronUp className="text-xs" />
                  )}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1 text-primaryAlt hover:text-primaryAlt/80"
                >
                  <FiPlus />
                </button>
              </div>

              <div
                className={`grid flex-1 min-h-0 transition-[grid-template-rows] duration-200 ease-in-out ${
                  sidebarMyGearCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                }`}
              >
                <div
                  className={`overflow-hidden min-h-0 flex flex-col transition-opacity duration-150 ease-in-out ${
                    sidebarMyGearCollapsed ? "opacity-0" : "opacity-100"
                  }`}
                >
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
                </div>
              </div>

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

            <CreateListModal
              isOpen={showCreateListModal}
              onClose={() => setShowCreateListModal(false)}
              onCreated={(id) => {
                setShowCreateListModal(false);
                fetchLists();
                localStorage.setItem("lastListId", id);
                onSelectList(id);
              }}
            />
            {/* Bottom actions group: Forum (future) + Admin */}
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
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
