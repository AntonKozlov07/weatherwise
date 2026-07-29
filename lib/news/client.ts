import { WeatherError, fetchVendor } from "../weather/errors";
import type { Article, NewsCategory } from "./types";

/**
 * News client, written against thenewsapi.com.
 *
 * CLAUDE.md says to identify the provider from one test request before writing
 * this, because a 40 character alphanumeric key suggests thenewsapi.com rather
 * than newsapi.org. That request has not been made: `NEWS_API_KEY` is not set
 * in this environment, so the provider is an assumption, not a finding.
 *
 * `identifyProvider` below exists to close that out with one call. If it comes
 * back as newsapi.org, this whole module gets swapped rather than patched:
 * their free tier restricts CORS to localhost and forbids production use, so
 * the page would work in dev and break on deploy.
 */

const BASE_URL = "https://api.thenewsapi.com/v1/news/top";

/**
 * Free news tiers run 100 to 1,000 requests a day. Seven category tabs would
 * exhaust that in an afternoon, so each category is cached server side for 30
 * minutes. CLAUDE.md calls this non-negotiable.
 */
export const NEWS_REVALIDATE_SECONDS = 1_800;

/** The Climate tab is a keyword search; the rest map to provider categories. */
const CATEGORY_QUERY: Record<NewsCategory, { categories?: string; search?: string }> = {
  world: { categories: "general" },
  sports: { categories: "sports" },
  business: { categories: "business" },
  technology: { categories: "tech" },
  science: { categories: "science" },
  health: { categories: "health" },
  climate: { search: "climate OR emissions OR global warming OR extreme weather" },
};

type RawArticle = {
  uuid?: string;
  title?: string;
  url?: string;
  source?: string;
  published_at?: string;
  image_url?: string;
};

type RawResponse = { data?: RawArticle[] };

function apiKey(): string {
  const key = process.env.NEWS_API_KEY;

  if (!key) {
    throw new WeatherError("config", "News is not configured.", {
      source: "News",
    });
  }

  return key;
}

function toArticle(raw: RawArticle, index: number): Article | null {
  if (!raw.title || !raw.url) return null;

  const publishedAt = raw.published_at ? Date.parse(raw.published_at) : Number.NaN;

  return {
    id: raw.uuid ?? `${raw.url}#${index}`,
    title: raw.title,
    url: raw.url,
    source: raw.source ?? "Unknown source",
    publishedAt: Number.isNaN(publishedAt) ? null : publishedAt,
    imageUrl: raw.image_url ?? null,
  };
}

export async function fetchNews(category: NewsCategory): Promise<Article[]> {
  const params = new URLSearchParams({
    api_token: apiKey(),
    language: "en",
    limit: "12",
    ...CATEGORY_QUERY[category],
  });

  const response = await fetchVendor(`${BASE_URL}?${params.toString()}`, "News", {
    next: { revalidate: NEWS_REVALIDATE_SECONDS },
  });

  const payload: unknown = await response.json();

  if (typeof payload !== "object" || payload === null) {
    throw new WeatherError("upstream", "News came back malformed.", {
      source: "News",
    });
  }

  const articles = (payload as RawResponse).data;

  // A shape mismatch here almost certainly means the key belongs to a different
  // provider, so the message says that rather than blaming the network.
  if (!Array.isArray(articles)) {
    throw new WeatherError(
      "upstream",
      "News came back in an unexpected shape. The key may belong to a different provider.",
      { source: "News" },
    );
  }

  return articles
    .map(toArticle)
    .filter((article): article is Article => article !== null);
}

export type ProviderReport = {
  provider: "thenewsapi.com" | "unknown";
  status: number;
  sampleKeys: string[];
};

/**
 * One request, to settle which provider the key belongs to.
 *
 * Exposed through `/api/news/identify` in development only. Run it once the key
 * is set, then delete this and the route if the answer is thenewsapi.com.
 */
export async function identifyProvider(): Promise<ProviderReport> {
  const params = new URLSearchParams({
    api_token: apiKey(),
    language: "en",
    limit: "1",
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  const payload: unknown = await response.json().catch(() => ({}));

  const body = payload as Record<string, unknown>;
  const sample = Array.isArray(body.data)
    ? (body.data[0] as Record<string, unknown> | undefined)
    : undefined;

  return {
    provider: Array.isArray(body.data) && response.ok ? "thenewsapi.com" : "unknown",
    status: response.status,
    sampleKeys: sample ? Object.keys(sample) : Object.keys(body),
  };
}
