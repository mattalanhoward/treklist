'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.treklist.co';

const LANG_OPTIONS = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'nl', flag: '🇳🇱', label: 'Nederlands' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];

export default function PublicHeader({ variant = 'solid', showSections = true }) {
  const t = useTranslations('publicHeader');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  const currentLang = LANG_OPTIONS.find((l) => l.code === locale) ?? LANG_OPTIONS[0];

  useEffect(() => {
    if (variant !== 'overlay') return;
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [variant]);

  useEffect(() => {
    if (!langOpen) return;
    function handleClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langOpen]);

  const handleLocaleChange = (code) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', code);
    }
    router.replace(pathname, { locale: code });
    setLangOpen(false);
  };

  const base = 'w-full flex items-center justify-between px-6 py-2 z-50 transition-colors duration-200';

  const variantClasses =
    variant === 'overlay'
      ? scrolled
        ? 'fixed top-0 left-0 bg-white border-b border-gray-200 shadow-sm'
        : 'absolute top-0 left-0 bg-white/10 backdrop-blur-md'
      : 'relative bg-white border-b border-gray-200 shadow-sm';

  return (
    <nav className={`${base} ${variantClasses}`}>
      {/* Brand */}
      <Link href="/" className="flex items-center">
        <img
          src="/images/media-kit/treklist_horizontal.png"
          alt="TrekList"
          className="h-8"
        />
      </Link>

      {/* Section links */}
      {showSections && (
        <div className="text-lg font-medium space-x-6 hidden md:flex">
          <a href="#features" className="hover:underline text-gray-800">
            {t('nav.features')}
          </a>
          <a href="#recommendedGearList" className="hover:underline text-gray-800">
            {t('nav.recommendedGearList')}
          </a>
          <a href="#howItWorks" className="hover:underline text-gray-800">
            {t('nav.howItWorks')}
          </a>
        </div>
      )}

      {/* Auth actions + language picker */}
      <div className="flex items-center space-x-4">

        {/* Language picker */}
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-1 text-sm font-medium hover:opacity-80 transition"
            aria-label="Select language"
          >
            <span className="text-lg leading-none">{currentLang.flag}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${langOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {langOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-md shadow-lg py-1 z-50 min-w-36 border border-gray-100">
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleLocaleChange(opt.code)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition ${
                    locale === opt.code ? 'font-semibold' : ''
                  }`}
                >
                  <span className="text-base">{opt.flag}</span>
                  <span className="text-gray-700">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <a
          href={`${APP_URL}/auth/login${locale !== 'en' ? `?lang=${locale}` : ''}`}
          className="font-medium hover:underline text-gray-800"
        >
          {t('auth.login')}
        </a>
        <a
          href={`${APP_URL}/auth/register${locale !== 'en' ? `?lang=${locale}` : ''}`}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
        >
          {t('auth.getStarted')}
        </a>
      </div>
    </nav>
  );
}
