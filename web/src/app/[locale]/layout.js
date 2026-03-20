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
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
