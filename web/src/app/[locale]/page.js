import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import FooterLegal from '@/components/FooterLegal';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.treklist.co';

const SHARE_TOKENS = {
  av1: process.env.NEXT_PUBLIC_SHARE_AV1_TOKEN,
  camino: process.env.NEXT_PUBLIC_SHARE_CAMINO_TOKEN,
  tmb: process.env.NEXT_PUBLIC_SHARE_TMB_TOKEN,
};

const shareUrl = (token) => (token ? `${APP_URL}/share/${token}` : null);

// Cloudinary hero image
const cloudinaryUrl = (publicId, width) =>
  `https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_${width}/${publicId}`;

const HERO_PUBLIC_ID = 'gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz';

const heroSrc = {
  768: cloudinaryUrl(HERO_PUBLIC_ID, 768),
  1280: cloudinaryUrl(HERO_PUBLIC_ID, 1280),
  1920: cloudinaryUrl(HERO_PUBLIC_ID, 1920),
};

// --- SEO ---
export async function generateMetadata() {
  const t = await getTranslations('landing');
  const ogImage =
    'https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz';
  return {
    title: t('pageTitle'),
    description: t('seo.description'),
    alternates: { canonical: 'https://treklist.co' },
    openGraph: {
      title: t('pageTitle'),
      description: t('seo.description'),
      url: 'https://treklist.co',
      siteName: 'TrekList',
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('pageTitle'),
      description: t('seo.description'),
      images: [ogImage],
    },
  };
}

// --- UI helpers ---
const CheckIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 6.543-6.543a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const Bullet = ({ title, text, color = 'text-blue-600' }) => (
  <li className="flex gap-3">
    <CheckIcon className={`mt-1 h-5 w-5 flex-none ${color}`} />
    <div>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="text-slate-600">{text}</p>
    </div>
  </li>
);

const IPhoneFrame = ({ src, alt = '', className = '' }) => (
  <figure className={`relative aspect-[9/19] ${className}`}>
    <div className="absolute inset-0 rounded-[2rem] bg-[#0B1220] shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-white/10" />
      <div className="absolute inset-[12px] sm:inset-[13px] md:inset-[14px] rounded-[1.5rem] overflow-hidden bg-black outline-1 outline-black">
        <img src={src} alt={alt} className="block h-full w-full object-cover object-top" loading="lazy" />
      </div>
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[8px] sm:top-[9px] md:top-[10px] h-3.5 sm:h-4 w-[34%] md:w-[32%] rounded-b-2xl bg-[#0B1220]" />
    </div>
  </figure>
);

const BrowserMock = ({ src, alt = '', className = '' }) => (
  <div className={`relative mx-auto rounded-xl bg-slate-900 shadow-2xl ring-1 ring-black/10 overflow-hidden ${className}`}>
    <div className="flex items-center space-x-1 px-3 py-2 bg-slate-800">
      <span className="w-3 h-3 rounded-full bg-red-500" />
      <span className="w-3 h-3 rounded-full bg-yellow-500" />
      <span className="w-3 h-3 rounded-full bg-green-500" />
    </div>
    <div className="aspect-[16/10] w-full bg-black">
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </div>
  </div>
);

export default async function LandingPage() {
  const t = await getTranslations('landing');

  const cards = [
    {
      key: 'av1',
      title: t('recommended.cards.av1.title'),
      img: 'https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-alta-via-1.jpg',
      alt: t('recommended.cards.av1.alt'),
      link: shareUrl(SHARE_TOKENS.av1) ?? `${APP_URL}/gearlist/alta-via-1`,
    },
    {
      key: 'camino',
      title: t('recommended.cards.camino.title'),
      img: 'https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-camino-de-santiago.jpg',
      alt: t('recommended.cards.camino.alt'),
      link: shareUrl(SHARE_TOKENS.camino) ?? `${APP_URL}/gearlist/camino-de-santiago`,
    },
    {
      key: 'tmb',
      title: t('recommended.cards.tmb.title'),
      img: 'https://res.cloudinary.com/treklist/image/upload/f_auto,q_auto,w_800/gear-list-landing/gear-list-tour-du-mont-blanc.jpg',
      alt: t('recommended.cards.tmb.alt'),
      link: shareUrl(SHARE_TOKENS.tmb) ?? `${APP_URL}/gearlist/tour-du-mont-blanc`,
    },
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TrekList',
    url: 'https://treklist.co',
    description: t('seo.description'),
    applicationCategory: 'TravelApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-white text-gray-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <PublicHeader variant="overlay" showSections={true} />

      {/* Hero */}
      <header className="relative h-screen flex flex-col items-center justify-center">
        <picture>
          <source
            srcSet={`${heroSrc[768]} 768w, ${heroSrc[1280]} 1280w, ${heroSrc[1920]} 1920w`}
            sizes="100vw"
          />
          <img
            src={heroSrc[1920]}
            alt={t('images.heroAlt')}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-20 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {t('hero.title')}
          </h1>
          <p className="max-w-2xl mx-auto text-white text-xl mb-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
            {t('hero.subtitle')}
          </p>
          <a
            href={`${APP_URL}/auth/register`}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
          >
            {t('hero.cta')}
          </a>
        </div>
      </header>

      {/* How it works / Founder */}
      <section id="howItWorks" className="py-16 px-6 bg-slate-50 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold mb-6">{t('howItWorks.title')}</h2>
          <p className="text-gray-700 text-lg leading-relaxed">{t('howItWorks.paragraph1')}</p>
          <p className="text-gray-700 text-lg leading-relaxed mt-4">{t('howItWorks.paragraph2')}</p>
          <p className="text-gray-700 text-lg leading-relaxed mt-4">{t('howItWorks.paragraph3')}</p>
          <p className="text-gray-700 text-lg leading-relaxed mt-4 font-medium">{t('howItWorks.paragraph4')}</p>
          <p className="mt-6 text-gray-500 text-sm font-medium">{t('howItWorks.signature')}</p>
        </div>
      </section>

      {/* Section A: Mobile phones → Text */}
      <section
        id="features"
        aria-labelledby="features-mobile"
        className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:py-20 pb-24 md:pb-28 lg:pb-32"
      >
        <div className="grid items-center gap-10 md:gap-16 md:[grid-template-columns:420px_minmax(0,1fr)] lg:[grid-template-columns:520px_minmax(0,1fr)]">
          <div className="relative mx-auto md:mx-0 w-full max-w-[520px] h-auto md:h-[440px] lg:h-[520px]">
            <div className="flex justify-center md:block">
              <div className="hidden md:block md:absolute md:left-0 md:top-0 z-10">
                <IPhoneFrame
                  src="/images/screenshots/treklist-mobile-sidebar.png"
                  alt={t('images.mobileSidebarAlt')}
                  className="mx-0 w-[200px] sm:w-[220px] md:w-[240px] lg:w-[280px]"
                />
              </div>
              <div className="relative md:absolute md:top-8 md:left-16 lg:left-[14rem] z-20">
                <IPhoneFrame
                  src="/images/screenshots/treklist-column-mobile.png"
                  alt={t('images.mobileColumnAlt')}
                  className="mx-0 w-[200px] sm:w-[220px] md:w-[240px] lg:w-[280px]"
                />
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <h2 id="features-mobile" className="text-center md:text-left text-3xl font-bold text-slate-900">
              {t('features.mobile.title')}
            </h2>
            <p className="text-center md:text-left mt-3 text-slate-600">
              {t('features.mobile.subtitle')}
            </p>
            <ul className="mt-8 space-y-6">
              <Bullet title={t('features.mobile.bullets.catalogCustom.title')} text={t('features.mobile.bullets.catalogCustom.text')} />
              <Bullet title={t('features.mobile.bullets.quickAdd.title')} text={t('features.mobile.bullets.quickAdd.text')} />
              <Bullet title={t('features.mobile.bullets.checklist.title')} text={t('features.mobile.bullets.checklist.text')} />
              <Bullet title={t('features.mobile.bullets.weightTotals.title')} text={t('features.mobile.bullets.weightTotals.text')} />
              <Bullet title={t('features.mobile.bullets.mobileFirst.title')} text={t('features.mobile.bullets.mobileFirst.text')} />
            </ul>
          </div>
        </div>
      </section>

      {/* Section B: Text → Desktop screenshot */}
      <section aria-labelledby="features-desktop" className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <h2 id="features-desktop" className="text-center md:text-left text-3xl font-bold text-slate-900">
              {t('features.desktop.title')}
            </h2>
            <p className="text-center md:text-left mt-3 text-slate-600">
              {t('features.desktop.subtitle')}
            </p>
            <ul className="mt-8 space-y-6">
              <Bullet title={t('features.desktop.bullets.gearLibrary.title')} text={t('features.desktop.bullets.gearLibrary.text')} color="text-emerald-600" />
              <Bullet title={t('features.desktop.bullets.backgrounds.title')} text={t('features.desktop.bullets.backgrounds.text')} color="text-emerald-600" />
              <Bullet title={t('features.desktop.bullets.share.title')} text={t('features.desktop.bullets.share.text')} color="text-emerald-600" />
              <Bullet title={t('features.desktop.bullets.template.title')} text={t('features.desktop.bullets.template.text')} color="text-emerald-600" />
              <Bullet title={t('features.desktop.bullets.drag.title')} text={t('features.desktop.bullets.drag.text')} color="text-emerald-600" />
            </ul>
          </div>
          <div className="order-1 md:order-2">
            <BrowserMock
              src="/images/screenshots/treklist-column-desktop-1.png"
              alt={t('images.desktopAlt')}
            />
          </div>
        </div>
      </section>

      {/* Featured gear lists */}
      <section id="recommendedGearList" className="py-16 px-6 bg-white text-center">
        <h2 className="text-3xl font-bold mb-8">{t('recommended.title')}</h2>
        <p className="max-w-2xl mx-auto text-gray-700 mb-12">{t('recommended.subtitle')}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {cards.map(({ key, title, img, alt, link }) => (
            <a
              key={key}
              href={link}
              aria-label={t('recommended.cards.ariaOpen', { title })}
              className="relative group overflow-hidden rounded-xl shadow-md aspect-[4/3] transition"
            >
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
                  {t('recommended.cards.viewCta')}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6 bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-3">{t('finalCta.title')}</h2>
          <p className="max-w-2xl mx-auto text-slate-400 mb-8 text-sm">{t('finalCta.subtitle')}</p>
          <a
            href={`${APP_URL}/auth/register`}
            className="inline-flex items-center justify-center rounded-full bg-blue-500 px-7 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition focus:outline-none"
          >
            {t('finalCta.primary')}
          </a>
        </div>
      </section>

      <FooterLegal variant="dark" containerWidth="max-w-4xl" />
    </div>
  );
}
