import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://models.github.ai/inference";
const MODEL = "openai/whisper-large-v3-turbo";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GITHUB_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: "Server not configured for transcription" }, { status: 500 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Forward to GitHub Models Whisper endpoint
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "audio.webm");
    whisperForm.append("model", MODEL);
    whisperForm.append("language", "en");
    whisperForm.append("response_format", "json");

    const res = await fetch(`${ENDPOINT}/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: whisperForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[transcribe]", res.status, errText.slice(0, 200));
      return NextResponse.json({ error: "Transcription failed" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text || "" });
  } catch (e) {
    console.error("[transcribe]", e);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
