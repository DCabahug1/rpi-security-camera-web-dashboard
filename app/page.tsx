import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getRecordings } from "@/lib/recordings";
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
import { PostgrestError } from "@supabase/supabase-js";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function Home() {
  const recordings = await getRecordings();

  if (recordings instanceof PostgrestError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>Could not load recordings</CardTitle>
            <CardDescription>{recordings.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!recordings?.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Recordings
        </h1>
        <p className="mt-1 text-muted-foreground">
          {recordings.length} clip{recordings.length === 1 ? "" : "s"}
        </p>
      </header>

      <ul className="flex flex-col gap-6">
        {recordings.map((recording: Recording) => (
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
    </div>
  );
}
