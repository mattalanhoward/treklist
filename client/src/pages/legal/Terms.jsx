import React from "react";
import LegalLayout from "../../components/LegalLayout";
import TermsContent from "../../components/legal/TermsContent";
import SEO from "../../components/SEO";

export default function TermsPage() {
  return (
    <LegalLayout>
      <SEO
        title="Terms of Use"
        description="TrekList Terms of Use. Read the terms and conditions for using our hiking gear list planning service."
        url="https://treklist.co/legal/terms"
      />
      <TermsContent />
    </LegalLayout>
  );
}
