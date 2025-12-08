// src/components/ViewToggle.jsx
import React from "react";
import { FaToggleOn, FaToggleOff } from "react-icons/fa";
import { useTranslation } from "react-i18next";

export default function ViewToggle({ viewMode, setViewMode }) {
  const { t } = useTranslation("common");
  const isList = viewMode === "list";

  const handleClick = () => {
    setViewMode((vm) => (vm === "column" ? "list" : "column"));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center space-x-1"
      aria-pressed={isList}
      aria-label={t("viewToggle.ariaLabel")}
      title={t("viewToggle.title")}
    >
      {isList ? (
        <FaToggleOn className="text-2xl transition-colors" aria-hidden="true" />
      ) : (
        <FaToggleOff
          className="text-2xl text-gray-400 hover:text-gray-600 transition-colors"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
