// client/src/services/cloudinaryUpload.js

import api from "./api";

export async function uploadBackgroundToCloudinary({
  blob,
  filename,
  onProgress,
}) {
  // 1) Get signature from your server
  const { data: sig } = await api.post("/uploads/cloudinary-signature");
  const { cloudName, apiKey, timestamp, signature, folder } = sig;

  // 2) Prepare upload form
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // 3) Upload with XHR so we can track progress
  const json = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress?.(pct);
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else
          reject(new Error(data?.error?.message || "Cloudinary upload failed"));
      } catch {
        reject(new Error("Cloudinary upload failed"));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error uploading to Cloudinary"));
    xhr.send(form);
  });

  return {
    secureUrl: json.secure_url,
    publicId: json.public_id,
    width: json.width,
    height: json.height,
    bytes: json.bytes,
    format: json.format,
  };
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadGearItemPhoto(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const { data: sig } = await api.post("/uploads/cloudinary-signature", { type: "gear-item" });
  const { cloudName, apiKey, timestamp, signature, folder } = sig;

  const form = new FormData();
  form.append("file", blob, "gear-photo.jpg");
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder);

  const json = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data?.error?.message || "Cloudinary upload failed"));
      } catch { reject(new Error("Cloudinary upload failed")); }
    };
    xhr.onerror = () => reject(new Error("Network error uploading to Cloudinary"));
    xhr.send(form);
  });

  return { secureUrl: json.secure_url };
}

const MAX_COMMUNITY_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadCommunityImage({ file, onProgress }) {
  if (file.size > MAX_COMMUNITY_IMAGE_BYTES) {
    throw new Error(`Image must be under 10 MB (${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  const { data: sig } = await api.post("/uploads/cloudinary-signature", { type: "community" });
  const { cloudName, apiKey, timestamp, signature, folder } = sig;

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const json = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      onProgress?.(Math.round((evt.loaded / evt.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data?.error?.message || "Cloudinary upload failed"));
      } catch { reject(new Error("Cloudinary upload failed")); }
    };
    xhr.onerror = () => reject(new Error("Network error uploading to Cloudinary"));
    xhr.send(form);
  });

  return {
    secureUrl: json.secure_url,
    publicId: json.public_id,
    width: json.width,
    height: json.height,
    bytes: json.bytes,
    format: json.format,
  };
}
