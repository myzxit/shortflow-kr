import fs from "node:fs";
import path from "node:path";
import { run, escapeFilterPath } from "./media.mjs";
import { BIN, SUBTITLE_FONT, SUBTITLE_FONT_DIR } from "./paths.mjs";
import { buildAss, totalDuration } from "./subtitles.mjs";
import { getAspect } from "./templates.mjs";

// 폰 CPU 를 생각해 기본을 빠른 프리셋으로 둔다.
const PRESET = process.env.FFMPEG_PRESET || "veryfast";
const CRF = process.env.FFMPEG_CRF || "23";

/**
 * 유지 구간들을 잘라 이어붙이고 → 세로로 크롭 → 자막을 구워 넣는다.
 * ffmpeg 한 번의 filter_complex 로 끝내서 중간 파일을 안 만든다.
 */
export async function renderShort(opts) {
  fs.mkdirSync(opts.outDir, { recursive: true });

  const aspect = getAspect(opts.aspectRatio);
  const duration = totalDuration(opts.ranges);
  const videoPath = path.join(opts.outDir, `${opts.fileBase}.mp4`);

  const filters = [];
  const concatInputs = [];

  opts.ranges.forEach((range, i) => {
    const start = range.start.toFixed(3);
    const end = range.end.toFixed(3);
    filters.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`);
    filters.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`);
    concatInputs.push(`[v${i}][a${i}]`);
  });

  filters.push(`${concatInputs.join("")}concat=n=${opts.ranges.length}:v=1:a=1[vcat][aout]`);
  filters.push(
    `[vcat]scale=${aspect.width}:${aspect.height}:force_original_aspect_ratio=increase,` +
      `crop=${aspect.width}:${aspect.height},setsar=1[vscaled]`
  );

  if (opts.burnSubtitles) {
    const assPath = path.join(opts.outDir, `${opts.fileBase}.ass`);
    fs.writeFileSync(
      assPath,
      buildAss({
        captions: opts.captions,
        title: opts.title,
        template: opts.template,
        width: aspect.width,
        height: aspect.height,
        durationSec: duration,
        fontName: SUBTITLE_FONT,
      }),
      "utf-8"
    );

    // Termux 에는 시스템 한글 글꼴이 없다. fontsdir 로 직접 알려줘야
    // 자막이 네모(□□□)로 나오지 않는다.
    const fontsDir = fs.existsSync(SUBTITLE_FONT_DIR)
      ? `:fontsdir='${escapeFilterPath(SUBTITLE_FONT_DIR)}'`
      : "";
    filters.push(`[vscaled]ass='${escapeFilterPath(assPath)}'${fontsDir}[vout]`);
  } else {
    filters.push(`[vscaled]null[vout]`);
  }

  await run(BIN.ffmpeg, [
    "-y", "-i", opts.sourcePath,
    "-filter_complex", filters.join(";"),
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", PRESET, "-crf", CRF,
    "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-movflags", "+faststart",
    videoPath,
  ]);

  return { videoPath, durationSec: duration };
}
