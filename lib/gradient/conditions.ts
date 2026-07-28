/**
 * WeatherAPI condition codes to the seven gradient buckets, in one table.
 *
 * Codes not listed fall back to `clear`, which leaves the time of day showing
 * undiluted. That is the right failure: a wrong tint reads as a bug, a missing
 * tint reads as a clear day.
 */

export type ConditionBucket =
  | "clear"
  | "partlyCloudy"
  | "overcast"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "fog";

const BUCKETS: Record<ConditionBucket, readonly number[]> = {
  clear: [1000],
  partlyCloudy: [1003],
  overcast: [1006, 1009],
  fog: [1030, 1135, 1147],
  rain: [
    1063, 1072, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195,
    1198, 1201, 1240, 1243, 1246,
  ],
  snow: [
    1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225,
    1237, 1249, 1252, 1255, 1258, 1261, 1264,
  ],
  // Snow-with-thunder codes sit here rather than under snow: the storm is what
  // the sky actually looks like.
  thunderstorm: [1087, 1273, 1276, 1279, 1282],
};

const BY_CODE = new Map<number, ConditionBucket>(
  Object.entries(BUCKETS).flatMap(([bucket, codes]) =>
    codes.map((code) => [code, bucket as ConditionBucket] as const),
  ),
);

export function conditionBucket(code: number): ConditionBucket {
  return BY_CODE.get(code) ?? "clear";
}

/** Exposed for the tuning page, which lists every bucket. */
export const CONDITION_BUCKETS = Object.keys(BUCKETS) as ConditionBucket[];

/** A representative WeatherAPI code per bucket, for the tuning page picker. */
export const SAMPLE_CODE: Record<ConditionBucket, number> = {
  clear: 1000,
  partlyCloudy: 1003,
  overcast: 1009,
  rain: 1189,
  snow: 1219,
  thunderstorm: 1276,
  fog: 1135,
};
