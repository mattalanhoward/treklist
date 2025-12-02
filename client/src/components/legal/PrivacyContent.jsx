// src/components/legal/PrivacyContent.jsx
import React from "react";

export default function PrivacyContent() {
  return (
    <div className="space-y-4 text-sm leading-6">
      <h1 className="text-2xl font-semibold mb-2">Privacy Policy</h1>

      <p>
        <strong>Last updated:</strong> December 1, 2025
      </p>
      <div className="mt-3 mb-4 rounded-md border border-base-300 bg-base-200/60 px-3 py-2 text-xs md:text-sm">
        <p className="font-semibold mb-1">In plain language:</p>
        <p>
          TrekList stores the information it needs to run your account and gear
          lists, keeps some logs to protect the service, and uses optional
          analytics (only with your consent) to understand how people use the
          app. If you choose, we may also email you occasional updates about new
          TrekList features and tips. We don&apos;t sell your personal data, and
          you can ask what we store or request deletion at any time. You can
          change your email preferences at any time in your account settings or
          by using unsubscribe links in emails.
        </p>
      </div>
      <p>
        This Privacy Policy explains how TrekList.co (&quot;
        <strong>TrekList</strong>&quot;, &quot;<strong>we</strong>&quot;, &quot;
        <strong>us</strong>&quot;) collects, uses, and protects your personal
        data when you use our website and services.
      </p>

      <p>
        TrekList.co is a gear list planning tool for hikers and travelers. We
        also operate the content brand <strong>Tall Joe Hikes</strong>.
      </p>

      <p>
        We are committed to handling your data carefully, transparently, and in
        line with applicable data protection laws such as the{" "}
        <strong>General Data Protection Regulation (GDPR)</strong>.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        1. Who is responsible for your data?
      </h2>

      <p>The data controller for TrekList.co is:</p>

      <p className="border-l-2 border-base-300 pl-3 text-sm">
        <strong>Tall Joe Hikes</strong>
        <br />
        Eenmanszaak registered in the Netherlands
        <br />
        KvK: <strong>98785419</strong>
        <br />
        Email:{" "}
        <a href="mailto:support@treklist.co" className="underline text-primary">
          support@treklist.co
        </a>
      </p>

      <p>
        If you have questions about this Privacy Policy or your data, you can
        contact us at <strong>support@treklist.co</strong>.
      </p>

      <p>
        We currently do not have a Data Protection Officer (DPO). If that
        changes, we will update this page.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        2. What personal data do we collect?
      </h2>

      <p>We collect and process the following categories of personal data:</p>

      <h3 className="font-semibold mt-3">
        2.1 Information you provide directly
      </h3>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Account details</strong> – email address, password (stored in
          hashed form only), and optional trail name or display name.
        </li>
        <li>
          <strong>Profile &amp; settings</strong> – preferred language and
          currency, weight units, theme, email communication preferences, and
          other app settings.
        </li>
        <li>
          <strong>Gear lists &amp; content</strong> – names of your lists and
          categories, items you add (e.g. item names, weights, prices, notes)
          and background images you select or upload.
        </li>
        <li>
          <strong>Support communication</strong> – messages you send us via
          email or contact forms, and information you provide when reporting a
          bug or asking for help.
        </li>
      </ul>

      <p>
        You can choose not to provide certain information, but this may limit
        your ability to use some features.
      </p>

      <h3 className="font-semibold mt-3">
        2.2 Information we collect automatically
      </h3>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Usage data</strong> – pages and screens you visit, buttons or
          features you interact with, timestamps of your visits.
        </li>
        <li>
          <strong>Device &amp; technical data</strong> – IP address, browser
          type and version, operating system, approximate location (country /
          region based on IP).
        </li>
        <li>
          <strong>Cookies</strong> – essential cookies required for login,
          security, and preferences, and optional analytics cookies (only if you
          consent). See our Cookie Policy for more details.
        </li>
      </ul>

      <h3 className="font-semibold mt-3">2.3 Information from third parties</h3>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Analytics providers</strong> (if enabled) – aggregated usage
          statistics.
        </li>
        <li>
          <strong>Payment providers</strong> (if we add paid plans in the
          future) – basic billing and transaction details, but not full card
          numbers.
        </li>
        <li>
          <strong>Affiliate networks</strong> – aggregated statistics on clicks
          and purchases from affiliate links (we do not receive your full
          payment details on other sites).
        </li>
      </ul>

      <p>We do not purchase or sell marketing lists.</p>

      <h2 className="text-lg font-semibold mt-6">
        3. For what purposes and on which legal bases do we process your data?
      </h2>

      <p>
        Under the GDPR, we must have a legal basis for each use of your personal
        data. We rely on the following:
      </p>

      <h3 className="font-semibold mt-3">
        3.1 Performance of a contract (Art. 6(1)(b) GDPR)
      </h3>

      <p>We use your data to:</p>

      <ul className="list-disc pl-6 space-y-1">
        <li>Create and manage your TrekList account.</li>
        <li>Let you log in securely.</li>
        <li>Store and display your gear lists, categories, and items.</li>
        <li>
          Provide features like packing checklists, printable views, and public
          share links.
        </li>
        <li>Provide support when you contact us.</li>
      </ul>

      <p>
        Without this data, TrekList would not function as a gear list planning
        tool.
      </p>

      <h3 className="font-semibold mt-3">
        3.2 Legitimate interests (Art. 6(1)(f) GDPR)
      </h3>

      <p>We use your data (in a way that respects your privacy) to:</p>

      <ul className="list-disc pl-6 space-y-1">
        <li>Keep TrekList secure and prevent abuse, spam, or attacks.</li>
        <li>Monitor capacity and performance to keep the service stable.</li>
        <li>Improve our product based on aggregated usage patterns.</li>
        <li>
          Communicate important service-related updates (e.g. downtime, security
          issues).
        </li>
      </ul>

      <p>
        Where we rely on legitimate interests, we balance our interests against
        your rights and expectations. You can object to such processing (see
        Section 8).
      </p>

      <h3 className="font-semibold mt-3">3.3 Consent (Art. 6(1)(a) GDPR)</h3>

      <p>We rely on your consent to:</p>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          Use <strong>analytics cookies</strong> or similar technologies that
          are not strictly necessary.
        </li>
        <li>
          Send optional product updates, feature tips, and occasional offers
          about TrekList, but only if you explicitly opt in (for example during
          registration or in your account settings).
        </li>
      </ul>

      <p>
        You can withdraw your consent at any time. For cookies and similar
        technologies, you can use the Cookie Settings page/tab. For optional
        emails, you can update your preferences in your account settings or use
        the unsubscribe links in those emails. Withdrawing consent does not
        affect the lawfulness of processing before withdrawal.
      </p>

      <h3 className="font-semibold mt-3">
        3.4 Legal obligation (Art. 6(1)(c) GDPR)
      </h3>

      <p>
        We may process and retain certain data where required to comply with
        tax, accounting, or other legal obligations, or to respond to lawful
        requests from authorities.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        4. How do we use cookies and similar technologies?
      </h2>

      <p>
        We use cookies and similar technologies to keep you logged in securely,
        remember your preferences, and understand how TrekList is used so we can
        improve it. Some cookies are essential for the service to function;
        others (analytics) are optional and only used with your consent.
      </p>

      <p>
        For more details, including how to manage your preferences, please see
        our <strong>Cookie Policy</strong> and the{" "}
        <strong>Cookie Settings</strong> page/tab.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        5. Who do we share your data with?
      </h2>

      <p>We do not sell your personal data.</p>

      <p>We may share your data with the following categories of recipients:</p>

      <h3 className="font-semibold mt-3">5.1 Service providers (processors)</h3>

      <p>We use trusted third-party providers to operate TrekList, such as:</p>

      <ul className="list-disc pl-6 space-y-1">
        <li>Hosting and infrastructure providers (cloud hosting, database).</li>
        <li>Analytics providers (if enabled).</li>
        <li>Email service providers (for transactional emails).</li>
        <li>Payment processors (if we introduce paid plans).</li>
      </ul>

      <p>
        These providers process personal data only on our instructions, under
        data processing agreements that include appropriate safeguards.
      </p>

      <h3 className="font-semibold mt-3">5.2 Legal and compliance</h3>

      <p>
        We may disclose your data if required by law, court order, or legal
        process, or if we reasonably believe it is necessary to:
      </p>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          Detect, prevent, or address fraud, security issues, or technical
          problems.
        </li>
        <li>Protect the rights, property, or safety of TrekList or others.</li>
      </ul>

      <h3 className="font-semibold mt-3">5.3 Business changes</h3>

      <p>
        If TrekList or Tall Joe Hikes is involved in a merger, acquisition, or
        other business transaction, your data may be transferred as part of that
        transaction. If this happens, we will inform you where appropriate.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        6. International data transfers
      </h2>

      <p>
        Some of our service providers may be located outside the European
        Economic Area (EEA), for example in the United States.
      </p>

      <p>
        Where data is transferred outside the EEA, we will ensure that an
        adequate level of protection is in place, for example by using{" "}
        <strong>Standard Contractual Clauses (SCCs)</strong> approved by the
        European Commission or relying on other appropriate safeguards, and take
        additional measures where necessary.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        7. How long do we keep your data?
      </h2>

      <p>
        We keep your personal data only for as long as necessary for the
        purposes described in this policy or to comply with legal obligations.
        In general:
      </p>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Account data</strong> – kept while your account is active. If
          you close your account, we will delete or anonymise your data within a
          reasonable period, unless we must keep it longer for legal reasons.
        </li>
        <li>
          <strong>Gear lists and content</strong> – kept while your account is
          active; deleted when your account and lists are deleted.
        </li>
        <li>
          <strong>Log and security data</strong> – kept for a limited period
          (typically up to 12 months) for security and troubleshooting.
        </li>
        <li>
          <strong>Support communication</strong> – kept for as long as necessary
          to handle your request and for a reasonable period afterwards (e.g. 12
          months), unless required longer for legal reasons.
        </li>
        <li>
          <strong>Billing and tax records</strong> – kept for the period
          required by Dutch tax law (usually <strong>7 years</strong>).
        </li>
      </ul>

      <p>
        Where we no longer need personal data, we will delete or irreversibly
        anonymise it.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        8. Your rights under the GDPR
      </h2>

      <p>
        As a data subject, you have the following rights, subject to certain
        conditions and exceptions:
      </p>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Right of access</strong> – to know whether we process your
          data and, if so, to receive a copy.
        </li>
        <li>
          <strong>Right to rectification</strong> – to correct inaccurate or
          incomplete data.
        </li>
        <li>
          <strong>Right to erasure</strong> (&quot;right to be forgotten&quot;)
          – to request deletion of your data, for example when it is no longer
          needed or if you withdraw consent.
        </li>
        <li>
          <strong>Right to restriction of processing</strong> – to ask us to
          limit how we use your data in certain cases.
        </li>
        <li>
          <strong>Right to data portability</strong> – to receive certain data
          in a structured, commonly used, machine-readable format and to
          transmit it to another controller.
        </li>
        <li>
          <strong>Right to object</strong> – to object to processing based on
          our legitimate interests or to direct marketing.
        </li>
        <li>
          <strong>Right to withdraw consent</strong> – at any time, where we
          rely on consent.
        </li>
      </ul>

      <p>
        To exercise these rights, contact us at{" "}
        <strong>support@treklist.co</strong>. We may need to verify your
        identity before responding.
      </p>

      <p>
        You also have the right to lodge a complaint with the Dutch supervisory
        authority:
      </p>

      <p className="border-l-2 border-base-300 pl-3 text-sm">
        <strong>Autoriteit Persoonsgegevens</strong>
        <br />
        Website:{" "}
        <a
          href="https://autoriteitpersoonsgegevens.nl/"
          target="_blank"
          rel="noreferrer"
          className="underline text-primary"
        >
          https://autoriteitpersoonsgegevens.nl/
        </a>
      </p>

      <p>
        We encourage you to contact us first so we can try to resolve your
        concerns.
      </p>

      <h2 className="text-lg font-semibold mt-6">9. Children</h2>

      <p>
        TrekList is not directed at children under <strong>16</strong> years of
        age. We do not knowingly collect personal data from children under 16.
        If you believe we have collected such data, please contact us at{" "}
        <strong>support@treklist.co</strong>, and we will take steps to delete
        it.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        10. Changes to this Privacy Policy
      </h2>

      <p>
        We may update this Privacy Policy from time to time, for example to
        reflect changes in our service or in applicable laws.
      </p>

      <p>
        When we make material changes, we will update the &quot;Last
        updated&quot; date at the top of this page and, where appropriate,
        notify you by email or through the app.
      </p>

      <p>Please review this page regularly to stay informed.</p>
    </div>
  );
}
