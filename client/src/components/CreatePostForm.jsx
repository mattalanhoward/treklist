import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { createPost, updatePost } from "../services/community";
import { toast } from "react-hot-toast";

export default function CreatePostForm({ communitySlug, existingPost, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(existingPost?.title || "");
  const [body, setBody] = useState(existingPost?.body || "");
  const [url, setUrl] = useState(existingPost?.url || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingPost) {
      setTitle(existingPost.title || "");
      setBody(existingPost.body || "");
      setUrl(existingPost.url || "");
    }
  }, [existingPost]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { toast.error(t("community.toasts.titleIsRequired")); return; }
    setSaving(true);
    try {
      let saved;
      if (existingPost) {
        saved = await updatePost(existingPost._id, { title, body, url });
      } else {
        saved = await createPost(communitySlug, { title, body, url });
      }
      onSaved(saved);
    } catch {
      toast.error(t("community.toasts.couldNotSavePost"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-base-100 border border-base-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">
          {existingPost ? t("community.post.editTitle") : t("community.post.createTitle")}
        </h3>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-xs btn-square">
            <FiX size={14} />
          </button>
        )}
      </div>

      <div>
        <input
          type="text"
          placeholder={t("community.post.titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          className="input input-bordered input-sm w-full"
          required
        />
        <div className="text-right text-xs opacity-40 mt-0.5">{title.length}/300</div>
      </div>

      <textarea
        placeholder={t("community.post.bodyPlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={10000}
        rows={4}
        className="textarea textarea-bordered textarea-sm w-full resize-none"
      />

      <input
        type="url"
        placeholder={t("community.post.urlPlaceholder")}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="input input-bordered input-sm w-full"
      />

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
            {t("actions.cancel")}
          </button>
        )}
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
          {saving ? t("actions.saving") : existingPost ? t("community.post.saveChanges") : t("community.post.submit")}
        </button>
      </div>
    </form>
  );
}
