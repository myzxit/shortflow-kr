/**
 * 렌더링 파이프라인 스모크 테스트.
 * 음성 인식(faster-whisper) 없이, 합성 영상 + 손으로 만든 자막 데이터로
 * 하이라이트 선정 → 무음 제거 → 자막 번인 → mp4 출력까지 한 번에 확인한다.
 *
 *   npx tsx scripts/smoke-render.ts
 *
 * 결과물: storage/smoke/short-1.mp4
 */

import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../worker/env";

loadEnv();

import { FFMPEG, run, probeDuration } from "../worker/ffmpeg";
import { pickHighlights, buildKeepRanges } from "../worker/highlights";
import { buildCaptions, totalDuration } from "../worker/subtitles";
import { renderShort } from "../worker/render";
import { getTemplate } from "../src/lib/templates";
import type { Segment } from "../worker/transcribe";

const OUT = path.resolve(process.cwd(), "storage", "smoke");

/** 문장 하나를 세그먼트로. 단어 타임스탬프는 균등 분할해 흉내 낸다. */
function segment(start: number, end: number, text: string): Segment {
  const tokens = text.split(" ");
  const step = (end - start) / tokens.length;
  return {
    start,
    end,
    text,
    words: tokens.map((word, i) => ({
      start: Number((start + i * step).toFixed(3)),
      end: Number((start + (i + 1) * step).toFixed(3)),
      word,
    })),
  };
}

const SEGMENTS: Segment[] = [
  segment(0, 4, "안녕하세요 오늘은 영상 편집 이야기를 해보려고 합니다."),
  segment(4, 7.5, "그냥 평범한 도입부입니다."),
  // 10초 근처에 의도적으로 공백을 둔다 (무음 제거 대상).
  segment(12, 16, "사실 이 방법 하나만 바꿔도 조회수가 3배 올라갑니다."),
  segment(16, 20.5, "왜 그런지 아세요? 핵심은 첫 문장에 있습니다."),
  segment(20.5, 25, "시청자는 3초 안에 계속 볼지 말지를 정합니다."),
  segment(25, 29, "그래서 가장 강한 문장을 맨 앞에 둬야 합니다."),
  segment(29, 33, "오늘은 여기까지 하겠습니다. 감사합니다."),
];

async function makeTestVideo(target: string): Promise<void> {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // 35초짜리 가로 영상 + 사인파 오디오
  await run(FFMPEG, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=1280x720:rate=30:duration=35",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=35",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    target,
  ]);
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const source = path.join(OUT, "source.mp4");
  console.log("1. 테스트 영상 생성…");
  await makeTestVideo(source);
  console.log(`   길이 ${(await probeDuration(source)).toFixed(1)}초`);

  console.log("2. 하이라이트 선정…");
  const highlights = pickHighlights(SEGMENTS, { count: 2, minSec: 10, maxSec: 25 });
  if (highlights.length === 0) throw new Error("하이라이트를 하나도 고르지 못했습니다.");
  for (const h of highlights) {
    console.log(
      `   #${h.index} ${h.startSec}s–${h.endSec}s (${h.score}점) "${h.title}" — ${h.reason}`
    );
  }

  const top = highlights[0];
  const windowSegments = SEGMENTS.filter((s) => s.end > top.startSec && s.start < top.endSec);

  console.log("3. 무음 구간 제거…");
  const ranges = buildKeepRanges(windowSegments, top.startSec, top.endSec, {
    removeSilence: true,
  });
  console.log(
    `   유지 구간 ${ranges.length}개, 총 ${totalDuration(ranges).toFixed(1)}초 ` +
      `(원래 ${(top.endSec - top.startSec).toFixed(1)}초)`
  );

  console.log("4. 자막 생성…");
  const captions = buildCaptions(windowSegments, { start: top.startSec, end: top.endSec }, ranges);
  console.log(`   자막 ${captions.length}줄, 첫 줄: "${captions[0]?.text}"`);

  console.log("5. 렌더링…");
  const result = await renderShort({
    sourcePath: source,
    outDir: OUT,
    fileBase: "short-1",
    ranges,
    captions,
    title: top.title,
    template: getTemplate("sandpaper"),
    aspectRatio: "9:16",
    burnSubtitles: true,
  });

  const actual = await probeDuration(result.videoPath);
  const size = fs.statSync(result.videoPath).size;
  console.log(`   ${result.videoPath}`);
  console.log(`   ${actual.toFixed(1)}초 · ${(size / 1024).toFixed(0)}KB`);

  if (Math.abs(actual - result.durationSec) > 1.5) {
    throw new Error(
      `길이가 예상과 다릅니다: 예상 ${result.durationSec.toFixed(1)}초, 실제 ${actual.toFixed(1)}초`
    );
  }

  console.log("\n✅ 파이프라인 정상 동작");
}

main().catch((err) => {
  console.error("\n❌ 실패:", err.message);
  process.exit(1);
});
