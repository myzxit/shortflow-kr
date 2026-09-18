import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/** 데이터(DB · 원본 · 결과물)가 모이는 곳. Termux 홈 아래가 기본값. */
export const DATA_DIR = path.resolve(
  process.env.SHORTFLOW_DATA || path.join(os.homedir(), "shortflow-data")
);

export const BIN = {
  ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobe: process.env.FFPROBE_PATH || "ffprobe",
  ytdlp: process.env.YTDLP_PATH || "yt-dlp",
  whisper: process.env.WHISPER_CLI || path.join(DATA_DIR, "whisper.cpp/build/bin/whisper-cli"),
};

export const WHISPER_MODEL =
  process.env.WHISPER_MODEL_PATH || path.join(DATA_DIR, "models/ggml-base.bin");

export const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || "ko";

/** 자막에 쓸 글꼴. Termux 는 시스템 한글 글꼴이 없어 파일 경로로 지정한다. */
export const SUBTITLE_FONT_DIR = process.env.SUBTITLE_FONT_DIR || path.join(DATA_DIR, "fonts");
export const SUBTITLE_FONT = process.env.SUBTITLE_FONT || "NanumGothic";

export const projectDir = (id) => path.join(DATA_DIR, "projects", id);
export const uploadDir = (userId) => path.join(DATA_DIR, "uploads", userId);

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const toRelative = (abs) => path.relative(DATA_DIR, abs).split(path.sep).join("/");
export const toAbsolute = (rel) => path.join(DATA_DIR, rel);

/** DATA_DIR 밖을 가리키는 경로(../ 섞인 것)를 막는다. */
export function resolveSafe(rel) {
  const abs = path.resolve(DATA_DIR, rel);
  if (abs !== DATA_DIR && !abs.startsWith(DATA_DIR + path.sep)) return null;
  return abs;
}
