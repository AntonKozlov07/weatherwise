import { parseCoordinates } from "@/lib/weather/coordinates";
import { errorResponse } from "@/lib/weather/errors";
import { getForecastBundle } from "@/lib/weather/forecast";

/**
 * GET /api/forecast?lat=&lon=
 *
 * The only weather endpoint the home screen calls. Keys stay on the server;
 * the browser never sees a vendor URL.
 *
 * Always metric. The units toggle formats what is already here rather than
 * refetching, so switching it is instant and works offline.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const coordinates = parseCoordinates(new URL(request.url).searchParams);
    const bundle = await getForecastBundle(coordinates);

    return Response.json(bundle, {
      headers: {
        // The client caches the payload itself for offline use, and the vendor
        // fetches upstream are already revalidated on their own schedule.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
