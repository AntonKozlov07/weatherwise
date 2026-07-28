/**
 * One error type for every vendor call, so route handlers map failures to
 * status codes in one place instead of each guessing.
 */

export type WeatherErrorKind =
  | "bad_request"
  | "not_found"
  | "config"
  | "upstream"
  | "timeout";

const STATUS: Record<WeatherErrorKind, number> = {
  bad_request: 400,
  not_found: 404,
  config: 500,
  upstream: 502,
  timeout: 504,
};

export class WeatherError extends Error {
  readonly kind: WeatherErrorKind;
  /** Which vendor the failure came from, when it came from one. */
  readonly source?: string;
  /** The vendor's HTTP status, when the failure was a bad response. */
  readonly httpStatus?: number;

  constructor(
    kind: WeatherErrorKind,
    message: string,
    options?: { source?: string; cause?: unknown; httpStatus?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = "WeatherError";
    this.kind = kind;
    this.source = options?.source;
    this.httpStatus = options?.httpStatus;
  }

  get status(): number {
    return STATUS[this.kind];
  }
}

export type ErrorBody = {
  error: { kind: WeatherErrorKind; message: string; source?: string };
};

/**
 * Messages here surface to the user behind a retry action, so they say what
 * happened in plain language and do not apologise.
 */
export function errorResponse(error: unknown): Response {
  const weatherError =
    error instanceof WeatherError
      ? error
      : new WeatherError("upstream", "Could not load weather data.", {
          cause: error,
        });

  const body: ErrorBody = {
    error: {
      kind: weatherError.kind,
      message: weatherError.message,
      ...(weatherError.source ? { source: weatherError.source } : {}),
    },
  };

  return Response.json(body, { status: weatherError.status });
}

/**
 * Vendor calls are aborted rather than left to hang. A phone on a bad
 * connection should get an error state it can retry, not an endless skeleton.
 */
export const REQUEST_TIMEOUT_MS = 8_000;

export async function fetchVendor(
  url: string,
  source: string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new WeatherError(
        response.status === 404 ? "not_found" : "upstream",
        `${source} returned ${response.status}.`,
        { source, httpStatus: response.status },
      );
    }

    return response;
  } catch (cause) {
    if (cause instanceof WeatherError) throw cause;

    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new WeatherError("timeout", `${source} did not respond in time.`, {
        source,
        cause,
      });
    }

    throw new WeatherError("upstream", `Could not reach ${source}.`, {
      source,
      cause,
    });
  }
}
