const BASE = 'https://treklist.co';
const APP_BASE = 'https://app.treklist.co';
const LOCALES = ['de', 'es', 'fr', 'it', 'nl'];
const LEGAL = ['privacy', 'terms', 'cookies', 'affiliate-disclosure', 'imprint'];

export const revalidate = 3600;

export default async function sitemap() {
  const home = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    ...LOCALES.map((locale) => ({
      url: `${BASE}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    })),
  ];

  const legal = LEGAL.map((slug) => ({
    url: `${BASE}/legal/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  let sharePages = [];
  try {
    const res = await fetch('https://api.treklist.co/api/public/share-tokens', {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const tokens = await res.json();
      sharePages = tokens.map((token) => ({
        url: `${APP_BASE}/share/${token}/`,
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
    }
  } catch (_) {
    // non-fatal — sitemap still serves static pages if API is unavailable
  }

  return [...home, ...legal, ...sharePages];
}
