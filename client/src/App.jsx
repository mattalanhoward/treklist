//src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import useAuth from "./hooks/useAuth";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import ChecklistView from "./pages/ChecklistView";
import PublicGearList from "./pages/PublicGearList";
import AffiliateDisclosurePage from "./pages/legal/AffiliateDisclosure";
import PrivacyPage from "./pages/legal/Privacy";
import CookiesPage from "./pages/legal/Cookies";
import TermsPage from "./pages/legal/Terms";
import ImprintPage from "./pages/legal/Imprint";
import CookieSettingsPage from "./pages/legal/CookieSettings";
import CookieBanner from "./components/CookieBanner";
import { initAnalytics } from "./utils/analytics";

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    children
  ) : (
    // send state that tells Landing to open the modal
    <Navigate to="/" state={{ auth: "login", reason: "protected" }} replace />
  );
}

export default function App() {
  // If user has already given analytics consent on a previous visit,
  // load analytics once when the app starts.
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
      <CookieBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/register" element={<Landing />} />
        <Route path="/auth/login" element={<Landing />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/legal/affiliate-disclosure"
          element={<AffiliateDisclosurePage />}
        />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/cookies" element={<CookiesPage />} />
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/imprint" element={<ImprintPage />} />
        <Route path="/legal/cookie-settings" element={<CookieSettingsPage />} />

        {/* “root” of all editable lists */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/:listId"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/:listId/checklist"
          element={
            <PrivateRoute>
              <ChecklistView />
            </PrivateRoute>
          }
        />
        {/* Public, read-only shared view */}
        <Route path="/share/:token" element={<PublicGearList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
