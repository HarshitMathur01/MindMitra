import { Helmet } from "react-helmet-async";

/**
 * Per-route head management. The root <title>/<meta> tags in index.html
 * remain the global default; this component overrides them for the
 * current route only.
 *
 * Drop one <SEO ... /> at the top of any page that has a distinct
 * identity (different title, different share preview). Pages that don't
 * render <SEO> simply inherit the index.html defaults.
 */

const SITE_NAME = "MindMitra";
const SITE_URL = "https://mindmitra.co.in";
const DEFAULT_OG_IMAGE = "/og-default.png";

export interface SEOProps {
  /** Page-specific title. Will be rendered as `"<title> · MindMitra"`. */
  title: string;
  /** 1–2 sentence description; ≤160 chars works best for search snippets. */
  description: string;
  /** Path-only canonical (e.g. "/therapy"). Combined with SITE_URL. */
  path?: string;
  /** Override the default share image. Path-only or absolute URL. */
  ogImage?: string;
  /** Page type — defaults to "website". Use "article" for long-form. */
  ogType?: "website" | "article";
  /** Discourage indexing for stub / draft pages. */
  noIndex?: boolean;
}

const SEO = ({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  noIndex = false,
}: SEOProps) => {
  const fullTitle = `${title} · ${SITE_NAME}`;
  const canonical = path ? `${SITE_URL}${path}` : undefined;
  const imageUrl = ogImage.startsWith("http")
    ? ogImage
    : `${SITE_URL}${ogImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_NAME} — ${title}`} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};

export default SEO;
