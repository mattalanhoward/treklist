import React, { useState, useEffect, useRef, useCallback } from "react";
import { FiBell } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/community";
import usePoll from "../hooks/usePoll";
import { formatDistanceToNow } from "date-fns";

const TYPE_LABELS = {
  reply_post: "replied to your post",
  reply_comment: "replied to your comment",
  upvote_post: "upvoted your post",
  upvote_comment: "upvoted your comment",
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  usePoll(fetchNotifications, 15000);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleOpen() {
    setOpen((o) => !o);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function handleNotificationClick(notification) {
    if (!notification.isRead) {
      await markNotificationRead(notification._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    // Navigate to the post (with comment anchor if available)
    if (notification.postId) {
      const community = notification.postId.communityId;
      const postPath = `/community/${community}/${notification.postId._id}`;
      const anchor = notification.commentId ? `#comment-${notification.commentId}` : "";
      navigate(postPath + anchor);
    }
    setOpen(false);
  }

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        className="relative p-1.5 rounded-full hover:bg-base-200 transition-colors text-primaryAlt hover:text-primary"
        onClick={handleOpen}
        aria-label="Notifications"
      >
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-error text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1 leading-none pointer-events-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <div
        aria-hidden={!open}
        className={`absolute right-0 top-full mt-2 w-80 bg-base-100 border border-base-200 rounded-xl shadow-xl z-50 overflow-hidden origin-top-right transition-all duration-150 ease-out ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm opacity-50 text-center py-8">No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left px-4 py-3 hover:bg-base-200 transition-colors border-b border-base-200 last:border-0 ${
                  !n.isRead ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className={!n.isRead ? "" : "ml-4"}>
                    <p className="text-xs leading-snug">
                      <span className="font-semibold">{n.fromUserId?.trailname || "Someone"}</span>{" "}
                      {TYPE_LABELS[n.type] || "interacted with your content"}
                      {n.postId?.title && (
                        <span className="opacity-60"> — {n.postId.title}</span>
                      )}
                    </p>
                    <p className="text-xs opacity-40 mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
