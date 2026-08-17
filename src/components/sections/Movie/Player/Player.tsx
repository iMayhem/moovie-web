"use client";

import { siteConfig } from "@/config/site";
import { cn } from "@/utils/helpers";
import { mutateMovieTitle } from "@/utils/movies";
import { pickBest, qualityRank, resolvePlayableUrl, type ScrapedLink } from "@/utils/scrape";
import { useScrapeLinks } from "@/hooks/useScrapeLinks";
import type { PlayersProps } from "@/types";
import { Card, Skeleton, Spinner } from "@heroui/react";
import { useDisclosure, useDocumentTitle, useIdle } from "@mantine/hooks";
import dynamic from "next/dynamic";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import useBreakpoints from "@/hooks/useBreakpoints";
import { SpacingClasses } from "@/utils/constants";

const MoviePlayerHeader = dynamic(() => import("./Header"));
const MoviePlayerSourceSelection = dynamic(() => import("./SourceSelection"));
const SourceList = dynamic(() => import("../../Player/SourceList"));
const NetflixPlayer = dynamic(() => import("../../Player/NetflixPlayer"));

interface MoviePlayerProps {
  movie: MovieDetails;
}

const MoviePlayer: React.FC<MoviePlayerProps> = ({ movie }) => {
  const title = mutateMovieTitle(movie);
  const year = movie.release_date?.slice(0, 4);
  const { links, status, error, abort } = useScrapeLinks({ title, year, type: "movie" });

  const idle = useIdle(3000);
  const { mobile } = useBreakpoints();
  const [opened, handlers] = useDisclosure(false);
  const [selectedSource, setSelectedSource] = useQueryState<number>(
    "src",
    parseAsInteger.withDefault(0),
  );
  const [src, setSrc] = useState<string>("");

  useDocumentTitle(`Play ${title} | ${siteConfig.name}`);

  const players: PlayersProps[] = useMemo(
    () =>
      links.map((l, i) => ({
        title: `${l.providerKey || "Provider"}${l.server ? ` [${l.server}]` : ""}${
          l.quality ? ` (${l.quality})` : ""
        }`,
        source: "https://placeholder.invalid",
        recommended: i === 0,
        fast: true,
        ads: false,
        resumable: false,
        ping: l.latencyMs,
        size: l.size,
      })),
    [links],
  );

  const selectSource = useCallback(
    (index: number) => {
      setSelectedSource(index);
      abort();
    },
    [setSelectedSource, abort],
  );

  const PLAYER: ScrapedLink | null = useMemo(
    () => links[selectedSource] || pickBest(links),
    [links, selectedSource],
  );

  useEffect(() => {
    let cancelled = false;
    if (!PLAYER) {
      setSrc("");
      return;
    }
    resolvePlayableUrl(PLAYER).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [PLAYER]);

  const loading = status === "idle" || status === "scraping";
  const noSources = status === "done" && links.length === 0;

  return (
    <>
      <div className={cn("relative", SpacingClasses.reset)}>
        <MoviePlayerHeader
          id={movie.id}
          movieName={title}
          onOpenSource={handlers.open}
          hidden={idle && !mobile}
        />
        <div className="mx-auto grid w-full max-w-[1700px] gap-4 p-2 md:grid-cols-[minmax(0,1fr)_400px] md:h-[calc(100dvh-68px)]">
        <Card shadow="md" radius="none" className="relative aspect-video w-full bg-black md:h-full">
          <Skeleton className="absolute h-full w-full" />
          {!loading && PLAYER && src && (
            <div className="absolute inset-0 z-10">
              <NetflixPlayer
                key={src}
                src={src}
                title={title}
                subtitle={year}
                quality={PLAYER.quality}
                autoPlay
              />
            </div>
          )}
          {loading && (
            <div className="absolute z-20 flex h-full w-full flex-col items-center justify-center gap-4 bg-black/60">
              <Spinner size="lg" color="warning" variant="simple" />
              <p className="text-sm text-white/80">Searching providers for {title}…</p>
            </div>
          )}
          {status === "error" && (
            <div className="absolute z-20 flex h-full w-full items-center justify-center bg-black/60">
              <p className="px-6 text-center text-sm text-danger-400">
                Scrape failed: {error || "unknown error"}
              </p>
            </div>
          )}
          {noSources && (
            <div className="absolute z-20 flex h-full w-full items-center justify-center bg-black/60">
              <p className="px-6 text-center text-sm text-white/80">
                No sources found for {title}. Try a different title or check back later.
              </p>
            </div>
          )}
        </Card>
          <SourceList
            links={links}
            selected={selectedSource}
            onSelect={selectSource}
            loading={loading}
          />
        </div>
      </div>

      <MoviePlayerSourceSelection
        opened={opened}
        onClose={handlers.close}
        players={players}
        selectedSource={selectedSource}
        setSelectedSource={selectSource}
      />
    </>
  );
};

MoviePlayer.displayName = "MoviePlayer";

export default MoviePlayer;