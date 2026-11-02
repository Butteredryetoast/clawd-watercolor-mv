#!/usr/bin/env bash
# Create a new Clawd MV project from the skill template.
#   bash scripts/new_project.sh <new project dir> [<existing project whose node_modules to clone>]
# Copies template/ (refuses an existing dir), then clones node_modules from the given project (APFS clone: instant,
# no extra disk) or runs npm install. Prints the next steps.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?usage: new_project.sh <dir> [<project with node_modules>]}"
[ -e "$DEST" ] && { echo "refusing: $DEST already exists"; exit 1; }
mkdir -p "$(dirname "$DEST")"
cp -R "$HERE/template" "$DEST"
mkdir -p "$DEST/out/check"
if [ -n "${2:-}" ] && [ -d "$2/node_modules/p5.brush" ]; then cp -Rc "$2/node_modules" "$DEST/node_modules" 2>/dev/null || cp -R "$2/node_modules" "$DEST/node_modules"
else (cd "$DEST" && npm install --no-audit --no-fund); fi
cat <<MSG
created $DEST
next:
  1. copy the MP3 (and LRC / lyric JSON) into $DEST/assets/; set title, artist, slug, audio, duration, sample in src/config.js
  2. no JSON yet:  python3 tools/lrc_to_json.py --lrc=assets/<song>.lrc
  3. node tools/beat.mjs  → CONFIG.beat
  4. write STORYBOARD.md (user confirms first), then python3 tools/build_data.py
  5. replace src/cast.js / props.js / world.js / ch/c00_demo.js; list new files in studio.html
MSG
