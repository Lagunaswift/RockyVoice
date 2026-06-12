#!/usr/bin/env node
"use strict";

const fs = require("fs");

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage: node hermes-tts.js --text-file INPUT --output OUTPUT [--url URL] [--timeout MS]\n\n`);
  out.write(`Calls a running RockyVoice server /api/tts endpoint and writes a WAV file for Hermes command TTS providers.\n`);
  out.write(`Defaults:\n`);
  out.write(`  URL:     ROCKY_TTS_URL or http://127.0.0.1:3333\n`);
  out.write(`  Timeout: ROCKY_TTS_TIMEOUT_MS or 120000\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    url: process.env.ROCKY_TTS_URL || "http://127.0.0.1:3333",
    timeoutMs: Number(process.env.ROCKY_TTS_TIMEOUT_MS || 120000),
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--text-file" || arg === "--input" || arg === "-i") {
      args.textFile = argv[++i];
    } else if (arg === "--output" || arg === "--out" || arg === "-o") {
      args.output = argv[++i];
    } else if (arg === "--url") {
      args.url = argv[++i];
    } else if (arg === "--timeout") {
      args.timeoutMs = Number(argv[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.textFile) throw new Error("Missing --text-file INPUT");
  if (!args.output) throw new Error("Missing --output OUTPUT");
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error("--timeout must be a positive number of milliseconds");
  }
  return args;
}

function wavHeader(byteLength, sampleRate, channels, bitsPerSample) {
  const blockAlign = channels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(byteLength, 40);
  return header;
}

async function main() {
  const args = parseArgs(process.argv);
  const text = fs.readFileSync(args.textFile, "utf8").trim();
  if (!text) throw new Error("Input text is empty");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  let response;
  try {
    response = await fetch(new URL("/api/tts", args.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`RockyVoice /api/tts failed (${response.status}): ${bodyText}`);
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (err) {
    throw new Error(`RockyVoice returned invalid JSON: ${err.message}`);
  }

  if (!body.audio) throw new Error("RockyVoice response missing audio");
  const audio = Buffer.from(body.audio, "base64");
  if (!audio.length) throw new Error("RockyVoice returned empty audio");

  let output;
  const format = (body.format || "pcm").toLowerCase();
  if (format === "pcm") {
    output = Buffer.concat([
      wavHeader(audio.length, body.sampleRate || 48000, body.channels || 1, 16),
      audio,
    ]);
  } else {
    output = audio;
  }

  fs.writeFileSync(args.output, output);
  process.stderr.write(`rocky-tts: wrote ${args.output}\n`);
}

main().catch((err) => {
  process.stderr.write(`rocky-tts: ${err.message}\n`);
  process.exit(1);
});
