require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Hume Octave PCM output is 48kHz, mono, 16-bit signed little-endian.
// Verified against the WAV header from the live API. The frontend reads
// these from the "connected" event so the two stay in sync.
const PCM_SAMPLE_RATE = 48000;
const PCM_CHANNELS = 1;

// Acting directions for Rocky. Octave 1 only (Octave 2 rejects `description`).
// Kept under 100 chars per Hume's guidance for acting directions.
const ROCKY_DESCRIPTION = "Alien engineer. Broken English. Deliberate. Warm but strange.";
const ROCKY_SPEED = Number(process.env.ROCKY_SPEED) || 1.25; // tune via .env

// Hume allows up to 5000 chars per utterance. We keep under that and split long
// replies into multiple utterances so nothing is truncated. MAX_SPEAK_CHARS is
// a generous overall ceiling so a runaway reply cannot generate endless audio.
const MAX_UTTERANCE_CHARS = 4500;
const MAX_SPEAK_CHARS = 6000;

// Resolve the speaker. Voice clones are private to the Hume account that made
// them, so a shared HUME_VOICE_ID 404s for everyone else. Each user clones the
// shipped rocky-voice-sample.mp3 on their own account and puts the id in .env.
// Until they do, fall back to a stock Hume voice so the app still speaks.
const FALLBACK_VOICE_NAME = process.env.HUME_FALLBACK_VOICE || "Male English Actor";
function configuredVoiceId() {
  const id = (process.env.HUME_VOICE_ID || "").trim();
  return id && !id.startsWith("your-") ? id : null;
}
function rockyVoice() {
  const id = configuredVoiceId();
  return id ? { id } : { name: FALLBACK_VOICE_NAME, provider: "HUME_AI" };
}

const sseClients = new Set();

// Most recent Hume generation id, fed back as context so Rocky's prosody
// stays consistent across replies instead of resetting every message.
let lastGenerationId = null;

// Track how far we have read in each transcript so we only speak new messages.
const transcriptOffsets = new Map();

let msgCounter = 0;

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      sampleRate: PCM_SAMPLE_RATE,
      channels: PCM_CHANNELS,
    })}\n\n`
  );
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) client.write(msg);
}

function cleanForSpeech(raw) {
  let t = raw;
  // Strip code blocks and inline code
  t = t.replace(/```[\s\S]*?```/g, "");
  t = t.replace(/`[^`]+`/g, "");
  // Strip HTML tags
  t = t.replace(/<[^>]+>/g, "");
  // Markdown links → just the label
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // URLs
  t = t.replace(/https?:\/\/\S+/g, "");
  // Strip full table rows (lines with pipes)
  t = t.replace(/^[|\s][-|:\s]+[|\s]*$/gm, "");
  t = t.replace(/^\|.*\|$/gm, "");
  // Strip horizontal rules
  t = t.replace(/^[-*_]{3,}\s*$/gm, "");
  // Headers
  t = t.replace(/#{1,6}\s*/g, "");
  // Bold / italic
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  // List markers (bullet and numbered)
  t = t.replace(/^[-*]\s+/gm, "");
  t = t.replace(/^\d+\.\s+/gm, "");
  // Finding IDs like SEC-001, CHAIN-010, FE-005, etc.
  t = t.replace(/\b[A-Z]+-\d{2,4}\b/g, "");
  // Stray pipes and table leftovers
  t = t.replace(/\|/g, "");
  // Collapse whitespace
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n{2,}/g, "\n");
  // Drop lines that are now empty or just punctuation
  t = t
    .split("\n")
    .filter((line) => line.trim().length > 2)
    .join("\n");
  t = t.trim();
  if (t.length > MAX_SPEAK_CHARS) t = t.slice(0, MAX_SPEAK_CHARS) + "...";
  return t;
}

// Group sentences/lines into pieces under Hume's per-utterance char limit so
// long replies are spoken in full instead of being cut off.
function splitForSpeech(text) {
  const tokens = text.match(/[^.!?\n]+[.!?]*\n*|\n+/g) || [text];
  const pieces = [];
  let cur = "";
  for (const tok of tokens) {
    if (tok.length > MAX_UTTERANCE_CHARS) {
      if (cur.trim()) pieces.push(cur);
      cur = "";
      for (let i = 0; i < tok.length; i += MAX_UTTERANCE_CHARS) {
        pieces.push(tok.slice(i, i + MAX_UTTERANCE_CHARS));
      }
    } else if ((cur + tok).length > MAX_UTTERANCE_CHARS) {
      if (cur.trim()) pieces.push(cur);
      cur = tok;
    } else {
      cur += tok;
    }
  }
  if (cur.trim()) pieces.push(cur);
  return pieces.map((p) => p.trim()).filter(Boolean);
}

// Stream PCM from Hume's streaming endpoint, invoking onChunk(base64Pcm) for
// each audio chunk the moment it arrives. Returns the generation id so it can
// be reused as prosody context for the next utterance.
async function streamSynthesize(text, onChunk) {
  const voice = rockyVoice();
  const utterances = splitForSpeech(text).map((piece) => ({
    text: piece,
    voice,
    description: ROCKY_DESCRIPTION,
    speed: ROCKY_SPEED,
  }));
  const body = {
    utterances,
    format: { type: "pcm" },
    instant_mode: true, // fastest time-to-first-chunk; needs a named voice
    strip_headers: true, // chunks concatenate into one clean stream
    version: "1", // Octave 1 — required to keep `description`
    num_generations: 1,
  };
  if (lastGenerationId) {
    body.context = { generation_id: lastGenerationId };
  }

  const response = await fetch("https://api.hume.ai/v0/tts/stream/json", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": process.env.HUME_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let generationId = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj.generation_id) generationId = obj.generation_id;
      if (obj.audio) onChunk(obj.audio);
    }
  }

  if (generationId) lastGenerationId = generationId;
  return generationId;
}

// Stream a line to all connected browsers as progressive PCM chunks.
async function speakStreaming(text) {
  const msgId = ++msgCounter;
  broadcast({ type: "pending", text, msgId });
  try {
    let index = 0;
    await streamSynthesize(text, (audio) => {
      broadcast({ type: "chunk", msgId, index: index++, audio });
    });
    broadcast({ type: "done", msgId });
  } catch (err) {
    broadcast({ type: "error", msgId, error: err.message });
  }
}

// One-shot synthesis returning a full base64 PCM blob (no SSE). Kept for
// direct API callers; the browser uses the SSE streaming path above.
app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const parts = [];
    await streamSynthesize(text, (audio) => parts.push(Buffer.from(audio, "base64")));
    res.json({
      audio: Buffer.concat(parts).toString("base64"),
      format: "pcm",
      sampleRate: PCM_SAMPLE_RATE,
      channels: PCM_CHANNELS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  res.json({ ok: true });
  speakStreaming(text);
});

// Extract all assistant text blocks from a transcript JSONL file, starting
// after the byte offset we last read. Returns { texts: string[], newOffset }.
function extractNewAssistantTexts(filePath, fromOffset) {
  let data;
  try {
    data = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { texts: [], newOffset: fromOffset };
  }
  const newOffset = Buffer.byteLength(data, "utf-8");
  if (newOffset <= fromOffset) return { texts: [], newOffset };

  const fresh = Buffer.from(data, "utf-8").slice(fromOffset).toString("utf-8");
  const texts = [];
  for (const line of fresh.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "assistant") continue;
    const content = entry.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block.type === "text" && block.text) texts.push(block.text);
    }
  }
  return { texts, newOffset };
}

app.post("/api/hook", async (req, res) => {
  const hookData = req.body;
  fs.appendFileSync(
    path.join(__dirname, "hook-log.jsonl"),
    JSON.stringify(hookData) + "\n"
  );

  const transcriptPath = hookData.transcript_path;

  // If we have a transcript, read ALL new assistant messages and speak each one.
  if (transcriptPath && fs.existsSync(transcriptPath)) {
    const prevOffset = transcriptOffsets.get(transcriptPath) || 0;
    const { texts, newOffset } = extractNewAssistantTexts(transcriptPath, prevOffset);
    transcriptOffsets.set(transcriptPath, newOffset);

    const speakable = texts
      .map(cleanForSpeech)
      .filter((t) => t.length > 0);

    if (speakable.length === 0) {
      res.json({ ok: true, note: "no speakable text in transcript" });
      return;
    }

    res.json({ ok: true, count: speakable.length });
    for (const text of speakable) {
      await speakStreaming(text);
    }
    return;
  }

  // Fallback: use the single assistant_message field if no transcript available.
  const raw = hookData.assistant_message || hookData.last_assistant_message || null;
  if (!raw) {
    res.json({ ok: true, note: "no text found in hook data" });
    return;
  }

  const text = cleanForSpeech(raw);
  if (!text) {
    res.json({ ok: true, note: "nothing speakable after cleaning" });
    return;
  }

  res.json({ ok: true });
  speakStreaming(text);
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Rocky TTS running at http://localhost:${PORT}`);
  if (configuredVoiceId()) {
    console.log(`Voice: cloned (HUME_VOICE_ID=${configuredVoiceId()})`);
  } else {
    console.log(
      `Voice: stock "${FALLBACK_VOICE_NAME}" — no clone set.\n` +
      `       For real Rocky, clone rocky-voice-sample.mp3 and set HUME_VOICE_ID in .env (see README).`
    );
  }
});
