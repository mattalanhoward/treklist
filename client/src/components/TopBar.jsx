// src/components/TopBar.jsx
import React, { useState, useEffect } from "react";
import DropdownMenu from "./DropdownMenu";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import logo from "../assets/images/logo.png";
import { useUserSettings } from "../contexts/UserSettings";
import AccountModal from "./AccountModal";
import ViewToggle from "./ViewToggle";
import LegalModal from "./LegalModal";
import EmailOptInBanner from "./EmailOptInBanner";
import { useTranslation } from "react-i18next";

const themes = [
  { name: "forest", label: "Forest", color: "#163A28" },
  { name: "snow", label: "Snow", color: "#f0f4f8" },
  { name: "alpine", label: "Alpine", color: "#172b4d" }, // default
  { name: "desert", label: "Desert", color: "#E0B251" },
  { name: "light", label: "Light", color: "#ffffff" },
  { name: "dark", label: "Dark", color: "#0f172a" },
];

export default function TopBar({ title, openSettings }) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState("privacy");
  const { user, logout } = useAuth();
  const {
    weightUnit,
    setWeightUnit,
    language,
    setLanguage,
    region,
    setRegion,
    theme,
    setTheme,
    viewMode,
    setViewMode,
  } = useUserSettings();

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

  // const currentTheme = themes.find((t) => t.name === theme)?.label || theme;

  if (!user) return null;

  const initial =
    user.trailname?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-[60] bg-base-100 border-b">
      {/* Top row: logo + account menu */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Logo" className="h-8" />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>

        <div className="flex items-center print:hidden">
          <DropdownMenu
            trigger={
              <button
                className="w-8 h-8 rounded-full bg-primaryAlt flex items-center justify-center text-sm font-medium uppercase text-base-100 hover:bg-primaryAlt/80 focus:outline-none"
                aria-label="Open account menu"
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
                      {themes.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ),
              },
              {
                key: "weight-unit",
                render: () => (
                  <div
                    className="flex items-center justify-between text-sm text-secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{t("topbar.weightUnit")}</span>
                    <select
                      value={weightUnit}
                      onChange={(e) => setWeightUnit(e.target.value)}
                      className="ml-2 bg-transparent focus:outline-none"
                    >
                      <option value="g">g</option>
                      <option value="oz">oz</option>
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
                      <option value="en">EN</option>
                      <option value="nl">NL</option>
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
                      <option value="ca">Canada</option>
                      <option value="fr">France</option>
                      <option value="de">Germany</option>
                      <option value="it">Italy</option>
                      <option value="nl">Netherlands</option>
                      <option value="gb">United Kingdom</option>
                      <option value="us">United States</option>
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
                  navigate("/", { replace: true, state: { reason: "manual" } });
                  await logout();
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
