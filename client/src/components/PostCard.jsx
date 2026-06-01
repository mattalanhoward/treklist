import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowUp, FiMessageSquare, FiFlag, FiEdit2, FiTrash2, FiExternalLink } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { upvotePost, flagPost, deletePost } from "../services/community";
import useAuth from "../hooks/useAuth";
import { toast } from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

function isFlaggedInStorage(type, id) {
  try { return JSON.parse(localStorage.getItem(`community:flagged:${type}`) || "[]").includes(id); }
  catch { return false; }
}
function storeFlagged(type, id) {
  try {
    const key = `community:flagged:${type}`;
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    if (!arr.includes(id)) localStorage.setItem(key, JSON.stringify([...arr, id]));
  } catch { /* ignore */ }
}

export default function PostCard({ post, communitySlug, onDeleted, compact = false }) {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [upvoteCount, setUpvoteCount] = useState(post.upvoteCount);
  const [upvoted, setUpvoted] = useState(post.upvoted);
  const [flagged, setFlagged] = useState(() => isFlaggedInStorage("post", post._id));
  const [loading, setLoading] = useState(false);

  const isOwner = isAuthenticated && user?._id === post.userId?._id;
  const slug = communitySlug || post.community?.slug;

  async function handleUpvote(e) {
    e.preventDefault();
    if (!isAuthenticated) { navigate("/auth/login"); return; }
    if (loading) return;
    setLoading(true);
    try {
      const res = await upvotePost(post._id);
      setUpvoted(res.upvoted);
      setUpvoteCount(res.upvoteCount);
    } catch {
      toast.error(t("community.toasts.couldNotUpvote"));
    } finally {
      setLoading(false);
    }
  }

  async function handleFlag(e) {
    e.preventDefault();
    if (!isAuthenticated) { navigate("/auth/login"); return; }
    if (flagged) return;
    try {
      await flagPost(post._id);
      setFlagged(true);
      storeFlagged("post", post._id);
      toast.success(t("community.toasts.postFlaggedForReview"));
    } catch {
      toast.error(t("community.toasts.couldNotFlagPost"));
    }
  }

  async function handleDelete(e) {
    e.preventDefault();
    if (!window.confirm(t("community.confirm.deletePost"))) return;
    try {
      await deletePost(post._id);
      onDeleted?.(post._id);
    } catch {
      toast.error(t("community.toasts.couldNotDeletePost"));
    }
  }

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <article className="bg-base-100 border border-base-200 rounded-xl p-4 hover:border-base-300 transition-colors">
      <div className="flex gap-3">
        {/* Upvote column */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={handleUpvote}
            className={`btn btn-ghost btn-xs btn-square ${upvoted ? "text-primary" : "opacity-60 hover:opacity-100"}`}
            title={t("community.actions.upvote")}
          >
            <FiArrowUp size={16} />
          </button>
          <span className="text-xs font-semibold tabular-nums">{upvoteCount}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            to={`/community/${slug}/${post._id}`}
            className="block group"
          >
            <h2 className={`font-semibold group-hover:text-primary transition-colors leading-snug ${compact ? "text-sm" : "text-base"}`}>
              {post.title}
              {post.isEdited && (
                <span className="ml-2 text-xs opacity-40 font-normal">(edited)</span>
              )}
            </h2>
          </Link>

          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <FiExternalLink size={11} />
              {(() => { try { return new URL(post.url).hostname; } catch { return post.url; } })()}
            </a>
          )}

          {!compact && post.body && (
            <p className="text-sm opacity-70 mt-1 line-clamp-3">{post.body}</p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs opacity-50 flex-wrap">
            <span>
              {post.userId?.trailname || "Unknown"} &middot; {timeAgo}
            </span>
            <Link
              to={`/community/${slug}/${post._id}`}
              className="flex items-center gap-1 hover:opacity-100"
            >
              <FiMessageSquare size={12} />
              {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
            </Link>
            {isAuthenticated && !isOwner && (
              <button
                onClick={handleFlag}
                className={`ml-auto flex items-center gap-1 hover:opacity-100 ${flagged ? "text-error" : ""}`}
                title={t("community.actions.flagPost")}
              >
                <FiFlag size={12} />
                {flagged ? t("community.actions.flagged") : t("community.actions.flag")}
              </button>
            )}
            {isOwner && (
              <>
                <Link
                  to={`/community/${slug}/${post._id}?edit=1`}
                  className="flex items-center gap-1 hover:opacity-100"
                >
                  <FiEdit2 size={12} /> {t("community.actions.edit")}
                </Link>
                <button
                  onClick={handleDelete}
                  className="ml-auto flex items-center gap-1 hover:text-error hover:opacity-100"
                >
                  <FiTrash2 size={12} /> {t("actions.delete")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
