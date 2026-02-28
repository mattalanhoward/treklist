// src/pages/Dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import GearListView from "./GearListView";
import AdminView from "../pages/AdminView";
import ForumView from "../pages/ForumView";
import WishlistView from "../pages/WishlistView";
import MyGearView from "../pages/MyGearView";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";
import Spinner from "../components/ui/Spinner";
import TourModal from "../components/TourModal";
import usePageTitle from "../hooks/usePageTitle";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCorners,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import PreviewCard from "../components/PreviewCard";

function DashboardEmptyState({
  hasLists,
  listsLoading,
  onCreateSampleList,
  creatingSample,
}) {
  const { t } = useTranslation("common");
  // While lists are loading (or we already have lists and redirect is about to run),
  // don’t flash the welcome/empty state.
  if (listsLoading) {
    return <Spinner centered label={t("dashboard.loadingLists")} />;
  }

  // If we have lists and we're not loading, the redirect effect should
  // immediately navigate. But if something goes wrong, don't trap them on a spinner.
  if (hasLists) {
    return (
      <div className="h-full flex items-center justify-center text-primary text-sm">
        {t("dashboard.loadingLists")}
      </div>
    );
  }

  // True first-time / zero-list state
  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <h1 className="text-lg sm:text-xl font-semibold text-primary">
          {t("dashboard.empty.simpleTitle", "Create a list to begin")}
        </h1>
        <p className="text-sm text-primary/80">
          {t(
            "dashboard.empty.simpleBody",
            "Start with a sample list, or create your own from the sidebar.",
          )}
        </p>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCreateSampleList}
            disabled={creatingSample}
            className={`inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium text-white bg-secondary hover:bg-secondary/80 ${
              creatingSample ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {creatingSample
              ? t("dashboard.empty.buttonSampleListLoading")
              : t("dashboard.empty.buttonSampleList", "Load sample list")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const { t } = useTranslation("common");
  const { listId } = useParams(); // from /dashboard/:listId
  const navigate = useNavigate();
  const TOUR_VERSION = 1;
  const hasSeenTour =
    Number(user?.onboarding?.tourVersionSeen || 0) >= TOUR_VERSION;

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const autoOnboardRef = useRef(false);

  const tourSteps = [
    {
      title: t("tour.steps.welcome.title"),
      body: t("tour.steps.welcome.body"),
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(false); // open sidebar
      },
    },
    {
      title: t("tour.steps.lists.title"),
      body: t("tour.steps.lists.body"),
      target: '[data-tour="sidebar-create-list"]',
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(false); // keep open
      },
    },
    {
      title: t("tour.steps.myGear.title"),
      body: t("tour.steps.myGear.body"),
      target: '[data-tour="sidebar-my-gear"]',
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(false); // keep open
      },
    },
    {
      title: t("tour.steps.categories.title"),
      body: t("tour.steps.categories.body"),
      target: '[data-tour="gearlist-category"]',
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(true); // close sidebar
      },
    },
    {
      title: t("tour.steps.addCategory.title"),
      body: t("tour.steps.addCategory.body"),
      target: '[data-tour="gearlist-add-category"]',
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.addItems.title"),
      body: t("tour.steps.addItems.body"),
      target: '[data-tour="category-add-item"]',
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.preferences.title"),
      body: t("tour.steps.preferences.body"),
      target: '[data-tour="list-preferences-menu"]',
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.settings.title"),
      body: t("tour.steps.settings.body"),
      target: '[data-tour="settings-menu"]',
      onEnter: ({ isMobile }) => {
        setActivePane("gear");
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
  ];

  const markTourSeen = useCallback(async () => {
    try {
      await api.post("/auth/onboarding/tour-seen", {
        tourVersion: TOUR_VERSION,
      });
    } catch (err) {
      // Non-blocking: failing to mark shouldn't break UX
      console.error("Failed to mark tour seen:", err);
    }
  }, []);

  const openTour = useCallback(() => {
    setTourStep(0);
    setIsTourOpen(true);
  }, []);

  const closeTour = useCallback(async () => {
    setIsTourOpen(false);
    await markTourSeen();
  }, [markTourSeen]);

  const nextTour = useCallback(async () => {
    const last = tourSteps.length - 1;
    if (tourStep >= last) {
      await closeTour();
      return;
    }
    setTourStep((s) => Math.min(last, s + 1));
  }, [tourStep, tourSteps.length, closeTour]);

  const backTour = useCallback(() => {
    setTourStep((s) => Math.max(0, s - 1));
  }, []);

  // ─── Sidebar collapsed state ───
  const { sidebarCollapsed: collapsed, setSidebarCollapsed } =
    useUserSettings();

  // ─── Which main panel is active: "gear" "admin" "forum" "wishlist" ───
  const [activePane, setActivePane] = useState("gear");

  useEffect(() => {
    if (!listId) return;
    setActivePane("gear");
  }, [listId]);

  // ─── Single‐source‐of‐truth for our `/full` payload ───
  const [fullData, setFullData] = useState({
    list: null,
    categories: [],
    items: [],
  });

  usePageTitle(fullData.list?.title ?? null);

  // ─── Lists state & fetchLists fn ───
  const [lists, setLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [fullLoading, setFullLoading] = useState(false);
  const fullReqIdRef = useRef(0);
  const fetchLists = useCallback(async () => {
    try {
      setListsLoading(true);
      const { data } = await api.get("/dashboard");
      setLists(data);
    } catch (err) {
      console.error("Failed to fetch lists", err);
      toast.error(t("dashboard.toasts.loadListsFailed"));
    } finally {
      setListsLoading(false);
    }
  }, [t]);

  const [creatingSample, setCreatingSample] = useState(false);
  const [autoOnboarding, setAutoOnboarding] = useState(false);

  const handleCreateSampleList = useCallback(async () => {
    try {
      setCreatingSample(true);
      const { data } = await api.post("/dashboard/sample-list");
      const newList = data?.list;

      if (!newList || !newList._id) {
        toast.error(t("dashboard.toasts.createSampleFailed"));
        return;
      }

      // Refresh sidebar lists so the new one appears
      await fetchLists();

      // Tell MyGearView to refetch (sample list items are global items too)
      window.dispatchEvent(new CustomEvent("global-items:updated"));

      // Remember this as the last opened list
      localStorage.setItem("lastListId", newList._id);

      // Navigate straight into the sample list
      navigate(`/dashboard/${newList._id}`);
    } catch (err) {
      console.error("Failed to create sample list", err);
      toast.error(
        err?.response?.data?.message ||
          t("dashboard.toasts.createSampleFailed"),
      );
    } finally {
      setCreatingSample(false);
    }
  }, [fetchLists, navigate, t]);

  // if we’re not logged in, bounce straight back to /login
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // load lists on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLists();
  }, [fetchLists, isAuthenticated]);

  useEffect(() => {
    if (!listId) return;
    localStorage.setItem("lastListId", listId);
  }, [listId]);

  // ─── Redirect logic ───
  useEffect(() => {
    if (!isAuthenticated) return;
    if (listsLoading) return;
    if (listId) return;
    if (lists.length === 0) return;

    const ids = lists.map((l) => l._id);
    const stored = localStorage.getItem("lastListId");

    if (stored && ids.includes(stored)) {
      navigate(`/dashboard/${stored}`, { replace: true });
      return;
    }

    navigate(`/dashboard/${ids[0]}`, { replace: true });
  }, [lists, listId, navigate, listsLoading, isAuthenticated]);

  // Auto-onboarding: if user has no lists AND hasn't seen the tour, create sample list and start tour.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (listsLoading) return;
    if (autoOnboardRef.current) return;
    if (hasSeenTour) return;
    if (lists.length > 0) return;

    autoOnboardRef.current = true;

    (async () => {
      try {
        setAutoOnboarding(true);
        const { data } = await api.post("/dashboard/sample-list");
        const newList = data?.list;
        if (!newList?._id) return;

        await fetchLists();
        window.dispatchEvent(new CustomEvent("global-items:updated"));
        localStorage.setItem("lastListId", newList._id);
        navigate(`/dashboard/${newList._id}`, { replace: true });

        // Open tour shortly after navigation settles
        setTimeout(() => {
          setTourStep(0);
          setIsTourOpen(true);
        }, 350);
      } catch (err) {
        console.error("Auto-onboarding sample list failed:", err);
      } finally {
        setAutoOnboarding(false);
      }
    })();
  }, [
    isAuthenticated,
    listsLoading,
    lists.length,
    hasSeenTour,
    fetchLists,
    navigate,
  ]);

  // ─── viewMode persistence ───
  const { viewMode, setViewMode } = useUserSettings();

  // fetch /api/dashboard/:listId/full
  const fetchFullData = useCallback(async () => {
    if (!listId) return;

    const reqId = ++fullReqIdRef.current;
    setFullLoading(true);

    try {
      const { data } = await api.get(`/dashboard/${listId}/full`);

      // If listId changed while request was in flight, ignore this response
      if (fullReqIdRef.current !== reqId) return;

      setFullData({
        list: data.list,
        categories: data.categories,
        items: data.items,
      });
    } catch (err) {
      // If listId changed while request was in flight, ignore this error UI
      if (fullReqIdRef.current !== reqId) return;

      console.error("Failed to fetch full data", err);

      const status = err?.response?.status;

      if (status === 404) {
        toast.error(t("dashboard.toasts.listGone"));

        const stored = localStorage.getItem("lastListId");
        if (stored === listId) {
          localStorage.removeItem("lastListId");
        }

        navigate("/dashboard", { replace: true });
      } else {
        toast.error(t("dashboard.toasts.loadListFailed"));
      }
    } finally {
      // Only clear loading if this is the latest request
      if (fullReqIdRef.current === reqId) {
        setFullLoading(false);
      }
    }
  }, [listId, navigate, t]);

  // ─── Drag-and-drop: shared DndContext for sidebar → gearlist + internal sorting ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const gearListDndRef = useRef({});
  const [sidebarDragItem, setSidebarDragItem] = useState(null);
  const [sidebarDragOverCatId, setSidebarDragOverCatId] = useState(null);

  const collisionDetectionStrategy = useCallback((args) => {
    const { active } = args;
    if (active && active.id?.startsWith("item-")) return closestCorners(args);
    return pointerWithin(args);
  }, []);

  const axisModifier = useCallback(
    (args) => {
      const { active, transform } = args;
      if (!active || !active.id || active.id.startsWith("item-") || active.id.startsWith("sidebar-"))
        return transform;
      if (viewMode === "column" && active.id.startsWith("cat-"))
        return restrictToHorizontalAxis(args);
      if (viewMode === "list" && active.id.startsWith("cat-"))
        return restrictToVerticalAxis(args);
      return transform;
    },
    [viewMode],
  );

  const handleDndDragStart = useCallback((event) => {
    const { active } = event;
    if (active.id.startsWith("sidebar-")) {
      setSidebarDragItem(active.data?.current?.globalItem || null);
    } else {
      gearListDndRef.current.handleDragStart?.(event);
    }
  }, []);

  const handleDndDragOver = useCallback((event) => {
    const { active, over } = event;
    if (!active.id.startsWith("sidebar-")) return;
    if (!over) {
      setSidebarDragOverCatId(null);
      return;
    }
    if (over.id.startsWith("cat-")) {
      setSidebarDragOverCatId(over.id.replace("cat-", ""));
    } else if (over.id.startsWith("item-")) {
      const parts = over.id.split("-");
      setSidebarDragOverCatId(parts[1] || null);
    } else {
      setSidebarDragOverCatId(null);
    }
  }, []);

  const handleDndDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;

      // Sidebar item drop
      if (active.id.startsWith("sidebar-")) {
        const globalItem = active.data?.current?.globalItem;
        setSidebarDragItem(null);
        setSidebarDragOverCatId(null);

        if (!over || !globalItem || !listId) return;

        let targetCatId;
        if (over.id.startsWith("cat-")) {
          targetCatId = over.id.replace("cat-", "");
        } else if (over.id.startsWith("item-")) {
          targetCatId = over.id.split("-")[1];
        }
        if (!targetCatId) return;

        const itemsMap = gearListDndRef.current.getItemsMap?.() || {};

        // Prevent duplicates: check if this global item already exists in any category
        const allListItems = Object.values(itemsMap).flat();
        const duplicate = allListItems.find(
          (i) => i.globalItem === globalItem._id,
        );
        if (duplicate) {
          toast.error(t("sidebar.itemAlreadyInList"));
          return;
        }

        const catItems = itemsMap[targetCatId] || [];

        // Determine insert position based on drop target
        let insertPos;
        if (over.id.startsWith("item-")) {
          const overItemId = over.id.split("-")[2];
          const overIndex = catItems.findIndex((i) => i._id === overItemId);
          insertPos = overIndex !== -1 ? overIndex : catItems.length;
        } else {
          insertPos = catItems.length;
        }

        // Optimistic insert — item appears instantly in the list
        gearListDndRef.current.insertOptimistic?.(
          targetCatId,
          insertPos,
          globalItem,
        );

        try {
          // Shift positions of items at or after the insert point
          for (let i = catItems.length - 1; i >= insertPos; i--) {
            await api.patch(
              `/dashboard/${listId}/categories/${targetCatId}/items/${catItems[i]._id}`,
              { position: i + 1 },
            );
          }

          await api.post(
            `/dashboard/${listId}/categories/${targetCatId}/items`,
            {
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
              position: insertPos,
            },
          );
          fetchFullData();
        } catch (err) {
          fetchFullData(); // rollback optimistic insert on error
          toast.error(
            err.response?.data?.message || t("sidebar.addToListFailed"),
          );
        }
        return;
      }

      // Internal GearListView drag — delegate
      gearListDndRef.current.handleDragEnd?.(event);
    },
    [listId, fetchFullData, t],
  );

  // — New: Optimistic reorder + persist for categories
  const onReorderCategories = useCallback(
    async (oldCats, reorderedCats) => {
      // 1) Immediately update UI
      setFullData((f) => ({ ...f, categories: reorderedCats }));

      // 2) Persist only changed positions
      const oldPosMap = Object.fromEntries(
        oldCats.map((c) => [c._id, c.position]),
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
    [listId],
  );

  // load on mount—and whenever listId changes
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchFullData();
  }, [fetchFullData, listId, isAuthenticated]);

  // const handleSelectList = useCallback(
  //   (id) => {
  //     // clear current list data so the new list can load fresh
  //     setFullData({ list: null, categories: [], items: [] });

  //     if (id) {
  //       localStorage.setItem("lastListId", id);
  //     } else {
  //       localStorage.removeItem("lastListId");
  //     }

  //     navigate(`/dashboard/${id}`);
  //   },
  //   [navigate]
  // );

  const handleSelectList = useCallback(
    (id) => {
      if (!id) return; // optional safety
      setActivePane("gear");
      navigate(`/dashboard/${id}`);
    },
    [navigate],
  );

  // ─── If auth not ready, or (for gear view) our fullData isn't ready ───
  if (!isAuthenticated) {
    return null;
  }

  const isSwitchingLists =
    fullLoading && fullData.list?._id && fullData.list._id !== listId;

  return (
    <div className="flex flex-col h-d-screen overflow-hidden bg-neutral/50 text-primary">
      <TourModal
        isOpen={isTourOpen}
        stepIndex={tourStep}
        steps={tourSteps}
        onNext={nextTour}
        onBack={backTour}
        onSkip={closeTour}
      />
      <TopBar
        title={t("app.name")}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenTour={openTour}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        modifiers={[axisModifier]}
        onDragStart={handleDndDragStart}
        onDragOver={handleDndDragOver}
        onDragEnd={handleDndDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            lists={lists}
            fetchLists={fetchLists}
            currentListId={listId}
            categories={fullData?.categories || []}
            collapsed={collapsed}
            setCollapsed={setSidebarCollapsed}
            onOpenAdmin={() => {
              if (isAdmin) setActivePane("admin");
            }}
            isAdmin={isAdmin}
            onOpenForum={() => setActivePane("forum")}
            onOpenWishlist={() => setActivePane("wishlist")}
            onOpenMyGear={() => setActivePane("myGear")}
            onShowGearPane={() => setActivePane("gear")}
            onSelectList={handleSelectList}
            onRefresh={fetchFullData}
            isLocked={fullData.list?.isLocked || false}
          />

          <main className="relative flex-1 overflow-hidden">
            {activePane === "gear" && listId && isSwitchingLists && (
              <div className="absolute inset-0 z-50 bg-base-100/40 backdrop-blur-[1px] flex items-center justify-center">
                <Spinner />
              </div>
            )}
            {activePane === "admin" && isAdmin ? (
              <AdminView />
            ) : activePane === "forum" ? (
              <ForumView />
            ) : activePane === "wishlist" ? (
              <WishlistView />
            ) : activePane === "myGear" ? (
              <MyGearView collapsed={collapsed} />
            ) : listId ? (
              fullData.list === null ? (
                <Spinner centered label={t("dashboard.loadingLists")} />
              ) : (
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
                  dndRef={gearListDndRef}
                  sidebarDragOverCatId={sidebarDragOverCatId}
                />
              )
            ) : (
              <DashboardEmptyState
                hasLists={lists.length > 0}
                listsLoading={listsLoading || autoOnboarding}
                onCreateSampleList={handleCreateSampleList}
                creatingSample={creatingSample}
              />
            )}
          </main>
        </div>

        {/* Drag overlay for sidebar → category drags */}
        <DragOverlay
          style={{ pointerEvents: "none", zIndex: 1000 }}
          dropAnimation={{
            duration: 200,
            easing: "ease-out",
            keyframes({ transform }) {
              return [
                { opacity: 0.85, transform: CSS.Transform.toString(transform.initial) },
                { opacity: 0, transform: CSS.Transform.toString(transform.initial) },
              ];
            },
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: "0" } },
            }),
          }}
        >
          {sidebarDragItem ? (
            <PreviewCard
              item={sidebarDragItem}
              viewMode={viewMode}
              width={gearListDndRef.current?.getPreviewWidth?.()}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
