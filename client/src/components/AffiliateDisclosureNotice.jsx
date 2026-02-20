// client/src/components/AffiliateDisclosureNotice.jsx
import React from "react";
import { useTranslation } from "react-i18next";

export default function AffiliateDisclosureNotice({
  context = "private", // "private" | "public"
  short = false,
  className = "",
}) {
  const { t } = useTranslation("common");
  const suffix = short ? "bodyShort" : "body";
  const key = context === "public"
    ? `affiliateDisclosure.public.${suffix}`
    : `affiliateDisclosure.private.${suffix}`;

  return (
    <div
      className={"text-[11px] text-gray-400 py-1 " + className}
      role="note"
    >
      {t(key)}
    </div>
  );
}
