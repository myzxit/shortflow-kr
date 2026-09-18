import fs from "node:fs";
import path from "node:path";
import { FFMPEG, run, escapeFilterPath } from "./ffmpeg";
import { buildAss, type Caption, type KeepRange, totalDuration } from "./subtitles";
import { getAspect, type Template } from "../src/lib/templates";

export type RenderOptions = {
  sourcePath: string;
  outDir: string;
  fileBase: string;
  ranges: KeepRange[];
  captions: Caption[];
  title: string;
  template: Template;
  aspectRatio: string;
  burnSubtitles: boolean;
};

export type RenderResult = {
  videoPath: string;
  assPath: string | null;
  durationSec: number;
};

/**
 * 유지 구간들을 잘라 이어붙이고, 세로 비율로 크롭한 뒤 자막을 구워 넣는다.
 * ffmpeg 한 번의 filter_complex 로 처리해 중간 파일을 만들지 않는다.
 */
export async function renderShort(opts: RenderOptions): Promise<RenderResult> {
  fs.mkdirSync(opts.outDir, { recursive: true });

  const aspect = getAspect(opts.aspectRatio);
  const duration = totalDuration(opts.ranges);
  const videoPath = path.join(opts.outDir, `${opts.fileBase}.mp4`);

  const filters: string[] = [];
  const concatInputs: string[] = [];

  opts.ranges.forEach((range, i) => {
    const start = range.start.toFixed(3);
    const end = range.end.toFixed(3);
    filters.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`);
    filters.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`);
    concatInputs.push(`[v${i}][a${i}]`);
  });

  filters.push(
    `${concatInputs.join("")}concat=n=${opts.ranges.length}:v=1:a=1[vcat][aout]`
  );

  // 잘린 영역이 생기지 않도록 키운 뒤 중앙 크롭한다.
  filters.push(
    `[vcat]scale=${aspect.width}:${aspect.height}:force_original_aspect_ratio=increase,` +
      `crop=${aspect.width}:${aspect.height},setsar=1[vscaled]`
  );

  let assPath: string | null = null;
  if (opts.burnSubtitles) {
    assPath = path.join(opts.outDir, `${opts.fileBase}.ass`);
    fs.writeFileSync(
      assPath,
      buildAss({
        captions: opts.captions,
        title: opts.title,
        template: opts.template,
        width: aspect.width,
        height: aspect.height,
        durationSec: duration,
      }),
      "utf-8"
    );
    filters.push(`[vscaled]ass='${escapeFilterPath(assPath)}'[vout]`);
  } else {
    filters.push(`[vscaled]null[vout]`);
  }

  await run(FFMPEG, [
    "-y",
    "-i",
    opts.sourcePath,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-movflags",
    "+faststart",
    videoPath,
  ]);

  return { videoPath, assPath, durationSec: duration };
}
