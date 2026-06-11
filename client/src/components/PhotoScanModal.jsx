// client/src/components/PhotoScanModal.jsx
// AI vision gear scanner. Scan flow: capture/upload → /api/ai/scan-item → catalog lookup
import React, { useState, useRef, useEffect } from "react";
import { FiCamera, FiUpload, FiX, FiRefreshCw } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { uploadGearItemPhoto } from "../services/cloudinaryUpload";
import { downscaleImageFile } from "../utils/imageProcessing";
import useStagedMessage from "../hooks/useStagedMessage";

export default function PhotoScanModal({ onResult, onCatalogSelect, onClose, initialFile }) {
  const { t } = useTranslation("common");
  const [phase, setPhase] = useState("idle"); // idle | scanning | catalog-matches | error
  const [imagePreview, setImagePreview] = useState(null);
  const [scanData, setScanData] = useState(null);
  const [catalogMatches, setCatalogMatches] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  async function processImage(dataUrl) {
    setImagePreview(dataUrl);
    setPhase("scanning");
    setErrorMsg(null);

    try {
      const uploadPromise = uploadGearItemPhoto(dataUrl).catch(() => null);
      const scanPromise = api.post("/ai/scan-item", { image: dataUrl });

      const [{ data }, uploadResult] = await Promise.all([scanPromise, uploadPromise]);
      if (uploadResult?.secureUrl) data.photoUrl = uploadResult.secureUrl;

      const matches = data.catalogMatches || [];
      if (matches.length > 0) {
        setScanData(data);
        setCatalogMatches(matches);
        setPhase("catalog-matches");
      } else {
        // No catalog match — go straight to pre-filled custom form
        onResult(data);
      }
    } catch (err) {
      const code = err.response?.data?.error;
      const msg =
        code === "not_identified"
          ? t("photoScanModal.errorNotIdentified", "Couldn't identify an item in this photo. Try a clearer shot of the packaging or label.")
          : code === "rate_limited"
            ? t("photoScanModal.errorRateLimited", "Too many scans — wait a minute and try again.")
            : t("photoScanModal.errorFallback", "Scan failed. Try again or add manually.");
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  async function processFile(file) {
    try {
      const { blob } = await downscaleImageFile(file, { maxSize: 1600, quality: 0.85 });
      const reader = new FileReader();
      reader.onload = (ev) => processImage(ev.target.result);
      reader.readAsDataURL(blob);
    } catch {
      setErrorMsg(t("photoScanModal.errorFallback", "Scan failed. Try again or add manually."));
      setPhase("error");
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    processFile(file);
  }

  // Scan immediately when opened with a pasted/dropped image
  useEffect(() => {
    if (initialFile) processFile(initialFile);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scanningMsg = useStagedMessage(
    phase === "scanning"
      ? [
          t("photoScanModal.scanningVision", "Identifying with AI…"),
          t("photoScanModal.scanningMatching", "Matching against the catalog…"),
        ]
      : [],
    3000,
  );

  function reset() {
    setPhase("idle");
    setImagePreview(null);
    setScanData(null);
    setCatalogMatches([]);
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
                <span className="text-sm text-primary/60">{scanningMsg}</span>
              </div>
            </div>
          )}

          {/* Catalog matches */}
          {phase === "catalog-matches" && (
            <div className="space-y-3">
              <p className="text-xs text-primary/50 text-center">
                {t("photoScanModal.catalogMatchHeading", "Found in catalog — is this your item?")}
              </p>
              <div className="space-y-2">
                {catalogMatches.map((item) => {
                  const thumb = item.imageUrls?.[0];
                  return (
                    <button
                      key={item._id}
                      onClick={() => onCatalogSelect(item)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg border border-base-300 hover:border-secondary/50 hover:bg-secondary/5 transition-colors text-left"
                    >
                      {thumb ? (
                        <img src={thumb} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-base-200 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{item.name}</p>
                        {item.brand && (
                          <p className="text-xs text-primary/50 truncate">{item.brand}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
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
        {(phase === "catalog-matches" || phase === "error") && (
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-base-300 rounded-lg text-primary/60 hover:text-primary transition-colors"
            >
              <FiRefreshCw size={13} />
              {t("photoScanModal.tryAgain", "Try again")}
            </button>
            {phase === "catalog-matches" && (
              <button
                onClick={() => onResult(scanData)}
                className="flex-1 flex items-center justify-center px-3 py-2 text-sm border border-base-300 rounded-lg text-primary/60 hover:text-primary transition-colors"
              >
                {t("photoScanModal.noneOfThese", "None of these")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
