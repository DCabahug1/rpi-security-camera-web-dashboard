"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { RecordingVideo } from "@/components/recording-video";
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
import type { Recording } from "@/lib/types";
import { cn } from "@/lib/utils";

// --- Small helpers (client Supabase payloads may use string ids / loose shapes) ---

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

// --- UI constants ---

/** Fade-in only on large blocks (transforms caused layout shift with cards). */
const enter =
  "animate-in fade-in duration-700 ease-out fill-mode-forwards motion-reduce:animate-none motion-reduce:opacity-100";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const POLL_MS = 15_000;

/** Shared pagination: first/last, prev/next, numeric jump, and page summary. */
function RecordingsPagination({
  page,
  lastPage,
  placement,
  enterClass,
}: {
  page: number;
  lastPage: number;
  placement: "top" | "bottom";
  enterClass: string;
}) {
  const router = useRouter();
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function goToPage(e: FormEvent) {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n)) return;
    const target = Math.min(Math.max(1, Math.floor(n)), lastPage);
    router.push(`/?page=${target}`);
  }

  return (
    <nav
      aria-label={
        placement === "top" ? "Pagination at top" : "Pagination at bottom"
      }
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-3",
        enterClass,
        placement === "top"
          ? "mb-6 border-b border-border pb-4"
          : "mt-8 border-t border-border pt-6"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          asChild={page > 1}
          title="First page"
        >
          {page > 1 ? (
            <Link href="/?page=1" scroll>
              <ArrowLeftToLine />
              <span className="sr-only">First page</span>
            </Link>
          ) : (
            <span className="pointer-events-none inline-flex items-center gap-1 opacity-50">
              <ArrowLeftToLine />
              <span className="sr-only">First page</span>
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          asChild={page > 1}
          title="Previous page"
        >
          {page > 1 ? (
            <Link href={`/?page=${page - 1}`} scroll>
              <ChevronLeft />
              Previous
            </Link>
          ) : (
            <span className="pointer-events-none inline-flex items-center gap-1 opacity-50">
              <ChevronLeft />
              Previous
            </span>
          )}
        </Button>
      </div>

      <form
        onSubmit={goToPage}
        className="flex items-center gap-2"
      >
        <label htmlFor={`page-jump-${placement}`} className="sr-only">
          Go to page
        </label>
        <input
          id={`page-jump-${placement}`}
          type="number"
          min={1}
          max={lastPage}
          inputMode="numeric"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          className="h-8 w-18 rounded-md border border-input bg-background px-2 text-center text-sm tabular-nums shadow-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button type="submit" variant="secondary" size="sm">
          Go
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          asChild={page < lastPage}
          title="Next page"
        >
          {page < lastPage ? (
            <Link href={`/?page=${page + 1}`} scroll>
              Next
              <ChevronRight />
            </Link>
          ) : (
            <span className="pointer-events-none inline-flex items-center gap-1 opacity-50">
              Next
              <ChevronRight />
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          asChild={page < lastPage}
          title="Last page"
        >
          {page < lastPage ? (
            <Link href={`/?page=${lastPage}`} scroll>
              <span className="sr-only">Last page</span>
              <ArrowRightToLine />
            </Link>
          ) : (
            <span className="pointer-events-none inline-flex items-center gap-1 opacity-50">
              <span className="sr-only">Last page</span>
              <ArrowRightToLine />
            </span>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground sm:ml-auto">
        Page {page} of {lastPage}
      </p>
    </nav>
  );
}

type RecordingsListProps = {
  initialRecordings: Recording[];
  initialTotal: number;
  page: number;
  perPage: number;
};

/**
 * Paginated recordings UI: syncs from server props on navigation, then keeps fresh via
 * Supabase Realtime, interval refetch, and window focus.
 */
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

  // Reset local state when the server sends a new page or data from navigation.
  useEffect(() => {
    setRecordings(sortNewestFirst(initialRecordings));
    setTotal(initialTotal);
  }, [initialRecordings, initialTotal, page]);

  // Realtime + polling + focus: refresh current page range from the browser client.
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

    function onFocus() {
      void refreshFromDb();
    }
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
          className={cn(enter, "delay-150 motion-reduce:delay-0")}
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

      {lastPage > 1 ? (
        <RecordingsPagination
          page={page}
          lastPage={lastPage}
          placement="top"
          enterClass={cn(enter, "delay-75 motion-reduce:delay-0")}
        />
      ) : null}

      <ul
        className={cn(
          "flex w-full min-w-0 flex-col gap-6",
          enter,
          "delay-100 motion-reduce:delay-0"
        )}
      >
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
        <RecordingsPagination
          page={page}
          lastPage={lastPage}
          placement="bottom"
          enterClass={cn(enter, "delay-200 motion-reduce:delay-0")}
        />
      ) : null}
    </>
  );
}
