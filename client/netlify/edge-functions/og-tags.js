// Netlify Edge Function: injects dynamic meta tags + pre-rendered body content
// for search crawlers and social bots on /share/:token pages.

const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'WhatsApp',
  'DiscordBot',
  'Googlebot',
  'Bingbot',
  'DuckDuckBot',
  'Baiduspider',
  'ia_archiver', // Alexa
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

function formatWeight(grams) {
  if (grams === null || grams === undefined) return null;
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  return `${grams} g`;
}

function generateListBody(data) {
  const { list, categories, items } = data;

  // Group items by category
  const catMap = {};
  for (const cat of categories) {
    catMap[cat.id] = { title: cat.title, items: [] };
  }
  for (const item of items) {
    if (item.categoryId && catMap[item.categoryId]) {
      catMap[item.categoryId].items.push(item);
    }
  }

  // Totals
  const totalWeightG = items.reduce((sum, i) => sum + (i.weight_g || 0) * (i.qty || 1), 0);
  const baseWeightG = items
    .filter(i => !i.worn && !i.consumable)
    .reduce((sum, i) => sum + (i.weight_g || 0) * (i.qty || 1), 0);

  const metaParts = [];
  if (list.location) metaParts.push(escapeHtml(list.location));
  if (totalWeightG > 0) metaParts.push(`Total weight: ${formatWeight(totalWeightG)}`);
  if (baseWeightG > 0) metaParts.push(`Base weight: ${formatWeight(baseWeightG)}`);
  metaParts.push(`${items.length} items`);

  let html = `<article>`;
  html += `<h1>${escapeHtml(list.title)} — Gear List</h1>`;
  html += `<p>${metaParts.join(' · ')}</p>`;

  if (list.notes) {
    // Strip HTML tags from notes (notes field may contain HTML markup)
    const plainNotes = String(list.notes).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plainNotes) html += `<p>${escapeHtml(plainNotes)}</p>`;
  }

  for (const cat of categories) {
    const catData = catMap[cat.id];
    if (!catData || catData.items.length === 0) continue;

    const catWeightG = catData.items.reduce((sum, i) => sum + (i.weight_g || 0) * (i.qty || 1), 0);
    const catWeightStr = catWeightG > 0 ? ` (${formatWeight(catWeightG)})` : '';

    html += `<section>`;
    html += `<h2>${escapeHtml(cat.title)}${catWeightStr}</h2>`;
    html += `<ul>`;

    for (const item of catData.items) {
      const parts = [];
      if (item.brand) parts.push(escapeHtml(item.brand));
      parts.push(escapeHtml(item.name || ''));
      if (item.weight_g !== null && item.weight_g !== undefined) parts.push(formatWeight(item.weight_g));
      if ((item.qty || 1) > 1) parts.push(`×${item.qty}`);
      html += `<li>${parts.join(' ')}</li>`;
    }

    html += `</ul></section>`;
  }

  html += `<p>Plan your hiking and backpacking gear list at <a href="https://treklist.co">TrekList</a>.</p>`;
  html += `</article>`;

  return html;
}

function buildDescription(data) {
  const { list, categories, items } = data;
  const catNames = categories.slice(0, 4).map(c => c.title).join(', ');
  const totalWeightG = items.reduce((sum, i) => sum + (i.weight_g || 0) * (i.qty || 1), 0);
  const weightStr = totalWeightG > 0 ? ` Total weight: ${formatWeight(totalWeightG)}.` : '';
  const catStr = catNames ? ` Categories: ${catNames}.` : '';
  return `${escapeHtml(list.title)} gear list — ${items.length} items.${weightStr}${catStr} View and copy this list on TrekList.`;
}

function buildStructuredData(data, token) {
  const { list, items } = data;
  const shareUrl = `https://treklist.co/share/${token}/`;
  const totalWeightG = items.reduce((sum, i) => sum + (i.weight_g || 0) * (i.qty || 1), 0);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': `${list.title} — Gear List`,
    'description': `Complete gear list for ${list.title}. ${items.length} items${totalWeightG > 0 ? `, total weight ${formatWeight(totalWeightG)}` : ''}.`,
    'url': shareUrl,
    'publisher': {
      '@type': 'Organization',
      'name': 'TrekList',
      'url': 'https://treklist.co',
    },
  };
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  const shareMatch = url.pathname.match(/^\/share\/([a-zA-Z0-9_-]+)/);
  if (!shareMatch || !isBot(userAgent)) {
    return context.next();
  }

  const token = shareMatch[1];

  try {
    const apiResponse = await fetch(`https://api.treklist.co/api/public/share/${token}/full`);

    if (!apiResponse.ok) {
      return context.next();
    }

    const data = await apiResponse.json();
    const listTitle = data.list?.title || 'TrekList';
    const shareUrl = `https://treklist.co/share/${token}/`;
    const description = buildDescription(data);
    const imageUrl = 'https://res.cloudinary.com/treklist/image/upload/v1771075130/branding/treklist_1200x630_pclazv.png';

    const response = await context.next();
    const html = await response.text();

    const listBodyHtml = generateListBody(data);
    const structuredData = buildStructuredData(data, token);

    const modifiedHtml = html
      .replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:title" content="${escapeHtml(listTitle)} - TrekList" />`
      )
      .replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:description" content="${description}" />`
      )
      .replace(
        /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:image" content="${imageUrl}" />`
      )
      .replace(
        /(<meta property="og:image" content="[^"]*"\s*\/?>)/,
        `$1\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`
      )
      .replace(
        /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:url" content="${shareUrl}" />`
      )
      .replace(
        /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:type" content="article" />`
      )
      .replace(
        /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:site_name" content="TrekList" />`
      )
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${escapeHtml(listTitle)} - TrekList</title>`
      )
      .replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="description" content="${description}" />`
      )
      .replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/s,
        `<link rel="canonical" href="${shareUrl}" />`
      )
      .replace(
        /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:title" content="${escapeHtml(listTitle)} - TrekList" />`
      )
      .replace(
        /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:description" content="${description}" />`
      )
      .replace(
        /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:image" content="${imageUrl}" />`
      )
      .replace(
        /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:card" content="summary_large_image" />`
      )
      // Inject structured data
      .replace(
        '</head>',
        `  <script type="application/ld+json">${JSON.stringify(structuredData).replace(/<\/script>/gi, '<\\/script>')}</script>\n  </head>`
      )
      // Inject pre-rendered gear list content into #root
      .replace(
        '<div id="root"></div>',
        `<div id="root">${listBodyHtml}</div>`
      );

    return new Response(modifiedHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return context.next();
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
