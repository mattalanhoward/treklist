import React from "react";
import LegalLayout from "../../components/LegalLayout";
import AffiliateDisclosureContent from "../../components/legal/AffiliateDisclosureContent";
import SEO from "../../components/SEO";

export default function AffiliateDisclosurePage() {
  return (
    <LegalLayout>
      <SEO
        title="Affiliate Disclosure"
        description="TrekList Affiliate Disclosure. Learn how we use affiliate links and how purchases through our links support the service."
        url="https://treklist.co/legal/affiliate-disclosure"
      />
      <AffiliateDisclosureContent />
    </LegalLayout>
  );
}
