// src/components/TopBar.jsx
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import DropdownMenu from "./DropdownMenu";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import logo from "../assets/images/media-kit/treklist_horizontal.png";
import logoDark from "../assets/images/media-kit/treklist_horizontal_white.png";
import { useUserSettings } from "../contexts/UserSettings";
import AccountModal from "./AccountModal";
import ViewToggle from "./ViewToggle";
import LegalModal from "./LegalModal";
import EmailOptInBanner from "./EmailOptInBanner";
import { useTranslation } from "react-i18next";

const themes = [
  { name: "forest", color: "#163A28" },
  { name: "snow", color: "#f0f4f8" },
  { name: "alpine", color: "#172b4d" }, // default
  { name: "desert", color: "#E0B251" },
  { name: "light", color: "#ffffff" },
  { name: "dark", color: "#0f172a" },
];

export default function TopBar({ title, openSettings, onOpenTour, onToggleSidebar, sidebarCollapsed }) {
  const headerRef = useRef(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState("privacy");
  const { user, logout } = useAuth();
  const {
    measurementSystem,
    setMeasurementSystem,
    language,
    setLanguage,
    region,
    setRegion,
    theme,
    setTheme,
    viewMode,
    setViewMode,
  } = useUserSettings();

  const isDark = theme === "dark";

  const { t } = useTranslation("common");
  const navigate = useNavigate();

  // Install global helpers so non-React code (footer, future cookie banner)
  // can open the Legal & Cookies center on a specific tab.
  useEffect(() => {
    const openCookieSettings = () => {
      setLegalInitialTab("cookie-settings");
      setIsLegalOpen(true);
    };

    const openLegalCenter = (tabId) => {
      setLegalInitialTab(tabId || "privacy");
      setIsLegalOpen(true);
    };

    window.openCookieSettings = openCookieSettings;
    window.openLegalCenter = openLegalCenter;

    return () => {
      if (window.openCookieSettings === openCookieSettings) {
        delete window.openCookieSettings;
      }
      if (window.openLegalCenter === openLegalCenter) {
        delete window.openLegalCenter;
      }
    };
  }, [setIsLegalOpen, setLegalInitialTab]);

  if (!user) return null;

  const initial =
    user.trailname?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?";

  return (
    <header ref={headerRef} className="sticky top-0 z-[60] bg-base-100 border-b">
      {/* Top row: logo + account menu */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-2">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="sm:hidden p-1.5 text-primaryAlt hover:text-primary transition-colors"
              aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
            >
              {sidebarCollapsed ? <FiMenu className="w-5 h-5" /> : <FiX className="w-5 h-5" />}
            </button>
          )}
          <img
            src={isDark ? logoDark : logo}
            alt={t("app.name")}
            className="h-8 w-auto"
          />
        </div>

        <div className="flex items-center print:hidden">
          <DropdownMenu
            trigger={
              <button
                data-tour="settings-menu"
                className="w-8 h-8 rounded-full bg-primaryAlt flex items-center justify-center text-sm font-medium uppercase text-base-100 hover:bg-primaryAlt/80 focus:outline-none"
                aria-label={t("topbar.a11y.openAccountMenu")}
              >
                {initial}
              </button>
            }
            menuWidth="w-64"
            items={[
              {
                key: "header-account",
                render: () => (
                  <div className="text-xs font-semibold text-primary uppercase">
                    {t("topbar.accountHeader")}
                  </div>
                ),
              },
              {
                key: "info",
                render: () => (
                  <div className="pb-2 text-sm text-secondary">
                    <div>{user.trailname}</div>
                    <div className="text-primary text-xs">{user.email}</div>
                  </div>
                ),
              },
              {
                key: "manage-account",
                label: t("topbar.manageAccount"),
                onClick: () => setIsAccountOpen(true),
              },
              {
                key: "take-tour",
                label: t("topbar.takeTour", "Take a tour"),
                onClick: () => onOpenTour?.(),
              },
              {
                key: "sep-1",
                render: () => <div className="border-t border-gray-200 my-2" />,
              },
              {
                key: "header-prefs",
                render: () => (
                  <div className="text-xs font-semibold text-primary uppercase">
                    {t("topbar.preferencesHeader")}
                  </div>
                ),
              },
              {
                key: "view-mode",
                render: () => (
                  <div className="flex items-center justify-between text-sm text-secondary">
                    <span>{t("topbar.viewMode")}</span>
                    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                  </div>
                ),
              },
              {
                key: "theme",
                render: () => (
                  <div
                    className="flex items-center justify-between text-sm text-secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{t("topbar.theme")}</span>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="ml-2 bg-transparent focus:outline-none"
                    >
                      {themes.map((themeOption) => (
                        <option key={themeOption.name} value={themeOption.name}>
                          {t(`topbar.themeOptions.${themeOption.name}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
              },
              {
                key: "measurement-system",
                render: () => (
                  <div
                    className="flex items-center justify-between text-sm text-secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{t("topbar.measurementSystem")}</span>
                    <select
                      value={measurementSystem}
                      onChange={(e) => setMeasurementSystem(e.target.value)}
                      className="ml-2 bg-transparent focus:outline-none"
                    >
                      <option value="metric">{t("topbar.metric")}</option>
                      <option value="imperial">{t("topbar.imperial")}</option>
                    </select>
                  </div>
                ),
              },
              {
                key: "language",
                render: () => (
                  <div
                    className="flex items-center justify-between text-sm text-secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{t("topbar.language")}</span>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="ml-2 bg-transparent focus:outline-none"
                    >
                      <option value="en">{t("language.english")}</option>
                      <option value="nl">{t("language.dutch")}</option>
                      <option value="de">{t("language.german")}</option>
                      <option value="fr">{t("language.french")}</option>
                      <option value="it">{t("language.italian")}</option>
                      <option value="es">{t("language.spanish")}</option>
                    </select>
                  </div>
                ),
              },
              {
                key: "region",
                render: () => (
                  <div
                    className="flex items-center justify-between text-sm text-secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{t("topbar.region")}</span>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value.toLowerCase())}
                      className="ml-2 bg-transparent focus:outline-none"
                    >
                      <option value="ca">{t("topbar.regions.ca")}</option>
                      <option value="fr">{t("topbar.regions.fr")}</option>
                      <option value="de">{t("topbar.regions.de")}</option>
                      <option value="it">{t("topbar.regions.it")}</option>
                      <option value="nl">{t("topbar.regions.nl")}</option>
                      <option value="gb">{t("topbar.regions.gb")}</option>
                      <option value="us">{t("topbar.regions.us")}</option>
                    </select>
                  </div>
                ),
              },
              {
                key: "sep-legal",
                render: () => <div className="border-t border-gray-200" />,
              },
              {
                className:
                  "flex items-center justify-between text-sm text-secondary",
                key: "legal",
                label: t("topbar.legal"),
                onClick: () => {
                  setLegalInitialTab("privacy");
                  setIsLegalOpen(true);
                },
              },
              {
                key: "sep-3",
                render: () => <div className="border-t border-gray-200" />,
              },
              {
                key: "logout",
                className: "mb-2",
                label: t("topbar.logout"),
                onClick: async () => {
                  await logout();
                  navigate("/", {
                    replace: true,
                    state: { reason: "manual" },
                  });
                },
              },
            ]}
          />
          <AccountModal
            isOpen={isAccountOpen}
            onClose={() => setIsAccountOpen(false)}
          />
          <LegalModal
            open={isLegalOpen}
            initialTab={legalInitialTab}
            onClose={() => setIsLegalOpen(false)}
          />
        </div>
      </div>

      {/* Banner row */}
      <div className="px-2 print:hidden">
        <EmailOptInBanner />
      </div>
    </header>
  );
}
