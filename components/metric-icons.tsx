/**
 * The small line glyphs the Figma pairs with condition, humidity, and wind
 * rows. Drawn inline rather than pulled from Meteocons: at 16 to 18px the
 * Meteocons artwork is far too detailed to read, and these sit in text rows
 * where they need to match the surrounding stroke weight.
 */

type IconProps = { size?: number; className?: string };

function Glyph({
  size = 18,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4" />
    </Glyph>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.5 6.8 11a6 6 0 1 0 10.4 0L12 3.5Z" />
    </Glyph>
  );
}

export function WindIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 9h11a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 11.5h7" />
    </Glyph>
  );
}

export function RainChanceIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M7 16.5a4.5 4.5 0 0 1-.6-8.96 5.5 5.5 0 0 1 10.7-1.02A4 4 0 0 1 17.5 16.5H7Z" />
      <path d="M9 19.5 8 21m4-1.5-1 1.5m4-1.5-1 1.5" />
    </Glyph>
  );
}
