import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines (a plain script tag is the right element: it is data, not code). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
