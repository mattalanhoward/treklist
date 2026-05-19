import api from "./api";

// Communities
export async function getCommunities() {
  const { data } = await api.get("/community");
  return data;
}

export async function createCommunity(payload) {
  const { data } = await api.post("/community", payload);
  return data;
}

export async function updateCommunity(slug, payload) {
  const { data } = await api.put(`/community/${slug}`, payload);
  return data;
}

export async function favoriteCommunity(slug) {
  const { data } = await api.post(`/community/${slug}/favorite`);
  return data; // { favorited: boolean }
}

// Posts
export async function searchPosts(q) {
  const { data } = await api.get("/posts/search", { params: { q } });
  return data; // { posts }
}

export async function getPosts(slug, { sort = "new", page = 1 } = {}) {
  const { data } = await api.get(`/community/${slug}/posts`, { params: { sort, page } });
  return data;
}

export async function createPost(slug, payload) {
  const { data } = await api.post(`/community/${slug}/posts`, payload);
  return data;
}

export async function getPost(postId) {
  const { data } = await api.get(`/posts/${postId}`);
  return data;
}

export async function updatePost(postId, payload) {
  const { data } = await api.put(`/posts/${postId}`, payload);
  return data;
}

export async function deletePost(postId) {
  const { data } = await api.delete(`/posts/${postId}`);
  return data;
}

export async function upvotePost(postId) {
  const { data } = await api.post(`/posts/${postId}/upvote`);
  return data;
}

export async function flagPost(postId) {
  const { data } = await api.post(`/posts/${postId}/flag`);
  return data;
}

// Comments
export async function getComments(postId) {
  const { data } = await api.get(`/posts/${postId}/comments`);
  return data;
}

export async function createComment(postId, payload) {
  const { data } = await api.post(`/posts/${postId}/comments`, payload);
  return data;
}

export async function updateComment(commentId, payload) {
  const { data } = await api.put(`/comments/${commentId}`, payload);
  return data;
}

export async function deleteComment(commentId) {
  const { data } = await api.delete(`/comments/${commentId}`);
  return data;
}

export async function upvoteComment(commentId) {
  const { data } = await api.post(`/comments/${commentId}/upvote`);
  return data;
}

export async function flagComment(commentId) {
  const { data } = await api.post(`/comments/${commentId}/flag`);
  return data;
}

// Notifications
export async function getNotifications() {
  const { data } = await api.get("/notifications");
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.put("/notifications/read-all");
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await api.put(`/notifications/${id}/read`);
  return data;
}
