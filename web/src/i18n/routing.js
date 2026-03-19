import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'de', 'es', 'fr', 'it', 'nl'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
