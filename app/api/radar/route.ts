import {
  RADAR_API,
  RADAR_REVALIDATE_SECONDS,
  parseRadarTimeline,
} from "@/lib/map/radar";
import { WeatherError, errorResponse, fetchVendor } from "@/lib/weather/errors";

/**
 * GET /api/radar
 *
 * RainViewer's frame index. Keyless, but routed through the server like every
 * other vendor call, which also means the frame list is cached once rather than
 * fetched per device.
 */
export async function GET(): Promise<Response> {
  try {
    const response = await fetchVendor(RADAR_API, "RainViewer", {
      next: { revalidate: RADAR_REVALIDATE_SECONDS },
    });

    const timeline = parseRadarTimeline(await response.json());

    if (!timeline) {
      throw new WeatherError("upstream", "Radar frames came back malformed.", {
        source: "RainViewer",
      });
    }

    return Response.json(timeline);
  } catch (error) {
    return errorResponse(error);
  }
}
