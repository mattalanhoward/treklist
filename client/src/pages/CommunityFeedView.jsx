import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Navigate, useOutletContext } from "react-router-dom";
import { FiPlus, FiLoader } from "react-icons/fi";
import { getPosts } from "../services/community";
import PostCard from "../components/PostCard";
import CreatePostForm from "../components/CreatePostForm";
import useAuth from "../hooks/useAuth";
import usePoll from "../hooks/usePoll";

export default function CommunityFeedView() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { communities } = useOutletContext();

  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("new");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const firstSlug = communities?.[0]?.slug;
  const effectiveSlug = slug || firstSlug;

  const fetchPosts = useCallback(async (resetPage = false) => {
    if (!effectiveSlug) return;
    const currentPage = resetPage ? 1 : page;
    try {
      const data = await getPosts(effectiveSlug, { sort, page: currentPage });
      setCommunity(data.community);
      setPosts(data.posts);
      setTotal(data.total);
      if (resetPage) setPage(1);
    } catch {
      // silently ignore poll errors
    } finally {
      setLoading(false);
    }
  }, [effectiveSlug, sort, page]);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    fetchPosts(true);
  }, [effectiveSlug, sort]);

  usePoll(() => fetchPosts(), 30000);

  // Redirect after all hooks — safe here since hooks are all above
  if (!slug && firstSlug) {
    return <Navigate to={`/community/${firstSlug}`} replace />;
  }

  function handlePostCreated(newPost) {
    setShowCreate(false);
    setPosts((prev) => [{ ...newPost, upvoted: false }, ...prev]);
    setTotal((t) => t + 1);
  }

  function handlePostDeleted(postId) {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    setTotal((t) => Math.max(0, t - 1));
  }

  if (!slug && !firstSlug && !loading) {
    return (
      <div className="flex items-center justify-center h-full opacity-50 text-sm">
        No communities yet.
      </div>
    );
  }

  const PAGE_SIZE = 20;
  const hasMore = total > page * PAGE_SIZE;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">{community?.name || "…"}</h1>
          {community?.description && (
            <p className="text-sm opacity-60 mt-0.5">{community.description}</p>
          )}
        </div>
        {isAuthenticated && !showCreate && (
          <button
            className="btn btn-primary btn-sm gap-1"
            onClick={() => setShowCreate(true)}
          >
            <FiPlus size={15} /> New post
          </button>
        )}
      </div>

      {/* Create post form */}
      {showCreate && (
        <CreatePostForm
          communitySlug={effectiveSlug}
          onSaved={handlePostCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Sort toggle */}
      <div className="flex gap-1">
        {["new", "top"].map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`btn btn-xs capitalize ${sort === s ? "btn-primary" : "btn-ghost"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-12 opacity-40">
          <FiLoader size={22} className="animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 opacity-40 text-sm">
          No posts yet. Be the first!
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              communitySlug={effectiveSlug}
              onDeleted={handlePostDeleted}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              getPosts(effectiveSlug, { sort, page: nextPage }).then((data) => {
                setPosts((prev) => [...prev, ...data.posts]);
              });
            }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
