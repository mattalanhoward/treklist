import React from "react";
import LegalLayout from "../../components/LegalLayout";
import CookieSettingsContent from "../../components/legal/CookieSettingsContent";
import SEO from "../../components/SEO";

export default function CookieSettingsPage() {
  return (
    <LegalLayout>
      <SEO title="Cookie Settings" noindex />
      <CookieSettingsContent />
    </LegalLayout>
  );
}
