// Landing.jsx - Public landing page for TrekList

import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import mobileSidebarScreenshot from "../assets/images/screen-shots/treklist-mobile-sidebar.png";
import mobileColumnScreenshot from "../assets/images/screen-shots/treklist-column-mobile.png";
import desktopColumnScreenshot from "../assets/images/screen-shots/treklist-column-desktop-1.png";
import AuthModal from "../components/AuthModal";
import FooterLegal from "../components/FooterLegal";
import PublicHeader from "../components/PublicHeader";
import SEO from "../components/SEO";
import usePageTitle from "../hooks/usePageTitle";

// helper to build share path safely
const sharePath = (token) => (token ? `/share/${token}/` : null);

// Featured list tokens from env (rotate without code changes)
const FEATURED_TOKENS = {
  av1: import.meta.env.VITE_SHARE_AV1_TOKEN,
  camino: import.meta.env.VITE_SHARE_CAMINO_TOKEN,
  tmb: import.meta.env.VITE_SHARE_TMB_TOKEN,
  whw: import.meta.env.VITE_SHARE_WHW_TOKEN,
  kungsleden: import.meta.env.VITE_SHARE_KUNGSLEDEN_TOKEN,
  gr20: import.meta.env.VITE_SHARE_GR20_TOKEN,
};

// ---- Landing hero (single image) ----

// We'll generate responsive sizes by only changing the width.
const CLOUDINARY_CLOUD_NAME = "treklist";
const cloudinaryHeroUrl = (publicIdWithVersion, width) =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_${width}/${publicIdWithVersion}`;

const LANDING_HERO_PUBLIC_ID_WITH_VERSION =
  "/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz";

const heroSources = {
  768: cloudinaryHeroUrl(LANDING_HERO_PUBLIC_ID_WITH_VERSION, 768),
  1280: cloudinaryHeroUrl(LANDING_HERO_PUBLIC_ID_WITH_VERSION, 1280),
  1920: cloudinaryHeroUrl(LANDING_HERO_PUBLIC_ID_WITH_VERSION, 1920),
};

// --- Icons / UI helpers ---
const CheckIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 6.543-6.543a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

// Minimal, realistic iPhone frame
const IPhoneFrame = ({ src, alt = "", className = "" }) => (
  <figure className={`relative aspect-[9/19] ${className}`}>
    <div className="absolute inset-0 rounded-[2rem] bg-[#0B1220] shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-white/10" />
      <div className="absolute inset-[12px] sm:inset-[13px] md:inset-[14px] rounded-[1.5rem] overflow-hidden bg-black outline outline-1 outline-black">
        <img
          src={src}
          alt={alt}
          className="block h-full w-full object-cover object-top"
          loading="lazy"
        />
      </div>
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[8px] sm:top-[9px] md:top-[10px] h-3.5 sm:h-4 md:h-4.5 w-[34%] md:w-[32%] rounded-b-2xl bg-[#0B1220]" />
    </div>
  </figure>
);

// BrowserMock with MacBook Air-ish proportions
const BrowserMock = ({ src, alt = "", className = "" }) => (
  <div
    className={`relative mx-auto rounded-xl bg-slate-900 shadow-2xl ring-1 ring-black/10 overflow-hidden ${className}`}
  >
    {/* top bar */}
    <div className="flex items-center space-x-1 px-3 py-2 bg-slate-800">
      <span className="w-3 h-3 rounded-full bg-red-500" />
      <span className="w-3 h-3 rounded-full bg-yellow-500" />
      <span className="w-3 h-3 rounded-full bg-green-500" />
    </div>

    {/* screenshot area — MacBook aspect */}
    <div className="aspect-[16/10] w-full bg-black">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  </div>
);

// --- Feature bullet item ---
const Bullet = ({ title, text, color = "text-blue-600" }) => (
  <li className="flex gap-3">
    <CheckIcon className={`mt-1 h-5 w-5 flex-none ${color}`} />
    <div>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="text-slate-600">{text}</p>
    </div>
  </li>
);

export default function Landing() {
  const { t } = useTranslation("common");
  usePageTitle(t("landing.pageTitle"));

  // Preload hero for faster first paint
  useEffect(() => {
    const img = new Image();
    img.src = heroSources[1920];
  }, []);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'

  const location = useLocation();
  const navigate = useNavigate();

  // auto-open modal when arriving with a ?next= param (share → auth flow).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasNext = !!params.get("next");

    if (hasNext && !authOpen) {
      setAuthMode("register");
      setAuthOpen(true);
    }
  }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps


  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const closeAuth = () => {
    setAuthOpen(false);
  };

  const cards = useMemo(
    () => [
      {
        key: "av1",
        title: t("landing.recommended.cards.av1.title"),
        img: "https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-alta-via-1.jpg",
        alt: t("landing.recommended.cards.av1.alt"),
        link: sharePath(FEATURED_TOKENS.av1) ?? "/gearlist/alta-via-1",
      },
      {
        key: "camino",
        title: t("landing.recommended.cards.camino.title"),
        img: "https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-camino-de-santiago.jpg",
        alt: t("landing.recommended.cards.camino.alt"),
        link:
          sharePath(FEATURED_TOKENS.camino) ?? "/gearlist/camino-de-santiago",
      },
      {
        key: "tmb",
        title: t("landing.recommended.cards.tmb.title"),
        img: "https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-tour-du-mont-blanc.jpg",
        alt: t("landing.recommended.cards.tmb.alt"),
        link: sharePath(FEATURED_TOKENS.tmb) ?? "/gearlist/tour-du-mont-blanc",
      },
      // {
      //   key: "whw",
      //   title: t("landing.recommended.cards.whw.title"),
      //   img: "https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-west-highland-way.jpg",
      //   alt: t("landing.recommended.cards.whw.alt"),
      //   link: sharePath(FEATURED_TOKENS.whw) ?? "/gearlist/west-highland-way",
      // },
      // {
      //   key: "kungsleden",
      //   title: t("landing.recommended.cards.kungsleden.title"),
      //   img: "https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-kungsleden.jpg",
      //   alt: t("landing.recommended.cards.kungsleden.alt"),
      //   link: sharePath(FEATURED_TOKENS.kungsleden) ?? "/gearlist/kungsleden",
      // },
      // {
      //   key: "gr20",
      //   title: t("landing.recommended.cards.gr20.title"),
      //   img: "https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-gr20.jpg",
      //   alt: t("landing.recommended.cards.gr20.alt"),
      //   link: sharePath(FEATURED_TOKENS.gr20) ?? "/gearlist/gr20-corsica",
      // },
    ],
    [t],
  );

  return (
    <div className="relative flex flex-col min-h-screen bg-white text-gray-800">
      <SEO
        title={t("landing.pageTitle")}
        description={t("landing.seo.description")}
        url="https://treklist.co/"
      >
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "TrekList",
          "url": "https://treklist.co",
          "description": "Plan your hiking and backpacking trips with TrekList. Create gear lists, track pack weight, and share your setup with fellow trekkers.",
          "applicationCategory": "TravelApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        })}</script>
      </SEO>
      <PublicHeader
        variant="overlay"
        showSections={true}
        onLogin={() => openAuth("login")}
        onRegister={() => openAuth("register")}
      />

      {/* Hero (single image) */}
      <header className="relative h-screen flex flex-col items-center justify-center">
        {/* Background image + overlay */}
        <picture>
          <source
            srcSet={`
              ${heroSources[768]} 768w,
              ${heroSources[1280]} 1280w,
              ${heroSources[1920]} 1920w
            `}
            sizes="100vw"
            type="image/jpeg"
          />
          <img
            src={heroSources[1920]}
            alt={t("landing.images.heroAlt")}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            fetchpriority="high"
            decoding="async"
          />
        </picture>

        <div className="absolute inset-0 bg-black/30"></div>

        {/* Foreground content */}
        <div className="relative z-20 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {t("landing.hero.title")}
          </h1>

          <p className="max-w-2xl text-white text-xl mb-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {t("landing.hero.subtitle")}
          </p>

          <button
            onClick={() => openAuth("register")}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
          >
            {t("landing.hero.cta")}
          </button>
        </div>
      </header>

      {/* Founder / How it Works */}
      <section id="howItWorks" className="py-16 px-6 bg-slate-50 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold mb-6">
            {t("landing.howItWorks.title")}
          </h2>
          <p className="text-gray-700 text-lg leading-relaxed">
            {t("landing.howItWorks.paragraph1")}
          </p>
          <p className="text-gray-700 text-lg leading-relaxed mt-4">
            {t("landing.howItWorks.paragraph2")}
          </p>
          <p className="text-gray-700 text-lg leading-relaxed mt-4">
            {t("landing.howItWorks.paragraph3")}
          </p>
          <p className="text-gray-700 text-lg leading-relaxed mt-4 font-medium">
            {t("landing.howItWorks.paragraph4")}
          </p>
          <p className="mt-6 text-gray-500 text-sm font-medium">
            {t("landing.howItWorks.signature")}
          </p>
        </div>
      </section>

      {/* ===== Section A: Image (phones) -> Text ===== */}
      <section
        id="features"
        aria-labelledby="features-mobile"
        className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:py-20 pb-24 md:pb-28 lg:pb-32"
      >
        <div
          className="
            grid items-center gap-10 md:gap-16
            md:[grid-template-columns:420px_minmax(0,1fr)]
            lg:[grid-template-columns:520px_minmax(0,1fr)]
          "
        >
          {/* Phones (single phone on mobile, overlap on md+) */}
          <div
            className="
              relative mx-auto md:mx-0 w-full max-w-[520px]
              h-auto md:h-[440px] lg:h-[520px]
            "
          >
            <div className="flex justify-center md:block">
              {/* back/left phone — hidden on small screens */}
              <div className="hidden md:block md:absolute md:left-0 md:top-0 z-10">
                <IPhoneFrame
                  src={mobileSidebarScreenshot}
                  alt={t("landing.images.mobileSidebarAlt")}
                  className="mx-0 w-[200px] sm:w-[220px] md:w-[240px] lg:w-[280px]"
                />
              </div>

              {/* front/right phone — always visible */}
              <div className="relative md:absolute md:top-8 md:left-16 lg:left-[14rem] z-20">
                <IPhoneFrame
                  src={mobileColumnScreenshot}
                  alt={t("landing.images.mobileColumnAlt")}
                  className="mx-0 w-[200px] sm:w-[220px] md:w-[240px] lg:w-[280px]"
                />
              </div>
            </div>
          </div>

          {/* Text bullets */}
          <div className="relative z-10">
            <h2
              id="features-mobile"
              className="text-center md:text-left text-3xl font-bold text-slate-900"
            >
              {t("landing.features.mobile.title")}
            </h2>
            <p className="text-center md:text-left mt-3 text-slate-600">
              {t("landing.features.mobile.subtitle")}
            </p>

            <ul className="mt-8 space-y-6">
              <Bullet
                title={t("landing.features.mobile.bullets.catalogCustom.title")}
                text={t("landing.features.mobile.bullets.catalogCustom.text")}
              />
              <Bullet
                title={t("landing.features.mobile.bullets.quickAdd.title")}
                text={t("landing.features.mobile.bullets.quickAdd.text")}
              />
              <Bullet
                title={t("landing.features.mobile.bullets.checklist.title")}
                text={t("landing.features.mobile.bullets.checklist.text")}
              />
              <Bullet
                title={t("landing.features.mobile.bullets.weightTotals.title")}
                text={t("landing.features.mobile.bullets.weightTotals.text")}
              />
              <Bullet
                title={t("landing.features.mobile.bullets.mobileFirst.title")}
                text={t("landing.features.mobile.bullets.mobileFirst.text")}
              />
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Section B: Text -> Image (desktop) ===== */}
      <section
        aria-labelledby="features-desktop"
        className="mx-auto max-w-7xl px-6 py-12 lg:px-8"
      >
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Text bullets (left on desktop) */}
          <div className="order-2 md:order-1">
            <h2
              id="features-desktop"
              className="text-center md:text-left text-3xl font-bold text-slate-900"
            >
              {t("landing.features.desktop.title")}
            </h2>
            <p className="text-center md:text-left mt-3 text-slate-600">
              {t("landing.features.desktop.subtitle")}
            </p>

            <ul className="mt-8 space-y-6">
              <Bullet
                title={t("landing.features.desktop.bullets.gearLibrary.title")}
                text={t("landing.features.desktop.bullets.gearLibrary.text")}
                color="text-emerald-600"
              />
              <Bullet
                title={t("landing.features.desktop.bullets.backgrounds.title")}
                text={t("landing.features.desktop.bullets.backgrounds.text")}
                color="text-emerald-600"
              />
              <Bullet
                title={t("landing.features.desktop.bullets.share.title")}
                text={t("landing.features.desktop.bullets.share.text")}
                color="text-emerald-600"
              />
              <Bullet
                title={t("landing.features.desktop.bullets.template.title")}
                text={t("landing.features.desktop.bullets.template.text")}
                color="text-emerald-600"
              />
              <Bullet
                title={t("landing.features.desktop.bullets.drag.title")}
                text={t("landing.features.desktop.bullets.drag.text")}
                color="text-emerald-600"
              />
            </ul>
          </div>

          {/* Desktop browser mock (right on desktop) */}
          <div className="order-1 md:order-2">
            <BrowserMock
              src={desktopColumnScreenshot}
              alt={t("landing.images.desktopAlt")}
            />
          </div>
        </div>
      </section>

      {/* Gear List Section */}
      <section
        id="recommendedGearList"
        className="py-16 px-6 bg-white text-center"
      >
        <h2 className="text-3xl font-bold mb-8">
          {t("landing.recommended.title")}
        </h2>
        <p className="max-w-2xl mx-auto text-gray-700 mb-12">
          {t("landing.recommended.subtitle")}
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {cards.map(({ key, title, img, alt, link }) => {
            const isInternal = typeof link === "string" && link.startsWith("/");
            const ariaLabel = t("landing.recommended.cards.ariaOpen", {
              title,
            });

            const CardInner = (
              <>
                <img
                  src={img}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/45 transition" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                  <h3 className="text-xl font-bold text-white">{title}</h3>
                  <span className="inline-block mt-2 text-sm font-medium text-white bg-blue-600 px-3 py-1 rounded-full">
                    {t("landing.recommended.cards.viewCta")}
                  </span>
                </div>
              </>
            );

            return isInternal ? (
              <Link
                key={key}
                to={link}
                aria-label={ariaLabel}
                className="relative group overflow-hidden rounded-xl shadow-md aspect-[4/3] transition"
              >
                {CardInner}
              </Link>
            ) : (
              <a
                key={key}
                href={link}
                aria-label={ariaLabel}
                className="relative group overflow-hidden rounded-xl shadow-md aspect-[4/3] transition"
              >
                {CardInner}
              </a>
            );
          })}
        </div>
      </section>

      {/* === Final CTA Band === */}
      <section className="py-16 px-6 bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-3">
            {t("landing.finalCta.title")}
          </h2>
          <p className="max-w-2xl mx-auto text-slate-400 mb-8 text-sm">
            {t("landing.finalCta.subtitle")}
          </p>
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="inline-flex items-center justify-center rounded-full bg-blue-500 px-7 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 focus-visible:ring-offset-slate-900"
            >
              {t("landing.finalCta.primary")}
            </button>
          </div>
        </div>
      </section>

      {/* Footer (public view) */}
      <FooterLegal variant="dark" containerWidth="max-w-4xl" />

      <AuthModal
        isOpen={authOpen}
        defaultMode={authMode}
        onClose={closeAuth}
        onAuthed={() => {
          closeAuth();
          // honor ?next=... if present (avoid open redirects)
          const params = new URLSearchParams(location.search);
          const rawNext = params.get("next");
          const next = rawNext && rawNext.startsWith("/") ? rawNext : null;
          navigate(next || "/dashboard", { replace: true });
        }}
      />
    </div>
  );
}
