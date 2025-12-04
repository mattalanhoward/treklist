import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function FooterLegal({
  variant = "dark", // "dark" | "light"
  containerWidth = "max-w-4xl",
  className = "",
}) {
  const { t } = useTranslation("common");
  const year = new Date().getFullYear();
  const dark = variant === "dark";

  const wrap = dark
    ? "bg-gray-900 text-gray-300"
    : "bg-transparent text-gray-600";
  const link =
    (dark
      ? "text-gray-300 hover:text-white"
      : "text-gray-700 hover:text-gray-900") + " underline underline-offset-2";
  const divider = dark ? "border-gray-800" : "border-gray-200";

  return (
    <footer className={`mt-auto ${wrap} ${className}`}>
      {/* subtle top divider */}
      <div className={`border-t ${divider}`} />
      <div
        className={`${containerWidth} mx-auto px-4 md:px-6 py-8 md:py-10 grid gap-6 md:grid-cols-2 items-center`}
      >
        {/* left: brand + contact */}
        <div className="space-y-1 text-sm leading-6 text-center md:text-left">
          <p className="font-medium">{t("footerLegal.brandLine", { year })}</p>
          <p>{t("footerLegal.companyLine")}</p>
          <p>
            <a className={link} href="mailto:support@treklist.co">
              support@treklist.co
            </a>
          </p>
        </div>

        {/* right: legal nav */}
        <nav className="justify-self-center md:justify-self-end">
          <ul className="flex flex-wrap justify-center md:justify-end gap-x-5 gap-y-2 text-sm">
            <li>
              <Link className={link} to="/legal/privacy">
                {t("footerLegal.links.privacy")}
              </Link>
            </li>
            <li>
              <Link className={link} to="/legal/cookies">
                {t("footerLegal.links.cookies")}
              </Link>
            </li>
            <li>
              <Link
                className={link}
                to="/legal/cookie-settings"
                onClick={(e) => {
                  if (
                    typeof window !== "undefined" &&
                    window.openCookieSettings
                  ) {
                    e.preventDefault();
                    window.openCookieSettings();
                  }
                }}
              >
                {t("footerLegal.links.cookieSettings")}
              </Link>
            </li>
            <li>
              <Link className={link} to="/legal/terms">
                {t("footerLegal.links.terms")}
              </Link>
            </li>
            <li>
              <Link className={link} to="/legal/affiliate-disclosure">
                {t("footerLegal.links.affiliateDisclosure")}
              </Link>
            </li>
            <li>
              <Link className={link} to="/legal/imprint">
                {t("footerLegal.links.imprint")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
