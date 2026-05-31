import React, { useState } from "react";
import { FiArrowUp, FiFlag, FiEdit2, FiTrash2, FiCornerDownRight, FiLink, FiGlobe, FiX, FiLoader } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { upvoteComment, flagComment, deleteComment, updateComment, createComment, translateText } from "../services/community";
import useAuth from "../hooks/useAuth";
import { toast } from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

function CommentItem({ comment, postId, isReply = false, onDeleted, onUpdated, onReplyAdded }) {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [upvoteCount, setUpvoteCount] = useState(comment.upvoteCount);
  const [upvoted, setUpvoted] = useState(comment.upvoted);
  const [flagged, setFlagged] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [translatedBody, setTranslatedBody] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const userLang = localStorage.getItem("language") || navigator.language?.split("-")[0] || "en";
  const showTranslateButton = !comment.lang || comment.lang !== userLang;

  const isOwner = isAuthenticated && user?._id === comment.userId?._id;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });

  async function handleUpvote() {
    if (!isAuthenticated) return;
    try {
      const res = await upvoteComment(comment._id);
      setUpvoted(res.upvoted);
      setUpvoteCount(res.upvoteCount);
    } catch {
      toast.error(t("community.toasts.couldNotUpvote"));
    }
  }

  async function handleFlag() {
    if (!isAuthenticated || flagged) return;
    try {
      await flagComment(comment._id);
      setFlagged(true);
      toast.success(t("community.toasts.commentFlaggedForReview"));
    } catch {
      toast.error(t("community.toasts.couldNotFlagComment"));
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("community.confirm.deleteComment"))) return;
    try {
      await deleteComment(comment._id);
      onDeleted?.(comment._id);
    } catch {
      toast.error(t("community.toasts.couldNotDeleteComment"));
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      const updated = await updateComment(comment._id, { body: editBody });
      onUpdated?.(updated);
      setEditing(false);
    } catch {
      toast.error(t("community.toasts.couldNotUpdateComment"));
    } finally {
      setSaving(false);
    }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSaving(true);
    try {
      const newComment = await createComment(postId, { body: replyBody, parentCommentId: comment._id });
      onReplyAdded?.(newComment);
      setReplyBody("");
      setReplying(false);
    } catch {
      toast.error(t("community.toasts.couldNotPostReply"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTranslate() {
    if (showTranslated) { setShowTranslated(false); return; }
    if (translatedBody) { setShowTranslated(true); return; }
    setTranslating(true);
    try {
      const targetLang = localStorage.getItem("language") || navigator.language?.split("-")[0] || "en";
      const { translated } = await translateText(comment.body, targetLang);
      setTranslatedBody(translated);
      setShowTranslated(true);
    } catch {
      toast.error(t("community.toasts.couldNotTranslate"));
    } finally {
      setTranslating(false);
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}${window.location.pathname}#comment-${comment._id}`;
    navigator.clipboard.writeText(url).then(() => toast.success(t("community.toasts.linkCopied")));
  }

  return (
    <div
      id={`comment-${comment._id}`}
      className={`flex gap-3 ${isReply ? "ml-8 mt-3" : ""}`}
    >
      {isReply && <FiCornerDownRight size={14} className="shrink-0 opacity-30 mt-1" />}

      <div className="flex-1 min-w-0">
        {/* Meta */}
        <div className="flex items-center gap-2 text-xs opacity-50 flex-wrap mb-1">
          <span className="font-medium opacity-80">{comment.userId?.trailname || "Unknown"}</span>
          <span>{timeAgo}</span>
          {comment.isEdited && <span>(edited)</span>}
        </div>

        {/* Body */}
        {editing ? (
          <form onSubmit={handleEdit} className="space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="textarea textarea-bordered textarea-sm w-full resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn btn-primary btn-xs">
                {saving ? t("actions.saving") : t("actions.save")}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-xs">
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">
            {showTranslated && translatedBody ? translatedBody : comment.body}
          </p>
        )}

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <button
              onClick={handleUpvote}
              className={`flex items-center gap-1 text-xs ${upvoted ? "text-primary" : "opacity-40 hover:opacity-70"} ${isOwner ? "invisible" : ""}`}
              disabled={!isAuthenticated || isOwner}
            >
              <FiArrowUp size={12} />
              <span>{upvoteCount}</span>
            </button>

            {isAuthenticated && !isOwner && !isReply && (
              <button
                onClick={() => setReplying((r) => !r)}
                className="text-xs opacity-40 hover:opacity-70"
              >
                {t("community.actions.reply")}
              </button>
            )}

            <button
              onClick={handleCopyLink}
              className="text-xs opacity-40 hover:opacity-70"
              title={t("community.actions.copyLink")}
            >
              <FiLink size={11} />
            </button>

            {showTranslateButton && (
              <button
                onClick={handleTranslate}
                className="text-xs text-sky-400 hover:text-sky-500 transition-colors"
                disabled={translating}
              >
                {translating ? <FiLoader size={14} className="animate-spin" /> : showTranslated ? <FiX size={14} /> : <FiGlobe size={14} />}
              </button>
            )}

            {isAuthenticated && !isOwner && (
              <button
                onClick={handleFlag}
                className={`text-xs flex items-center gap-1 ${flagged ? "text-error opacity-70" : "opacity-40 hover:opacity-70"}`}
              >
                <FiFlag size={11} />
                {flagged ? t("community.actions.flagged") : t("community.actions.flag")}
              </button>
            )}
            {isOwner && (
              <>
                <button onClick={() => setEditing(true)} className="text-xs opacity-40 hover:opacity-70 flex items-center gap-1">
                  <FiEdit2 size={11} /> {t("community.actions.edit")}
                </button>
                <button onClick={handleDelete} className="text-xs opacity-40 hover:text-error hover:opacity-70 flex items-center gap-1">
                  <FiTrash2 size={11} /> {t("actions.delete")}
                </button>
              </>
            )}
          </div>
        )}

        {/* Reply form */}
        {replying && (
          <form onSubmit={handleReply} className="mt-2 space-y-2">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={t("community.comments.replyPlaceholder")}
              rows={2}
              className="textarea textarea-bordered textarea-sm w-full resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn btn-primary btn-xs">
                {saving ? t("community.actions.posting") : t("community.actions.reply")}
              </button>
              <button type="button" onClick={() => setReplying(false)} className="btn btn-ghost btn-xs">
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CommentThread({ comments: initial, postId, onCommentsChange }) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [comments, setComments] = useState(initial || []);
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);

  // Sync when parent refreshes comments via polling
  React.useEffect(() => {
    setComments(initial || []);
  }, [initial]);

  async function handlePost(e) {
    e.preventDefault();
    if (!newBody.trim()) return;
    setPosting(true);
    try {
      const comment = await createComment(postId, { body: newBody });
      setComments((prev) => [...prev, { ...comment, replies: [] }]);
      setNewBody("");
      onCommentsChange?.();
    } catch {
      toast.error(t("community.toasts.couldNotPostComment"));
    } finally {
      setPosting(false);
    }
  }

  function handleTopLevelDeleted(commentId) {
    setComments((prev) => prev.filter((c) => c._id !== commentId));
  }

  function handleTopLevelUpdated(updated) {
    setComments((prev) =>
      prev.map((c) => (c._id === updated._id ? { ...c, ...updated, replies: c.replies } : c))
    );
  }

  function handleReplyAdded(newReply) {
    setComments((prev) =>
      prev.map((c) =>
        c._id === newReply.parentCommentId
          ? { ...c, replies: [...(c.replies || []), newReply] }
          : c
      )
    );
  }

  function handleReplyDeleted(parentId, replyId) {
    setComments((prev) =>
      prev.map((c) =>
        c._id === parentId
          ? { ...c, replies: (c.replies || []).filter((r) => r._id !== replyId) }
          : c
      )
    );
  }

  function handleReplyUpdated(parentId, updated) {
    setComments((prev) =>
      prev.map((c) =>
        c._id === parentId
          ? { ...c, replies: (c.replies || []).map((r) => (r._id === updated._id ? updated : r)) }
          : c
      )
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">
        {comments.length} comment{comments.length !== 1 ? "s" : ""}
      </h3>

      {/* New comment form */}
      {isAuthenticated ? (
        <form onSubmit={handlePost} className="space-y-2">
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder={t("community.comments.commentPlaceholder")}
            rows={3}
            className="textarea textarea-bordered textarea-sm w-full resize-none"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={posting || !newBody.trim()} className="btn btn-primary btn-sm">
              {posting ? t("community.actions.posting") : t("community.actions.comment")}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm opacity-50">
          <a href="/auth/login" className="text-primary hover:underline">{t("community.logIn")}</a> to comment.
        </p>
      )}

      {/* Comments list */}
      <div className="space-y-4 divide-y divide-base-200">
        {comments.map((comment) => (
          <div key={comment._id} className="pt-4 first:pt-0">
            <CommentItem
              comment={comment}
              postId={postId}
              onDeleted={handleTopLevelDeleted}
              onUpdated={handleTopLevelUpdated}
              onReplyAdded={handleReplyAdded}
            />
            {(comment.replies || []).map((reply) => (
              <CommentItem
                key={reply._id}
                comment={reply}
                postId={postId}
                isReply
                onDeleted={(id) => handleReplyDeleted(comment._id, id)}
                onUpdated={(u) => handleReplyUpdated(comment._id, u)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
