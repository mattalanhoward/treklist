'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.treklist.co';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
];

export default function PublicHeader({ variant = 'solid', showSections = true }) {
  const t = useTranslations('publicHeader');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (variant !== 'overlay') return;
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [variant]);

  const handleLocaleChange = (e) => {
    const newLocale = e.target.value;
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', newLocale);
    }
    router.replace(pathname, { locale: newLocale });
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
        <select
          value={locale}
          onChange={handleLocaleChange}
          className="text-sm text-gray-700 bg-transparent border-none cursor-pointer focus:outline-none"
          aria-label="Language"
        >
          {LOCALES.map(({ code, label }) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
        <a
          href={`${APP_URL}/auth/login`}
          className="font-medium hover:underline text-gray-800"
        >
          {t('auth.login')}
        </a>
        <a
          href={`${APP_URL}/auth/register`}
          className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:opacity-90 transition"
        >
          {t('auth.getStarted')}
        </a>
      </div>
    </nav>
  );
}
