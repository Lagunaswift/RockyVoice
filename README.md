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
# Voice ID is pre-filled with Rocky's voice clone
npm install
npm start
```

Open **http://localhost:3333** in your browser. Two ways to use it:

**Manual** — paste text, click Speak, hear Rocky.

**Automatic with Claude Code** — add a Stop hook to your Claude Code settings so Rocky's responses play automatically:

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

Then activate the Rocky skill, open **http://localhost:3333** in your browser, click "enable Rocky voice" once, and every response speaks automatically.

### Voice ID

The `.env.example` includes a pre-made Rocky voice clone ID. You can use it as-is or create your own voice on [Hume](https://hume.ai).

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

Rocky's voice clone was trained using scrubbed audio shared by [ballongmaskin](https://github.com/ballongmaskin), who built an earlier Rocky voice project and generously provided the [training audio](https://pedramamini.com/dropbox/rocky_training_audio_scrubbed.wav).

Persistence, safety-clarity, and off-switch ideas borrowed from [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee — a token-compression skill built on the same "small mouth, big brain" idea.

Rocky is a character created by Andy Weir in *Project Hail Mary*. This is a fan project. Not affiliated with the author or publisher.

## License

MIT. See [LICENSE](LICENSE).
