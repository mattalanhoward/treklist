export default async function handler(request, context) {
  const response = await fetch('https://api.treklist.co/sitemap.xml');

  if (!response.ok) {
    return new Response('Error fetching sitemap', { status: 502 });
  }

  const xml = await response.text();

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
