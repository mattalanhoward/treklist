import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiArrowUp, FiMessageSquare, FiMessageCircle, FiPlus, FiLoader, FiFlag, FiEdit2, FiTrash2, FiExternalLink, FiSend, FiCornerDownRight, FiShare2, FiStar, FiSearch, FiX, FiCheck, FiInfo, FiGlobe, FiImage, FiBold, FiItalic, FiList } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import {
  getCommunities, getPosts, getPost, getComments, searchPosts,
  createPost, updatePost, deletePost, upvotePost, flagPost,
  createComment, updateComment, deleteComment, upvoteComment, flagComment,
  favoriteCommunity, translateText,
} from "../services/community";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import useAuth from "../hooks/useAuth";
import usePoll from "../hooks/usePoll";
import { toast } from "react-hot-toast";
import { uploadCommunityImage } from "../services/cloudinaryUpload";
import { cldTransformUrl } from "../utils/cloudinary";
import ImageCarousel from "../components/ImageCarousel";
import { formatDistanceToNow } from "date-fns";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getUserLang() {
  return localStorage.getItem("language") || navigator.language?.split("-")[0] || "en";
}

function timeAgo(date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function SearchForm({ searchProps }) {
  const { value, onChange, onSubmit, onClear } = searchProps;
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-600 opacity-70 pointer-events-none" />
      <input
        type="text"
        placeholder={t("community.searchPlaceholder")}
        value={value}
        onChange={onChange}
        className="input input-bordered input-sm w-full pl-8 pr-8 focus:outline-none focus:border-green-600 focus:[box-shadow:none]"
      />
      {value && (
        <button type="button" onClick={onClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70">
          <FiX className="w-3.5 h-3.5" />
        </button>
      )}
    </form>
  );
}

// ─── Rich text body editor ────────────────────────────────────────────────────

function PostBodyEditor({ initialContent = "", onChange, placeholder = "Share your experience…" }) {
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || "",
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: { class: "tiptap-community" },
    },
  });

  const tb = (active) =>
    `p-1.5 rounded transition-colors ${active ? "bg-primary/15 text-primary" : "opacity-60 hover:opacity-100 hover:bg-base-200"}`;
  const cmd = (e, fn) => { e.preventDefault(); fn(); };

  return (
    <div className="rounded-lg border border-base-300 overflow-hidden focus-within:border-primary/40 bg-base-100">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-base-200 bg-base-50">
        <button type="button" title={t("community.toolbar.bold")} onMouseDown={(e) => cmd(e, () => editor?.chain().focus().toggleBold().run())} className={tb(editor?.isActive("bold"))}>
          <FiBold size={12} />
        </button>
        <button type="button" title={t("community.toolbar.italic")} onMouseDown={(e) => cmd(e, () => editor?.chain().focus().toggleItalic().run())} className={tb(editor?.isActive("italic"))}>
          <FiItalic size={12} />
        </button>
        <div className="w-px h-3 bg-base-300 mx-0.5" />
        <button type="button" title={t("community.toolbar.bulletList")} onMouseDown={(e) => cmd(e, () => editor?.chain().focus().toggleBulletList().run())} className={tb(editor?.isActive("bulletList"))}>
          <FiList size={12} />
        </button>
      </div>
      <div className="relative">
        {editor?.isEmpty && (
          <div className="absolute top-0 left-0 px-3 py-2.5 text-sm text-base-content/40 pointer-events-none select-none">{placeholder}</div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ message, subtext, confirmLabel = "Confirm", destructive = false, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="bg-neutralAlt sm:rounded-lg shadow-2xl border border-neutral/60 max-w-sm w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-4 py-3 sm:px-6 flex-shrink-0 border-b border-neutral/40">
          <div>
            <h2 className="text-base font-semibold text-primary">{message}</h2>
            {subtext && <p className="text-xs opacity-60 mt-1">{subtext}</p>}
          </div>
          <button type="button" onClick={onCancel} className="text-error hover:text-error/80" aria-label="Close">
            <FiX size={20} />
          </button>
        </div>
        <div className="flex justify-end gap-2 px-4 sm:px-6 py-3">
          <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded text-sm text-primary hover:bg-primary/10">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded text-sm text-base-100 ${destructive ? "bg-error hover:bg-error/80" : "bg-primary hover:bg-primary/80"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState({});
  const resolveRef = useRef(null);

  const confirm = (message, { confirmLabel = "Confirm", destructive = false, subtext = "" } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOpts({ message, subtext, confirmLabel, destructive });
      setOpen(true);
    });
  };

  const handleConfirm = () => { resolveRef.current?.(true); resolveRef.current = null; setOpen(false); };
  const handleCancel = () => { resolveRef.current?.(false); resolveRef.current = null; setOpen(false); };

  const dialog = open ? <ConfirmDialog {...opts} onConfirm={handleConfirm} onCancel={handleCancel} /> : null;

  return { confirm, dialog };
}

const RECENT_KEY = "community:recentPosts";
const MAX_RECENT = 12;

function saveRecentPost(post, community) {
  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const filtered = existing.filter((p) => p.postId !== post._id);
    const entry = {
      postId: post._id,
      title: post.title,
      communityName: community?.name || "",
      communitySlug: community?.slug || "",
    };
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...filtered].slice(0, MAX_RECENT)));
    window.dispatchEvent(new CustomEvent("community:recent-updated"));
  } catch { /* ignore storage errors */ }
}

function RecentActivity({ onSelectPost }) {
  const { t } = useTranslation();
  const [recent, setRecent] = useState([]);

  function load() {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch { setRecent([]); }
  }

  useEffect(() => {
    load();
    window.addEventListener("community:recent-updated", load);
    return () => window.removeEventListener("community:recent-updated", load);
  }, []);

  if (recent.length === 0) return null;

  return (
    <aside className="hidden lg:block w-52 xl:w-60 shrink-0 self-start sticky top-4">
      <CommunityRulesButton className="px-1 mb-4" />
      <p className="text-xs font-semibold uppercase tracking-wider opacity-40 px-1 mb-2">{t("community.recentlyVisited")}</p>
      <div className="space-y-0.5">
        {recent.map((item) => (
          <button
            key={item.postId}
            onClick={() => onSelectPost(item.postId, item.communitySlug)}
            className="w-full text-left px-2 py-2 rounded-lg border-l-2 border-l-transparent hover:border-l-green-600/60 hover:bg-base-200 transition-colors group"
          >
            <p className="text-xs font-medium line-clamp-2 leading-snug group-hover:text-green-700 transition-colors">{item.title}</p>
            {item.communityName && (
              <p className="text-xs opacity-40 mt-0.5 truncate group-hover:opacity-60 transition-opacity">{item.communityName}</p>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}

// ─── Community Rules ──────────────────────────────────────────────────────────

function CommunityRulesButton({ className = "" }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const rules = [
    ["🥾", t("community.guidelines.rule1Title"), t("community.guidelines.rule1Desc")],
    ["🗺️", t("community.guidelines.rule2Title"), t("community.guidelines.rule2Desc")],
    ["🚫", t("community.guidelines.rule3Title"), t("community.guidelines.rule3Desc")],
    ["📢", t("community.guidelines.rule4Title"), t("community.guidelines.rule4Desc")],
    ["✅", t("community.guidelines.rule5Title"), t("community.guidelines.rule5Desc")],
    ["🎉", t("community.guidelines.rule6Title"), t("community.guidelines.rule6Desc")],
  ];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs text-base-content/40 hover:text-green-600 transition-colors ${className}`}
        title={t("community.guidelines.title")}
      >
        <FiInfo size={13} />
        <span>{t("community.guidelines.rulesButton")}</span>
      </button>
      {open && (
        <div className="fixed top-14 sm:top-0 inset-x-0 bottom-0 bg-black/40 backdrop-blur-[1px] flex sm:items-center sm:justify-center z-50 sm:p-4" onClick={() => setOpen(false)}>
          <div className="bg-base-100 sm:rounded-xl shadow-2xl sm:border border-base-200 sm:max-w-md w-full h-full sm:h-auto flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-base-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FiInfo size={16} className="text-green-600" />
                <h2 className="font-semibold text-sm">{t("community.guidelines.title")}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-base-content/40 hover:text-error transition-colors"><FiX size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm overflow-y-auto flex-1">
              <p className="text-xs opacity-60 italic">{t("community.guidelines.subtitle")}</p>
              <ul className="space-y-2.5">
                {rules.map(([emoji, title, desc]) => (
                  <li key={title} className="flex gap-2.5">
                    <span className="shrink-0 mt-0.5">{emoji}</span>
                    <div>
                      <span className="font-medium">{title}</span>
                      <span className="opacity-60"> — {desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Community Landing ────────────────────────────────────────────────────────

// ─── Search Results ───────────────────────────────────────────────────────────

function SearchResults({ query, onSelectPost, onSelectCommunity, searchProps }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    searchPosts(query)
      .then((d) => setPosts(d.posts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex gap-6 max-w-4xl mx-auto px-4 py-4">
        <div className="flex-1 min-w-0 space-y-3">
          <SearchForm searchProps={searchProps} />
          <p className="text-xs opacity-50">
            {loading ? "Searching…" : `${posts.length} result${posts.length !== 1 ? "s" : ""} for "${query}"`}
          </p>
          {loading ? (
            <div className="flex justify-center py-12 opacity-40"><FiLoader size={22} className="animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 opacity-40 text-sm">No posts found.</div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <article
                  key={post._id}
                  onClick={() => onSelectPost(post._id, post.communityId?.slug)}
                  className="bg-base-100 border border-base-200 rounded-xl p-4 hover:border-primary/30 cursor-pointer transition-colors"
                >
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <FiArrowUp size={14} className={post.upvoted ? "text-amber-400" : "opacity-30"} />
                      <span className={`text-xs font-semibold tabular-nums ${post.upvoted ? "text-amber-400" : ""}`}>{post.upvoteCount}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectCommunity(post.communityId?.slug); }}
                          className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 rounded px-1.5 py-0.5 transition-colors"
                        >
                          {post.communityId?.name}
                        </button>
                      </div>
                      <h2 className="font-semibold text-sm leading-snug">{post.title}</h2>
                      {post.body && <p className="text-xs opacity-60 mt-1 line-clamp-2">{post.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs opacity-50">
                        <span>{post.userId?.trailname} &middot; {timeAgo(post.createdAt)}</span>
                        <span className="flex items-center gap-1"><FiMessageSquare size={11} />{post.commentCount}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <RecentActivity onSelectPost={onSelectPost} />
      </div>
    </div>
  );
}

// ─── Community Landing ────────────────────────────────────────────────────────

function CommunityLanding({ communities, onSelect, onToggleFavorite, onSelectPost, searchProps }) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const lang = getUserLang();
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 flex items-center">
        <h2 className="text-lg font-semibold text-primary">{t("sidebar.a11y.community")}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-6 max-w-5xl mx-auto">
        <div className="flex-1 min-w-0">
        <div className="mb-5">
          <SearchForm searchProps={searchProps} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {communities.map((c) => (
            <div
              key={c._id}
              className="relative group text-left p-4 rounded-xl border border-base-200 border-l-4 border-l-green-600/50 hover:border-l-green-600 hover:border-base-300 hover:bg-base-200/30 transition-colors cursor-pointer"
              onClick={() => onSelect(c.slug)}
            >
              <h3 className="font-semibold text-sm text-primary pr-6">{t(`communities.${c.slug}.name`, { defaultValue: c.name })}</h3>
              {c.description && (
                <p className="text-xs opacity-60 mt-1 line-clamp-2">{c.i18n?.[lang]?.description || c.description}</p>
              )}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(c.slug); }}
                  className={`absolute top-3 right-3 p-0.5 transition-opacity ${c.favorited ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
                  title={c.favorited ? "Remove from sidebar" : "Add to sidebar"}
                >
                  {c.favorited
                    ? <FaStar className="text-sm text-amber-400" />
                    : <FiStar className="text-sm text-primary/40 hover:text-amber-400" />}
                </button>
              )}
            </div>
          ))}
        </div>
        </div>
        <RecentActivity onSelectPost={onSelectPost} />
        </div>
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, onSelect, onDeleted, currentUserId }) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const userLang = getUserLang();
  const showTranslateButton = !post.lang || post.lang !== userLang;
  const [upvoteCount, setUpvoteCount] = useState(post.upvoteCount);
  const [upvoted, setUpvoted] = useState(post.upvoted);
  const [flagged, setFlagged] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedBody, setTranslatedBody] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatingPost, setTranslatingPost] = useState(false);
  const isOwner = currentUserId && post.userId?._id === currentUserId;
  const { confirm, dialog } = useConfirm();

  async function handleUpvote(e) {
    e.stopPropagation();
    if (!isAuthenticated) return;
    try {
      const res = await upvotePost(post._id);
      setUpvoted(res.upvoted);
      setUpvoteCount(res.upvoteCount);
    } catch { toast.error(t("community.toasts.couldNotUpvote")); }
  }

  async function handleFlag(e) {
    e.stopPropagation();
    if (flagged) return;
    const ok = await confirm("Flag this post for review?", { confirmLabel: t("community.actions.flag"), subtext: "This will send the post to our admins for review. Flag for inappropriate content, spam, or guideline violations." });
    if (!ok) return;
    try {
      await flagPost(post._id);
      setFlagged(true);
      toast.success(t("community.toasts.flaggedForReview"));
    } catch { toast.error(t("community.toasts.couldNotFlagPost")); }
  }

  async function handleDelete(e) {
    e.stopPropagation();
    const ok = await confirm(t("community.confirm.deletePost"), { confirmLabel: t("actions.delete"), destructive: true });
    if (!ok) return;
    try {
      await deletePost(post._id);
      onDeleted?.(post._id);
    } catch { toast.error(t("community.toasts.couldNotDeletePost")); }
  }

  async function handleTranslatePost(e) {
    e.stopPropagation();
    if (showTranslated) { setShowTranslated(false); return; }
    if (translatedTitle) { setShowTranslated(true); return; }
    setTranslatingPost(true);
    try {
      const targetLang = getUserLang();
      const plainBody = post.body ? post.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
      const calls = [translateText(post.title, targetLang)];
      if (plainBody) calls.push(translateText(plainBody, targetLang));
      const [titleResult, bodyResult] = await Promise.all(calls);
      setTranslatedTitle(titleResult.translated || post.title);
      setTranslatedBody(bodyResult?.translated || "");
      setShowTranslated(true);
    } catch { toast.error(t("community.toasts.couldNotTranslate")); }
    finally { setTranslatingPost(false); }
  }

  return (
    <>
    <article
      onClick={() => onSelect(post._id)}
      className="bg-base-100 border border-base-200 border-l-4 border-l-green-600/50 hover:border-l-green-600 hover:border-base-300 rounded-xl p-4 cursor-pointer transition-colors"
    >
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1 shrink-0 min-w-[2rem]" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleUpvote}
            className={`btn btn-ghost btn-xs btn-square ${upvoted ? "text-amber-400" : "text-amber-400/50 hover:text-amber-400"}`}
          >
            <FiArrowUp size={15} />
          </button>
          <span className={`text-xs font-bold tabular-nums ${upvoted ? "text-amber-400" : "text-amber-400/50"}`}>{upvoteCount}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-primary leading-snug">
            {showTranslated && translatedTitle ? translatedTitle : post.title}
            {post.isEdited && <span className="ml-2 text-xs opacity-40 font-normal">(edited)</span>}
          </h2>
          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary mt-0.5 hover:underline"
            >
              <FiExternalLink size={11} />
              {(() => { try { return new URL(post.url).hostname; } catch { return post.url; } })()}
            </a>
          )}
          {post.body && (
            <p className="text-xs opacity-60 mt-1 line-clamp-2">
              {showTranslated && translatedBody ? translatedBody : post.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs opacity-50 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <span>{post.userId?.trailname} &middot; {timeAgo(post.createdAt)}</span>
            <span onClick={(e) => { e.stopPropagation(); onSelect(post._id); }} className="flex items-center gap-1 cursor-pointer hover:text-green-600 transition-colors">
              <FiMessageSquare size={14} className="text-green-600/60" />{post.commentCount}
            </span>
            {showTranslateButton && (
              <button onClick={handleTranslatePost} disabled={translatingPost} className="p-0 leading-none text-sky-400 hover:text-sky-500 transition-colors">
                {translatingPost ? <FiLoader size={14} className="animate-spin" /> : showTranslated ? <FiX size={14} /> : <FiGlobe size={14} />}
              </button>
            )}
            {isAuthenticated && !isOwner && (
              <button onClick={handleFlag} className={flagged ? "text-error" : "hover:text-error transition-colors"} title={t("community.actions.flag")}>
                <FiFlag size={14} />
              </button>
            )}
            {isOwner && (
              <button onClick={handleDelete} className="hover:text-error hover:opacity-100" title={t("actions.delete")}>
                <FiTrash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {post.imageUrls?.length > 0 && (
          <div className="relative shrink-0 self-start">
            <img
              src={cldTransformUrl(post.imageUrls[0], "w_120,h_80,c_fill,q_auto")}
              alt=""
              className="w-[90px] h-[60px] rounded-lg object-cover border border-base-200"
            />
            {post.imageUrls.length > 1 && (
              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] rounded px-1 leading-none py-0.5">
                +{post.imageUrls.length - 1}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
    {dialog}
    </>
  );
}

// ─── Community Feed ───────────────────────────────────────────────────────────

function CommunityFeed({ community, onBack, onSelectPost, currentUserId, onToggleFavorite, onSelectRecentPost, searchProps }) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("new");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [postImageUrls, setPostImageUrls] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef(null);

  const fetchPosts = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    try {
      const data = await getPosts(community.slug, { sort, page: p });
      setPosts(data.posts);
      setTotal(data.total);
      if (reset) setPage(1);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [community.slug, sort, page]);

  useEffect(() => { setLoading(true); setPosts([]); fetchPosts(true); }, [community.slug, sort]);
  usePoll(() => fetchPosts(), 30000);

  async function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const slots = 5 - postImageUrls.length;
    const toUpload = files.slice(0, slots);
    if (!toUpload.length) { toast.error(t("community.toasts.maxImages")); return; }
    setImageUploading(true);
    try {
      const results = await Promise.all(toUpload.map((file) => uploadCommunityImage({ file })));
      setPostImageUrls((prev) => [...prev, ...results.map((r) => r.secureUrl)]);
    } catch (err) { toast.error(err.message || "Could not upload image(s)"); }
    finally { setImageUploading(false); e.target.value = ""; }
  }

  async function handleCreatePost(e) {
    e.preventDefault();
    if (!title.trim()) { toast.error(t("community.toasts.titleRequired")); return; }
    setSaving(true);
    try {
      const newPost = await createPost(community.slug, { title, body, url, imageUrls: postImageUrls });
      setPosts((p) => [{ ...newPost, upvoted: false }, ...p]);
      setTitle(""); setBody(""); setUrl(""); setPostImageUrls([]); setShowCreate(false);
    } catch { toast.error(t("community.toasts.couldNotCreatePost")); }
    finally { setSaving(false); }
  }

  const PAGE_SIZE = 20;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Breadcrumb header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-primaryAlt hover:text-primary transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          Community
        </button>
        <span className="text-primary/20 select-none">/</span>
        <span className="text-sm font-semibold text-primary truncate">{t(`communities.${community.slug}.name`, { defaultValue: community.name })}</span>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => onToggleFavorite(community.slug)}
            className={`ml-1 p-0.5 transition-opacity flex-shrink-0 ${community.favorited ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
            title={community.favorited ? "Remove from sidebar" : "Add to sidebar"}
          >
            {community.favorited
              ? <FaStar className="text-sm text-amber-400" />
              : <FiStar className="text-sm text-primary/40 hover:text-amber-400" />}
          </button>
        )}
        <div className="flex-1" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-6 max-w-4xl mx-auto px-4 py-4">
        <div className="flex-1 min-w-0 space-y-3">
          <SearchForm searchProps={searchProps} />
          {/* Prompt card / create form */}
          {isAuthenticated && !showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full text-left px-4 py-3 rounded-xl border border-base-200 border-l-4 border-l-green-600/50 bg-base-100 hover:border-l-green-600 hover:border-base-300 hover:bg-base-200/30 transition-colors flex items-center gap-3 group"
            >
              <div className="bg-green-600/15 group-hover:bg-green-600/25 rounded-full p-1.5 transition-colors shrink-0">
                <FiPlus size={13} className="text-green-600" />
              </div>
              <span className="text-sm text-primary/70 group-hover:text-primary transition-colors">{t("community.shareSomethingWith", { name: t(`communities.${community.slug}.name`, { defaultValue: community.name }) })}</span>
            </button>
          )}
          {showCreate && (
            <form onSubmit={handleCreatePost} noValidate className="bg-base-100 border border-base-200 rounded-xl p-4 space-y-2">
              <input type="text" placeholder={t("community.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300}
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 text-sm font-medium placeholder:text-base-content/40 focus:outline-none focus:border-primary/50" />
              <PostBodyEditor initialContent="" onChange={setBody} />
              <input type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 text-sm placeholder:text-base-content/40 focus:outline-none focus:border-primary/50" />
              <input type="file" accept="image/*" multiple ref={imageInputRef} className="hidden" onChange={handleImageSelect} />
              {postImageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {postImageUrls.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={cldTransformUrl(url, "w_100,h_70,c_fill,q_auto")} alt="" className="w-20 h-[54px] rounded-lg object-cover border border-base-200" />
                      <button type="button" onClick={() => setPostImageUrls((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 btn btn-circle btn-xs btn-error">
                        <FiX size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-base-200">
                <div>
                  {postImageUrls.length < 5 && (
                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={imageUploading} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-600/30 text-green-600/70 hover:border-green-600/60 hover:text-green-600 text-xs transition-colors">
                      {imageUploading ? <FiLoader size={13} className="animate-spin" /> : <FiImage size={13} />}
                      {imageUploading ? t("community.actions.uploading") : t("community.actions.addPhotos")}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setShowCreate(false); setTitle(""); setBody(""); setUrl(""); setPostImageUrls([]); }} className="text-base-content/40 hover:text-error transition-colors" title={t("actions.cancel")}>
                    <FiX size={18} />
                  </button>
                  <button type="submit" disabled={saving || imageUploading} className="text-base-content/40 hover:text-green-600 disabled:opacity-30 transition-colors" title={t("community.post.submit")}>
                    {saving ? <FiLoader size={18} className="animate-spin" /> : <FiMessageCircle size={18} />}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Sort */}
          <div className="flex items-center justify-between">
            <CommunityRulesButton className="lg:hidden" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="select select-bordered select-sm text-sm w-28"
            >
              <option value="new">{t("community.sort.new")}</option>
              <option value="top">{t("community.sort.top")}</option>
            </select>
          </div>

          {/* Posts */}
          {loading ? (
            <div className="flex justify-center py-12 opacity-40"><FiLoader size={22} className="animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 opacity-40 text-sm">{t("community.noPosts")}</div>
          ) : (
            <>
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    onSelect={onSelectPost}
                    onDeleted={(id) => setPosts((p) => p.filter((x) => x._id !== id))}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
              {total > page * PAGE_SIZE && (
                <div className="flex justify-center pt-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const next = page + 1; setPage(next);
                    getPosts(community.slug, { sort, page: next }).then((d) => setPosts((p) => [...p, ...d.posts]));
                  }}>{t("community.loadMore")}</button>
                </div>
              )}
            </>
          )}
        </div>
        <RecentActivity onSelectPost={onSelectRecentPost} />
        </div>
      </div>
    </div>
  );
}

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, postId, isReply = false, onDeleted, onUpdated, onReplyAdded, currentUserId, shareBaseUrl }) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const userLang = getUserLang();
  const showTranslateButton = !comment.lang || comment.lang !== userLang;
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
  const isOwner = currentUserId && comment.userId?._id === currentUserId;
  const { confirm, dialog } = useConfirm();

  async function handleUpvote() {
    if (!isAuthenticated) return;
    try {
      const res = await upvoteComment(comment._id);
      setUpvoted(res.upvoted); setUpvoteCount(res.upvoteCount);
    } catch { toast.error(t("community.toasts.couldNotUpvote")); }
  }

  async function handleFlag() {
    if (!isAuthenticated || flagged) return;
    const ok = await confirm("Flag this comment for review?", { confirmLabel: t("community.actions.flag"), subtext: "This will send the comment to our admins for review. Flag for inappropriate content, spam, or guideline violations." });
    if (!ok) return;
    try { await flagComment(comment._id); setFlagged(true); toast.success(t("community.toasts.flaggedForReview")); }
    catch { toast.error(t("community.toasts.couldNotFlagComment")); }
  }

  async function handleDelete() {
    const ok = await confirm(t("community.confirm.deleteComment"), { confirmLabel: t("actions.delete"), destructive: true });
    if (!ok) return;
    try { await deleteComment(comment._id); onDeleted?.(comment._id); }
    catch { toast.error(t("community.toasts.couldNotDeleteComment")); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editBody.trim()) return;
    setSaving(true);
    try { const u = await updateComment(comment._id, { body: editBody }); onUpdated?.(u); setEditing(false); }
    catch { toast.error(t("community.toasts.couldNotUpdate")); }
    finally { setSaving(false); }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSaving(true);
    try {
      const c = await createComment(postId, { body: replyBody, parentCommentId: comment._id });
      onReplyAdded?.(c); setReplyBody(""); setReplying(false);
    } catch { toast.error(t("community.toasts.couldNotReply")); }
    finally { setSaving(false); }
  }

  async function handleTranslate() {
    if (showTranslated) { setShowTranslated(false); return; }
    if (translatedBody) { setShowTranslated(true); return; }
    setTranslating(true);
    try {
      const targetLang = getUserLang();
      const { translated } = await translateText(comment.body, targetLang);
      setTranslatedBody(translated);
      setShowTranslated(true);
    } catch { toast.error(t("community.toasts.couldNotTranslate")); }
    finally { setTranslating(false); }
  }

  function copyLink() {
    const base = shareBaseUrl || `${window.location.origin}${window.location.pathname}`;
    navigator.clipboard.writeText(`${base}#comment-${comment._id}`).then(() => toast.success("Link copied"));
  }

  return (
    <>
    <div id={`comment-${comment._id}`} className={`flex gap-2 ${isReply ? "ml-7 mt-2" : ""}`}>
      {isReply && <FiCornerDownRight size={13} className="shrink-0 opacity-30 mt-1" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs opacity-50 mb-1 flex-wrap">
          <span className="font-medium opacity-80">{comment.userId?.trailname}</span>
          <span>{timeAgo(comment.createdAt)}</span>
          {comment.isEdited && <span>(edited)</span>}
        </div>
        {editing ? (
          <form onSubmit={handleEdit} className="space-y-2">
            <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} className="textarea textarea-bordered textarea-sm w-full resize-none p-3" autoFocus />
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="text-base-content/40 hover:text-green-600 transition-colors" title={t("actions.save")}>
                {saving ? <FiLoader size={14} className="animate-spin" /> : <FiCheck size={14} />}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-base-content/40 hover:text-error transition-colors" title={t("actions.cancel")}>
                <FiX size={14} />
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{showTranslated && translatedBody ? translatedBody : comment.body}</p>
        )}
        {!editing && (
          <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
            <button onClick={handleUpvote} className={`flex flex-col items-center gap-0.5 transition-colors ${upvoted ? "text-amber-400" : "text-amber-400/50 hover:text-amber-400"}`}>
              <FiArrowUp size={17} />
              <span className="text-xs font-bold tabular-nums leading-none">{upvoteCount}</span>
            </button>
            <div className="flex items-center gap-3 text-xs text-base-content/40">
            {isAuthenticated && !isReply && (
              <button onClick={() => setReplying((r) => !r)} className="hover:text-green-600 transition-colors" title={t("community.actions.reply")}><FiCornerDownRight size={14} /></button>
            )}
            <button onClick={copyLink} className="hover:text-green-600 transition-colors" title={t("community.actions.copyLink")}><FiSend size={14} /></button>
            {showTranslateButton && (
              <button onClick={handleTranslate} className="p-0 leading-none text-sky-400 hover:text-sky-500 transition-colors" disabled={translating}>
                {translating ? <FiLoader size={14} className="animate-spin" /> : showTranslated ? <FiX size={14} /> : <FiGlobe size={14} />}
              </button>
            )}
            {isAuthenticated && !isOwner && (
              <button onClick={handleFlag} className={`transition-colors ${flagged ? "text-error opacity-70" : "hover:text-error hover:opacity-100"}`} title={t("community.actions.flag")}>
                <FiFlag size={14} />
              </button>
            )}
            {isOwner && (
              <>
                <button onClick={() => setEditing(true)} className="hover:text-green-600 transition-colors" title={t("community.actions.edit")}><FiEdit2 size={14} /></button>
                <button onClick={handleDelete} className="hover:text-error hover:opacity-100 transition-colors" title={t("actions.delete")}><FiTrash2 size={14} /></button>
              </>
            )}
            </div>
          </div>
        )}
        {replying && (
          <form onSubmit={handleReply} className="mt-2 space-y-2">
            <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder={t("community.comments.replyPlaceholder")} rows={2} className="textarea textarea-bordered textarea-sm w-full resize-none p-3" autoFocus />
            <div className="flex gap-4">
              <button type="submit" disabled={saving} className="btn btn-primary btn-sm btn-square" title={t("community.actions.reply")}>
                {saving ? <FiLoader size={18} className="animate-spin" /> : <FiMessageCircle size={18} />}
              </button>
              <button type="button" onClick={() => setReplying(false)} className="btn btn-ghost btn-sm btn-square" title={t("actions.cancel")}>
                <FiX size={18} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    {dialog}
    </>
  );
}

// ─── Post Detail ──────────────────────────────────────────────────────────────

function PostDetail({ postId, community, onBack, currentUserId, onSelectPost }) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [upvoted, setUpvoted] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editImageUrls, setEditImageUrls] = useState([]);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const editImageInputRef = useRef(null);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState(null);
  const [translatedBody, setTranslatedBody] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatingPost, setTranslatingPost] = useState(false);
  const { confirm, dialog } = useConfirm();
  const userLang = getUserLang();

  const fetchAll = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getPost(postId), getComments(postId)]);
      setPost(p); setUpvoteCount(p.upvoteCount); setUpvoted(p.upvoted); setComments(c);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [postId]);

  useEffect(() => { setLoading(true); fetchAll(); }, [postId]);
  usePoll(fetchAll, 30000);

  useEffect(() => {
    if (post && community) saveRecentPost(post, community);
  }, [post?._id, community?.slug]);

  async function handleUpvote() {
    if (!isAuthenticated) return;
    try { const r = await upvotePost(postId); setUpvoted(r.upvoted); setUpvoteCount(r.upvoteCount); }
    catch { toast.error(t("community.toasts.couldNotUpvote")); }
  }

  async function handleFlag() {
    if (flagged) return;
    const ok = await confirm("Flag this post for review?", { confirmLabel: t("community.actions.flag"), subtext: "This will send the post to our admins for review. Flag for inappropriate content, spam, or guideline violations." });
    if (!ok) return;
    try { await flagPost(postId); setFlagged(true); toast.success(t("community.toasts.flaggedForReview")); }
    catch { toast.error(t("community.toasts.couldNotFlagPost")); }
  }

  async function handleDelete() {
    const ok = await confirm(t("community.confirm.deletePost"), { confirmLabel: t("actions.delete"), destructive: true });
    if (!ok) return;
    try { await deletePost(postId); onBack(); }
    catch { toast.error(t("community.toasts.couldNotDeletePost")); }
  }

  async function handleTranslatePost() {
    if (showTranslated) { setShowTranslated(false); return; }
    if (translatedTitle) { setShowTranslated(true); return; }
    setTranslatingPost(true);
    try {
      const targetLang = getUserLang();
      const plainBody = post.body ? post.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
      const calls = [translateText(post.title, targetLang)];
      if (plainBody) calls.push(translateText(plainBody, targetLang));
      const [titleResult, bodyResult] = await Promise.all(calls);
      setTranslatedTitle(titleResult.translated || post.title);
      setTranslatedBody(bodyResult?.translated || "");
      setShowTranslated(true);
    } catch { toast.error(t("community.toasts.couldNotTranslate")); }
    finally { setTranslatingPost(false); }
  }

  async function handleEditImageSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const slots = 5 - editImageUrls.length;
    const toUpload = files.slice(0, slots);
    if (!toUpload.length) { toast.error(t("community.toasts.maxImages")); return; }
    setEditImageUploading(true);
    try {
      const results = await Promise.all(toUpload.map((file) => uploadCommunityImage({ file })));
      setEditImageUrls((prev) => [...prev, ...results.map((r) => r.secureUrl)]);
    } catch (err) { toast.error(err.message || "Could not upload image(s)"); }
    finally { setEditImageUploading(false); e.target.value = ""; }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    try {
      const updated = await updatePost(postId, { title: editTitle, body: editBody, url: editUrl, imageUrls: editImageUrls });
      setPost(updated); setEditing(false);
    } catch { toast.error(t("community.toasts.couldNotUpdate")); }
  }

  async function handlePostComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const c = await createComment(postId, { body: newComment });
      setComments((prev) => [...prev, { ...c, replies: [] }]);
      setNewComment("");
    } catch { toast.error(t("community.toasts.couldNotPostComment")); }
    finally { setPosting(false); }
  }

  function handleTopDeleted(id) { setComments((p) => p.filter((c) => c._id !== id)); }
  function handleTopUpdated(u) { setComments((p) => p.map((c) => c._id === u._id ? { ...c, ...u, replies: c.replies } : c)); }
  function handleReplyAdded(r) { setComments((p) => p.map((c) => c._id === r.parentCommentId ? { ...c, replies: [...(c.replies || []), r] } : c)); }
  function handleReplyDeleted(pid, rid) { setComments((p) => p.map((c) => c._id === pid ? { ...c, replies: (c.replies || []).filter((r) => r._id !== rid) } : c)); }
  function handleReplyUpdated(pid, u) { setComments((p) => p.map((c) => c._id === pid ? { ...c, replies: (c.replies || []).map((r) => r._id === u._id ? u : r) } : c)); }

  const isOwner = currentUserId && post?.userId?._id === currentUserId;
  const publicPostUrl = community ? `${window.location.origin}/community/${community.slug}/${postId}` : null;

  function copyPostLink() {
    if (!publicPostUrl) return;
    navigator.clipboard.writeText(publicPostUrl).then(() => toast.success("Link copied"));
  }

  return (
    <>
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-primaryAlt hover:text-primary transition-colors">
          <FiArrowLeft className="w-4 h-4" />
          {community ? t(`communities.${community.slug}.name`, { defaultValue: community.name }) : "Community"}
        </button>
        {post && (
          <>
            <span className="text-primary/20 select-none">/</span>
            <span className="text-sm font-semibold text-primary truncate">{post.title}</span>
          </>
        )}
        <div className="flex-1" />
        {isAuthenticated && !isOwner && post && (
          <button onClick={handleFlag} title={flagged ? t("community.actions.flagged") : t("community.actions.flag")} className={`btn btn-ghost btn-xs btn-square transition-colors ${flagged ? "text-error opacity-70" : "opacity-40 hover:text-error hover:opacity-100"}`}>
            <FiFlag size={15} />
          </button>
        )}
        {publicPostUrl && (
          <button onClick={copyPostLink} title="Copy shareable link" className="btn btn-ghost btn-xs btn-square opacity-50 hover:opacity-100">
            <FiShare2 size={15} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24 opacity-40"><FiLoader size={24} className="animate-spin" /></div>
      ) : !post ? (
        <div className="text-center py-24 opacity-50 text-sm">{t("community.postNotFound")}</div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-6 max-w-4xl mx-auto px-4 py-6">
          <div className="flex-1 min-w-0 space-y-6">
            {/* Post */}
            {editing ? (
              <form onSubmit={handleEditSave} className="bg-base-100 border border-base-200 rounded-xl p-4 space-y-2">
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t("community.titlePlaceholder")}
                  className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 text-sm font-medium placeholder:text-base-content/40 focus:outline-none focus:border-primary/50" />
                <PostBodyEditor initialContent={editBody} onChange={setEditBody} placeholder="Body" />
                <input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://"
                  className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2.5 text-sm placeholder:text-base-content/40 focus:outline-none focus:border-primary/50" />
                <div>
                  <input type="file" accept="image/*" multiple ref={editImageInputRef} className="hidden" onChange={handleEditImageSelect} />
                  {editImageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editImageUrls.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={cldTransformUrl(url, "w_100,h_70,c_fill,q_auto")} alt="" className="w-20 h-[54px] rounded-lg object-cover border border-base-200" />
                          <button type="button" onClick={() => setEditImageUrls((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 btn btn-circle btn-xs btn-error">
                            <FiX size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-base-200">
                  <div>
                    {editImageUrls.length < 5 && (
                      <button type="button" onClick={() => editImageInputRef.current?.click()} disabled={editImageUploading} title={editImageUploading ? t("community.actions.uploading") : t("community.actions.addPhotos")} className="btn btn-ghost btn-xs btn-square opacity-40 hover:opacity-100">
                        {editImageUploading ? <FiLoader size={14} className="animate-spin" /> : <FiImage size={14} />}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm text-xs">{t("actions.cancel")}</button>
                    <button type="submit" disabled={editImageUploading} className="btn btn-primary btn-sm text-xs">{t("actions.save")}</button>
                  </div>
                </div>
              </form>
            ) : (
              <article className="bg-base-100 border border-base-200 border-l-[3px] border-l-primary/30 rounded-xl p-5 space-y-3">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5 min-w-[2rem]">
                    <button onClick={handleUpvote} className={`btn btn-ghost btn-xs btn-square ${upvoted ? "text-amber-400" : "opacity-40 hover:opacity-100"}`}>
                      <FiArrowUp size={18} />
                    </button>
                    <span className={`text-sm font-bold tabular-nums ${upvoted ? "text-amber-400" : "opacity-50"}`}>{upvoteCount}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold text-primary leading-snug">
                      {showTranslated && translatedTitle ? translatedTitle : post.title}
                      {post.isEdited && <span className="ml-2 text-xs opacity-40 font-normal">(edited)</span>}
                    </h1>
                    <div className="flex items-center gap-2 text-xs opacity-50 mt-1">
                      <span>{post.userId?.trailname}</span>
                      <span>&middot;</span>
                      <span>{timeAgo(post.createdAt)}</span>
                    </div>
                    {post.url && (
                      <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary mt-2 hover:underline">
                        <FiExternalLink size={13} />
                        {(() => { try { return new URL(post.url).hostname; } catch { return post.url; } })()}
                      </a>
                    )}
                    {post.body && (
                      showTranslated && translatedBody
                        ? <p className="text-sm mt-3 opacity-80 whitespace-pre-wrap">{translatedBody}</p>
                        : <div className="prose-notes text-sm mt-3 opacity-80" dangerouslySetInnerHTML={{ __html: post.body }} />
                    )}
                    {post.imageUrls?.length > 0 && (
                      <div className="mt-3">
                        <ImageCarousel images={post.imageUrls} heightClass="h-72" objectFit="cover" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-4 text-xs text-base-content/40">
                      {(!post.lang || post.lang !== userLang) && (
                        <button onClick={handleTranslatePost} disabled={translatingPost} className="p-0 leading-none text-sky-400 hover:text-sky-500 transition-colors">
                          {translatingPost ? <FiLoader size={14} className="animate-spin" /> : showTranslated ? <FiX size={14} /> : <FiGlobe size={14} />}
                        </button>
                      )}
                      {isAuthenticated && !isOwner && (
                        <button onClick={handleFlag} title={t("community.actions.flag")} className={`transition-colors ${flagged ? "text-error" : "hover:text-error"}`}>
                          <FiFlag size={14} />
                        </button>
                      )}
                      {isOwner && (
                        <>
                          <button onClick={() => { setEditTitle(post.title); setEditBody(post.body || ""); setEditUrl(post.url || ""); setEditImageUrls(post.imageUrls || []); setEditing(true); }} title={t("community.actions.edit")} className="hover:text-green-600 transition-colors">
                            <FiEdit2 size={16} />
                          </button>
                          <button onClick={handleDelete} title={t("actions.delete")} className="hover:text-error hover:opacity-100">
                            <FiTrash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* Comments */}
            <section className="space-y-4">
              <h3 className="font-semibold text-sm">{comments.length} comment{comments.length !== 1 ? "s" : ""}</h3>
              {isAuthenticated ? (
                <form onSubmit={handlePostComment} className="space-y-2">
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t("community.comments.commentPlaceholder")} rows={3} className="textarea textarea-bordered textarea-sm w-full resize-none p-3" />
                  <div className="flex justify-end">
                    <button type="submit" disabled={posting || !newComment.trim()} className="text-base-content/40 hover:text-green-600 disabled:opacity-30 transition-colors" title={t("community.actions.comment")}>
                      {posting ? <FiLoader size={18} className="animate-spin" /> : <FiMessageCircle size={18} />}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-sm opacity-50">{t("community.logIn")} to comment.</p>
              )}
              <div className="space-y-4 divide-y divide-base-200">
                {comments.map((c) => (
                  <div key={c._id} className="pt-4 first:pt-0">
                    <CommentItem comment={c} postId={postId} onDeleted={handleTopDeleted} onUpdated={handleTopUpdated} onReplyAdded={handleReplyAdded} currentUserId={currentUserId} shareBaseUrl={publicPostUrl} />
                    {(c.replies || []).map((r) => (
                      <CommentItem key={r._id} comment={r} postId={postId} isReply onDeleted={(id) => handleReplyDeleted(c._id, id)} onUpdated={(u) => handleReplyUpdated(c._id, u)} currentUserId={currentUserId} shareBaseUrl={publicPostUrl} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </div>
          <RecentActivity onSelectPost={onSelectPost} />
          </div>
        </div>
      )}
    </div>
    {dialog}
    </>
  );
}

// ─── Main CommunityView ───────────────────────────────────────────────────────

export default function CommunityView({ initialSlug, initialPostId }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const currentUserId = user?._id;

  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const [view, setView] = useState(initialPostId ? "post" : initialSlug ? "feed" : "landing");
  const [communities, setCommunities] = useState([]);
  const [community, setCommunity] = useState(null);
  const [postId, setPostId] = useState(initialPostId || null);

  // Tracks which (initialSlug, initialPostId) combo we've already acted on,
  // so that communities updates (e.g. starring) don't re-trigger navigation.
  const syncedKeyRef = useRef(null);

  useEffect(() => {
    getCommunities().then(setCommunities).catch(() => {});
  }, []);

  // Sync when sidebar selects a community or deep-link redirects here.
  // Uses syncedKeyRef to avoid re-navigating when communities updates for other reasons.
  useEffect(() => {
    const key = `${initialSlug}|${initialPostId}`;
    const alreadySynced = syncedKeyRef.current === key;

    if (!initialSlug && !initialPostId) {
      if (!alreadySynced) {
        syncedKeyRef.current = key;
        setView("landing"); setCommunity(null); setPostId(null);
      }
      return;
    }

    if (!communities.length || alreadySynced) return;

    if (initialPostId && initialSlug) {
      const found = communities.find((c) => c.slug === initialSlug);
      if (found) { syncedKeyRef.current = key; setCommunity(found); setPostId(initialPostId); setView("post"); }
    } else if (initialSlug) {
      const found = communities.find((c) => c.slug === initialSlug);
      if (found) { syncedKeyRef.current = key; setCommunity(found); setView("feed"); setPostId(null); }
    }
  }, [initialSlug, initialPostId, communities]);

  function selectCommunity(slug) {
    const found = communities.find((c) => c.slug === slug);
    if (found) { setCommunity(found); setView("feed"); setPostId(null); }
  }

  function selectPost(id, communitySlug) {
    setPostId(id);
    setView("post");
    if (communitySlug && communitySlug !== community?.slug) {
      const found = communities.find((c) => c.slug === communitySlug);
      if (found) setCommunity(found);
    }
  }

  function backToLanding() { setView("landing"); setCommunity(null); setPostId(null); }

  function backToFeed() { setView("feed"); setPostId(null); }

  function handleSearch(e) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setActiveQuery(q);
    setView("search");
  }

  function clearSearch() {
    setSearchInput("");
    setActiveQuery("");
    setView(community ? "feed" : "landing");
  }

  async function handleToggleFavorite(slug) {
    try {
      const { favorited } = await favoriteCommunity(slug);
      setCommunities((prev) =>
        prev.map((c) => c.slug === slug ? { ...c, favorited } : c)
      );
      if (community?.slug === slug) {
        setCommunity((prev) => prev ? { ...prev, favorited } : prev);
      }
      window.dispatchEvent(new CustomEvent("community:favorites-updated"));
    } catch {
      toast.error("Could not update favorites");
    }
  }

  const searchProps = {
    value: searchInput,
    onChange: (e) => setSearchInput(e.target.value),
    onSubmit: handleSearch,
    onClear: clearSearch,
  };

  if (view === "search") {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 flex items-center gap-3">
          <button onClick={clearSearch} className="flex items-center gap-1.5 text-sm text-primaryAlt hover:text-primary transition-colors">
            <FiArrowLeft className="w-4 h-4" />
            {community ? t(`communities.${community.slug}.name`, { defaultValue: community.name }) : "Community"}
          </button>
          <span className="text-primary/20 select-none">/</span>
          <span className="text-sm font-semibold text-primary truncate">"{activeQuery}"</span>
        </div>
        <SearchResults query={activeQuery} onSelectPost={selectPost} onSelectCommunity={selectCommunity} searchProps={searchProps} />
      </div>
    );
  }

  if (view === "feed" && community) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <CommunityFeed community={community} onBack={backToLanding} onSelectPost={selectPost} currentUserId={currentUserId} onToggleFavorite={handleToggleFavorite} onSelectRecentPost={selectPost} searchProps={searchProps} />
      </div>
    );
  }

  if (view === "post" && postId) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <PostDetail postId={postId} community={community} onBack={backToFeed} currentUserId={currentUserId} onSelectPost={selectPost} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <CommunityLanding communities={communities} onSelect={selectCommunity} onToggleFavorite={handleToggleFavorite} onSelectPost={selectPost} searchProps={searchProps} />
    </div>
  );
}
