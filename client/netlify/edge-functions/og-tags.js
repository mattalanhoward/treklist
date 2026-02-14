// Netlify Edge Function to inject dynamic OG meta tags for social media crawlers
// Detects bots crawling /share/:token pages and injects the correct meta tags

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
  'Baiduspider',
  'ia_archiver', // Alexa
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // Only intercept bot requests to /share/:token pages
  const shareMatch = url.pathname.match(/^\/share\/([a-zA-Z0-9_-]+)/);
  if (!shareMatch || !isBot(userAgent)) {
    // Pass through to normal routing for non-bots or non-share pages
    return context.next();
  }

  const token = shareMatch[1];

  try {
    // Fetch the list data from your API
    const apiResponse = await fetch(`https://api.treklist.co/api/public/share/${token}/full`);

    if (!apiResponse.ok) {
      // If list not found, just serve the default page
      return context.next();
    }

    const data = await apiResponse.json();
    const listTitle = data.list?.title || 'TrekList';
    const shareUrl = `https://treklist.co/share/${token}/`;
    const description = 'Plan your hiking and backpacking trips with TrekList. Create gear lists, track pack weight, and share your setup with fellow trekkers.';
    const imageUrl = 'https://res.cloudinary.com/treklist/image/upload/v1771075130/branding/treklist_1200x630_pclazv.png?v=' + Date.now();

    // Get the original HTML
    const response = await context.next();
    const html = await response.text();

    // Inject the correct OG meta tags (handle multi-line tags)
    // Use [\s\S] to match across lines, but be specific about tag boundaries
    const modifiedHtml = html
      // Replace og:title (handles multi-line)
      .replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:title" content="${escapeHtml(listTitle)} - TrekList" />`
      )
      // Replace og:description (handles multi-line)
      .replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:description" content="${escapeHtml(description)}" />`
      )
      // Replace og:image (handles multi-line)
      .replace(
        /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:image" content="${imageUrl}" />`
      )
      // Add og:image dimensions after og:image
      .replace(
        /(<meta property="og:image" content="[^"]*"\s*\/?>)/,
        `$1\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`
      )
      // Replace og:url (handles multi-line)
      .replace(
        /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:url" content="${shareUrl}" />`
      )
      // Replace og:type (handles multi-line)
      .replace(
        /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:type" content="article" />`
      )
      // Replace og:site_name (handles multi-line)
      .replace(
        /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/s,
        `<meta property="og:site_name" content="TrekList" />`
      )
      // Replace title tag
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${escapeHtml(listTitle)} - TrekList</title>`
      )
      // Replace meta description (handles multi-line)
      .replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="description" content="${escapeHtml(description)}" />`
      )
      // Replace canonical URL (handles multi-line)
      .replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/s,
        `<link rel="canonical" href="${shareUrl}" />`
      )
      // Replace Twitter card meta tags (handles multi-line)
      .replace(
        /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:title" content="${escapeHtml(listTitle)} - TrekList" />`
      )
      .replace(
        /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:description" content="${escapeHtml(description)}" />`
      )
      .replace(
        /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:image" content="${imageUrl}" />`
      )
      .replace(
        /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/s,
        `<meta name="twitter:card" content="summary_large_image" />`
      );

    return new Response(modifiedHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate', // Don't cache dynamic content
      },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    // On error, just pass through to normal routing
    return context.next();
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
