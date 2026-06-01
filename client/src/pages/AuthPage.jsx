import React from "react";
import { useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import SEO from "../components/SEO";

const HERO_SRCSET = `
  https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_768/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz 768w,
  https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1280/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz 1280w,
  https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1920/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz 1920w
`;
const HERO_FALLBACK =
  "https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,f_auto,q_auto:eco,dpr_auto,w_1280/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz";

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen">
      <SEO title={mode === "register" ? "Create Account" : "Sign In"} noindex />
      <img
        src={HERO_FALLBACK}
        srcSet={HERO_SRCSET}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      />
      <div className="absolute inset-0 bg-black/30" />
      <AuthModal
        isOpen={true}
        showLogo={true}
        defaultMode={mode}
        onClose={() => navigate("/")}
        onAuthed={() => navigate("/dashboard")}
      />
    </div>
  );
}
