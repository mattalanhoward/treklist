// Netlify Edge Function: injects pre-rendered content into the landing page
// for search crawlers so they can index TrekList's content without executing JS.

const BOT_USER_AGENTS = [
  'Googlebot',
  'Bingbot',
  'DuckDuckBot',
  'Baiduspider',
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'WhatsApp',
  'DiscordBot',
  'ia_archiver',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

const LANDING_BODY = `
<article>
  <h1>Pack Smart. Travel Light.</h1>
  <p>
    TrekList is a free gear list planner for hikers and backpackers. Create gear lists,
    track pack weight, and share your setup with fellow trekkers. Designed for
    long-distance hikers, weekenders, and hut-to-hut trekkers exploring Europe and beyond.
  </p>

  <section>
    <h2>Features</h2>
    <ul>
      <li><strong>Mobile first design</strong> — Create and edit gear lists on the go.</li>
      <li><strong>Catalog and custom gear</strong> — Import common items from the gear catalog, or add your own with weight, notes, and a buy link.</li>
      <li><strong>Smart weight totals</strong> — Base weight, worn gear, and consumables calculated in real time.</li>
      <li><strong>Quick add and search</strong> — Find gear fast, edit from anywhere.</li>
      <li><strong>Packing checklist</strong> — One-tap packing with clean PDF export.</li>
      <li><strong>Drag and drop between categories</strong> — Move items across your kit as your plan evolves.</li>
      <li><strong>Public share links</strong> — Share read-only gear lists for forums, friends, or trip planning.</li>
      <li><strong>Embeds</strong> — Drop your gear list into blog posts and trip reports.</li>
    </ul>
  </section>

  <section>
    <h2>Recommended Gear Lists</h2>
    <p>
      Explore curated gear lists for Europe's most iconic long-distance trails.
      View them instantly, or customize and save them to your account.
    </p>
    <ul>
      <li>Alta Via 1 — Dolomites, Italy</li>
      <li>Camino de Santiago — Spain</li>
      <li>Tour du Mont Blanc — Alps</li>
    </ul>
  </section>

  <section>
    <h2>How TrekList Works</h2>
    <p>
      TrekList is free to use and supported by optional affiliate links. Build your
      gear list, dial in your pack weight, and walk out the door knowing you haven't
      forgotten anything. If you purchase gear through a link, it helps keep the
      project running.
    </p>
  </section>

  <p><a href="https://treklist.co/auth/register">Start your free gear list</a></p>
</article>
`;

const STRUCTURED_DATA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  'name': 'TrekList',
  'url': 'https://treklist.co',
  'description': 'Free hiking and backpacking gear list planner. Create gear lists, track pack weight, and share your setup with fellow trekkers.',
  'applicationCategory': 'TravelApplication',
  'operatingSystem': 'Web',
  'offers': {
    '@type': 'Offer',
    'price': '0',
    'priceCurrency': 'USD',
  },
});

export default async function handler(request, context) {
  const userAgent = request.headers.get('user-agent') || '';

  if (!isBot(userAgent)) {
    return context.next();
  }

  try {
    const response = await context.next();
    const html = await response.text();

    const modifiedHtml = html
      // Inject structured data before </head>
      .replace(
        '</head>',
        `  <script type="application/ld+json">${STRUCTURED_DATA}</script>\n  </head>`
      )
      // Inject pre-rendered landing page content into #root
      .replace(
        '<div id="root"></div>',
        `<div id="root">${LANDING_BODY}</div>`
      );

    return new Response(modifiedHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Landing edge function error:', error);
    return context.next();
  }
}
