import { Helmet } from "react-helmet-async";
import PropTypes from "prop-types";

const DEFAULT_TITLE = "TrekList";
const DEFAULT_DESCRIPTION =
  "Plan your hiking and backpacking trips with TrekList. Create gear lists, track pack weight, and share your setup with fellow trekkers.";
const DEFAULT_IMAGE =
  "https://res.cloudinary.com/treklist/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/gear-list-hero-images/hero-hiker-cinque-torri_hpe3lz";
const SITE_URL = "https://treklist.co";

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = "website",
  noindex = false,
  children,
}) {
  const fullTitle = title ? `${title} - ${DEFAULT_TITLE}` : DEFAULT_TITLE;
  const canonicalUrl = url || SITE_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={DEFAULT_TITLE} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {children}
    </Helmet>
  );
}

SEO.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  image: PropTypes.string,
  url: PropTypes.string,
  type: PropTypes.string,
  noindex: PropTypes.bool,
  children: PropTypes.node,
};
