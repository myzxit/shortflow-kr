#!/usr/bin/env bash
# 숏플로우 · 안드로이드(Termux) 설치
#
#   bash setup.sh
#
# 여러 번 실행해도 안전합니다. 이미 끝난 단계는 건너뜁니다.

set -e

DATA_DIR="${SHORTFLOW_DATA:-$HOME/shortflow-data}"
MODEL="${SHORTFLOW_MODEL:-base}"   # tiny | base | small
JOBS="${JOBS:-4}"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }

mkdir -p "$DATA_DIR/models" "$DATA_DIR/fonts"

say "1/5 · 필요한 패키지 설치"
pkg update -y
pkg install -y nodejs ffmpeg python git cmake clang wget

say "2/5 · yt-dlp 설치 (유튜브 링크용)"
pip install -U yt-dlp

say "3/5 · whisper.cpp 빌드 (음성 인식 · 몇 분 걸립니다)"
if [ -x "$DATA_DIR/whisper.cpp/build/bin/whisper-cli" ]; then
  echo "이미 빌드되어 있습니다. 건너뜁니다."
else
  if [ ! -d "$DATA_DIR/whisper.cpp" ]; then
    git clone --depth 1 https://github.com/ggml-org/whisper.cpp "$DATA_DIR/whisper.cpp"
  fi
  cd "$DATA_DIR/whisper.cpp"
  # OPENMP 를 끄는 이유: Termux 에 libomp 가 없는 경우가 많아 빌드가 깨진다.
  cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_OPENMP=OFF \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_SERVER=OFF
  cmake --build build -j"$JOBS" --target whisper-cli
  cd - >/dev/null
fi

say "4/5 · 음성 인식 모델 내려받기 ($MODEL)"
MODEL_FILE="$DATA_DIR/models/ggml-$MODEL.bin"
if [ -s "$MODEL_FILE" ]; then
  echo "이미 있습니다. 건너뜁니다."
else
  wget -O "$MODEL_FILE" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$MODEL.bin"
fi

say "5/5 · 한글 글꼴 내려받기"
FONT_FILE="$DATA_DIR/fonts/NanumGothic-Regular.ttf"
if [ -s "$FONT_FILE" ]; then
  echo "이미 있습니다. 건너뜁니다."
else
  # Termux 에는 시스템 한글 글꼴이 없어서, 없으면 자막이 네모(□□□)로 나온다.
  wget -O "$FONT_FILE" \
    "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf"
fi

cat <<EOF

────────────────────────────────────────
 설치가 끝났습니다.

   bash start.sh

 를 실행한 뒤 브라우저에서  http://localhost:3000  을 여세요.

 데이터 위치: $DATA_DIR
 사용 모델  : ggml-$MODEL.bin
────────────────────────────────────────
EOF
