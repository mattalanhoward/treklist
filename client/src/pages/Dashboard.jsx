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
import { toast } from "react-hot-toast";
import { useUserSettings } from "../contexts/UserSettings";
import { useTranslation } from "react-i18next";
import Spinner from "../components/ui/Spinner";

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
    <div className="h-full px-3 py-4 sm:px-4 sm:py-6 overflow-y-auto sm:overflow-visible">
      <div className="mx-auto w-full max-w-4xl bg-base-100/95 rounded-xl shadow-md p-4 sm:p-6 space-y-3 my-2 sm:my-4">
        <h1 className="text-xl font-semibold text-primary">
          {t("dashboard.empty.title")}
        </h1>

        <p className="text-sm sm:text-base text-primary">
          {t("dashboard.empty.intro")}
        </p>

        <section className="mb-3">
          <h3 className="font-semibold text-primary mb-1">
            {t("dashboard.empty.gettingStartedTitle")}
          </h3>
          <p className="text-sm sm:text-base text-primary/90">
            {t("dashboard.empty.gettingStartedBody")}
          </p>
        </section>

        <section className="mb-3">
          <h3 className="font-semibold text-primary mb-1">
            {t("dashboard.empty.howOrganizedTitle")}
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-primary/90">
            <li>
              <span className="font-semibold">
                {t("sidebar.gearListsTitle")}
              </span>{" "}
              - {t("dashboard.empty.howOrganizedGearLists")}
            </li>
            <li>
              <span className="font-semibold">{t("sidebar.myGearTitle")}</span>{" "}
              - {t("dashboard.empty.howOrganizedMyGear")}
            </li>
            <li>
              <span className="font-semibold">Pack stats</span> -{" "}
              {t("dashboard.empty.howOrganizedPackStats")}
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-1">
            {t("dashboard.empty.settingsTitle")}
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-primary/90">
            <li>{t("dashboard.empty.settingsListMenu")}</li>
            <li>{t("dashboard.empty.settingsAccount")}</li>
          </ul>
        </section>

        <div className="border-t border-primary/10 pt-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 text-center sm:text-left">
          <div className="flex justify-center sm:justify-start w-full sm:w-auto">
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
                : t("dashboard.empty.buttonSampleList")}
            </button>
          </div>
          <p className="text-xs text-primary/80">
            {t("dashboard.empty.startFromScratch")}
          </p>
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

      // Remember this as the last opened list
      localStorage.setItem("lastListId", newList._id);

      // Navigate straight into the sample list
      navigate(`/dashboard/${newList._id}`);
    } catch (err) {
      console.error("Failed to create sample list", err);
      toast.error(
        err?.response?.data?.message || t("dashboard.toasts.createSampleFailed")
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

    console.log("[dashboard redirect]", { stored, ids });

    if (stored && ids.includes(stored)) {
      navigate(`/dashboard/${stored}`, { replace: true });
      return;
    }

    navigate(`/dashboard/${ids[0]}`, { replace: true });
  }, [lists, listId, navigate, listsLoading, isAuthenticated]);

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
      navigate(`/dashboard/${id}`);
    },
    [navigate]
  );

  // ─── If auth not ready, or (for gear view) our fullData isn't ready ───
  if (!isAuthenticated) {
    return null;
  }

  const isSwitchingLists =
    fullLoading && fullData.list?._id && fullData.list._id !== listId;

  return (
    <div className="flex flex-col h-d-screen overflow-hidden bg-neutral/50 text-primary">
      <TopBar
        title={t("app.name")}
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
          onOpenAdmin={() => {
            if (isAdmin) setActivePane("admin");
          }}
          isAdmin={isAdmin}
          onOpenForum={() => setActivePane("forum")}
          onOpenWishlist={() => setActivePane("wishlist")}
          onShowGearPane={() => setActivePane("gear")}
          onSelectList={handleSelectList}
          onRefresh={fetchFullData}
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
              />
            )
          ) : (
            <DashboardEmptyState
              hasLists={lists.length > 0}
              listsLoading={listsLoading}
              onCreateSampleList={handleCreateSampleList}
              creatingSample={creatingSample}
            />
          )}
        </main>
      </div>
    </div>
  );
}
