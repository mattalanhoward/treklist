import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import api from "../services/api";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hydrateFromStorage } = useAuth();
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;

    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const authError = params.get("authError");

    if (authError) {
      navigate("/?authError=" + authError, { replace: true });
      return;
    }

    if (!code) {
      navigate("/", { replace: true });
      return;
    }

    exchangedRef.current = true;

    api
      .post("/auth/exchange", { code })
      .then(({ data }) => {
        localStorage.setItem("accessToken", data.accessToken);
        hydrateFromStorage();
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        navigate("/?authError=token_exchange_failed", { replace: true });
      });
  }, [location, navigate, hydrateFromStorage]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-primary">Completing sign-in...</div>
    </div>
  );
}
