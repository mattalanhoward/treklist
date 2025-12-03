// src/components/ShareModal.jsx
import React from "react";
import { FaCopy, FaBan, FaCode, FaFileCsv } from "react-icons/fa";
import { toast } from "react-hot-toast";
import api from "../services/api";
import ConfirmDialog from "./ConfirmDialog";

export default function ShareModal({ listId, isOpen, onClose }) {
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
        if (!cancelled) toast.error("Could not create share link");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    ensureToken();
    return () => {
      cancelled = true;
    };
  }, [isOpen, listId]);

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success("Copied!");
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
          toast.success("Copied!");
          return true;
        }
      }
    } catch {}
    toast.error("Copy not supported on this device.");
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
        toast.success("Embed copied!");
        return;
      }
    } catch {}
    try {
      if (embedRef.current) {
        embedRef.current.focus();
        embedRef.current.select();
        document.execCommand("copy");
        toast.success("Embed copied!");
        return;
      }
    } catch {}
    toast.error("Copy not supported on this device.");
  }

  async function actuallyRevoke() {
    if (!listId) return;
    try {
      setBusy(true);
      await api.post(`/dashboard/${listId}/share/revoke`);
      setToken("");
      toast.success("Share link revoked");
    } catch (e) {
      console.error(e);
      toast.error("Could not revoke link");
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
      toast.error("Could not download CSV");
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
      className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50"
      role="modal"
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
            Share this gear list
          </h2>
          <div className="w-6 h-6" aria-hidden="true" />
        </div>

        {/* Body */}
        <div className="space-y-4">
          {/* Share URL */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              Shareable URL
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                readOnly
                className="flex-1 mt-0.5 block w-full border border-primary rounded p-2 h-10 text-primary"
                value={shareUrl}
                placeholder={busy ? "Generating…" : "No active link"}
              />
              <button
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-secondary text-white hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2"
                onClick={onCopyUrl}
                disabled={busy || !token}
                title="Copy link"
              >
                <FaCopy /> Copy
              </button>
            </div>
            <p className="mt-1 text-sm text-primary/80">
              Anyone with this link can view a read-only version of your list.
            </p>
          </div>

          {/* Embeddable snippet */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              Embeddable snippet
            </label>
            <div className="flex gap-2">
              <textarea
                ref={embedRef}
                className="flex-1 mt-0.5 block w-full border border-primary rounded p-2 h-10 resize-none text-primary"
                rows={1}
                readOnly
                value={embedCode}
                placeholder={busy ? "Generating…" : "No active link"}
              />
              <button
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-secondary text-white hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2"
                onClick={onCopyEmbed}
                disabled={busy || !token}
                title="Copy embed"
              >
                <FaCode /> Copy
              </button>
            </div>
          </div>

          {/* CSV Export */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              Export CSV
            </label>
            <div className="flex items-center justify-between">
              <div className="text-sm text-primary/80">
                Download a CSV of this shared list.
              </div>
              <button
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded bg-neutralAlt text-primary border border-primary hover:bg-neutralAlt/90 disabled:opacity-50 flex items-center gap-2"
                onClick={onDownloadCsv}
                disabled={busy || !token}
                title="Download CSV"
              >
                <FaFileCsv /> Download
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
            title="Revoke link"
          >
            <FaBan /> Revoke link
          </button>

          <button
            className="px-4 py-2 rounded bg-secondary text-white hover:bg-secondary/80"
            onClick={onClose}
            title="Cancel"
          >
            Close
          </button>
        </div>

        {/* Revoke confirm dialog (same component/style used in GlobalItemEditModal) */}
        <ConfirmDialog
          isOpen={revokeConfirmOpen}
          title="Revoke this share URL?"
          message="This will immediately disable the current link."
          confirmText="Revoke Link"
          cancelText="Cancel"
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
