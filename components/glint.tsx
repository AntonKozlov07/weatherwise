import type { Tilt } from "@/lib/hooks/use-tilt";

/**
 * The highlight that follows the phone.
 *
 * Two layers moving by different amounts, so it reads as depth rather than a
 * sticker sliding around. Travel is capped well short of the edges: a highlight
 * that reaches the border stops looking like light and starts looking like a
 * shape.
 *
 * Shared by the hero and the world cards. Every gradient surface in the app
 * should catch the light the same way, and a second copy would drift in the
 * numbers that make it read as light rather than as movement.
 */
export function Glint({
  tilt,
  /** Scaled down on small cards, where full travel reads as a wobble. */
  scale = 1,
}: {
  tilt: Tilt;
  scale?: number;
}) {
  return (
    <>
      <span
        className="ww-glint"
        aria-hidden="true"
        style={{
          transform: `translate3d(${tilt.x * 15 * scale}%, ${tilt.y * 15 * scale}%, 0)`,
        }}
      />
      <span
        className="ww-glint ww-glint-far"
        aria-hidden="true"
        style={{
          transform: `translate3d(${tilt.x * -8 * scale}%, ${tilt.y * -8 * scale}%, 0)`,
        }}
      />
    </>
  );
}
