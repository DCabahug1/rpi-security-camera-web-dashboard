"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Recording } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Fade only — no translate on large wrappers (transform + layout was shifting card size on load). */
const enter =
  "animate-in fade-in duration-700 ease-out fill-mode-forwards motion-reduce:animate-none motion-reduce:opacity-100";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Realtime and PostgREST may represent bigint `id` as string; normalize for comparisons. */
function normalizeRecording(row: Record<string, unknown>): Recording {
  return {
    id: Number(row.id),
    video_url:
      row.video_url != null && row.video_url !== ""
        ? String(row.video_url)
        : null,
    created_at: String(row.created_at),
  };
}

function sortNewestFirst(rows: Recording[]): Recording[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function RecordingVideo({ src }: { src: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setPhase("loading");
  }, [src]);

  return (
    <div
      className="relative aspect-video w-full min-h-0 min-w-0 overflow-hidden rounded-lg border bg-black"
      aria-busy={phase === "loading"}
    >
      {phase === "loading" ? (
        <Skeleton
          className="absolute inset-0 z-10 size-full rounded-lg"
          aria-hidden
        />
      ) : null}
      {phase === "error" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-muted px-4 text-center text-sm text-muted-foreground">
          Could not load video
        </div>
      ) : (
        <video
          className={cn(
            "h-full w-full object-contain transition-opacity duration-500 ease-out motion-reduce:transition-none",
            phase === "ready"
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          )}
          src={src}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setPhase("ready")}
          onError={() => setPhase("error")}
        />
      )}
    </div>
  );
}

type RecordingsListProps = {
  initialRecordings: Recording[];
  initialTotal: number;
  page: number;
  perPage: number;
};

const POLL_MS = 15_000;

export function RecordingsList({
  initialRecordings,
  initialTotal,
  page,
  perPage,
}: RecordingsListProps) {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>(() =>
    sortNewestFirst(initialRecordings)
  );
  const [total, setTotal] = useState(initialTotal);

  const pageRef = useRef(page);
  const perPageRef = useRef(perPage);
  pageRef.current = page;
  perPageRef.current = perPage;

  useEffect(() => {
    setRecordings(sortNewestFirst(initialRecordings));
    setTotal(initialTotal);
  }, [initialRecordings, initialTotal, page]);

  useEffect(() => {
    const supabase = createClient();

    async function refreshFromDb() {
      const p = pageRef.current;
      const pp = perPageRef.current;

      const { data, error, count } = await supabase
        .from("recordings")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((p - 1) * pp, p * pp - 1);

      if (error) return;

      const rowCount = count ?? 0;
      const lastPage = Math.max(1, Math.ceil(rowCount / pp));

      if (rowCount > 0 && p > lastPage) {
        router.replace(`/?page=${lastPage}`);
        return;
      }

      setTotal(rowCount);
      if (!data) {
        setRecordings([]);
        return;
      }
      setRecordings(
        sortNewestFirst(
          (data as Record<string, unknown>[]).map(normalizeRecording)
        )
      );
    }

    const channel = supabase
      .channel("recordings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recordings" },
        () => {
          void refreshFromDb();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      void refreshFromDb();
    }, POLL_MS);

    const onFocus = () => {
      void refreshFromDb();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  if (total === 0) {
    return (
      <>
        <header className={cn("mb-8", enter)}>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Recordings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Clips from your camera appear here after they are uploaded.
          </p>
        </header>
        <Card
          className={cn(
            enter,
            "delay-150 motion-reduce:delay-0"
          )}
        >
          <CardContent className="py-14 text-center text-muted-foreground">
            No recordings yet.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <header className={cn("mb-8", enter)}>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Recordings
        </h1>
        <p className="mt-1 text-muted-foreground">
          {rangeStart}–{rangeEnd} of {total} clip{total === 1 ? "" : "s"}
        </p>
      </header>

      <ul className={cn("flex w-full min-w-0 flex-col gap-6", enter, "delay-100 motion-reduce:delay-0")}>
        {recordings.map((recording) => (
          <li key={recording.id} className="min-w-0">
            <Card className="w-full min-w-0">
              <CardHeader>
                <CardTitle>
                  {dateFormatter.format(new Date(recording.created_at))}
                </CardTitle>
                <CardDescription>Recording #{recording.id}</CardDescription>
              </CardHeader>
              <CardContent>
                {recording.video_url ? (
                  <RecordingVideo src={recording.video_url} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No video attached to this entry.
                  </p>
                )}
              </CardContent>
              {recording.video_url ? (
                <CardFooter className="justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={recording.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink />
                      Open in new tab
                    </Link>
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {lastPage > 1 ? (
        <nav
          className={cn(
            "mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6",
            enter,
            "delay-200 motion-reduce:delay-0"
          )}
          aria-label="Pagination"
        >
          <p className="text-sm text-muted-foreground">
            Page {page} of {lastPage}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              asChild={page > 1}
            >
              {page > 1 ? (
                <Link href={`/?page=${page - 1}`} scroll>
                  <ChevronLeft />
                  Previous
                </Link>
              ) : (
                <span className="pointer-events-none inline-flex items-center gap-1">
                  <ChevronLeft />
                  Previous
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              asChild={page < lastPage}
            >
              {page < lastPage ? (
                <Link href={`/?page=${page + 1}`} scroll>
                  Next
                  <ChevronRight />
                </Link>
              ) : (
                <span className="pointer-events-none inline-flex items-center gap-1">
                  Next
                  <ChevronRight />
                </span>
              )}
            </Button>
          </div>
        </nav>
      ) : null}
    </>
  );
}
