#!/usr/bin/env bash
# Resize JQ 4K PNG atlases to 2048² for Safari WebGPU memory budget.
# Requires macOS `sips` (ships with macOS). Re-run after updating public/textures/jq/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/textures/jq"
DST="$ROOT/public/textures/jq-lite"
MAX=2048

if [[ ! -d "$SRC" ]]; then
  echo "Missing source textures: $SRC" >&2
  exit 1
fi

mkdir -p "$DST"

count=0
while IFS= read -r -d '' src; do
  rel="${src#$SRC/}"
  out="$DST/$rel"
  mkdir -p "$(dirname "$out")"
  sips -Z "$MAX" "$src" --out "$out" >/dev/null
  count=$((count + 1))
  echo "  $rel"
done < <(find "$SRC" -name '*.png' -print0)

echo "Generated $count jq-lite textures (max ${MAX}px) in public/textures/jq-lite/"
