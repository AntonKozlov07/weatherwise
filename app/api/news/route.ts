import { fetchNews } from "@/lib/news/client";
import { isNewsCategory } from "@/lib/news/types";
import { WeatherError, errorResponse } from "@/lib/weather/errors";

/**
 * GET /api/news?category=
 *
 * The 30 minute cache lives on the upstream fetch inside the client, so every
 * visitor to a tab within that window shares one vendor request. That is what
 * keeps seven tabs inside a free tier's daily allowance.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const category = new URL(request.url).searchParams.get("category") ?? "world";

    if (!isNewsCategory(category)) {
      throw new WeatherError("bad_request", "Unknown category.");
    }

    const articles = await fetchNews(category);

    return Response.json({ articles });
  } catch (error) {
    return errorResponse(error);
  }
}
