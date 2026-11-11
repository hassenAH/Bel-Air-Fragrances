import { JsonLd } from "@/components/json-ld";
import { getCatalog } from "@/lib/catalog";
import { BRAND, TAGLINE } from "@/lib/config";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

/** Tells search engines who the shop is (name, logo, social pages, phone) and that the site has one home. */
export async function SiteSchema() {
  const { content } = await getCatalog();
  const sameAs = [content.instagramUrl, content.facebookUrl, content.tiktokUrl, content.googleMapsUrl].filter(Boolean);

  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: BRAND,
          url: absoluteUrl("/"),
          logo: absoluteUrl("/apple-icon"),
          description: TAGLINE,
          ...(sameAs.length ? { sameAs } : {}),
          ...(content.phone ? { telephone: content.phone } : {}),
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: BRAND,
          url: absoluteUrl("/"),
          publisher: { "@id": `${SITE_URL}/#organization` },
        },
      ]}
    />
  );
}
