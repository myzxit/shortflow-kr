import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BIN } from "./paths.mjs";

/** 외부 명령 실행. 종료코드가 0이 아니면 stderr 끝부분을 담아 throw. */
export function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      if (stderr.length > 120_000) stderr = stderr.slice(-60_000);
      opts.onStderr?.(text);
    });

    child.on("error", (err) => {
      reject(
        err.code === "ENOENT"
          ? new Error(`실행 파일을 찾을 수 없습니다: ${bin}`)
          : err
      );
    });
    child.on("close", (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(new Error(`${path.basename(bin)} 종료 코드 ${code}\n${stderr.slice(-2500)}`))
    );
  });
}

export async function checkBinary(bin, hint) {
  try {
    await run(bin, ["-version"]);
  } catch {
    throw new Error(`${bin} 을(를) 실행할 수 없습니다. ${hint}`);
  }
}

export async function probeDuration(file) {
  const { stdout } = await run(BIN.ffprobe, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const value = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(value)) throw new Error("영상 길이를 읽을 수 없습니다.");
  return value;
}

/** whisper.cpp 는 16kHz 모노 wav 만 받는다. */
export async function extractAudio(input, output) {
  await run(BIN.ffmpeg, [
    "-y", "-i", input,
    "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
    output,
  ]);
}

export async function extractThumbnail(input, output, atSec) {
  await run(BIN.ffmpeg, [
    "-y", "-ss", atSec.toFixed(3), "-i", input,
    "-frames:v", "1", "-q:v", "3",
    output,
  ]);
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be",
]);

export function isYoutubeUrl(value) {
  try {
    return YOUTUBE_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * 유튜브 다운로드. 폰 저장공간과 처리 속도를 생각해 720p 로 제한한다.
 * (어차피 결과물은 1080x1920 세로이고, 원본 720p 면 충분하다.)
 */
export async function downloadYoutube(url, destDir) {
  fs.mkdirSync(destDir, { recursive: true });

  await run(BIN.ytdlp, [
    "--no-playlist", "--no-progress", "--retries", "3",
    "--merge-output-format", "mp4",
    "-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best",
    "-o", path.join(destDir, "source.%(ext)s"),
    url,
  ]);

  const file = fs
    .readdirSync(destDir)
    .filter((n) => n.startsWith("source."))
    .map((n) => path.join(destDir, n))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];

  if (!file) throw new Error("영상을 내려받지 못했습니다.");
  return file;
}

export async function fetchYoutubeTitle(url) {
  try {
    const { stdout } = await run(BIN.ytdlp, [
      "--no-playlist", "--skip-download", "--print", "%(title)s", url,
    ]);
    return stdout.trim().split("\n")[0] || null;
  } catch {
    return null;
  }
}

/** ffmpeg 필터 그래프 안에서 경로에 쓰이는 특수문자 이스케이프 */
export const escapeFilterPath = (p) =>
  p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
