#!/usr/bin/env bash
# rocky-voice installer. Installs the text skill for Claude Code and/or Hermes.
#
#   curl -fsSL https://raw.githubusercontent.com/Lagunaswift/RockyVoice/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/Lagunaswift/RockyVoice/main/install.sh | bash -s -- --hermes
#
# For the voice app, see rocky-tts/ in the repo.

set -euo pipefail

REPO_RAW="${ROCKYVOICE_RAW:-https://raw.githubusercontent.com/Lagunaswift/RockyVoice/main}"
MODE="claude"

usage() {
  cat <<'EOF'
Usage: install.sh [--claude|--hermes|--all]

Default: --claude
  --claude   Install Claude Code skill to ~/.claude/skills/rocky-voice
  --hermes   Install Hermes skill to ~/.hermes/skills/creative/rocky-voice
  --all      Install both
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --claude) MODE="claude" ;;
    --hermes) MODE="hermes" ;;
    --all) MODE="all" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "rocky-voice: unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

download() {
  local url="$1"
  local out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$out"
  else
    echo "rocky-voice: need curl or wget. Install one and re-run." >&2
    exit 1
  fi
}

install_claude() {
  local candidates=(
    "$HOME/.claude/skills"
    "$HOME/.config/claude/skills"
  )
  local dest=""
  for dir in "${candidates[@]}"; do
    if [ -d "$dir" ]; then
      dest="$dir"
      break
    fi
  done
  if [ -z "$dest" ]; then
    dest="$HOME/.claude/skills"
  fi

  mkdir -p "$dest/rocky-voice"
  echo "rocky-voice: installing Claude skill to $dest/rocky-voice"
  download "$REPO_RAW/rocky-voice/SKILL.md" "$dest/rocky-voice/SKILL.md"
}

install_hermes() {
  local hermes_home="${HERMES_HOME:-$HOME/.hermes}"
  local dest="$hermes_home/skills/creative/rocky-voice"
  mkdir -p "$dest"
  echo "rocky-voice: installing Hermes skill to $dest"
  download "$REPO_RAW/hermes/rocky-voice/SKILL.md" "$dest/SKILL.md"
}

case "$MODE" in
  claude) install_claude ;;
  hermes) install_hermes ;;
  all) install_claude; install_hermes ;;
esac

echo "rocky-voice: done. Turn it on, then talk to space friend."
echo "rocky-voice: stop any time with \"Rocky stop\" or \"normal mode\"."
echo ""
echo "rocky-voice: want Rocky to SPEAK? See rocky-tts/ in the repo:"
echo "  git clone https://github.com/Lagunaswift/RockyVoice.git"
echo "  cd RockyVoice/rocky-tts && cp .env.example .env && npm install && npm start"
echo ""
echo "rocky-voice: for Hermes TTS, configure a command provider that runs:"
echo "  node /path/to/RockyVoice/rocky-tts/hermes-tts.js --text-file {input_path} --output {output_path}"
