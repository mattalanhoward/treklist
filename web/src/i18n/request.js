import { getRequestConfig } from 'next-intl/server';

// English-only for now. Locale routing (URL prefixes) is a future step.
export default getRequestConfig(async () => {
  const locale = 'en';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
