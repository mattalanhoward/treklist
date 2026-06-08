// src/pages/Dashboard.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import api from "../services/api";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import GearListView from "./GearListView";
import AdminView from "../pages/AdminView";
import ForumView from "../pages/ForumView";
import WishlistView from "../pages/WishlistView";
import MyGearView from "../pages/MyGearView";
import GearListsOverview from "../pages/GearListsOverview";
import TemplatesView from "../pages/TemplatesView";
import CommunityView from "../pages/CommunityView";
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";
import Spinner from "../components/ui/Spinner";
import TourModal from "../components/TourModal";
import SEO from "../components/SEO";
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
import CreateListModal from "../components/CreateListModal";

function DashboardEmptyState({ hasLists, listsLoading, creatingSample, onCreateNewList }) {
  const { t } = useTranslation("common");
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (listsLoading || creatingSample) {
    return <Spinner centered label={t("dashboard.loadingLists")} />;
  }

  if (hasLists) {
    return (
      <div className="h-full flex items-center justify-center text-primary text-sm">
        {t("dashboard.loadingLists")}
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="text-center space-y-3 max-w-sm">
        <h1 className="text-lg sm:text-xl font-semibold text-primary">
          {t("dashboard.empty.simpleTitle", "Create a list to begin")}
        </h1>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium text-white bg-secondary hover:bg-secondary/80"
          >
            {t("dashboard.empty.buttonNewList", "New list")}
          </button>
        </div>
      </div>

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(id) => {
          setShowCreateModal(false);
          onCreateNewList(id);
        }}
      />
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const { t } = useTranslation("common");
  const { listId } = useParams(); // from /dashboard/:listId
  const navigate = useNavigate();
  const location = useLocation();
  const TOUR_VERSION = 2;
  const hasSeenTour =
    Number(user?.onboarding?.tourVersionSeen || 0) >= TOUR_VERSION;

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tourSteps = useMemo(() => [
    {
      title: t("tour.steps.welcome.title"),
      body: t("tour.steps.welcome.body"),
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(false); // open sidebar
      },
    },
    {
      title: t("tour.steps.lists.title"),
      body: t("tour.steps.lists.body"),
      target: '[data-tour="sidebar-lists-header"]',
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(false); // keep open
      },
    },
    {
      title: t("tour.steps.categories.title"),
      body: t("tour.steps.categories.body"),
      target: '[data-tour="gearlist-category"]',
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(true); // close sidebar
      },
    },
    {
      title: t("tour.steps.addCategory.title"),
      body: t("tour.steps.addCategory.body"),
      target: '[data-tour="gearlist-add-category"]',
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.addItems.title"),
      body: t("tour.steps.addItems.body"),
      target: '[data-tour="category-add-item"]',
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.wishlist.title"),
      body: t("tour.steps.wishlist.body"),
      target: '[data-tour="item-wishlist"]',
      spotlightRadius: "8px",
      spotlightPadding: 10,
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.swap.title"),
      body: t("tour.steps.swap.body"),
      target: '[data-tour="item-swap"]',
      spotlightRadius: "8px",
      spotlightPadding: 10,
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.preferences.title"),
      body: t("tour.steps.preferences.body"),
      target: '[data-tour="list-preferences-bar"]',
      spotlightRadius: "8px",
      spotlightPadding: 10,
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(true); // keep closed
      },
    },
    {
      title: t("tour.steps.templates.title"),
      body: t("tour.steps.templates.body"),
      target: '[data-tour="sidebar-templates"]',
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(false); // open sidebar
      },
    },
    {
      title: t("tour.steps.community.title"),
      body: t("tour.steps.community.body"),
      target: '[data-tour="sidebar-community"]',
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(false); // keep sidebar open
      },
    },
    {
      title: t("tour.steps.myGear.title"),
      body: t("tour.steps.myGear.body"),
      target: '[data-tour="sidebar-my-gear"]',
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(false); // open sidebar so the link is visible
      },
    },
    {
      title: t("tour.steps.myGearView.title"),
      body: t("tour.steps.myGearView.body"),
      target: '[data-tour="mygear-header"]',
      spotlightRadius: "8px",
      spotlightPadding: 6,
      onEnter: ({ isMobile }) => {
        setActivePane("myGear");
        if (isMobile) setSidebarCollapsed(true);
      },
    },
    {
      title: t("tour.steps.addGear.title"),
      body: t("tour.steps.addGear.body"),
      target: '[data-tour="mygear-add-item"]',
      spotlightRadius: "8px",
      spotlightPadding: 10,
      onEnter: ({ isMobile }) => {
        if (isMobile) setSidebarCollapsed(true);
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
  // Re-create only when language changes (t), not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activePane = searchParams.get("pane") ?? "gear";
  const activeCommunitySlug = searchParams.get("communitySlug") ?? null;
  const activeCommunityPostId = searchParams.get("communityPost") ?? null;
  const setActivePane = useCallback((pane) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("pane", pane);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const setActiveCommunitySlug = useCallback((slug) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (slug) next.set("communitySlug", slug); else next.delete("communitySlug");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const setActiveCommunityPostId = useCallback((postId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (postId) next.set("communityPost", postId); else next.delete("communityPost");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [templatesKey, setTemplatesKey] = useState(0);

  const prevListIdRef = useRef(listId);
  useEffect(() => {
    if (prevListIdRef.current === listId) return;
    prevListIdRef.current = listId;
    if (!listId) return;
    setActivePane("gear");
  }, [listId]);

  // ─── Single‐source‐of‐truth for our `/full` payload ───
  const [fullData, setFullData] = useState({
    list: null,
    categories: [],
    items: [],
  });

  const pageTitle = (() => {
    if (activePane === "myGear") return "My Gear";
    if (activePane === "templates") return "Templates";
    if (activePane === "lists") return "My Lists";
    if (activePane === "admin") return "Admin";
    if (activePane === "wishlist") return "Wishlist";
    if (activePane === "community") return "Community";
    return fullData.list?.title ?? "My Lists";
  })();

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

      // Start tour for first-time users
      if (!hasSeenTour) {
        setTimeout(() => {
          setTourStep(0);
          setIsTourOpen(true);
        }, 350);
      }
    } catch (err) {
      console.error("Failed to create sample list", err);
      toast.error(
        err?.response?.data?.message ||
          t("dashboard.toasts.createSampleFailed"),
      );
    } finally {
      setCreatingSample(false);
    }
  }, [fetchLists, navigate, t, hasSeenTour]);

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

  // ─── Start tour for users who arrive via share-link copy+signup ───
  const fromShareCopy = location.state?.fromShareCopy ?? false;
  const copyTourStartedRef = useRef(false);
  useEffect(() => {
    if (!fromShareCopy) return;
    if (!user) return;
    if (hasSeenTour) return;
    if (!listId) return;
    if (copyTourStartedRef.current) return;
    copyTourStartedRef.current = true;
    const timer = setTimeout(() => {
      setTourStep(0);
      setIsTourOpen(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [listId, fromShareCopy, user, hasSeenTour]);

  // ─── Auto-load sample list for new users ───
  const autoLoadStartedRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (listsLoading) return;
    if (lists.length > 0) return;
    if (hasSeenTour) return;
    if (autoLoadStartedRef.current) return;
    autoLoadStartedRef.current = true;
    handleCreateSampleList();
  }, [user, listsLoading, lists, hasSeenTour, handleCreateSampleList]);

  // ─── Redirect logic ───
  useEffect(() => {
    if (!isAuthenticated) return;
    if (listsLoading) return;
    if (listId) return;
    if (lists.length === 0) return;
    // User explicitly navigated to the overview — don't redirect to a list
    if (activePane === "lists") return;
    if (activePane === "community") return;

    const ids = lists.map((l) => l._id);
    const stored = localStorage.getItem("lastListId");

    if (stored && ids.includes(stored)) {
      navigate(`/dashboard/${stored}`, { replace: true });
      return;
    }

    navigate(`/dashboard/${ids[0]}`, { replace: true });
  }, [lists, listId, navigate, listsLoading, isAuthenticated, activePane]);


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
  // Clear stale data first so GearListView never renders with the wrong list
  useEffect(() => {
    if (!isAuthenticated) return;
    setFullData({ list: null, categories: [], items: [] });
    fetchFullData();
  }, [fetchFullData, listId, isAuthenticated]);

  // Refetch list data when global items change (e.g. deleted from My Gear)
  useEffect(() => {
    const handler = () => fetchFullData();
    window.addEventListener("global-items:updated", handler);
    return () => window.removeEventListener("global-items:updated", handler);
  }, [fetchFullData]);

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

  return (
    <div className="flex flex-col h-d-screen overflow-hidden bg-neutral/50 text-primary">
      <SEO title={pageTitle} noindex />
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
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        sidebarCollapsed={collapsed}
        isAdmin={isAdmin}
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
            onShowGearPane={() => setActivePane("lists")}
            onOpenTemplates={() => { setActivePane("templates"); setTemplatesKey((k) => k + 1); }}
            onOpenCommunity={(slug) => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("pane", "community");
                if (slug) next.set("communitySlug", slug); else next.delete("communitySlug");
                next.delete("communityPost");
                return next;
              }, { replace: true });
            }}
            onSelectList={handleSelectList}
            onRefresh={fetchFullData}
            isLocked={fullData.list?.isLocked || false}
          />

          <main className="relative flex-1 overflow-hidden">
            {activePane === "admin" && isAdmin ? (
              <AdminView />
            ) : activePane === "forum" ? (
              <ForumView />
            ) : activePane === "wishlist" ? (
              <WishlistView />
            ) : activePane === "myGear" ? (
              <MyGearView collapsed={collapsed} />
            ) : activePane === "community" ? (
              <CommunityView initialSlug={activeCommunitySlug} initialPostId={activeCommunityPostId} />
            ) : activePane === "templates" ? (
              <TemplatesView key={templatesKey} fetchLists={fetchLists} />
            ) : activePane === "lists" ? (
              <GearListsOverview
                lists={lists}
                onSelectList={handleSelectList}
                fetchLists={fetchLists}
                collapsed={collapsed}
              />
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
                  onBackToLists={() => setActivePane("lists")}
                />
              )
            ) : (
              <DashboardEmptyState
                hasLists={lists.length > 0}
                listsLoading={listsLoading}
                creatingSample={creatingSample}
                onCreateNewList={(id) => {
                  fetchLists();
                  localStorage.setItem("lastListId", id);
                  handleSelectList(id);
                }}
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
