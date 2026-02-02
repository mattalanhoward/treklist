import React from "react";
import LegalLayout from "../../components/LegalLayout";
import PrivacyContent from "../../components/legal/PrivacyContent";
import SEO from "../../components/SEO";

export default function PrivacyPage() {
  return (
    <LegalLayout>
      <SEO
        title="Privacy Policy"
        description="TrekList Privacy Policy. Learn how we collect, use, and protect your personal data when you use our hiking gear list planning service."
        url="https://treklist.co/legal/privacy"
      />
      <PrivacyContent />
    </LegalLayout>
  );
}
