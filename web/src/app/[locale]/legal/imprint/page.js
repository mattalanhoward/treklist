export const metadata = {
  title: 'Imprint',
  description: 'Legal notice and contact information for TrekList (Tall Joe Hikes).',
  alternates: { canonical: 'https://treklist.co/legal/imprint' },
  robots: { index: false },
};

export default function ImprintPage() {
  return (
    <div className="space-y-4 text-sm leading-6">
      <h1 className="text-2xl font-semibold mb-2">Imprint / Contact</h1>

      <p>TrekList.co is operated by a sole proprietorship (eenmanszaak) registered in the Netherlands.</p>

      <h2 className="text-lg font-semibold mt-4">Legal information</h2>

      <div className="border-l-2 border-gray-200 pl-3 space-y-1">
        <p><strong>Trade name:</strong> Tall Joe Hikes</p>
        <p><strong>Legal form:</strong> Eenmanszaak</p>
        <p><strong>Owner:</strong> Matthew Howard</p>
        <p><strong>Chamber of Commerce (KvK) number:</strong> 98785419</p>
      </div>

      <h2 className="text-lg font-semibold mt-4">Contact</h2>

      <div className="border-l-2 border-gray-200 pl-3 space-y-1">
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:support@treklist.co" className="underline text-blue-600">
            support@treklist.co
          </a>
        </p>
        <p>
          <strong>Website:</strong>{' '}
          <a
            href="https://treklist.co"
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-600"
          >
            https://treklist.co
          </a>
        </p>
      </div>

      <h2 className="text-lg font-semibold mt-4">Editorial responsibility / content owner</h2>

      <p>
        Unless otherwise indicated, editorial responsibility for the content on
        TrekList.co and associated pages lies with:
      </p>

      <p className="border-l-2 border-gray-200 pl-3 text-sm">
        Matthew Howard <br />
        Tall Joe Hikes
      </p>

      <h2 className="text-lg font-semibold mt-4">Disclaimer for external links</h2>

      <p>
        Our website may contain links to external websites operated by third
        parties. We have no control over the content of those websites and
        accept no responsibility or liability for their content, accuracy, or availability.
      </p>

      <p>
        When you follow an external link, you leave TrekList.co and are subject
        to the terms and privacy policies of the external website.
      </p>

      <h2 className="text-lg font-semibold mt-4">Copyright</h2>

      <p>
        The content and design of TrekList.co, including text, images, logos,
        and layout, are protected by copyright and other intellectual property
        laws. Unless explicitly stated otherwise, all rights are reserved by
        Tall Joe Hikes or the respective rights holders.
      </p>

      <p>
        You may not reproduce, distribute, or publicly display any substantial
        portion of the content without prior written permission, except where
        permitted by applicable law (for example, quotation rights).
      </p>

      <h2 className="text-lg font-semibold mt-4">Online dispute resolution (EU)</h2>

      <p>
        If you are a consumer in the European Union, you may also use the
        European Commission&apos;s Online Dispute Resolution (ODR) platform to
        resolve disputes:
      </p>

      <p className="border-l-2 border-gray-200 pl-3 text-sm">
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noreferrer"
          className="underline text-blue-600"
        >
          https://ec.europa.eu/consumers/odr
        </a>
      </p>

      <p>
        We prefer to resolve issues directly with you. If you have a complaint
        or concern, please contact us first at{' '}
        <a href="mailto:support@treklist.co" className="underline text-blue-600">
          support@treklist.co
        </a>
        .
      </p>
    </div>
  );
}
