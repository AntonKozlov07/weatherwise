import { fetchOnThisDay } from "@/lib/history/archive";
import { compareToday, historyFacts, summarise } from "@/lib/history/on-this-day";
import { parseCoordinates } from "@/lib/weather/coordinates";
import { errorResponse } from "@/lib/weather/errors";

/**
 * GET /api/history?lat=&lon=&high=&low=
 *
 * This calendar day across the last twenty years, reduced to records and a
 * comparison against today.
 *
 * Today's high and low are optional query parameters rather than fetched here.
 * The client already holds the forecast, and refetching it server side to
 * compare against would be a second call for a number that is already on the
 * screen.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const { latitude, longitude } = parseCoordinates(params);

    const records = await fetchOnThisDay(latitude, longitude);
    const history = summarise(records);

    if (!history) {
      // No archive coverage is a legitimate answer for some coordinates, not a
      // fault. The client renders nothing rather than an error.
      return Response.json({ history: null, facts: [] });
    }

    const high = Number(params.get("high"));
    const low = Number(params.get("low"));

    const comparison =
      Number.isFinite(high) && Number.isFinite(low)
        ? compareToday(history, high, low)
        : null;

    return Response.json(
      { history, comparison, facts: historyFacts(history, comparison) },
      {
        headers: {
          // Changes once a day, and only by location.
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
