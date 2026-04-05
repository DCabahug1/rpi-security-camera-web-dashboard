import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Row shape for `public.recordings` (webhook JSON may use number or string for `id`). */
type RecordingRow = {
  id: number | string;
  video_url: string | null;
  created_at: string;
};

type InsertPayload = {
  type: "INSERT";
  table: string;
  schema: string;
  record: RecordingRow;
  old_record: null;
};

type UpdatePayload = {
  type: "UPDATE";
  table: string;
  schema: string;
  record: RecordingRow;
  old_record: RecordingRow;
};

type DeletePayload = {
  type: "DELETE";
  table: string;
  schema: string;
  record: null;
  old_record: RecordingRow;
};

type WebhookPayload = InsertPayload | UpdatePayload | DeletePayload;

/** Manual invoke: `{ "message": "..." }` for curl/tests. */
type ManualPayload = {
  message?: string;
};

function isWebhookPayload(x: unknown): x is WebhookPayload {
  if (typeof x !== "object" || x === null) return false;
  const t = (x as { type?: unknown }).type;
  return t === "INSERT" || t === "UPDATE" || t === "DELETE";
}

function isManualPayload(x: unknown): x is ManualPayload {
  return typeof x === "object" && x !== null && "message" in x;
}

function contentForRecordingsWebhook(p: WebhookPayload): string | null {
  if (p.schema !== "public" || p.table !== "recordings") return null;

  if (p.type === "INSERT" && p.record) {
    const r = p.record;
    return [
      "**New recording**",
      `id: \`${r.id}\``,
      r.video_url ? `url: ${r.video_url}` : "_no video url_",
      `created: ${r.created_at}`,
    ].join("\n");
  }

  if (p.type === "UPDATE" && p.record) {
    const r = p.record;
    return `Recording **updated** — id \`${r.id}\`${r.video_url ? `\n${r.video_url}` : ""}`;
  }

  if (p.type === "DELETE" && p.old_record) {
    const r = p.old_record;
    return `Recording **deleted** — id \`${r.id}\``;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!webhookUrl) {
    return new Response(
      JSON.stringify({ error: "DISCORD_WEBHOOK_URL is not set" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body must be JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let text: string | null = null;

  if (isWebhookPayload(raw)) {
    text = contentForRecordingsWebhook(raw);
  }

  if (text === null && isManualPayload(raw) && raw.message != null) {
    text = raw.message;
  }

  if (text === null) {
    return new Response(
      JSON.stringify({
        ok: true,
        skipped: true,
        reason: "Not a recordings webhook event and no manual message",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });

  if (!discordRes.ok) {
    const errText = await discordRes.text();
    return new Response(
      JSON.stringify({
        error: "Discord rejected the request",
        detail: errText,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});