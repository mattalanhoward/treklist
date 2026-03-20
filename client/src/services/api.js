// client/src/services/api.js
import axios from "axios";

/**
 * Base URL for your API; example: http://localhost:3000
 * Ensure VITE_API_URL is set in your client .env
 */
// Ensure base ends with /api so client calls can use paths like "/auth/login"
const BASE_HOST = (import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, ""); // strip trailing slash
const BASE_URL = `${BASE_HOST}/api`;
if (!BASE_HOST && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn("VITE_API_URL is not set; requests will likely fail.");
}

// ---- Token helpers ----
export function getAccessToken() {
  try {
    return localStorage.getItem("accessToken") || "";
  } catch {
    return "";
  }
}
export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem("accessToken", token);
    else localStorage.removeItem("accessToken");
  } catch {
    /* ignore */
  }
}

// ---- Axios instances ----
// main API instance (used by the app)
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send/receive refreshToken cookie
});

// auth-only instance that won't recurse through our response interceptor
const authApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Attach Authorization header if we have a token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- 401 handling with single-flight refresh ----
let refreshPromise = null;

async function refreshAccessTokenOnce() {
  if (!refreshPromise) {
    refreshPromise = authApi
      .post("/auth/refresh")
      .then((res) => {
        const { accessToken } = res.data || {};
        if (!accessToken) {
          throw new Error("No accessToken in refresh response");
        }
        setAccessToken(accessToken);
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Exported helper so specific pages can ask for a silent refresh
export async function refreshAccessToken() {
  return refreshAccessTokenOnce();
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error?.response?.status;

    if (status === 401) {
      // 1) Respect per-request opt-out so pages can handle 401 themselves
      if (original.__noGlobal401) {
        return Promise.reject(error);
      }

      // If no response or not a 401, just bubble it up
      // if (!status || status !== 401) {
      //   return Promise.reject(error);
      // }

      // Don't try to refresh if the original request was the refresh endpoint
      const url = (original?.url || "").toString();
      if (url.endsWith("/auth/refresh")) {
        // refresh failed → treat as logged-out
        setAccessToken("");
        return Promise.reject(error);
      }

      // If we've already retried this request once, don't loop forever
      if (original && original._retry) {
        setAccessToken("");
        return Promise.reject(error);
      }

      try {
        const newToken = await refreshAccessTokenOnce();
        // retry original request with the new token
        if (original) {
          original._retry = true;
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
        return Promise.reject(error);
      } catch (e) {
        // Refresh failed → clear token; caller (AuthContext/route guard) can redirect to login
        setAccessToken("");
        return Promise.reject(e);
      }
    }
    // non-401 errors: bubble up
    return Promise.reject(error);
  }
);

export default api;
