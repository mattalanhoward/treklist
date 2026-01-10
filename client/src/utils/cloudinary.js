// client/src/utils/cloudinary.js
export function cldTransformUrl(url, transform) {
  if (!url || typeof url !== "string") return url;

  // Only transform Cloudinary delivery URLs
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  const before = url.slice(0, idx + marker.length);
  const after = url.slice(idx + marker.length);

  // Avoid double-injecting if a transform is already present at the front
  if (after.startsWith(transform + "/")) return url;

  return `${before}${transform}/${after}`;
}
