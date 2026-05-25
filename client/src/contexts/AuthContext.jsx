import React, { createContext, useState, useEffect } from "react";
import api from "../services/api";
import PropTypes from "prop-types";
import { clearGlobalItemCache } from "../services/globalItemCache";

export const AuthContext = createContext({
  user: null,
  login: async () => {},
  logout: async () => {},
  verifyEmail: async () => {},
  hydrateFromStorage: () => {},
  updateUser: () => {},
  loading: false,
  userFetching: false,
  isAuthenticated: false,
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userFetching, setUserFetching] = useState(() => Boolean(localStorage.getItem("accessToken")));
  const isAuthenticated = Boolean(token);

  const hydrateFromStorage = () => {
    try {
      const stored = localStorage.getItem("accessToken");
      if (stored) {
        setToken(stored);
      }
    } catch {
      // ignore
    }
  };

  // Persist token and trigger API interceptor
  useEffect(() => {
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }, [token]);

  // Fetch current user when token changes
  useEffect(() => {
    if (token) {
      setUserFetching(true);
      api
        .get("/auth/me")
        .then(({ data }) => {
          setUser(data.user);
        })
        .catch((err) => {
          console.error("Failed to fetch current user:", err);
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            clearGlobalItemCache();
            setUser(null);
            setToken(null);
          }
          // Network errors / 5xx: keep the token so the user stays logged in
        })
        .finally(() => {
          setUserFetching(false);
        });
    } else {
      setUser(null);
      setUserFetching(false);
    }
  }, [token]);

  // Verify email (from registration flow)
  const verifyEmail = async (tok) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-email", { token: tok });
      setToken(data.accessToken);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Login user
  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setToken(data.accessToken);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Merge partial user fields into current user state (e.g., after trailname confirmation)
  const updateUser = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // Logout user
  const logout = async () => {
    setLoading(true);
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      clearGlobalItemCache();
      setUser(null);
      setToken(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        verifyEmail,
        hydrateFromStorage,
        updateUser,
        loading,
        userFetching,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
