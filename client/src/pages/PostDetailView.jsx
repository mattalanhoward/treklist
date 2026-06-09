import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { FiArrowLeft, FiArrowUp, FiExternalLink, FiLoader } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { getPost, getComments, upvotePost, flagPost, deletePost } from "../services/community";
import CommentThread from "../components/CommentThread";
import CreatePostForm from "../components/CreatePostForm";
import useAuth from "../hooks/useAuth";
import usePoll from "../hooks/usePoll";
import { toast } from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import SEO from "../components/SEO";

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

export default function PostDetailView() {
  const { t } = useTranslation();
  const { slug, postId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [upvoted, setUpvoted] = useState(false);
  const [flagged, setFlagged] = useState(() => isFlaggedInStorage("post", postId));
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");

  const fetchAll = useCallback(async () => {
    try {
      const [postData, commentsData] = await Promise.all([
        getPost(postId),
        getComments(postId),
      ]);
      setPost(postData);
      setUpvoteCount(postData.upvoteCount);
      setUpvoted(postData.upvoted);
      setComments(commentsData);
    } catch {
      // silent on poll errors
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [postId]);

  usePoll(fetchAll, 30000);

  async function handleUpvote() {
    if (!isAuthenticated) { navigate("/auth/login"); return; }
    try {
      const res = await upvotePost(postId);
      setUpvoted(res.upvoted);
      setUpvoteCount(res.upvoteCount);
    } catch {
      toast.error(t("community.toasts.couldNotUpvote"));
    }
  }

  async function handleFlag() {
    if (!isAuthenticated || flagged) return;
    try {
      await flagPost(postId);
      setFlagged(true);
      storeFlagged("post", postId);
      toast.success(t("community.toasts.postFlaggedForReview"));
    } catch {
      toast.error(t("community.toasts.couldNotFlagPost"));
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("community.confirm.deletePost"))) return;
    try {
      await deletePost(postId);
      navigate(`/community/${slug}`);
    } catch {
      toast.error(t("community.toasts.couldNotDeletePost"));
    }
  }

  function handlePostSaved(updated) {
    setPost(updated);
    setEditing(false);
    setSearchParams({});
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24 opacity-40">
        <FiLoader size={24} className="animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-24 opacity-50 text-sm">
        {t("community.postNotFound")}{" "}
        <Link to={`/community/${slug}`} className="text-primary hover:underline">
          Back to community
        </Link>
      </div>
    );
  }

  const isOwner = isAuthenticated && user?._id === post.userId?._id;
  const isAdmin = isAuthenticated && user?.isAdmin;
  const canEdit  = isOwner || isAdmin;
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <SEO title={`${post.title} · Community`} noindex />
      {/* Back link */}
      <Link
        to={`/community/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100"
      >
        <FiArrowLeft size={14} /> Back to {post.community?.name || "community"}
      </Link>

      {/* Post */}
      {editing ? (
        <CreatePostForm
          communitySlug={slug}
          existingPost={post}
          onSaved={handlePostSaved}
          onCancel={() => { setEditing(false); setSearchParams({}); }}
        />
      ) : (
        <article className="bg-base-100 border border-base-200 rounded-xl p-5 space-y-3">
          <div className="flex gap-3">
            {/* Upvote */}
            <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
              <button
                onClick={handleUpvote}
                className={`btn btn-ghost btn-xs btn-square ${upvoted ? "text-primary" : "opacity-50 hover:opacity-100"}`}
              >
                <FiArrowUp size={18} />
              </button>
              <span className="text-sm font-semibold tabular-nums">{upvoteCount}</span>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-snug">
                {post.title}
                {post.isEdited && (
                  <span className="ml-2 text-xs opacity-40 font-normal">(edited)</span>
                )}
              </h1>

              <div className="flex items-center gap-2 text-xs opacity-50 mt-1 flex-wrap">
                <span>{post.userId?.trailname || "Unknown"}</span>
                <span>&middot;</span>
                <span>{timeAgo}</span>
              </div>

              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary mt-2 hover:underline"
                >
                  <FiExternalLink size={13} />
                  {(() => { try { return new URL(post.url).hostname; } catch { return post.url; } })()}
                </a>
              )}

              {post.body && (
                <p className="text-sm mt-3 whitespace-pre-wrap leading-relaxed opacity-80">{post.body}</p>
              )}

              {/* Post actions */}
              <div className="flex items-center gap-4 mt-4 text-xs opacity-50 flex-wrap">
                {isAuthenticated && !canEdit && (
                  <button
                    onClick={handleFlag}
                    className={`ml-auto hover:opacity-100 ${flagged ? "text-error opacity-70" : ""}`}
                  >
                    {flagged ? t("community.actions.flagged") : t("community.actions.flag")}
                  </button>
                )}
                {canEdit && (
                  <>
                    <button onClick={() => setEditing(true)} className="hover:opacity-100">
                      {t("community.actions.edit")}
                    </button>
                    <button onClick={handleDelete} className="hover:text-error hover:opacity-100">
                      {t("actions.delete")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </article>
      )}

      {/* Comments */}
      <section>
        <CommentThread
          comments={comments}
          postId={postId}
          onCommentsChange={() => getComments(postId).then(setComments)}
        />
      </section>
    </div>
  );
}
