// Netlify Edge Function: injects dynamic meta tags + pre-rendered body content
// for search crawlers and social bots on /community/:slug and /community/:slug/:postId pages.

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
  'ia_archiver',
];

const FALLBACK_IMAGE = 'https://res.cloudinary.com/treklist/image/upload/v1771075130/branding/treklist_1200x630_pclazv.png';
const BASE_URL = 'https://treklist.co';
const API_URL = 'https://api.treklist.co';

function isBot(ua) {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_USER_AGENTS.some(b => lower.includes(b.toLowerCase()));
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text, max = 160) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

function injectMeta(html, { title, description, canonical, imageUrl, bodyHtml, structuredData }) {
  const ogImage = imageUrl || FALLBACK_IMAGE;

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/s,
      `<meta name="description" content="${escapeHtml(description)}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/s,
      `<link rel="canonical" href="${canonical}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/s,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/s,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/s,
      `<meta property="og:url" content="${canonical}" />`
    )
    .replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/s,
      `<meta property="og:type" content="article" />`
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/s,
      `<meta property="og:image" content="${ogImage}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/s,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/s,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/s,
      `<meta name="twitter:image" content="${ogImage}" />`
    )
    .replace(
      '</head>',
      `  <script type="application/ld+json">${JSON.stringify(structuredData).replace(/<\/script>/gi, '<\\/script>')}</script>\n  </head>`
    )
    .replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';

  if (!isBot(ua)) return context.next();

  const postMatch = url.pathname.match(/^\/community\/([^/]+)\/([a-f0-9]{24})$/i);
  const feedMatch = !postMatch && url.pathname.match(/^\/community\/([^/]+)\/?$/);

  if (!postMatch && !feedMatch) return context.next();

  try {
    if (postMatch) {
      const [, slug, postId] = postMatch;
      const apiRes = await fetch(`${API_URL}/api/posts/${postId}`);
      if (!apiRes.ok) return context.next();

      const post = await apiRes.json();
      const community = post.community || {};
      const canonical = `${BASE_URL}/community/${slug}/${postId}`;

      const bodyText = truncate(stripHtml(post.body), 140);
      const title = `${post.title} — ${community.name || 'TrekList Community'}`;
      const descParts = [];
      if (bodyText) descParts.push(bodyText);
      descParts.push(`${post.upvoteCount} upvotes · ${post.commentCount} comments`);
      const description = truncate(descParts.join(' · '), 160);

      const bodyHtml = `<article>
        <h1>${escapeHtml(post.title)}</h1>
        <p>Posted by ${escapeHtml(post.userId?.trailname || 'anonymous')} in ${escapeHtml(community.name || '')} · ${post.upvoteCount} upvotes · ${post.commentCount} comments</p>
        ${bodyText ? `<p>${escapeHtml(bodyText)}</p>` : ''}
        <p>Join the discussion on <a href="${BASE_URL}">TrekList</a>.</p>
      </article>`;

      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'DiscussionForumPosting',
        'headline': post.title,
        'description': description,
        'url': canonical,
        'datePublished': post.createdAt,
        'dateModified': post.editedAt || post.updatedAt || post.createdAt,
        'author': { '@type': 'Person', 'name': post.userId?.trailname || 'Anonymous' },
        'publisher': { '@type': 'Organization', 'name': 'TrekList', 'url': BASE_URL },
        'interactionStatistic': [
          { '@type': 'InteractionCounter', 'interactionType': 'https://schema.org/LikeAction', 'userInteractionCount': post.upvoteCount },
          { '@type': 'InteractionCounter', 'interactionType': 'https://schema.org/CommentAction', 'userInteractionCount': post.commentCount },
        ],
      };

      const pageResponse = await context.next();
      const html = await pageResponse.text();
      const imageUrl = post.imageUrls?.[0] || null;

      return new Response(
        injectMeta(html, { title, description, canonical, imageUrl, bodyHtml, structuredData }),
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
          },
        }
      );
    }

    if (feedMatch) {
      const [, slug] = feedMatch;
      const apiRes = await fetch(`${API_URL}/api/community/${slug}/posts?page=1&sort=new`);
      if (!apiRes.ok) return context.next();

      const data = await apiRes.json();
      const community = data.community || {};
      const canonical = `${BASE_URL}/community/${slug}`;

      const title = `${community.name || slug} — TrekList Community`;
      const description = truncate(
        community.description
          ? `${community.description} Join the ${community.name} community on TrekList.`
          : `Discuss ${community.name || slug} with fellow trekkers on TrekList.`,
        160
      );

      const recentPosts = (data.posts || []).slice(0, 5);
      const bodyHtml = `<article>
        <h1>${escapeHtml(community.name || slug)}</h1>
        ${community.description ? `<p>${escapeHtml(community.description)}</p>` : ''}
        ${recentPosts.length > 0
          ? `<ul>${recentPosts.map(p => `<li><a href="${BASE_URL}/community/${slug}/${p._id}">${escapeHtml(p.title)}</a></li>`).join('')}</ul>`
          : ''
        }
        <p>Join the discussion on <a href="${BASE_URL}">TrekList</a>.</p>
      </article>`;

      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': community.name || slug,
        'description': description,
        'url': canonical,
        'publisher': { '@type': 'Organization', 'name': 'TrekList', 'url': BASE_URL },
      };

      const pageResponse = await context.next();
      const html = await pageResponse.text();

      return new Response(
        injectMeta(html, { title, description, canonical, bodyHtml, structuredData }),
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'public, max-age=60, stale-while-revalidate=300',
          },
        }
      );
    }
  } catch (err) {
    console.error('community-meta edge function error:', err);
    return context.next();
  }
}
