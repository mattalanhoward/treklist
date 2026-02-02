import React from "react";
import LegalLayout from "../../components/LegalLayout";
import CookiesContent from "../../components/legal/CookiesContent";
import SEO from "../../components/SEO";

export default function CookiesPage() {
  return (
    <LegalLayout>
      <SEO
        title="Cookie Policy"
        description="TrekList Cookie Policy. Learn about the cookies we use and how they help improve your experience on our hiking gear list planning service."
        url="https://treklist.co/legal/cookies"
      />
      <CookiesContent />
    </LegalLayout>
  );
}
