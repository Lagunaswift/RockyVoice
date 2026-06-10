#!/usr/bin/env bash
# rocky-voice installer. No Node. No build. One file.
#
#   curl -fsSL https://raw.githubusercontent.com/Lagunaswift/RockyVoice/main/install.sh | bash
#
# Copies SKILL.md into your Claude skills directory.
# For the voice app, see rocky-tts/ in the repo.

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/Lagunaswift/RockyVoice/main"

# Common Claude skills locations. First one that exists wins.
CANDIDATES=(
  "$HOME/.claude/skills"
  "$HOME/.config/claude/skills"
)

DEST=""
for dir in "${CANDIDATES[@]}"; do
  if [ -d "$dir" ]; then
    DEST="$dir"
    break
  fi
done

# None found — default to the standard one and create it.
if [ -z "$DEST" ]; then
  DEST="$HOME/.claude/skills"
fi

mkdir -p "$DEST/rocky-voice"

echo "rocky-voice: installing to $DEST/rocky-voice"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$REPO_RAW/rocky-voice/SKILL.md" -o "$DEST/rocky-voice/SKILL.md"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$REPO_RAW/rocky-voice/SKILL.md" -O "$DEST/rocky-voice/SKILL.md"
else
  echo "rocky-voice: need curl or wget. Install one and re-run." >&2
  exit 1
fi

echo "rocky-voice: done. Turn it on, then talk to space friend."
echo "rocky-voice: stop any time with \"Rocky stop\" or \"normal mode\"."
echo ""
echo "rocky-voice: want Rocky to SPEAK? See rocky-tts/ in the repo:"
echo "  git clone https://github.com/Lagunaswift/RockyVoice.git"
echo "  cd RockyVoice/rocky-tts && cp .env.example .env && npm install && npm start"
