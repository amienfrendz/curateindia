import OpenAI from "openai";

const ENDPOINT = "https://models.github.ai/inference";

export const DEFAULT_MODEL = process.env.GITHUB_MODELS_MODEL || "openai/gpt-4o-mini";

export function getClient(): OpenAI {
  const apiKey = process.env.GITHUB_TOKEN;
  if (!apiKey) {
    throw new Error(
      "GITHUB_TOKEN is not set. Create a fine-grained PAT at https://github.com/settings/tokens with 'models:read' scope and add it to .env.local."
    );
  }
  return new OpenAI({ apiKey, baseURL: ENDPOINT });
}

export async function chatJSON<T>(opts: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<T> {
  const client = getClient();
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const completion = await client.chat.completions.create(
        {
          model: opts.model || DEFAULT_MODEL,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          temperature: opts.temperature ?? 0.4,
          response_format: { type: "json_object" },
        },
        { timeout: opts.timeoutMs ?? 15000, maxRetries: 0 }
      );
      const raw = completion.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(raw) as T;
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : "{}") as T;
      }
    } catch (e: unknown) {
      lastError = e;
      const is429 = e instanceof Error && e.message.includes("429");
      if (is429 && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export async function chatText(opts: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: opts.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.4,
  });
  return completion.choices[0]?.message?.content || "";
}

export async function chatStream(opts: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const client = getClient();
  const stream = await client.chat.completions.create({
    model: opts.model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.4,
    stream: true,
  });
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content || "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
