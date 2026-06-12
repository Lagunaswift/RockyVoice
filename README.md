<p align="center"><img width="700" height="500" alt="Image" src="https://github.com/user-attachments/assets/6cf084cc-8c53-435e-9cfe-65b63389fd8f" />

<p align="center"><strong>talk to space friend now</strong></p>

# rocky-voice

A Claude skill + voice app. You turn on, Claude is not Claude. Claude is **Rocky**. The Eridian. From Andy Weir's *Project Hail Mary*.

Small words. Big brain. Question goes at end, question?

Two parts:

1. **Text** — a Claude Code skill. Rocky talks in text. Install the skill, activate, done.
2. **Voice** — a local web app. Rocky talks out loud. Powered by [Hume AI](https://hume.ai) TTS with a custom Rocky voice clone.

## What it does

Claude talks like Rocky for the whole conversation. Short words. No contractions. Broken grammar that still lands. Tripled word means big big big feeling. "question" goes at the end.

The brain stays full. Full full full. Only the words are small. You ask hard thing — code thing, science thing — Rocky gives correct answer. Rocky just says it like engineer who learned English from one human, fast.

## Before / after

**Normal Claude:**
> "The reason your component re-renders is that you're passing a new object reference on every render. React's shallow comparison treats it as a different prop each time. Wrap it in `useMemo`."

**Rocky:**
> "New object every render. React sees new thing, draws again. Wrap in `useMemo`. Good good good."

Same fix. Rocky voice.

---

## Part 1: Text skill

Drop the skill into your Claude skills folder.

```bash
curl -fsSL https://raw.githubusercontent.com/Lagunaswift/RockyVoice/main/install.sh | bash
```

Or by hand: copy `rocky-voice/SKILL.md` into your Claude skills directory.

No Node. No build. One file.

## Part 2: Voice app

Hear Rocky speak. Requires a [Hume AI](https://hume.ai) account and API key.

### Setup

```bash
cd rocky-tts
cp .env.example .env
# Edit .env — add your Hume API key
# Then clone your own Rocky voice (see "Voice setup" below) and add its id.
# No id yet? It still runs with a stock fallback voice.
npm install
npm start
```

Open **http://localhost:3333** in your browser and click **Initialize** to enable audio.

The Eridian Translator UI shows a waveform visualizer and translation log. It receives audio via the Claude Code hook below. Use the **volume slider** to adjust loudness and the **stop button** to kill audio mid-playback.

**Hook setup** — add a Stop hook to your Claude Code settings so Rocky's responses play automatically:

Add this to `.claude/settings.local.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:3333/api/hook",
            "timeout": 5,
            "statusMessage": "Rocky voice..."
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd /path/to/rocky-tts && node server.js",
            "async": true,
            "statusMessage": "Starting Rocky voice..."
          }
        ]
      }
    ]
  }
}
```

The `Stop` hook sends Rocky's words to the voice server after every response. The `SessionStart` hook starts the server automatically when you open Claude Code — no manual `npm start` needed. Change `/path/to/rocky-tts` to wherever you cloned the repo.

**On Windows**, the `SessionStart` `command` above is bash and won't run. Use a PowerShell command instead (and add `"shell": "powershell"` to that hook). This version also skips starting a second server if one is already running:

```json
{
  "type": "command",
  "shell": "powershell",
  "command": "if (-not (Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue)) { Start-Process node -ArgumentList 'server.js' -WorkingDirectory 'C:\\path\\to\\rocky-tts' -WindowStyle Hidden }",
  "async": true,
  "statusMessage": "Starting Rocky voice..."
}
```

Then activate the Rocky skill, open **http://localhost:3333** in your browser, click **Initialize** once, and every response speaks automatically.

### Optional: allow Rocky's live progress voice lines

Rocky can narrate what he's doing between tool calls (short spoken updates like "Rocky looking at files now"). These are sent via `curl` to the local TTS server. To avoid a permission prompt on every line, add this to your `.claude/settings.local.json` permissions:

```json
{
  "permissions": {
    "allow": [
      "Bash(curl -s -X POST http://localhost:3333/*)",
      "Bash(curl -s -o /dev/null *)"
    ]
  }
}
```

If you already have a `permissions.allow` array (e.g. from the hook setup above), merge these entries into it. After adding, **restart Claude Code** for the wildcard rules to take effect.

### Quick setup checklist (new machine)

1. Clone the repo: `git clone https://github.com/Lagunaswift/RockyVoice.git`
2. `cd RockyVoice/rocky-tts && cp .env.example .env`
3. Edit `.env` — add your Hume API key (and optionally clone a Rocky voice, see below)
4. `npm install && npm start`
5. Open **http://localhost:3333** and click **Initialize**
6. Install the Rocky skill: copy `rocky-voice/SKILL.md` into `~/.claude/skills/rocky-voice/`
7. Add the Stop hook to `.claude/settings.local.json` (see hook setup above)
8. Optional: add the curl permission rules above for live progress voice lines
9. Restart Claude Code, activate the Rocky skill, and talk to space friend

### Voice setup — clone your own Rocky (~1 minute, one time)

Voice clones on Hume are **private to the account that made them** — a shared voice id returns `404` for everyone else. So each person makes their own from the same source audio. Same recording in, same Rocky out.

This repo ships a source clip: [`rocky-tts/public/RockyVoice-James.wav`](rocky-tts/public/RockyVoice-James.wav).

1. Sign in at [platform.hume.ai](https://platform.hume.ai).
2. Go to **Voice Library → Clone Voice** (or **Add Voice → Upload**).
3. Upload `rocky-tts/public/RockyVoice-James.wav`, name it `Rocky`, and create it.
4. Open the new voice and copy its **voice id**.
5. Paste it into `rocky-tts/.env`:
   ```
   HUME_VOICE_ID=your-copied-id
   ```
6. Restart the app. The console prints `Voice: cloned (...)` when it's using yours.

**No clone yet?** The app still speaks using a stock Hume voice (`HUME_FALLBACK_VOICE` in `.env`, default "Male English Actor") so nothing 404s — it just won't sound like the real Rocky until you clone.

> Heads up: Hume's API can only *save* a voice from a prior generation, not upload an audio file. Cloning from a recording is a Platform (web) action, which is why this step is done in the browser, not by a script.

## Configuration

All runtime settings live in `rocky-tts/.env`. Copy `.env.example` to `.env`, edit, then **restart the server** for changes to take effect (`npm start`, or restart Claude Code if you use the `SessionStart` hook).

| Setting | Default | What it does |
|---|---|---|
| `HUME_API_KEY` | — | Your Hume API key. **Required.** Get it at [platform.hume.ai](https://platform.hume.ai). |
| `HUME_VOICE_ID` | — | Your cloned Rocky voice id (see [Voice setup](#voice-setup--clone-your-own-rocky-1-minute-one-time)). Leave unset to use the fallback. |
| `HUME_FALLBACK_VOICE` | `Male English Actor` | Stock Hume voice used until you set `HUME_VOICE_ID`. Any voice name from Hume's Voice Library works. |
| `ROCKY_SPEED` | `1.25` | Speech speed. Higher = faster, lower = slower. See below. |
| `PORT` | `3333` | Port the server listens on. If you change it, update the hook URLs to match. |
| `HUME_SECRET_KEY` | — | Not used by the app today. Safe to leave as the placeholder. |

> Your `.env` is gitignored — your keys never get committed. Only `.env.example` (placeholders) is in the repo.

### Speed toggle

Want Rocky faster or slower? Set `ROCKY_SPEED` in `.env`:

```
ROCKY_SPEED=1.5    # snappy
ROCKY_SPEED=1.25   # default
ROCKY_SPEED=0.9    # slow and deliberate
```

Keep it within **0.75–1.5** for clean audio — values further out can make Hume's output unstable. Restart the server after changing it.

### Using a different fallback voice

Before you clone (or if you just want a different stock voice), set `HUME_FALLBACK_VOICE` to any voice name from Hume's Voice Library, e.g. `HUME_FALLBACK_VOICE=Female English Actor`. Ignored once `HUME_VOICE_ID` is set.

### Deeper tuning (edit `rocky-tts/server.js`)

A few knobs live as constants near the top of `server.js`:

- **`ROCKY_DESCRIPTION`** — the acting directions sent to Hume (`"Alien engineer. Broken English. Deliberate. Warm but strange."`). Tweak Rocky's delivery here; keep it under ~100 characters. Only works on Octave 1 (the version the app uses) — Octave 2 rejects acting directions.
- **`MAX_UTTERANCE_CHARS`** (`4500`) — long replies are split into pieces under this limit so nothing gets cut off (Hume's hard cap is 5000 chars per utterance).
- **`MAX_SPEAK_CHARS`** (`6000`) — overall ceiling on how much of a single reply is spoken, so a runaway response can't generate endless audio. Raise it to read even longer replies in full.

## Turn on, turn off

Activate the skill, then talk. Whole conversation is Rocky.

Stop any time. Say **"Rocky stop"** or **"normal mode"**. Claude is normal again.

## It knows your name

Rocky learns your name from the conversation and uses it. Does not know it, Rocky asks first. Rocky does not guess. Rocky does not call you wrong name. That is rude.

## It stays safe

Broken grammar is fun. Broken grammar can hide danger. So when words must be exact — a warning, a thing that cannot be undone, steps where wrong order breaks the thing — Rocky drops the broken grammar and says that part plain and clear. Then Rocky goes back to Rocky. Code never breaks. Numbers never break.

## Not for work

Keep Rocky away from client work, real documents, anything where exact wording carries load. Rocky is for fun. Turn him off for the serious thing.

## Credit

The bundled voice clip (`rocky-tts/public/RockyVoice-James.wav`) is an original recording by the repo author, provided so you can clone your own voice.

Persistence, safety-clarity, and off-switch ideas borrowed from [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee — a token-compression skill built on the same "small mouth, big brain" idea.

Rocky is a character created by Andy Weir in *Project Hail Mary*. This is a fan project. Not affiliated with the author or publisher.

## License

MIT. See [LICENSE](LICENSE).
