type SocialHeadOptions = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  card?: "summary" | "summary_large_image";
  robots?: "index" | "noindex";
};

export function socialHead({
  title,
  description,
  ogTitle = title,
  ogDescription = description,
  card = "summary",
  robots,
}: SocialHeadOptions) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: card },
      ...(robots === undefined ? [] : [{ name: "robots", content: robots }]),
    ],
  };
}
