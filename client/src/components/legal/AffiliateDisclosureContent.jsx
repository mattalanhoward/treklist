// src/components/legal/AffiliateDisclosureContent.jsx
import React from "react";

export default function AffiliateDisclosureContent() {
  return (
    <div className="space-y-4 text-sm leading-6">
      <h1 className="text-2xl font-semibold mb-2">Affiliate Disclosure</h1>

      <p>
        <strong>Last updated:</strong> December 1, 2025
      </p>
      <div className="mt-3 mb-4 rounded-md border border-base-300 bg-base-200/60 px-3 py-2 text-xs md:text-sm">
        <p className="font-semibold mb-1">In plain language:</p>
        <p>
          Some gear links on TrekList.co and TallJoeHikes.com are affiliate
          links. If you click one and make a purchase, we may earn a small
          commission at no extra cost to you. We only recommend gear we&apos;d
          genuinely consider for our own trips, and affiliate status
          doesn&apos;t change our opinion of a product.
        </p>
      </div>

      <p>
        TrekList.co and Tall Joe Hikes are supported in part through{" "}
        <strong>affiliate links</strong>.
      </p>

      <p>
        This means that if you click a product link on TrekList.co or
        TallJoeHikes.com and then make a purchase on the retailer&apos;s
        website, we may receive a small commission. This comes at{" "}
        <strong>no additional cost to you</strong>.
      </p>

      <p>
        Affiliate income helps us keep TrekList running and continue creating
        helpful content, guides, and gear lists.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        1. How affiliate links work
      </h2>

      <p>
        When we link to a product or retailer, the link may contain a tracking
        parameter or be generated via an affiliate network. If you make a
        purchase after clicking one of these links, the retailer or affiliate
        network can attribute the sale to our website and pay us a commission.
      </p>

      <p>
        Any tracking or cookies related to this are handled by the{" "}
        <strong>retailer or affiliate network</strong>, not directly by
        TrekList. Please refer to their privacy and cookie policies for details
        on how they process your data.
      </p>

      <p>We may work with affiliate programs such as:</p>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          Retailers&apos; own affiliate programs (for example outdoor gear
          shops).
        </li>
        <li>
          Affiliate networks such as{" "}
          <span className="italic">Awin, Impact, and Avantlink</span>.
        </li>
        <li>
          Amazon Associates (for links to Amazon products), where applicable and
          available.
        </li>
      </ul>

      <p>
        We update our partner list from time to time as our relationships
        change.
      </p>

      <h2 className="text-lg font-semibold mt-6">
        2. Our approach to recommendations
      </h2>

      <p>We take your trust seriously. Our approach is:</p>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          We only recommend products that we <strong>use ourselves</strong>,
          have used in the past, or would genuinely consider using on our own
          trips.
        </li>
        <li>
          Affiliate status <strong>does not change</strong> our opinion of a
          product. If something has downsides, we say so.
        </li>
        <li>
          We do not accept payment in exchange for guaranteed positive reviews.
        </li>
        <li>
          Where possible, we try to link to multiple retailers so you can choose
          the option that works best for you.
        </li>
      </ul>

      <p>
        That said, gear is personal. What works well for us might not be perfect
        for you. Always consider your own experience, comfort, and budget.
      </p>

      <h2 className="text-lg font-semibold mt-6">3. No extra cost to you</h2>

      <p>
        If you make a purchase via one of our affiliate links, the price you pay
        is the same as if you had gone to the retailer directly. The commission
        is paid out of the retailer&apos;s margin, not by you.
      </p>

      <p>
        By using our affiliate links, you help support the ongoing development
        of TrekList and our hiking content, which allows us to keep TrekList
        free or low-cost.
      </p>

      <h2 className="text-lg font-semibold mt-6">4. Legal notices (FTC, EU)</h2>

      <p>
        We aim to comply with relevant advertising and transparency guidelines,
        including:
      </p>

      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>US Federal Trade Commission (FTC)</strong> guidelines on
          endorsements and testimonials.
        </li>
        <li>
          <strong>EU and Dutch guidelines</strong> on advertising and
          transparency.
        </li>
      </ul>

      <p>
        This is why you may see phrases such as{" "}
        <strong>&quot;This page contains affiliate links&quot;</strong> or
        similar text near links or on pages that contain affiliate links.
      </p>

      <p>
        Where required by specific programs (for example Amazon Associates), we
        include their mandated wording. For example, where applicable:
      </p>

      <blockquote className="border-l-2 border-base-300 pl-3 text-sm italic">
        &quot;As an Amazon Associate I earn from qualifying purchases.&quot;
      </blockquote>

      <h2 className="text-lg font-semibold mt-6">5. Questions</h2>

      <p>
        If you have any questions about how affiliate links work on TrekList.co
        or TallJoeHikes.com, feel free to contact us at:
      </p>

      <p className="border-l-2 border-base-300 pl-3 text-sm">
        <strong>Email:</strong>{" "}
        <a href="mailto:support@treklist.co" className="underline text-primary">
          support@treklist.co
        </a>
      </p>
    </div>
  );
}
