// client/src/utils/imageProcessing.js

export async function downscaleImageFile(
  file,
  { maxSize = 3200, quality = 0.82 } = {}
) {
  // Uses browser canvas to resize and encode.
  // Output: Blob (webp if supported, else jpeg)
  const img = await loadImage(file);

  const { width, height } = img;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const supportsWebp = await canEncodeWebp();

  const mime = supportsWebp ? "image/webp" : "image/jpeg";

  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });

  if (!blob) throw new Error("Image processing failed");

  return {
    blob,
    mime,
    width: targetW,
    height: targetH,
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

async function canEncodeWebp() {
  // quick feature check
  const canvas = document.createElement("canvas");
  if (!canvas.toDataURL) return false;
  const data = canvas.toDataURL("image/webp");
  return data.startsWith("data:image/webp");
}

export async function downscaleToTargetBytes(file, opts = {}) {
  const { maxBytes = 1_500_000 } = opts; // 1.5MB
  let quality = opts.quality ?? 0.78;

  for (let i = 0; i < 5; i++) {
    const out = await downscaleImageFile(file, { ...opts, quality });
    if (out.blob.size <= maxBytes) return out;
    quality = Math.max(0.55, quality - 0.08);
  }
  return downscaleImageFile(file, {
    ...opts,
    quality: Math.max(0.55, quality),
  });
}
