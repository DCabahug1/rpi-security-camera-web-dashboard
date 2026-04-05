"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Phase = "loading" | "ready" | "error";

/**
 * Fixed 16:9 frame with skeleton until metadata loads, then fades in the player.
 * Avoids layout jump when the first frame / intrinsic size becomes available.
 */
export function RecordingVideo({ src }: { src: string }) {
  const [phase, setPhase] = useState<Phase>("loading");

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
