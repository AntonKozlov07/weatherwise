"use client";

import { useEffect, useRef, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { haptic } from "@/lib/haptics";
import { ScrollHint } from "@/components/scroll-hint";
import { ErrorState } from "@/components/skeletons";
import {
  CATEGORY_LABELS,
  NEWS_CATEGORIES,
  type Article,
  type NewsCategory,
} from "@/lib/news/types";
import type { ErrorBody } from "@/lib/weather/errors";

type State =
  | { status: "loading" }
  // `fetchedAt` is captured when the articles land, so the relative times are
  // computed against a fixed moment rather than a ticking clock in render.
  | { status: "ready"; articles: Article[]; fetchedAt: number }
  | { status: "error"; message: string };

function relativeTime(published: number | null, now: number): string {
  if (published === null) return "";

  const minutes = Math.max(0, Math.round((now - published) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function ArticleSkeleton() {
  return (
    <li className="ww-article flex gap-4 py-4">
      <div className="flex-1">
        <div className="ww-shimmer h-4 w-full rounded-inner" />
        <div className="ww-shimmer mt-2 h-4 w-3/4 rounded-inner" />
        <div className="ww-shimmer mt-3 h-3 w-1/2 rounded-inner" />
      </div>
      <div className="ww-shimmer h-16 w-16 shrink-0 rounded-inner" />
    </li>
  );
}

export function Explore() {
  const [category, setCategory] = useState<NewsCategory>("world");
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Everything that sets state lives inside this async body. Calling setState
    // synchronously in an effect cascades an extra render on every tab change.
    void (async () => {
      setState({ status: "loading" });

      try {
        const response = await fetch(`/api/news?category=${category}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as ErrorBody | null;
          setState({
            status: "error",
            message: body?.error.message ?? "Could not load the news.",
          });
          return;
        }

        const body = (await response.json()) as { articles: Article[] };
        setState({
          status: "ready",
          articles: body.articles,
          fetchedAt: Date.now(),
        });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: "Could not load the news." });
        }
      }
    })();

    return () => controller.abort();
  }, [category, reloadKey]);

  return (
    <div className="screen relative">
      <header className="page-gutter pt-2">
        <h1 className="screen-title">Explore</h1>
      </header>

      <div
        role="tablist"
        aria-label="News categories"
        className="mt-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="page-gutter flex gap-5">
          {NEWS_CATEGORIES.map((candidate) => {
            const selected = candidate === category;

            return (
              <button
                key={candidate}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  haptic("select");
                  setCategory(candidate);
                }}
                /* Underline rather than a filled pill. Pills were the one
                   remaining piece of the old chrome; the home screen dropped
                   them when the segmented control went, and two different
                   selection idioms in one app reads as two apps. */
                className="ww-tab type-label shrink-0 px-1 pb-2 pt-1 text-2xs"
                data-selected={selected || undefined}
              >
                {CATEGORY_LABELS[candidate]}
              </button>
            );
          })}
        </div>
      </div>

      <ScrollHint
        targetRef={listRef}
        direction="vertical"
        label="Scroll for more"
      />

      <div ref={listRef} className="screen-scroll page-gutter relative py-5">
        {state.status === "loading" && (
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, index) => (
              <ArticleSkeleton key={index} />
            ))}
          </ul>
        )}

        {state.status === "error" && (
          <ErrorState
            message={state.message}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        )}

        {state.status === "ready" && state.articles.length === 0 && (
          <p className="py-8 text-base text-text-dim">
            Nothing published in this category right now.
          </p>
        )}

        {state.status === "ready" && state.articles.length > 0 && (
          <ul key={category} className="flex flex-col">
            {state.articles.map((article, index) => (
              <li
                key={article.id}
                className="ww-rise"
                style={{ "--rise-delay": `${Math.min(index, 8) * 40}ms` } as React.CSSProperties}
              >
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ww-article flex gap-4 py-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-snug">
                      {article.title}
                    </span>
                    {/* Source and age as a label, the same treatment the
                        timeline gives a row's time. */}
                    <span className="type-label mt-2 block truncate text-2xs">
                      {article.source}
                      {article.publishedAt !== null &&
                        ` · ${relativeTime(article.publishedAt, state.fetchedAt)}`}
                    </span>
                  </span>

                  {article.imageUrl && (
                    /* Remote thumbnails from arbitrary news domains, so the
                       Next image optimiser is bypassed rather than allow-listing
                       every publisher's CDN. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-inner object-cover"
                    />
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
