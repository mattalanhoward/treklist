'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.treklist.co';

export default function PublicHeader({ variant = 'solid', showSections = true }) {
  const t = useTranslations('publicHeader');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (variant !== 'overlay') return;
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [variant]);

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

      {/* Auth actions */}
      <div className="flex items-center space-x-4">
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
