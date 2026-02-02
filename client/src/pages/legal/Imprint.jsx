import React from "react";
import LegalLayout from "../../components/LegalLayout";
import ImprintContent from "../../components/legal/ImprintContent";
import SEO from "../../components/SEO";

export default function ImprintPage() {
  return (
    <LegalLayout>
      <SEO
        title="Imprint & Contact"
        description="TrekList Imprint and Contact Information. Find our company details and how to get in touch with us."
        url="https://treklist.co/legal/imprint"
      />
      <ImprintContent />
    </LegalLayout>
  );
}
