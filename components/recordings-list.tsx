"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
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

type RecordingsListProps = {
  initialRecordings: Recording[];
};

const POLL_MS = 15_000;

export function RecordingsList({ initialRecordings }: RecordingsListProps) {
  const [recordings, setRecordings] = useState<Recording[]>(() =>
    sortNewestFirst(initialRecordings)
  );

  useEffect(() => {
    setRecordings(sortNewestFirst(initialRecordings));
  }, [initialRecordings]);

  useEffect(() => {
    const supabase = createClient();

    async function refreshFromDb() {
      const { data, error } = await supabase
        .from("recordings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error || !data) return;
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
        (payload) => {
          setRecordings((prev) => {
            if (payload.eventType === "INSERT" && payload.new) {
              const row = normalizeRecording(
                payload.new as Record<string, unknown>
              );
              if (prev.some((r) => r.id === row.id)) return prev;
              return sortNewestFirst([row, ...prev]);
            }
            if (payload.eventType === "UPDATE" && payload.new) {
              const row = normalizeRecording(
                payload.new as Record<string, unknown>
              );
              return sortNewestFirst(
                prev.map((r) => (r.id === row.id ? row : r))
              );
            }
            if (payload.eventType === "DELETE" && payload.old) {
              const old = payload.old as Record<string, unknown>;
              const id = Number(old.id);
              return prev.filter((r) => r.id !== id);
            }
            return prev;
          });
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
  }, []);

  if (!recordings.length) {
    return (
      <>
        <header className="mb-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Recordings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Clips from your camera appear here after they are uploaded.
          </p>
        </header>
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            No recordings yet.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Recordings
        </h1>
        <p className="mt-1 text-muted-foreground">
          {recordings.length} clip{recordings.length === 1 ? "" : "s"}
        </p>
      </header>

      <ul className="flex flex-col gap-6">
        {recordings.map((recording) => (
          <li key={recording.id}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {dateFormatter.format(new Date(recording.created_at))}
                </CardTitle>
                <CardDescription>Recording #{recording.id}</CardDescription>
              </CardHeader>
              <CardContent>
                {recording.video_url ? (
                  <div className="overflow-hidden rounded-lg border bg-black">
                    <video
                      className="aspect-video w-full object-contain"
                      src={recording.video_url}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  </div>
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
    </>
  );
}
