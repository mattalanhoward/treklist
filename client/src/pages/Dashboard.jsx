// src/pages/Dashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import GearListView from "./GearListView";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";

function DashboardEmptyState({ hasLists }) {
  // If we DO have lists but no listId, the redirect effect is about to run.
  // Show a simple loading message instead of the full welcome card.
  if (hasLists) {
    return (
      <div className="h-full flex items-center justify-center text-primary text-sm">
        Loading your gear lists…
      </div>
    );
  }

  // True first-time / zero-list state
  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-base-100 rounded-lg shadow-md p-6 text-primary">
        <h2 className="text-2xl font-semibold mb-2">Welcome to TrekList 👋</h2>

        <p className="text-sm sm:text-base text-primary mb-4">
          TrekList helps you plan and pack your hiking gear so you don&apos;t
          forget <b>anything</b> on your next trip.
        </p>

        <section className="mb-4">
          <h3 className="font-semibold text-primary mb-1">Getting started</h3>
          <p className="text-sm sm:text-base text-primary/90">
            Start by creating your first gear list in the{" "}
            <span className="font-semibold">Gear Lists</span> panel on the left.
            Type a trip name in the <span className="italic">New list</span> box
            and click the <span className="font-semibold">+</span> button. That
            opens your first list where you can add categories like{" "}
            <span className="italic">Rifugios</span>,{" "}
            <span className="italic">Hiking</span>, or{" "}
            <span className="italic">Toiletries</span>, and start adding gear.
          </p>
        </section>

        <section className="mb-4">
          <h3 className="font-semibold text-primary mb-1">
            How TrekList is organized
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-primary/90">
            <li>
              <span className="font-semibold">Gear Lists</span> — one list per
              trip or pack, for example{" "}
              <span className="italic">Alta Via 1</span>,{" "}
              <span className="italic">Tour du Mont Blanc</span>, or{" "}
              <span className="italic">Ultralight Summer 2025</span>.
            </li>
            <li>
              <span className="font-semibold">My Gear</span> — your library of
              gear you currently own or want to buy. You can reuse these items
              across different lists.
            </li>
            <li>
              <span className="font-semibold">Pack stats</span> — at the top of
              each list you&apos;ll see total, base, worn, and consumable
              weight, so you can dial in your pack.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-1">
            Settings & preferences
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-primary/90">
            <li>
              Use the <span className="font-semibold">…</span> (ellipsis) menu
              at the top of a gear list for list-specific preferences like
              background, checklist view, share, copy, and delete.
            </li>
            <li>
              Use the icon in the top-right of the app for account and global
              settings.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const { listId } = useParams(); // from /dashboard/:listId
  const navigate = useNavigate();

  // ─── Sidebar collapsed state ───
  const { sidebarCollapsed: collapsed, setSidebarCollapsed } =
    useUserSettings();

  // ─── Single‐source‐of‐truth for our `/full` payload ───
  const [fullData, setFullData] = useState({
    list: null,
    categories: [],
    items: [],
  });

  // ─── Lists state & fetchLists fn ───
  const [lists, setLists] = useState([]);
  const fetchLists = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard");
      setLists(data);
    } catch (err) {
      console.error("Failed to fetch lists", err);
      toast.error("Could not load your gear lists");
    }
  }, []);

  // if we’re not logged in, bounce straight back to /login
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // load lists on mount
  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // ─── Redirect logic ───
  useEffect(() => {
    if (listId) return;
    // if there are no lists at all, stay on the "root" path (no listId)
    if (lists.length === 0) return;

    const ids = lists.map((l) => l._id);

    // 2) try lastListId from localStorage
    const stored = localStorage.getItem("lastListId");
    if (stored && ids.includes(stored)) {
      navigate(`/dashboard/${stored}`, { replace: true });
      return;
    }

    // 3) fallback to first list
    navigate(`/dashboard/${ids[0]}`, { replace: true });
  }, [lists, listId, navigate]);

  // ─── viewMode persistence ───
  const { viewMode, setViewMode } = useUserSettings();

  // fetch /api/dashboard/:listId/full
  const fetchFullData = useCallback(async () => {
    if (!listId) return;
    try {
      const { data } = await api.get(`/dashboard/${listId}/full`);
      setFullData({
        list: data.list,
        categories: data.categories,
        items: data.items,
      });
    } catch (err) {
      console.error("Failed to fetch full data", err);

      const status = err?.response?.status;

      if (status === 404) {
        // This list no longer exists (e.g. it was deleted)
        toast.error("This gear list no longer exists");

        // Clear stale lastListId if it was pointing at this deleted list
        const stored = localStorage.getItem("lastListId");
        if (stored === listId) {
          localStorage.removeItem("lastListId");
        }

        // Redirect to a safe dashboard path; the redirect logic will pick a valid list
        navigate("/dashboard", { replace: true });
      } else {
        // Other errors (network, 500, etc.)
        toast.error("Could not load this gear list");
      }
    }
  }, [listId, navigate]);

  // — New: Optimistic reorder + persist for categories
  const onReorderCategories = useCallback(
    async (oldCats, reorderedCats) => {
      // 1) Immediately update UI
      setFullData((f) => ({ ...f, categories: reorderedCats }));

      // 2) Persist only changed positions
      const oldPosMap = Object.fromEntries(
        oldCats.map((c) => [c._id, c.position])
      );

      for (let i = 0; i < reorderedCats.length; i++) {
        const { _id, position } = reorderedCats[i];
        if (oldPosMap[_id] !== position) {
          await api.patch(`/dashboard/${listId}/categories/${_id}/position`, {
            position,
          });
        }
      }
    },
    [listId]
  );

  // load on mount—and whenever listId changes
  useEffect(() => {
    fetchFullData();
  }, [fetchFullData, listId]);

  // ─── If auth, lists or fullData not loaded yet ───
  if (!isAuthenticated || (listId && fullData.list === null)) {
    return null;
  }
  return (
    <div className="flex flex-col h-d-screen overflow-hidden bg-neutral/50 text-primary">
      <TopBar
        title="TrekList.co"
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          lists={lists} // up-to-date list array
          fetchLists={fetchLists} // allows Sidebar to re-load after mutating
          currentListId={listId}
          categories={fullData?.categories || []}
          collapsed={collapsed}
          setCollapsed={setSidebarCollapsed}
          onSelectList={(id) => {
            if (id) {
              localStorage.setItem("lastListId", id);
            } else {
              localStorage.removeItem("lastListId");
            }
            navigate(`/dashboard/${id}`);
          }}
          onRefresh={fetchFullData}
        />

        <main className="flex-1 overflow-hidden">
          {listId ? (
            <GearListView
              listId={listId}
              viewMode={viewMode}
              categories={fullData.categories}
              onRefresh={fetchFullData}
              onReorderCategories={onReorderCategories}
              list={fullData.list}
              items={fullData.items}
              fetchLists={fetchLists}
              collapsed={collapsed}
            />
          ) : (
            <DashboardEmptyState hasLists={lists.length > 0} />
          )}
        </main>
      </div>
    </div>
  );
}
