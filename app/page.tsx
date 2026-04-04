import { getRecordings } from "@/lib/recordings";
import { RecordingsList } from "@/components/recordings-list";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PostgrestError } from "@supabase/supabase-js";

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <RecordingsList initialRecordings={recordings ?? []} />
    </div>
  );
}
