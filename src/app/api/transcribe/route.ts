import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://models.github.ai/inference";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GITHUB_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "No audio" }, { status: 400 });
    }

    // Convert audio to base64
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const base64Audio = buffer.toString("base64");

    // Detect mime type from file
    const mimeType = audioFile.type || "audio/webm";

    // Use GPT-4o-audio-preview which supports audio input
    // Fallback: send to GPT-4o-mini as a data URI in a user message
    const models = ["openai/gpt-4o-mini-audio-preview", "openai/gpt-4o-audio-preview", "openai/gpt-4o-mini"];

    for (const model of models) {
      try {
        const res = await fetch(`${ENDPOINT}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: { data: base64Audio, format: mimeType.includes("webm") ? "webm" : "mp4" },
                },
                { type: "text", text: "Transcribe this audio exactly as spoken. Return ONLY the transcribed text, nothing else." },
              ],
            }],
            max_tokens: 200,
            temperature: 0,
          }),
        });

        if (res.status === 429) continue;
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[transcribe] ${model}: ${res.status} ${errText.slice(0, 200)}`);
          continue;
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim() || "";
        return NextResponse.json({ text });
      } catch (e) {
        console.error(`[transcribe] ${model}:`, e);
        continue;
      }
    }

    return NextResponse.json({ error: "All transcription models failed" }, { status: 500 });
  } catch (e) {
    console.error("[transcribe]", e);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
