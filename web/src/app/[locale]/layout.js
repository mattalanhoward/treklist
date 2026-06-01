import '../globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export const metadata = {
  metadataBase: new URL('https://treklist.co'),
  title: {
    template: '%s | TrekList',
    default: 'TrekList — Get the pack right.',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!locale || !routing.locales.includes(locale)) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <head>
        <link
          rel="preload"
          as="image"
          imageSrcSet="
            https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_768/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz 768w,
            https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1280/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz 1280w,
            https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1920/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz 1920w
          "
          imageSizes="100vw"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
