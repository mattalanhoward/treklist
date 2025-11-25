import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import mobileSidebarScreenshot from "../assets/images/treklist-mobile-sidebar.png";
import mobileColumnScreenshot from "../assets/images/treklist-column-mobile.png";
import desktopColumnScreenshot from "../assets/images/treklist-column-desktop-1.png";
import AuthModal from "../components/AuthModal";
import FooterLegal from "../components/FooterLegal";
import PublicHeader from "../components/PublicHeader";
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

// Cloudinary responsive hero image URLs
const heroOspreySources = {
  768: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_768/v1754767083/gear-list-hero-images/hero-hiker-blue-osprey_nm7lte.jpg",
  1280: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1280/v1754767083/gear-list-hero-images/hero-hiker-blue-osprey_nm7lte.jpg",
  1920: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1920/v1754767083/gear-list-hero-images/hero-hiker-blue-osprey_nm7lte.jpg",
};

const heroHikingSources = {
  768: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_768/v1754767189/gear-list-hero-images/hero-hiker-ridgeline_v7twmc.jpg",
  1280: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1280/v1754767189/gear-list-hero-images/hero-hiker-ridgeline_v7twmc.jpg",
  1920: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1920/v1754767189/gear-list-hero-images/hero-hiker-ridgeline_v7twmc.jpg",
};

const heroHMGSources = {
  768: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_768/v1754767189/gear-list-hero-images/hero-hmg-mountains_xn6aso.jpg",
  1280: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1280/v1754767189/gear-list-hero-images/hero-hmg-mountains_xn6aso.jpg",
  1920: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1920/v1754767189/gear-list-hero-images/hero-hmg-mountains_xn6aso.jpg",
};

const heroTentSources = {
  768: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_768/v1754767080/gear-list-hero-images/hero-tent_ijvmku.jpg",
  1280: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1280/v1754767080/gear-list-hero-images/hero-tent_ijvmku.jpg",
  1920: "https://res.cloudinary.com/packplanner/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1920/v1754767080/gear-list-hero-images/hero-tent_ijvmku.jpg",
};

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
  usePageTitle("Pack Smart. Travel Light.");
  // Hero image carousel
  const heroImages = [
    { alt: "Hiker with blue Osprey pack", sources: heroOspreySources },
    { alt: "Hiker on alpine ridgeline", sources: heroHikingSources },
    { alt: "HMG pack in the mountains", sources: heroHMGSources },
    { alt: "Tent in the mountains", sources: heroTentSources },
  ];

  useEffect(() => {
    const preload = (url) => {
      const img = new Image();
      img.src = url;
    };
    preload(heroImages[0].sources[1920]); // first slide

    setTimeout(() => {
      heroImages.slice(1).forEach((img) => preload(img.sources[1280]));
    }, 1500);
  }, []);

  const [current, setCurrent] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'

  const location = useLocation();
  const navigate = useNavigate();

  // NEW: auto-open modal when routed to /auth/register or /auth/login,
  // or when arriving with a ?next= param (share → auth flow).
  useEffect(() => {
    const path = location.pathname;
    const params = new URLSearchParams(location.search);
    const hasNext = !!params.get("next");

    if (path === "/auth/register" || (hasNext && !authOpen)) {
      setAuthMode("register");
      setAuthOpen(true);
      return;
    }
    if (path === "/auth/login") {
      setAuthMode("login");
      setAuthOpen(true);
    }
  }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const auth = location.state?.auth; // "login" | "register"
    const reason = location.state?.reason; // "protected" | "expired" | undefined
    const shouldOpen =
      (auth === "login" || auth === "register") &&
      (reason === "protected" || reason === "expired");

    if (shouldOpen) {
      setAuthMode(auth);
      setAuthOpen(true);
      // clear state so refresh/back doesn’t re-open
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const closeAuth = () => {
    setAuthOpen(false);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative flex flex-col min-h-screen bg-white text-gray-800">
      <PublicHeader
        variant="overlay"
        showSections={true}
        onLogin={() => openAuth("login")}
        onRegister={() => openAuth("register")}
      />

      {/* Hero Carousel */}
      <header className="relative h-screen flex flex-col items-center justify-center">
        {/* Background image + overlay */}
        <picture>
          <source
            srcSet={`
      ${heroImages[current].sources[768]} 768w,
      ${heroImages[current].sources[1280]} 1280w,
      ${heroImages[current].sources[1920]} 1920w
    `}
            sizes="100vw"
            type="image/jpeg"
          />
          <img
            src={heroImages[current].sources[1920]}
            alt={heroImages[current].alt}
            className="absolute inset-0 h-full w-full object-cover"
            loading={current === 0 ? "eager" : "lazy"}
            fetchpriority={current === 0 ? "high" : "auto"}
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-black/40"></div>

        {/* Foreground content */}
        <div className="relative z-20 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Pack Smart. Travel Light.
          </h1>
          <p className="max-w-2xl text-white mb-8">
            Build, share, and check off your gear lists—designed for
            long-distance hikers, weekenders, and hut to hut trekkers exploring
            Europe and beyond.
          </p>
          <button
            onClick={() => openAuth("register")}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
          >
            Start Your List
          </button>
        </div>

        {/* Dots */}
        <div className="absolute bottom-10 flex space-x-2 z-20">
          {heroImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`w-3 h-3 rounded-full transition-opacity duration-300 ${
                idx === current ? "bg-white opacity-100" : "bg-white opacity-50"
              }`}
            />
          ))}
        </div>
      </header>
      {/* Brand Partners
      <section className="py-12 px-6 flex flex-wrap justify-center items-center gap-8 bg-gray-50">
        {[
          "https://cdn.shopify.com/s/files/1/0173/1185/files/hyperlite-logo.svg",
          "https://www.zpacks.com/cdn/shop/files/zpacks_logo_black.svg",
          "https://www.osprey.com/media/wysiwyg/Footer/osprey-logo.svg",
          // "https://assets.bever.nl/logos/bever_logo.svg",
        ].map((src) => (
          <img
            key={src}
            src={src}
            alt="Partner logo"
            className="h-12 grayscale hover:grayscale-0 transition"
          />
        ))}
      </section> */}

      {/* Screenshot + Features */}
      {/* ===== Section A: Image (phones) -> Text ===== */}

      <section
        id="features"
        aria-labelledby="features-mobile"
        className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:py-20 pb-24 md:pb-28 lg:pb-32" // extra bottom space
      >
        <h2 className="text-center text-3xl font-bold mb-4">Features</h2>
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
                  alt="TrekList mobile view showing gear lists and My Gear search"
                  className="mx-0 w-[200px] sm:w-[220px] md:w-[240px] lg:w-[280px]"
                />
              </div>

              {/* front/right phone — always visible */}
              <div className="relative md:absolute md:top-8 md:left-16 lg:left-[14rem] z-20">
                <IPhoneFrame
                  src={mobileColumnScreenshot}
                  alt="TrekList mobile category columns"
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
              Built for the Trek
            </h2>
            <p className="text-center md:text-left mt-3 text-slate-600">
              Mobile first UX — add, edit, and reorder without friction.
            </p>
            <ul className="mt-8 space-y-6">
              <Bullet
                title="Mobile-first design"
                text="Create and edit gear lists on the go."
              />
              <Bullet
                title="Smart weight totals"
                text="Base, worn, consumables in real time."
              />
              <Bullet
                title="Quick add & search"
                text="Find gear fast, edit from anywhere."
              />
              <Bullet
                title="Packing checklist"
                text="One-tap packing, clean PDF export."
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
              Built for Your Next Adventure
            </h2>
            <p className="text-center md:text-left mt-3 text-slate-600">
              Plan, budget, and fine-tune your kit.
            </p>
            <ul className="mt-8 space-y-6">
              <Bullet
                title="Drag between categories"
                text="Kanban-style columns or traditional list view for planning."
                color="text-emerald-600"
              />
              <Bullet
                title="Price & currency"
                text="Track costs alongside weights."
                color="text-emerald-600"
              />
              <Bullet
                title="Public share links"
                text="Read-only pages for forums/blogs."
                color="text-emerald-600"
              />
              <Bullet
                title="Embeds"
                text="Drop your list into posts."
                color="text-emerald-600"
              />
            </ul>
          </div>

          {/* Desktop browser mock (right on desktop) */}
          <div className="order-1 md:order-2">
            <BrowserMock
              src={desktopColumnScreenshot}
              alt="TrekList desktop view with multiple gear categories in columns"
            />
          </div>
        </div>
      </section>

      {/* Gear List Section */}
      <section
        id="recommendedGearList"
        className="py-16 px-6 bg-white text-center"
      >
        <h2 className="text-3xl font-bold mb-8">Recommended Gear Lists</h2>
        <p className="max-w-2xl mx-auto text-gray-700 mb-12">
          Explore our curated gear lists for Europe’s most iconic long-distance
          trails. View them instantly, or customize and save them to your
          account.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {[
            {
              title: "Alta Via 1",
              img: "https://res.cloudinary.com/packplanner/image/upload/f_auto,q_auto,w_800/v1752432593/gear-list-backgrounds/docilcoaiwytxccqcc4c.jpg",
              alt: "Alta Via 1 gear list in the Dolomites, Italy",
              link: sharePath(FEATURED_TOKENS.av1) ?? "/gearlist/alta-via-1",
            },
            {
              title: "Camino de Santiago",
              img: "https://res.cloudinary.com/packplanner/image/upload/f_auto,q_auto,w_800/v1752415040/gear-list-backgrounds/foqdt3vgogiubrizfe0s.jpg",
              alt: "Camino de Santiago gear list for walking across Spain",
              link:
                sharePath(FEATURED_TOKENS.camino) ??
                "/gearlist/camino-de-santiago",
            },
            {
              title: "Tour du Mont Blanc",
              img: "https://res.cloudinary.com/packplanner/image/upload/f_auto,q_auto,w_800/v1752609809/gear-list-backgrounds/u726utxdhmmmk5p6npuz.jpg",
              alt: "Tour du Mont Blanc gear list",
              link:
                sharePath(FEATURED_TOKENS.tmb) ??
                "/gearlist/tour-du-mont-blanc",
            },
            {
              title: "West Highland Way",
              img: "https://res.cloudinary.com/packplanner/image/upload/f_auto,q_auto,w_800/v1754772966/gear-list-landing/gear-list-west-highland-way_d8d7bq.jpg",
              alt: "West Highland Way gear list",
              link:
                sharePath(FEATURED_TOKENS.whw) ?? "/gearlist/west-highland-way",
            },
            {
              title: "Kungsleden",
              img: "https://res.cloudinary.com/packplanner/image/upload/f_auto,q_auto,w_800/v1754772965/gear-list-landing/gear-list-kungsleden_yultsg.jpg",
              alt: "Kungsleden gear list",
              link:
                sharePath(FEATURED_TOKENS.kungsleden) ?? "/gearlist/kungsleden",
            },
            {
              title: "GR20 Corsica",
              img: "https://res.cloudinary.com/packplanner/image/upload/f_auto,q_auto,w_800/v1754772963/gear-list-landing/gear-list-gr20_azn4uu.jpg",
              alt: "GR20 gear list",
              link: sharePath(FEATURED_TOKENS.gr20) ?? "/gearlist/gr20-corsica",
            },
          ].map(({ title, img, alt, link }) => {
            const isInternal = typeof link === "string" && link.startsWith("/");
            const CardInner = (
              <>
                <img
                  src={img}
                  alt={alt}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/45 transition" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                  <h3 className="text-xl font-bold text-white">{title}</h3>
                  <span className="inline-block mt-2 text-sm font-medium text-white bg-blue-600 px-3 py-1 rounded-full">
                    View Gear List
                  </span>
                </div>
              </>
            );
            return isInternal ? (
              <Link
                key={title}
                to={link}
                aria-label={`Open ${title} gear list`}
                className="relative group overflow-hidden rounded-xl shadow-md aspect-[4/3] transition"
              >
                {CardInner}
              </Link>
            ) : (
              <a
                key={title}
                href={link}
                aria-label={`Open ${title} gear list`}
                className="relative group overflow-hidden rounded-xl shadow-md aspect-[4/3] transition"
              >
                {CardInner}
              </a>
            );
          })}
        </div>

        {/* Affiliate disclosure
        <p className="mt-10 max-w-4xl mx-auto text-sm text-gray-500">
          <strong>Affiliate Disclosure:</strong> Some links in these gear lists
          are affiliate links, meaning we may earn a small commission if you
          make a purchase at no extra cost to you. This helps support
          TrekList.co and keeps our content free. We only recommend gear we
          trust and use ourselves.
        </p> */}
      </section>

      {/* Mission / Social Good */}
      {/* <section id="mission" className="py-16 px-6 bg-white text-center">
        <h2 className="text-3xl font-bold mb-4">Built for Adventurers</h2>
        <p className="max-w-2xl mx-auto text-gray-700 mb-6">
          We give 5% of revenue back to trail conservation programs.
        </p>
        <Link
          to="/about"
          className="px-5 py-2 border-2 border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-600 hover:text-white transition"
        >
          Learn More
        </Link>
      </section> */}

      {/* === How TrekList Fits Into Your Planning (3-step explainer) === */}
      <section
        id="how-it-works"
        aria-labelledby="how-it-works-title"
        className="py-16 px-6 bg-white border-t border-slate-200"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="how-it-works-title"
            className="text-3xl font-bold text-slate-900 text-center mb-4"
          >
            How TrekList fits into your next hike
          </h2>
          <p className="max-w-2xl mx-auto text-center text-slate-600 mb-10">
            Start with a recommended list or build your own from scratch, tune
            your kit, and walk into your trip with a pack that feels just right.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="flex flex-col items-start rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-600 text-white text-sm font-semibold mb-4">
                1
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">
                Plan your list
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Use the import feature to quickly build your gear inventory from
                our library, add any custom items you need, then organize
                everything into categories like sleep, clothing, electronics,
                and food as you build out your list.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-start rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-600 text-white text-sm font-semibold mb-4">
                2
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">
                Tune weight & budget
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                See base, worn, consumable and total weights in real time while
                you tweak your kit. Track prices in your preferred currency as
                you upgrade or swap items.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-start rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-600 text-white text-sm font-semibold mb-4">
                3
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">
                Pack and share
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Switch to checklist mode the week before you leave, tick items
                off as they go into your pack, and share a read-only link with
                friends, family, or forum posts.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-7 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              Start your free gear list
            </button>
          </div>
        </div>
      </section>

      {/* === FAQ Section === */}
      <section
        aria-labelledby="faq"
        className="py-16 px-6 bg-white border-t border-slate-200"
      >
        <div className="mx-auto max-w-4xl">
          <h2
            id="faq"
            className="text-3xl font-bold text-slate-900 text-center mb-4"
          >
            Questions before you start?
          </h2>
          <p className="max-w-2xl mx-auto text-center text-slate-600 mb-10">
            A few quick answers about how TrekList works and what you get when
            you create an account.
          </p>

          <div className="space-y-4">
            <details className="group rounded-lg border border-slate-200 bg-slate-50 p-4 open:bg-white open:border-blue-200">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
                <span>Is TrekList free?</span>
                <span className="ml-3 text-xs text-slate-500 group-open:hidden">
                  +
                </span>
                <span className="ml-3 text-xs text-slate-500 hidden group-open:inline">
                  –
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-700">
                Yes. You can start and maintain your gear lists for free.
                Treklist earns through affiliate programs. Please consider using
                our links to support the platform at no extra cost to you.
              </p>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 p-4 open:bg-white open:border-blue-200">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
                <span>Do I need to install an app?</span>
                <span className="ml-3 text-xs text-slate-500 group-open:hidden">
                  +
                </span>
                <span className="ml-3 text-xs text-slate-500 hidden group-open:inline">
                  –
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-700">
                No. TrekList runs in your browser on desktop and mobile. Just
                log in at treklist.co and your lists are there.
              </p>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 p-4 open:bg-white open:border-blue-200">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
                <span>Can I use it offline?</span>
                <span className="ml-3 text-xs text-slate-500 group-open:hidden">
                  +
                </span>
                <span className="ml-3 text-xs text-slate-500 hidden group-open:inline">
                  –
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-700">
                You’ll need a connection to create and edit lists, but you can
                print or export your packing checklist before you leave so you
                always have a copy.
              </p>
            </details>

            <details className="group rounded-lg border border-slate-200 bg-slate-50 p-4 open:bg-white open:border-blue-200">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
                <span>Do I have to create an account?</span>
                <span className="ml-3 text-xs text-slate-500 group-open:hidden">
                  +
                </span>
                <span className="ml-3 text-xs text-slate-500 hidden group-open:inline">
                  –
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-700">
                Yes. An account keeps your lists synced between devices and lets
                you save, duplicate, and share them.
              </p>
            </details>
          </div>

          <p className="mt-10 text-center text-sm text-slate-600">
            Ready to try it out?{" "}
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="font-semibold text-blue-600 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              Create your free account
            </button>
          </p>
        </div>
      </section>

      {/* === Final CTA Band === */}
      <section className="py-16 px-6 bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to pack smarter for your next trip?
          </h2>
          <p className="max-w-2xl mx-auto text-slate-200 mb-8">
            Start a gear list for your upcoming trek, fine-tune your kit, and
            walk out the door knowing you haven’t forgotten anything.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="inline-flex items-center justify-center rounded-full bg-blue-500 px-7 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 focus-visible:ring-offset-slate-900"
            >
              Start your free gear list
            </button>
            <Link
              to={sharePath(FEATURED_TOKENS.av1) || "/gearlist/alta-via-1"}
              className="inline-flex items-center justify-center rounded-full border border-slate-400 px-6 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800 hover:border-slate-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-200 focus-visible:ring-offset-slate-900"
            >
              Preview an example list
            </Link>
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
          // honor ?next=... if present
          const params = new URLSearchParams(location.search);
          const rawNext = params.get("next");
          const next = rawNext && rawNext.startsWith("/") ? rawNext : null;
          navigate(next || "/dashboard", { replace: true });
        }}
      />
    </div>
  );
}
