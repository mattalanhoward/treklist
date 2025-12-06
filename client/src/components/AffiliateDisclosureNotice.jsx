// client/src/components/AffiliateDisclosureNotice.jsx
import React from "react";
import { useTranslation } from "react-i18next";

export default function AffiliateDisclosureNotice({
  context = "private", // "private" | "public"
  className = "",
}) {
  const { t } = useTranslation("common");
  const isPublic = context === "public";

  const prefixKey = isPublic
    ? "affiliateDisclosure.public.bodyPrefix"
    : "affiliateDisclosure.private.bodyPrefix";

  const actorKey = isPublic
    ? "affiliateDisclosure.public.actor"
    : "affiliateDisclosure.private.actor";

  const suffixKey = isPublic
    ? "affiliateDisclosure.public.bodySuffix"
    : "affiliateDisclosure.private.bodySuffix";

  return (
    <div
      className={
        "text-xs md:text-sm px-3 py-2 rounded bg-yellow-50 text-yellow-900 border border-yellow-200 " +
        className
      }
      role="note"
    >
      <strong>{t("affiliateDisclosure.label")}</strong> {t(prefixKey)}{" "}
      <strong>{t(actorKey)}</strong>
      {t(suffixKey)} <strong>{t("affiliateDisclosure.amazon")}</strong>
    </div>
  );
}
