import { redirect } from "next/navigation";
import { PostgrestError } from "@supabase/supabase-js";
import { RecordingsList } from "@/components/recordings-list";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRecordingsPage } from "@/lib/recordings";
import { cn } from "@/lib/utils";

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

/** Parses `?page=`; invalid or missing values default to page 1. */
function parseRequestedPage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const shellClass =
  "mx-auto w-full min-w-0 max-w-4xl px-4 py-10";

const errorCardClass = cn(
  "border-destructive/30 bg-destructive/5",
  "animate-in fade-in duration-700 ease-out fill-mode-forwards motion-reduce:animate-none motion-reduce:opacity-100"
);

/**
 * Home: loads a paginated slice of `recordings` on the server, then hands off to
 * `RecordingsList` for live updates (Realtime + polling).
 */
export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedPage = parseRequestedPage(params.page);

  const result = await getRecordingsPage(requestedPage);

  // Canonical URL when ?page= is past the last page (e.g. after deletes).
  if (!(result instanceof PostgrestError) && result.page !== requestedPage) {
    redirect(`/?page=${result.page}`);
  }

  if (result instanceof PostgrestError) {
    return (
      <div className={shellClass}>
        <Card className={errorCardClass}>
          <CardHeader>
            <CardTitle>Could not load recordings</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <RecordingsList
        initialRecordings={result.recordings}
        initialTotal={result.total}
        page={result.page}
        perPage={result.perPage}
      />
    </div>
  );
}
