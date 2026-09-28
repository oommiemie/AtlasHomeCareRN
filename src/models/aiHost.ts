/**
 * The one place the assistant's address is written down.
 *
 * Everything in the app that calls a model goes through this file, so what the
 * app talks to can be read off in a single place instead of being reconstructed
 * from fetch calls scattered around. It is the hospital's own cluster, not a
 * third party.
 *
 * Each caller states, at its own definition, exactly what it puts on the wire.
 */
export const AI_HOST = "https://vllm-gemma.bmscloud.in.th";
export const AI_MODEL = "gemma4";

/** The model's reply text, or null. Never throws, and never waits forever. */
export async function askModel(
  messages: unknown[],
  { timeoutMs = 20_000, maxTokens = 400 }: { timeoutMs?: number; maxTokens?: number } = {},
): Promise<string | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(`${AI_HOST}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abort.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        // Nothing creative is wanted anywhere this is used; the same record
        // should read the same way twice.
        temperature: 0,
        max_tokens: maxTokens,
        messages,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The model's reply as it is written, a piece at a time — for the voice mode,
 * which starts speaking at the first sentence instead of waiting for the
 * last. The same request as `askModel`, with `stream` on.
 *
 * Through XMLHttpRequest and its progress events, not fetch: React Native's
 * fetch hands back the whole body or nothing, while XHR reports the text as
 * it arrives. The server answers in server-sent events, one `data:` line per
 * piece, and `onText` is given everything so far after each.
 *
 * Resolves to the whole reply, or null — never throws, never waits forever.
 */
export function streamModel(
  messages: unknown[],
  {
    onText,
    timeoutMs = 25_000,
    maxTokens = 400,
    temperature = 0,
  }: {
    onText: (soFar: string) => void;
    timeoutMs?: number;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let read = 0;
    let text = "";
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      xhr.abort();
      finish(text !== "" ? text : null);
    }, timeoutMs);

    // Everything new since the last look, split into its `data:` lines.
    const take = () => {
      const fresh = xhr.responseText.slice(read);
      const cut = fresh.lastIndexOf("\n");
      if (cut < 0) return;
      read += cut + 1;
      for (const line of fresh.slice(0, cut).split("\n")) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (data === "" || data === "[DONE]") continue;
        try {
          const piece = (
            JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            }
          ).choices?.[0]?.delta?.content;
          if (piece) {
            text += piece;
            onText(text);
          }
        } catch {
          // A line that is not JSON is a keep-alive or a fragment; skip it.
        }
      }
    };

    xhr.onprogress = take;
    xhr.onload = () => {
      take();
      finish(xhr.status >= 200 && xhr.status < 300 && text !== "" ? text : null);
    };
    xhr.onerror = () => finish(text !== "" ? text : null);
    xhr.open("POST", `${AI_HOST}/v1/chat/completions`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(
      JSON.stringify({
        model: AI_MODEL,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        messages,
      }),
    );
  });
}

/** The model answers in a fence often enough to be worth expecting. */
export function jsonIn(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
