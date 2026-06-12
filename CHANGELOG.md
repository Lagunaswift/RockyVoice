# Changelog

## Unreleased

### Added
- Phone speaker support — Rocky speaks through your phone via Tailscale. The server broadcasts to all connected SSE clients; the phone is just a second browser
- Wake Lock — keeps the phone screen on while the Eridian Translator tab is open and foregrounded (requires HTTPS)
- `TAILNET_HOST` env var — prints the phone URL on boot when set
- `HOST=0.0.0.0` support — allows connections from other devices on the tailnet
- TTS auto-setup in SKILL.md — Claude detects missing hooks, permissions, dependencies, and server state on activation and configures everything automatically
- Progress voice lines — Rocky speaks short updates between tool calls via curl, instructions built into the skill
- `.claude/settings.local.json.example` — template with hooks and permissions for manual setup
- Root `.gitignore` to keep user settings out of git
- Volume slider with persistent setting across refreshes
- Stop button to kill audio mid-playback
- HUME_API_KEY validation at startup with clear warning if missing
- Hook log rotation at 512 KB to prevent unbounded growth
- Graceful handling of partial Hume stream failures

### Fixed
- Replaced synchronous `appendFileSync` with async write stream
- README now matches actual UI (removed references to nonexistent paste/Speak UI)
- `.env.example` ROCKY_SPEED default matches code default (1.25)

## 2025-06-01

### Added
- Eridian Translator UI with vertical rainbow waveforms and theme picker (cyan, amber, green, purple, red, rainbow)
- Strip tables, finding IDs, and extra symbols from TTS input
- Speak all assistant messages, not just the last one

### Changed
- Replaced copyrighted voice sample with original recording

## 2025-05-30

### Added
- Progressive PCM streaming from Hume TTS (chunks play as they arrive)
- Per-account voice cloning (each user clones their own Rocky voice)
- Fallback to stock Hume voice when no clone is configured
- Prosody context chaining across messages for consistent Rocky voice

## 2025-05-28

### Added
- Rocky TTS voice app powered by Hume AI
- SSE-based audio streaming to browser
- Speech cleaning (strips markdown, code blocks, URLs, HTML)
- Utterance splitting for long replies (stays under Hume's 5000 char limit)
- SessionStart hook for auto-starting the voice server
- Stop hook for automatic speech on every Claude response

## 2025-05-27

### Added
- Rocky voice skill (`rocky-voice/SKILL.md`)
- One-line installer script (`install.sh`)
- README with setup guide, voice cloning instructions, and configuration reference
