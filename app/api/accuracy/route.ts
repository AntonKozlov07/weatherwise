import { fetchAccuracyPairs } from "@/lib/history/accuracy-fetch";
import { accuracySummary, measureAccuracy } from "@/lib/history/accuracy";
import { parseCoordinates } from "@/lib/weather/coordinates";
import { errorResponse } from "@/lib/weather/errors";

/**
 * GET /api/accuracy?lat=&lon=
 *
 * How far the forecast has missed here over the last month, measured against
 * what actually happened.
 *
 * Returns null rather than an error where there is too little overlap to say
 * anything. A confident number from four days would be worse than no number.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { latitude, longitude } = parseCoordinates(
      new URL(request.url).searchParams,
    );

    const pairs = await fetchAccuracyPairs(latitude, longitude);
    const accuracy = measureAccuracy(pairs);

    return Response.json(
      {
        accuracy,
        summary: accuracy ? accuracySummary(accuracy) : [],
      },
      {
        headers: {
          // Both halves move once a day at most.
          "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
