import Image from "next/image";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <Image
        src="/brand/WeatherWise_Text_Logo.svg"
        alt="WeatherWise"
        width={232}
        height={19}
        priority
        unoptimized
      />
      <p className="type-label text-sm">Phase 1 · Shell</p>
    </main>
  );
}
