const BASE = 'https://treklist.co';
const LOCALES = ['de', 'es', 'fr', 'it', 'nl'];
const LEGAL = ['privacy', 'terms', 'cookies', 'affiliate-disclosure', 'imprint'];

export default function sitemap() {
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

  return [...home, ...legal];
}
