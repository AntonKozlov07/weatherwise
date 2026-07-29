export const NEWS_CATEGORIES = [
  "world",
  "sports",
  "business",
  "technology",
  "science",
  "health",
  "climate",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export function isNewsCategory(value: string): value is NewsCategory {
  return (NEWS_CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  world: "World",
  sports: "Sports",
  business: "Business",
  technology: "Technology",
  science: "Science",
  health: "Health",
  climate: "Climate",
};

export type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number | null;
  imageUrl: string | null;
};
