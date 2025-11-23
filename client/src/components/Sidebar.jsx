// src/components/Sidebar.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import {
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaEllipsisH,
} from "react-icons/fa";
import GlobalItemModal from "./GlobalItemModal";
import GlobalItemEditModal from "./GlobalItemEditModal";
import { toast } from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog";
import { useUserSettings } from "../contexts/UserSettings";

export default function Sidebar({
  lists,
  fetchLists,
  currentListId,
  categories,
  onSelectList,
  onRefresh,
  collapsed,
  setCollapsed,
}) {
  const [newListTitle, setNewListTitle] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGlobalItem, setEditingGlobalItem] = useState(null);

  // delete list dialog
  const [confirmListOpen, setConfirmListOpen] = useState(false);
  const [pendingDeleteListId, setPendingDeleteListId] = useState(null);

  const { region } = useUserSettings();

  // global gear items & debounced search
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // 1) update debouncedSearch 300 ms after user stops typing
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
    if (!title) return toast.error("List name cannot be empty.");

    try {
      const { data } = await api.post("/dashboard", { title, region });
      setNewListTitle("");
      await fetchLists();
      localStorage.setItem("lastListId", data.list._id);
      onSelectList(data.list._id);
      toast.success("List created!");
    } catch (err) {
      console.error("Error creating list:", err);
      toast.error(err.response?.data?.message || "Could not create list.");
    }
  };

  // ─── Delete list flow ───
  const handleDeleteListClick = (id) => {
    setPendingDeleteListId(id);
    setConfirmListOpen(true);
  };

  const actuallyDeleteList = async () => {
    const id = pendingDeleteListId;
    try {
      await api.delete(`/dashboard/${id}`);
      setConfirmListOpen(false);
      setPendingDeleteListId(null);
      await fetchLists();
      if (currentListId === id) onSelectList(null);
      toast.success("List deleted");
    } catch (err) {
      console.error("Error deleting list:", err);
      toast.error(err.response?.data?.message || "Could not delete list.");
    }
  };

  const cancelDeleteList = () => {
    setConfirmListOpen(false);
    setPendingDeleteListId(null);
  };

  // === gear item actions ===

  const addToList = async (item) => {
    if (!currentListId || categories.length === 0) {
      return toast.error(
        "Pick or create a list with at least one category first."
      );
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
      toast.error("Failed to add item into your list.");
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
            `absolute top-2 text-primaryAlt hover:text-primaryAlt/80 p-1 transform ` +
            (collapsed ? "right-[-1rem] translate-x-full" : "right-4")
          }
        >
          {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
        </button>

        {!collapsed && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Gear Lists section */}
            <section className="flex flex-col flex-none h-1/3 p-4 border-b border-base-100 overflow-hidden">
              <h2 className="font-bold mb-2 truncate text-primaryAlt">
                Gear Lists
              </h2>
              <div className="flex mb-3">
                <input
                  className="flex-1 rounded-lg py-1 px-2 bg-base-100 text-primary border-primary"
                  placeholder="New list"
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
                        // 1) Select the new list
                        onSelectList(l._id);
                        // 2) if on mobile, collapse sidebar
                        if (isMobile()) {
                          setCollapsed(true);
                        }
                        // 3) Persist or clear storage
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
                      {" "}
                      {l.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Gear Items / Global Items */}
            <section className="flex flex-col flex-1 p-4 overflow-hidden">
              <div className="flex justify-between items-center mb-2 text-primaryAlt">
                <h2 className="font-bold truncate">My Gear</h2>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1 text-primaryAlt  hover:text-primaryAlt/80"
                  disabled={!currentListId || categories.length === 0}
                >
                  <FaPlus />
                </button>
              </div>
              <input
                className="w-full rounded-lg py-1 px-2 bg-base-100 text-primary border border-primary mb-3"
                placeholder="Search Gear Items"
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
                        title="Edit global template"
                        className="hover:text-base-100/80 text-secondaryAlt hover:text-secondaryAlt/80 rounded-lg"
                      >
                        <FaEllipsisH />
                      </button>
                    </div>
                  </li>
                ))}
                {filteredAndSortedItems.length === 0 && (
                  <li className="text-primaryAlt py-1 px-2">No Gear Items</li>
                )}
              </ul>

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
          </div>
        )}
      </div>
    </div>
  );
}
