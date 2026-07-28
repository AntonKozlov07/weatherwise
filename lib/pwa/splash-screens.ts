/**
 * iOS splash screens.
 *
 * iOS only shows a launch image when a `apple-touch-startup-image` link matches
 * the device exactly, so every supported size needs its own entry. The PNGs are
 * produced by `pwa-asset-generator` (see CLAUDE.md) and named
 * `apple-splash-<pixelWidth>-<pixelHeight>.png`, which is derivable from the
 * CSS device size and its pixel ratio.
 */

type Device = {
  /** CSS pixels. */
  width: number;
  /** CSS pixels. */
  height: number;
  ratio: number;
};

const DEVICES: Device[] = [
  { width: 1032, height: 1376, ratio: 2 },
  { width: 1024, height: 1366, ratio: 2 },
  { width: 834, height: 1210, ratio: 2 },
  { width: 834, height: 1194, ratio: 2 },
  { width: 834, height: 1112, ratio: 2 },
  { width: 820, height: 1180, ratio: 2 },
  { width: 810, height: 1080, ratio: 2 },
  { width: 768, height: 1024, ratio: 2 },
  { width: 744, height: 1133, ratio: 2 },
  { width: 440, height: 956, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 428, height: 926, ratio: 3 },
  { width: 420, height: 912, ratio: 3 },
  { width: 414, height: 896, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 414, height: 736, ratio: 3 },
  { width: 402, height: 874, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 375, height: 812, ratio: 3 },
  { width: 375, height: 667, ratio: 2 },
  { width: 360, height: 780, ratio: 3 },
  { width: 320, height: 568, ratio: 2 },
];

export type AppleStartupImage = {
  url: string;
  media: string;
};

function media(device: Device, orientation: "portrait" | "landscape"): string {
  return [
    `(device-width: ${device.width}px)`,
    `(device-height: ${device.height}px)`,
    `(-webkit-device-pixel-ratio: ${device.ratio})`,
    `(orientation: ${orientation})`,
  ].join(" and ");
}

export const appleStartupImages: AppleStartupImage[] = DEVICES.flatMap(
  (device) => {
    const short = device.width * device.ratio;
    const long = device.height * device.ratio;

    return [
      {
        url: `/icons/apple-splash-${short}-${long}.png`,
        media: media(device, "portrait"),
      },
      {
        url: `/icons/apple-splash-${long}-${short}.png`,
        media: media(device, "landscape"),
      },
    ];
  },
);
