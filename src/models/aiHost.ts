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
