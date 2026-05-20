import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiMenu, FiX } from "react-icons/fi";
import useAuth from "../hooks/useAuth";
import { getCommunities } from "../services/community";
import logo from "../assets/images/media-kit/treklist_horizontal.png";
import logoDark from "../assets/images/media-kit/treklist_horizontal_white.png";
import { useUserSettings } from "../contexts/UserSettings";

export default function CommunityLayout() {
  const { isAuthenticated } = useAuth();
  const { theme } = useUserSettings();
  const navigate = useNavigate();
  const { slug } = useParams();
  const isDark = theme === "dark";

  const [communities, setCommunities] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    getCommunities()
      .then(setCommunities)
      .catch(() => {});
  }, []);

  const currentCommunity = communities.find((c) => c.slug === slug);

  const communityNav = (
    <nav className="flex flex-col gap-1 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-50 px-2 mb-1">
        Communities
      </p>
      {communities.map((c) => (
        <NavLink
          key={c._id}
          to={`/community/${c.slug}`}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-content"
                : "hover:bg-base-200"
            }`
          }
        >
          {c.name}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base-100">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 border-b border-base-200 shrink-0 h-14">
        <button
          className="lg:hidden btn btn-ghost btn-sm btn-square"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <FiX size={18} /> : <FiMenu size={18} />}
        </button>

        <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center shrink-0">
          <img
            src={isDark ? logoDark : logo}
            alt="TrekList"
            className="h-6 object-contain"
          />
        </Link>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Link
            to="/community"
            className="text-xs text-primaryAlt hover:underline transition-colors flex-shrink-0"
          >
            Community
          </Link>
          {currentCommunity && (
            <>
              <span className="text-xs text-primaryAlt/60 flex-shrink-0">/</span>
              <span className="text-sm font-medium text-primary truncate">
                {currentCommunity.name}
              </span>
            </>
          )}
        </div>

        <div className="flex-1" />

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost btn-sm gap-1"
              onClick={() => navigate("/dashboard")}
            >
              <FiArrowLeft size={15} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/auth/login" className="btn btn-ghost btn-sm">
              Log in
            </Link>
            <Link to="/auth/register" className="btn btn-primary btn-sm">
              Sign up
            </Link>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:relative z-30 lg:z-auto
            top-14 lg:top-auto bottom-0 lg:bottom-auto
            w-56 shrink-0 border-r border-base-200 bg-base-100 overflow-y-auto
            transition-transform lg:translate-x-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          {communityNav}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ communities, setCommunities }} />
        </main>
      </div>
    </div>
  );
}
