#!/bin/bash
# build-scripts/pack_demo.sh
# Creates a zip archive of the demo branch files for Cocos Creator import.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT=mirror-maze-demo.zip
echo "Packing demo from $ROOT_DIR to $OUT"

# Files to include - adjust as needed
INCLUDE=(
  "assets"
  "assets/scripts"
  "assets/settings/levels.json"
  "scenes/Main.scene"
  "package.json"
  "project.json"
  "README_DEMO.md"
  "docs"
)

cd "$ROOT_DIR"
zip -r "$OUT" "${INCLUDE[@]}" >/dev/null
if [ $? -eq 0 ]; then
  echo "Created $OUT"
else
  echo "Zip failed"
fi
