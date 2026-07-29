import { identifyProvider } from "@/lib/news/client";
import { errorResponse } from "@/lib/weather/errors";

/**
 * GET /api/news/identify
 *
 * Development only. Answers which provider `NEWS_API_KEY` belongs to, which
 * CLAUDE.md requires be settled before trusting the Explore page. It reports
 * the status and the response's field names, never the key.
 *
 * Delete this route once the answer is recorded in the Decisions Log.
 */
export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  try {
    return Response.json(await identifyProvider());
  } catch (error) {
    return errorResponse(error);
  }
}
