// client/src/utils/imageCdn.js
// Vendor-CDN-aware image resizing. Most catalog imageUrls are hotlinked to
// vendor CDNs that serve multi-MB originals; Shopify's CDN (~85% of them)
// supports free on-the-fly downscaling via a `width` query param and
// auto-negotiates WebP/AVIF from the Accept header. Hosts we don't know
// pass through untouched, so this is safe to apply to any image URL
// (Cloudinary user uploads, Amazon, etc.).
//
// NOTE: image *health* probes (e.g. AdminView's ImageStatusCell) must keep
// checking the original stored URL, not a resized one.
export function resizedImageUrl(url, width) {
  if (!url || typeof url !== "string" || !width) return url;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (parsed.hostname !== "cdn.shopify.com") return url;
  if (parsed.searchParams.has("width")) return url;

  parsed.searchParams.set("width", String(width));
  return parsed.toString();
}
