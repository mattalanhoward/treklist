//src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import useAuth from "./hooks/useAuth";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import ChecklistView from "./pages/ChecklistView";
import PublicGearList from "./pages/PublicGearList";
import CommunityLayout from "./pages/CommunityLayout";
import CommunityFeedView from "./pages/CommunityFeedView";
import PostDetailView from "./pages/PostDetailView";
import AffiliateDisclosurePage from "./pages/legal/AffiliateDisclosure";
import PrivacyPage from "./pages/legal/Privacy";
import CookiesPage from "./pages/legal/Cookies";
import TermsPage from "./pages/legal/Terms";
import ImprintPage from "./pages/legal/Imprint";
import CookieSettingsPage from "./pages/legal/CookieSettings";
import CookieBanner from "./components/CookieBanner";
import TrailnamePrompt from "./components/TrailnamePrompt";
import { initAnalytics } from "./utils/analytics";
import { isBannerRegion } from "./utils/region";
import { hasStoredConsent, saveConsent, loadConsent } from "./utils/cookieConsent";

function PrivateRoute({ children }) {
  const { isAuthenticated, user, userFetching } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (userFetching) return null;
  return (
    <>
      {children}
      {user && user.trailnameConfirmed === false && <TrailnamePrompt />}
    </>
  );
}

// Authenticated users landing on /community/* get sent to the Dashboard pane.
// Unauthenticated users see the public layout as-is.
function CommunityAuthRedirect({ children }) {
  const { isAuthenticated } = useAuth();
  const { slug, postId } = useParams();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace state={{ pane: "community", communitySlug: slug || null, communityPostId: postId || null }} />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Treat both `?embed=1` and iframe context as embedded.
  // We suppress cookie banner + analytics inside embeds.
  const isEmbedded = React.useMemo(() => {
    const p = new URLSearchParams(location.search);
    const isEmbedParam = p.get("embed") === "1";
    let isInIframe = false;
    try {
      isInIframe = typeof window !== "undefined" && window.self !== window.top;
    } catch {
      isInIframe = true;
    }
    return isEmbedParam || isInIframe;
  }, [location.search]);

  // Load analytics on app start.
  // For non-banner regions (US/CA) where no consent decision has been stored,
  // auto-grant analytics consent since cookie banners aren't legally required.
  useEffect(() => {
    if (isEmbedded) return;
    if (!hasStoredConsent() && !isBannerRegion()) {
      saveConsent({ ...loadConsent(), analytics: true });
    }
    initAnalytics();
  }, [isEmbedded]);

  return (
    <>
      {!isEmbedded && <CookieBanner />}
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/auth/register" element={<AuthPage mode="register" />} />
        <Route path="/auth/login" element={<AuthPage mode="login" />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
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

        {/* Community forum — publicly readable; authenticated users redirected to Dashboard pane */}
        <Route path="/community" element={<CommunityLayout />}>
          <Route index element={<CommunityAuthRedirect><CommunityFeedView /></CommunityAuthRedirect>} />
          <Route path=":slug" element={<CommunityAuthRedirect><CommunityFeedView /></CommunityAuthRedirect>} />
          <Route path=":slug/:postId" element={<CommunityAuthRedirect><PostDetailView /></CommunityAuthRedirect>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
