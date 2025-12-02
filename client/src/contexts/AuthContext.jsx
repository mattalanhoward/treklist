import React, { createContext, useState, useEffect } from "react";
import api from "../services/api";
import PropTypes from "prop-types";

export const AuthContext = createContext({
  user: null,
  login: async () => {},
  logout: async () => {},
  verifyEmail: async () => {},
  hydrateFromStorage: () => {},
  loading: false,
  isAuthenticated: false,
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
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
      api
        .get("/auth/me")
        .then(({ data }) => {
          setUser(data.user);
        })
        .catch((err) => {
          console.error("Failed to fetch current user:", err);
          setUser(null);
          setToken(null);
        });
    } else {
      setUser(null);
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

  // Logout user
  const logout = async () => {
    setLoading(true);
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
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
        loading,
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
