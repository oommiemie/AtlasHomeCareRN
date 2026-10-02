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

/** A tool the model asked to have run, as the API hands it back. */
export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** One turn from the model: what it wrote, and any tools it wants run. */
export type ModelTurn = { content: string; toolCalls: ToolCall[] };

/**
 * One turn of a conversation that may use tools — the assistant's.
 *
 * The model is offered `tools` and either answers or asks for some of them
 * to be run; the caller runs them and asks again (see `askAssistant`).
 * Given `onText`, the turn is streamed, so an answer that needs no tools
 * starts arriving at its first words; tool calls are gathered from the
 * stream's pieces as they come.
 *
 * Null where the cluster could not be reached or answered nothing usable.
 * Never throws, never waits forever.
 */
export function modelTurn(
  messages: unknown[],
  {
    tools,
    onText,
    timeoutMs = 25_000,
    maxTokens = 500,
    temperature = 0,
  }: {
    tools?: unknown[];
    onText?: (soFar: string) => void;
    timeoutMs?: number;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<ModelTurn | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const stream = onText != null;
    let read = 0;
    let text = "";
    const calls: { id: string; name: string; args: string }[] = [];
    let done = false;
    const result = (): ModelTurn | null => {
      // Gemma sometimes writes its tool calls into the text, in its own
      // template's markup, instead of the API's field — and the carer was
      // shown "<|tool_call>call:patient_record{…}". Read back as the calls
      // they are, and taken out of the words.
      const leaked = leakedCalls(text);
      if (leaked.length > 0) {
        calls.push(...leaked);
        text = text.replace(LEAK, "").trim();
      }
      const toolCalls: ToolCall[] = calls
        .filter((c) => c.name !== "")
        .map((c, i) => ({
          id: c.id || `call-${i}`,
          type: "function",
          function: { name: c.name, arguments: c.args || "{}" },
        }));
      return text.trim() === "" && toolCalls.length === 0
        ? null
        : { content: text, toolCalls };
    };
    const finish = (value: ModelTurn | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      xhr.abort();
      finish(text !== "" ? result() : null);
    }, timeoutMs);

    type Delta = {
      content?: string;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    const takeDelta = (d: Delta | undefined) => {
      if (d == null) return;
      if (d.content) {
        text += d.content;
        // Never read leaked tool markup aloud: once it starts, the rest of
        // this turn is calls, not words.
        if (!/<\|tool|call:[a-z_]+\{/.test(text)) onText?.(text);
      }
      for (const piece of d.tool_calls ?? []) {
        const i = piece.index ?? calls.length;
        calls[i] ??= { id: "", name: "", args: "" };
        if (piece.id) calls[i].id = piece.id;
        if (piece.function?.name) calls[i].name += piece.function.name;
        if (piece.function?.arguments) calls[i].args += piece.function.arguments;
      }
    };

    // Streamed: everything new since the last look, in `data:` lines.
    const take = () => {
      const fresh = xhr.responseText.slice(read);
      const cut = fresh.lastIndexOf("\n");
      if (cut < 0) return;
      read += cut + 1;
      for (const line of fresh.slice(0, cut).split("\n")) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (data === "" || data === "[DONE]") continue;
        try {
          takeDelta(
            (JSON.parse(data) as { choices?: { delta?: Delta }[] }).choices?.[0]
              ?.delta,
          );
        } catch {
          // A keep-alive or a fragment; the next look reads it whole.
        }
      }
    };

    if (stream) xhr.onprogress = take;
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(null);
        return;
      }
      if (stream) {
        take();
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as {
            choices?: { message?: Delta }[];
          };
          const m = body.choices?.[0]?.message;
          takeDelta({
            content: m?.content ?? undefined,
            tool_calls: m?.tool_calls?.map((c, index) => ({ ...c, index })),
          });
        } catch {
          finish(null);
          return;
        }
      }
      finish(result());
    };
    xhr.onerror = () => finish(text !== "" ? result() : null);
    xhr.open("POST", `${AI_HOST}/v1/chat/completions`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(
      JSON.stringify({
        model: AI_MODEL,
        temperature,
        max_tokens: maxTokens,
        stream,
        messages,
        ...(tools != null && tools.length > 0
          ? { tools, tool_choice: "auto" }
          : {}),
      }),
    );
  });
}

/** Gemma's own tool-call markup, where it leaks into the answer's text. */
const LEAK = /<\|tool_call>[\s\S]*?(?:<tool_call\|>|$)|call:[a-z_]+\{[^}]*\}/g;

/**
 * Tool calls written out as text, in Gemma's template: `call:name{key:
 * <|"|>value<|"|>, n: 3}`. Parsed into the same shape the API gives.
 */
export function leakedCalls(text: string): { id: string; name: string; args: string }[] {
  const out: { id: string; name: string; args: string }[] = [];
  const re = /call:([a-z_]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) != null) {
    const args: Record<string, string | number> = {};
    const body = m[2].replace(/<\|"\|>/g, '"');
    const pair = /([a-z_]+)\s*:\s*("([^"]*)"|[^,]+)/g;
    let p: RegExpExecArray | null;
    while ((p = pair.exec(body)) != null) {
      const raw = p[3] ?? p[2].trim();
      args[p[1]] = p[3] == null && /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    }
    // The template's own word for a resident id, where it used one.
    if (args.patient_id != null && args.resident_id == null) {
      args.resident_id = args.patient_id;
      delete args.patient_id;
    }
    out.push({ id: `leak-${out.length}`, name: m[1], args: JSON.stringify(args) });
  }
  return out;
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
