// src/components/ShareModal.jsx
import React from "react";
import { FaCopy, FaBan, FaCode, FaFileCsv } from "react-icons/fa";
import { toast } from "react-hot-toast";
import api from "../services/api";
import ConfirmDialog from "./ConfirmDialog";
import { useTranslation } from "react-i18next";

export default function ShareModal({ listId, isOpen, onClose }) {
  const { t } = useTranslation("common");

  const [busy, setBusy] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [revokeConfirmOpen, setRevokeConfirmOpen] = React.useState(false);
  const inputRef = React.useRef(null);
  const embedRef = React.useRef(null);

  const shareUrl = token ? `${window.location.origin}/share/${token}` : "";

  React.useEffect(() => {
    let cancelled = false;
    async function ensureToken() {
      if (!isOpen || !listId) return;
      try {
        setBusy(true);
        const { data } = await api.post(`/dashboard/${listId}/share`);
        if (!cancelled) setToken(data.token);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error(t("shareModal.toasts.createLinkError"));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    ensureToken();
    return () => {
      cancelled = true;
    };
  }, [isOpen, listId, t]);

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success(t("shareModal.toasts.copySuccess"));
        return true;
      }
    } catch {}

    try {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
        el.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy");
        if (ok) {
          toast.success(t("shareModal.toasts.copySuccess"));
          return true;
        }
      }
    } catch {}

    toast.error(t("shareModal.toasts.copyError"));
    return false;
  }

  async function onCopyUrl() {
    if (!shareUrl) return;
    await copyToClipboard(shareUrl);
  }

  const embedCode = token
    ? `<iframe src="${window.location.origin}/share/${token}" style="width:100%;height:600px;border:0;" loading="lazy"></iframe>`
    : "";

  async function onCopyEmbed() {
    if (!token) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(embedCode);
        toast.success(t("shareModal.toasts.embedCopySuccess"));
        return;
      }
    } catch {}

    try {
      if (embedRef.current) {
        embedRef.current.focus();
        embedRef.current.select();
        document.execCommand("copy");
        toast.success(t("shareModal.toasts.embedCopySuccess"));
        return;
      }
    } catch {}

    toast.error(t("shareModal.toasts.copyError"));
  }

  async function actuallyRevoke() {
    if (!listId) return;
    try {
      setBusy(true);
      await api.post(`/dashboard/${listId}/share/revoke`);
      setToken("");
      toast.success(t("shareModal.toasts.revokeSuccess"));
    } catch (e) {
      console.error(e);
      toast.error(t("shareModal.toasts.revokeError"));
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadCsv() {
    if (!token) return;
    try {
      setBusy(true);
      const csvUrl = `${
        import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || ""
      }/api/public/share/${token}/csv`;
      const a = document.createElement("a");
      a.href = csvUrl;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
      toast.error(t("shareModal.toasts.csvError"));
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* Panel */}
      <div className="relative bg-neutralAlt rounded-lg shadow-2xl max-w-xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4">
        {/* Header (no 'X' button) */}
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <h2
            id="share-modal-title"
            className="text-xl font-semibold text-primary"
          >
            {t("shareModal.title")}
          </h2>
          <div className="w-6 h-6" aria-hidden="true" />
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Share URL */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              {t("shareModal.fields.shareUrlLabel")}
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                readOnly
                className="flex-1 mt-0.5 block w-full border border-primary rounded p-2 h-10 text-primary bg-base-100 placeholder:text-primary/50"
                value={shareUrl}
                placeholder={
                  busy
                    ? t("shareModal.fields.shareUrlPlaceholderGenerating")
                    : t("shareModal.fields.shareUrlPlaceholderNone")
                }
              />
              <button
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-secondary text-white hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2"
                onClick={onCopyUrl}
                disabled={busy || !token}
                title={t("shareModal.tooltips.copyLink")}
              >
                <FaCopy /> {t("shareModal.buttons.copyLink")}
              </button>
            </div>
            <p className="mt-1 text-sm text-primary/80">
              {t("shareModal.fields.shareUrlHelp")}
            </p>
          </div>

          {/* Embeddable snippet */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              {t("shareModal.fields.embedLabel")}
            </label>
            <div className="flex gap-2">
              <textarea
                ref={embedRef}
                className="flex-1 mt-0.5 block w-full border border-primary rounded p-2 h-10 resize-none text-primary bg-base-100 placeholder:text-primary/50"
                rows={1}
                readOnly
                value={embedCode}
                placeholder={
                  busy
                    ? t("shareModal.fields.embedPlaceholderGenerating")
                    : t("shareModal.fields.embedPlaceholderNone")
                }
              />
              <button
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-secondary text-white hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2"
                onClick={onCopyEmbed}
                disabled={busy || !token}
                title={t("shareModal.tooltips.copyEmbed")}
              >
                <FaCode /> {t("shareModal.buttons.copyEmbed")}
              </button>
            </div>
          </div>

          {/* CSV Export */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              {t("shareModal.fields.csvLabel")}
            </label>
            <div className="flex items-center justify-between">
              <div className="text-sm text-primary/80">
                {t("shareModal.fields.csvHelp")}
              </div>
              <button
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-neutralAlt text-primary border border-primary hover:bg-neutralAlt/90 disabled:opacity-50 flex items-center gap-2"
                onClick={onDownloadCsv}
                disabled={busy || !token}
                title={t("shareModal.tooltips.downloadCsv")}
              >
                <FaFileCsv /> {t("shareModal.buttons.downloadCsv")}
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Revoke on the left (destructive), Close on the right (cancel) */}
        <div className="mt-4 flex items-center justify-between">
          <button
            className="px-4 py-2 bg-error text-neutral font-semibold rounded-md shadow hover:bg-error/80 disabled:opacity-50 flex items-center gap-2"
            onClick={() => setRevokeConfirmOpen(true)}
            disabled={busy || !token}
            title={t("shareModal.tooltips.revokeLink")}
          >
            <FaBan /> {t("shareModal.buttons.revokeLink")}
          </button>

          <button
            className="px-4 py-2 rounded bg-secondary text-white hover:bg-secondary/80"
            onClick={onClose}
            title={t("actions.close")}
          >
            {t("actions.close")}
          </button>
        </div>

        {/* Revoke confirm dialog */}
        <ConfirmDialog
          isOpen={revokeConfirmOpen}
          title={t("shareModal.confirm.revokeTitle")}
          message={t("shareModal.confirm.revokeMessage")}
          confirmText={t("shareModal.confirm.revokeConfirm")}
          cancelText={t("actions.cancel")}
          onConfirm={async () => {
            setRevokeConfirmOpen(false);
            await actuallyRevoke();
          }}
          onCancel={() => setRevokeConfirmOpen(false)}
        />
      </div>
    </div>
  );
}
