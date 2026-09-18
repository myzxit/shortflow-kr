#!/usr/bin/env bash
# 숏플로우 실행. 종료는 Ctrl+C.

set -e
cd "$(dirname "$0")"

DATA_DIR="${SHORTFLOW_DATA:-$HOME/shortflow-data}"
MODEL="${SHORTFLOW_MODEL:-base}"

export SHORTFLOW_DATA="$DATA_DIR"
export WHISPER_CLI="${WHISPER_CLI:-$DATA_DIR/whisper.cpp/build/bin/whisper-cli}"
export WHISPER_MODEL_PATH="${WHISPER_MODEL_PATH:-$DATA_DIR/models/ggml-$MODEL.bin}"
export SUBTITLE_FONT_DIR="${SUBTITLE_FONT_DIR:-$DATA_DIR/fonts}"

if [ ! -x "$WHISPER_CLI" ]; then
  echo "whisper.cpp 가 없습니다. 먼저 'bash setup.sh' 를 실행하세요." >&2
  exit 1
fi
if [ ! -s "$WHISPER_MODEL_PATH" ]; then
  echo "음성 인식 모델이 없습니다. 먼저 'bash setup.sh' 를 실행하세요." >&2
  exit 1
fi

# node:sqlite 는 Node 22 에서 실험 기능이라 플래그가 필요하고, 23 부터는 기본 제공된다.
MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 22 ]; then
  echo "Node 22 이상이 필요합니다 (현재 $(node -v)). 'pkg upgrade nodejs' 를 실행하세요." >&2
  exit 1
elif [ "$MAJOR" -eq 22 ]; then
  exec node --experimental-sqlite --no-warnings src/server.mjs
else
  exec node --no-warnings src/server.mjs
fi
