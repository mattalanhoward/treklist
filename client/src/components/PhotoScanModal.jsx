// client/src/components/PhotoScanModal.jsx
// Barcode + AI vision gear scanner.
// Scan flow: capture/upload → BarcodeDetector (if available) → /api/ai/scan-item
import React, { useState, useRef } from "react";
import { FiCamera, FiUpload, FiX, FiRefreshCw, FiCheck } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { uploadGearItemPhoto } from "../services/cloudinaryUpload";
import { downscaleImageFile } from "../utils/imageProcessing";

export default function PhotoScanModal({ onResult, onClose }) {
  const { t } = useTranslation("common");
  const [phase, setPhase] = useState("idle"); // idle | scanning | result | error
  const [imagePreview, setImagePreview] = useState(null);
  const [scanMethod, setScanMethod] = useState(null); // 'barcode' | 'vision'
  const [barcodeValue, setBarcodeValue] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  async function tryBarcodeDetect(img) {
    if (!("BarcodeDetector" in window)) return null;
    try {
      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
      });
      const barcodes = await detector.detect(img);
      return barcodes?.[0]?.rawValue || null;
    } catch {
      return null;
    }
  }

  async function processImage(dataUrl) {
    setImagePreview(dataUrl);
    setPhase("scanning");
    setErrorMsg(null);
    setBarcodeValue(null);
    setScanMethod(null);

    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });

    try {
      const detectedBarcode = await tryBarcodeDetect(img);

      // Upload photo to Cloudinary in parallel with AI scan; ignore failures silently
      const uploadPromise = uploadGearItemPhoto(dataUrl).catch(() => null);

      let scanPromise;
      if (detectedBarcode) {
        setBarcodeValue(detectedBarcode);
        setScanMethod("barcode");
        scanPromise = api.post("/ai/scan-item", { barcode: detectedBarcode });
      } else {
        setScanMethod("vision");
        scanPromise = api.post("/ai/scan-item", { image: dataUrl });
      }

      const [{ data }, uploadResult] = await Promise.all([scanPromise, uploadPromise]);
      if (uploadResult?.secureUrl) data.photoUrl = uploadResult.secureUrl;
      setResult(data);
      setPhase("result");
    } catch (err) {
      const msg = err.response?.data?.error || t("photoScanModal.errorFallback", "Scan failed. Try again or add manually.");
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const { blob } = await downscaleImageFile(file, { maxSize: 1600, quality: 0.85 });
    const reader = new FileReader();
    reader.onload = (ev) => processImage(ev.target.result);
    reader.readAsDataURL(blob);
  }

  function reset() {
    setPhase("idle");
    setImagePreview(null);
    setBarcodeValue(null);
    setScanMethod(null);
    setResult(null);
    setErrorMsg(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h2 className="text-sm font-semibold text-primary">
            {t("photoScanModal.title", "Scan Gear")}
          </h2>
          <button onClick={onClose} className="text-primary/40 hover:text-primary p-1">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-4">

          {/* Idle: capture options */}
          {phase === "idle" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-primary/20 rounded-lg hover:border-secondary/50 hover:bg-secondary/5 transition-colors"
                >
                  <FiCamera size={26} className="text-primary/40" />
                  <span className="text-xs text-primary/60 font-medium">
                    {t("photoScanModal.takePhoto", "Take Photo")}
                  </span>
                </button>
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-primary/20 rounded-lg hover:border-secondary/50 hover:bg-secondary/5 transition-colors"
                >
                  <FiUpload size={26} className="text-primary/40" />
                  <span className="text-xs text-primary/60 font-medium">
                    {t("photoScanModal.uploadScreenshot", "Upload Screenshot")}
                  </span>
                </button>
              </div>
              <p className="text-xs text-primary/30 text-center">
                {t("photoScanModal.hint", "Works best with product packaging and product info screenshots")}
              </p>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {/* Scanning */}
          {phase === "scanning" && (
            <div className="space-y-3">
              {imagePreview && (
                <img src={imagePreview} alt="" className="w-full h-40 object-cover rounded-lg" />
              )}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-primary/60">
                  {scanMethod === "barcode"
                    ? t("photoScanModal.scanningBarcode", "Barcode detected — looking up…")
                    : t("photoScanModal.scanningVision", "Identifying with AI…")}
                </span>
              </div>
            </div>
          )}

          {/* Result */}
          {phase === "result" && result && (
            <div className="space-y-3">
              {imagePreview && (
                <img src={imagePreview} alt="" className="w-full h-32 object-cover rounded-lg" />
              )}
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                scanMethod === "barcode"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}>
                {scanMethod === "barcode"
                  ? `${t("photoScanModal.badgeBarcodePrefix", "Barcode")} · ${barcodeValue}`
                  : t("photoScanModal.badgeVision", "AI Vision")}
              </span>
              <dl className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="text-primary/40 w-16 flex-shrink-0 text-xs pt-0.5">{t("photoScanModal.fieldName", "Name")}</dt>
                  <dd className="text-primary font-medium">{result.name}</dd>
                </div>
                {result.brand && (
                  <div className="flex gap-2">
                    <dt className="text-primary/40 w-16 flex-shrink-0 text-xs pt-0.5">{t("photoScanModal.fieldBrand", "Brand")}</dt>
                    <dd className="text-primary">{result.brand}</dd>
                  </div>
                )}
                {result.category && (
                  <div className="flex gap-2">
                    <dt className="text-primary/40 w-16 flex-shrink-0 text-xs pt-0.5">{t("photoScanModal.fieldCategory", "Category")}</dt>
                    <dd className="text-primary">{result.category}</dd>
                  </div>
                )}
                {result.itemType && (
                  <div className="flex gap-2">
                    <dt className="text-primary/40 w-16 flex-shrink-0 text-xs pt-0.5">{t("photoScanModal.fieldType", "Type")}</dt>
                    <dd className="text-primary">{result.itemType}</dd>
                  </div>
                )}
                {result.weightGrams != null && (
                  <div className="flex gap-2">
                    <dt className="text-primary/40 w-16 flex-shrink-0 text-xs pt-0.5">{t("photoScanModal.fieldWeight", "Weight")}</dt>
                    <dd className="text-primary">{result.weightGrams}g</dd>
                  </div>
                )}
                {result.description && (
                  <div className="flex gap-2">
                    <dt className="text-primary/40 w-16 flex-shrink-0 text-xs pt-0.5">{t("photoScanModal.fieldDesc", "Desc")}</dt>
                    <dd className="text-primary/70 text-xs leading-relaxed">{result.description}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="space-y-3">
              {imagePreview && (
                <img src={imagePreview} alt="" className="w-full h-32 object-cover rounded-lg opacity-50" />
              )}
              <p className="text-sm text-error text-center py-2">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === "result" || phase === "error") && (
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-base-300 rounded-lg text-primary/60 hover:text-primary transition-colors"
            >
              <FiRefreshCw size={13} />
              {t("photoScanModal.tryAgain", "Try again")}
            </button>
            {phase === "result" && (
              <button
                onClick={() => onResult(result)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-secondary text-white rounded-lg hover:bg-secondary/90 font-medium transition-colors"
              >
                <FiCheck size={14} />
                {t("photoScanModal.useThisItem", "Use this item")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
