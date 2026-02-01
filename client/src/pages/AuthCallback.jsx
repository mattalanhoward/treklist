import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hydrateFromStorage } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get("accessToken");
    const authError = params.get("authError");

    if (authError) {
      // Handle error (redirect to login with error message)
      navigate("/?authError=" + authError, { replace: true });
      return;
    }

    if (accessToken) {
      // Store token and hydrate auth context
      localStorage.setItem("accessToken", accessToken);
      hydrateFromStorage();

      // Navigate to dashboard
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [location, navigate, hydrateFromStorage]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-primary">Completing sign-in...</div>
    </div>
  );
}
