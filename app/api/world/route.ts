import { fetchWorldWeather } from "@/lib/world/world";

/**
 * GET /api/world
 *
 * The world board. One upstream request covers all eight cities, and nothing in
 * the response is personal, so it is cached and shared rather than fetched per
 * device.
 *
 * Never fails: an empty array is a screen without a world board, which is a
 * smaller loss than an error state on a screen that has other things to show.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  const name = params.get("name") ?? "Your city";

  const home =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
      ? { name, latitude, longitude }
      : null;

  const cities = await fetchWorldWeather(home);

  return Response.json(
    { cities },
    {
      headers: {
        // Shared, so a CDN may hold it. Ten minutes matches the upstream
        // revalidation; the stale window covers a slow upstream without
        // showing anyone an empty board.
        // Varies by the home coordinates in the query, so this is per-URL
        // rather than one shared document.
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    },
  );
}
