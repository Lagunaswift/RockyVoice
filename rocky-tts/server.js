require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sseClients = new Set();

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("data: {\"type\":\"connected\"}\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) client.write(msg);
}

async function synthesize(text) {
  const response = await fetch("https://api.hume.ai/v0/tts", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": process.env.HUME_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      utterances: [
        {
          text,
          voice: process.env.HUME_VOICE_ID
            ? { id: process.env.HUME_VOICE_ID }
            : undefined,
          description:
            "Alien engineer speaking broken English. Deliberate. Each word placed carefully. Warm but strange.",
          speed: 1.25,
        },
      ],
      format: { type: "mp3" },
      num_generations: 1,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.generations[0].audio;
}

app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  try {
    const audio = await synthesize(text);
    res.json({ audio });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  broadcast({ type: "pending", text });
  res.json({ ok: true });

  try {
    const audio = await synthesize(text);
    broadcast({ type: "audio", text, audio });
  } catch (err) {
    broadcast({ type: "error", error: err.message });
  }
});

app.post("/api/hook", async (req, res) => {
  const text = req.body.last_assistant_message || null;

  if (!text) {
    res.json({ ok: true, note: "no text found in hook data" });
    return;
  }

  broadcast({ type: "pending", text });
  res.json({ ok: true });

  try {
    const audio = await synthesize(text);
    broadcast({ type: "audio", text, audio });
  } catch (err) {
    broadcast({ type: "error", error: err.message });
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Rocky TTS running at http://localhost:${PORT}`);
});
