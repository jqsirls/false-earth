#!/usr/bin/env bash
# Convert jq-lite PNG atlases to KTX2 for Safari GPU memory budget.
# Requires Khronos toktx: https://github.com/KhronosGroup/KTX-Software
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/public/textures/jq-lite"
OUT="${ROOT}/public/textures/jq-ktx2"

if ! command -v toktx >/dev/null 2>&1; then
  echo "toktx not found. Install KTX-Software, then re-run." >&2
  exit 1
fi

mkdir -p "$OUT"

find "$SRC" -name '*.png' | while read -r png; do
  rel="${png#"$SRC"/}"
  dest="${OUT}/${rel%.png}.ktx2"
  mkdir -p "$(dirname "$dest")"
  toktx --bcmp --genmipmap "$dest" "$png"
  echo "→ $dest"
done

echo "Done. Wire jq-ktx2 paths in jqConfig when ready."
