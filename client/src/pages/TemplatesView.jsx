// src/pages/TemplatesView.jsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { cldTransformUrl } from "../utils/cloudinary";
import TemplatePreviewPane from "../components/TemplatePreviewPane";

const CARD_BG_TRANSFORM = "f_auto,q_auto,w_800,c_fill";

const FEATURED_TOKENS = {
  av1: import.meta.env.VITE_SHARE_AV1_TOKEN,
  camino: import.meta.env.VITE_SHARE_CAMINO_TOKEN,
  tmb: import.meta.env.VITE_SHARE_TMB_TOKEN,
  whw: import.meta.env.VITE_SHARE_WHW_TOKEN,
};

export default function TemplatesView({ fetchLists }) {
  const { t } = useTranslation("common");
  const [selectedToken, setSelectedToken] = useState(null);

  const templates = [
    {
      key: "av1",
      title: t("landing.recommended.cards.av1.title"),
      img: "https://res.cloudinary.com/treklist/image/upload/gear-list-landing/gear-list-alta-via-1.jpg",
      alt: t("landing.recommended.cards.av1.alt"),
      token: FEATURED_TOKENS.av1,
    },
    {
      key: "camino",
      title: t("landing.recommended.cards.camino.title"),
      img: "https://res.cloudinary.com/treklist/image/upload/gear-list-landing/gear-list-camino-de-santiago.jpg",
      alt: t("landing.recommended.cards.camino.alt"),
      token: FEATURED_TOKENS.camino,
    },
    {
      key: "tmb",
      title: t("landing.recommended.cards.tmb.title"),
      img: "https://res.cloudinary.com/treklist/image/upload/gear-list-landing/gear-list-tour-du-mont-blanc.jpg",
      alt: t("landing.recommended.cards.tmb.alt"),
      token: FEATURED_TOKENS.tmb,
    },
    {
      key: "whw",
      title: t("landing.recommended.cards.whw.title"),
      img: "https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-west-highland-way.jpg",
      alt: t("landing.recommended.cards.whw.alt"),
      token: FEATURED_TOKENS.whw,
    },
  ];

  // Show preview pane when a template is selected
  if (selectedToken) {
    return (
      <TemplatePreviewPane
        token={selectedToken}
        onBack={() => setSelectedToken(null)}
        fetchLists={fetchLists}
      />
    );
  }

  // Card grid
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header — matches GearListsOverview */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary whitespace-nowrap">
          {t("templates.title")}
        </h2>
      </div>

      {/* Subtitle */}
      <div className="flex-shrink-0 px-4 py-2 text-sm text-secondary border-b border-primary/10">
        {t("templates.subtitle")}
      </div>

      {/* Cards grid — matches GearListsOverview */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(({ key, title, img, alt, token }) => {
            const bgUrl = cldTransformUrl(img, CARD_BG_TRANSFORM) || img;
            const cardStyle = {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(${bgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            };

            return (
              <button
                key={key}
                type="button"
                onClick={() => token && setSelectedToken(token)}
                disabled={!token}
                style={cardStyle}
                className="relative rounded-xl overflow-hidden cursor-pointer h-48 sm:h-56 lg:h-80 flex flex-col justify-end transition-transform hover:scale-[1.02] active:scale-[0.98] bg-neutral/60 border border-base-100 text-left disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={t("templates.openAriaLabel", { title })}
              >
                <div className="p-3 flex flex-col gap-1">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-white">
                    {title}
                  </h3>
                  <span className="text-xs text-white/80">
                    {t("templates.previewCta")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
