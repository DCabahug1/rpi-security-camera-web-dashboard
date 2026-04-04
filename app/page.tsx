import { redirect } from "next/navigation";
import { getRecordingsPage } from "@/lib/recordings";
import { RecordingsList } from "@/components/recordings-list";
import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PostgrestError } from "@supabase/supabase-js";

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = parseInt(params.page ?? "1", 10);
  const requestedPage = Number.isFinite(raw) && raw > 0 ? raw : 1;

  const result = await getRecordingsPage(requestedPage);

  if (!(result instanceof PostgrestError) && result.page !== requestedPage) {
    redirect(`/?page=${result.page}`);
  }

  if (result instanceof PostgrestError) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <Card
          className={cn(
            "border-destructive/30 bg-destructive/5",
            "animate-in fade-in duration-700 ease-out fill-mode-forwards motion-reduce:animate-none motion-reduce:opacity-100"
          )}
        >
          <CardHeader>
            <CardTitle>Could not load recordings</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
      <RecordingsList
        initialRecordings={result.recordings}
        initialTotal={result.total}
        page={result.page}
        perPage={result.perPage}
      />
    </div>
  );
}
