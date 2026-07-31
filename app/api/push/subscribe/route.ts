import {
  deleteSubscription,
  ensureSchema,
  saveSubscription,
  updateSubscriptionLocation,
} from "@/lib/push/subscriptions";

/**
 * Push subscription lifecycle.
 *
 *   POST   subscribe, or refresh an existing endpoint
 *   PATCH  follow a saved-location change without re-subscribing
 *   DELETE unsubscribe
 *
 * Endpoints are never logged or echoed back: an endpoint is a capability URL,
 * and anyone holding it can push to that device.
 */

type Body = {
  subscription?: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  endpoint?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

function badRequest(message: string): Response {
  return Response.json({ error: { message } }, { status: 400 });
}

function coordinate(value: unknown, limit: number): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null;
  return parsed;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Body;

    const endpoint = body.subscription?.endpoint;
    const p256dh = body.subscription?.keys?.p256dh;
    const auth = body.subscription?.keys?.auth;

    if (
      typeof endpoint !== "string" ||
      typeof p256dh !== "string" ||
      typeof auth !== "string"
    ) {
      return badRequest("Malformed push subscription.");
    }

    const latitude = coordinate(body.latitude, 90);
    const longitude = coordinate(body.longitude, 180);

    if (latitude === null || longitude === null) {
      return badRequest("Missing or out of range coordinates.");
    }

    await ensureSchema();
    await saveSubscription({ endpoint, p256dh, auth, latitude, longitude });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Push subscribe failed:", (error as Error).message);
    return Response.json(
      { error: { message: "Could not save the subscription." } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Body;
    const endpoint = body.endpoint;

    if (typeof endpoint !== "string") {
      return badRequest("Missing endpoint.");
    }

    const latitude = coordinate(body.latitude, 90);
    const longitude = coordinate(body.longitude, 180);

    if (latitude === null || longitude === null) {
      return badRequest("Missing or out of range coordinates.");
    }

    await ensureSchema();
    await updateSubscriptionLocation(endpoint, latitude, longitude);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Push location update failed:", (error as Error).message);
    return Response.json(
      { error: { message: "Could not update the subscription." } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Body;
    const endpoint = body.endpoint;

    if (typeof endpoint !== "string") {
      return badRequest("Missing endpoint.");
    }

    await ensureSchema();
    await deleteSubscription(endpoint);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Push unsubscribe failed:", (error as Error).message);
    return Response.json(
      { error: { message: "Could not remove the subscription." } },
      { status: 500 },
    );
  }
}
