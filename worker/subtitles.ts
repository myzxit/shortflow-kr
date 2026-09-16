import type { Segment, Word } from "./transcribe";
import type { Template } from "../src/lib/templates";

export type KeepRange = { start: number; end: number };

/**
 * 원본 타임라인의 시각을 "무음을 잘라낸 뒤"의 출력 타임라인 시각으로 옮긴다.
 * 잘려나간 구간에 속하는 시각은 가장 가까운 유지 구간 경계로 스냅한다.
 */
export function mapToOutputTime(t: number, ranges: KeepRange[]): number {
  let acc = 0;
  for (const r of ranges) {
    if (t < r.start) return acc;
    if (t <= r.end) return acc + (t - r.start);
    acc += r.end - r.start;
  }
  return acc;
}

export function totalDuration(ranges: KeepRange[]): number {
  return ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
}

export type Caption = { start: number; end: number; text: string };

const MAX_CAPTION_CHARS = 16;
const MAX_CAPTION_SEC = 2.2;

/**
 * 단어 타임스탬프를 짧은 자막 덩어리로 묶는다.
 * 단어 정보가 없는 세그먼트는 문장 전체를 하나의 자막으로 쓴다.
 */
export function buildCaptions(
  segments: Segment[],
  window: { start: number; end: number },
  ranges: KeepRange[]
): Caption[] {
  const captions: Caption[] = [];

  const push = (start: number, end: number, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const s = mapToOutputTime(Math.max(start, window.start), ranges);
    const e = mapToOutputTime(Math.min(end, window.end), ranges);
    if (e - s < 0.2) return;
    captions.push({ start: s, end: e, text: clean });
  };

  for (const seg of segments) {
    if (seg.end < window.start || seg.start > window.end) continue;

    const words: Word[] = (seg.words ?? []).filter(
      (w) => w.end >= window.start && w.start <= window.end
    );

    if (words.length === 0) {
      push(seg.start, seg.end, seg.text);
      continue;
    }

    let chunk: Word[] = [];
    const flush = () => {
      if (chunk.length === 0) return;
      push(chunk[0].start, chunk[chunk.length - 1].end, chunk.map((w) => w.word).join(" "));
      chunk = [];
    };

    for (const w of words) {
      const nextText = [...chunk, w].map((x) => x.word).join(" ");
      const nextSpan = w.end - (chunk[0]?.start ?? w.start);
      if (chunk.length > 0 && (nextText.length > MAX_CAPTION_CHARS || nextSpan > MAX_CAPTION_SEC)) {
        flush();
      }
      chunk.push(w);
      if (/[.!?。…]$/.test(w.word)) flush();
    }
    flush();
  }

  // 겹침 제거
  captions.sort((a, b) => a.start - b.start);
  for (let i = 1; i < captions.length; i++) {
    if (captions[i].start < captions[i - 1].end) {
      captions[i - 1].end = captions[i].start;
    }
  }
  return captions.filter((c) => c.end > c.start);
}

/** "0xRRGGBB" 또는 "0xRRGGBB@0.8" 을 ASS 색상(&HAABBGGRR)으로 변환 */
export function toAssColor(value: string): string {
  const [hexPart, alphaPart] = value.split("@");
  const hex = hexPart.replace(/^0x/i, "").padStart(6, "0");
  const rr = hex.slice(0, 2);
  const gg = hex.slice(2, 4);
  const bb = hex.slice(4, 6);
  const opacity = alphaPart ? Number.parseFloat(alphaPart) : 1;
  // ASS 의 alpha 는 "투명도"라서 반전시킨다. 00 = 불투명.
  const alpha = Math.round((1 - Math.min(Math.max(opacity, 0), 1)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `&H${alpha}${bb}${gg}${rr}`.toUpperCase();
}

function assTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
}

function escapeAss(text: string): string {
  return text.replace(/\{/g, "(").replace(/\}/g, ")").replace(/\r?\n/g, "\\N");
}

export const SUBTITLE_FONT = process.env.SUBTITLE_FONT || "NanumGothic";

/**
 * 자막 + (템플릿에 따라) 상단 타이틀을 담은 ASS 파일 내용을 만든다.
 * libass 로 렌더링되므로 한글 폰트가 시스템에 설치되어 있어야 한다.
 */
export function buildAss(opts: {
  captions: Caption[];
  title: string;
  template: Template;
  width: number;
  height: number;
  durationSec: number;
}): string {
  const { template: t, width, height } = opts;

  const fontSize = Math.round(height * 0.042);
  const titleSize = Math.round(height * 0.034);
  // ASS 의 MarginV 는 하단 기준이므로 subtitleY(상단 기준 비율)를 뒤집는다.
  const marginV = Math.round(height * (1 - t.subtitleY));

  const styles = [
    `Style: Caption,${SUBTITLE_FONT},${fontSize},${toAssColor(t.fontColor)},&H000000FF,${toAssColor(
      t.borderColor
    )},${t.boxColor ? toAssColor(t.boxColor) : "&HFF000000"},1,0,0,0,100,100,0,0,${
      t.boxColor ? 3 : 1
    },${t.borderWidth},${t.boxColor ? 0 : 2},2,${Math.round(width * 0.06)},${Math.round(
      width * 0.06
    )},${marginV},1`,
    `Style: Title,${SUBTITLE_FONT},${titleSize},${toAssColor(t.titleColor)},&H000000FF,${toAssColor(
      t.titleBarColor
    )},${toAssColor(t.titleBarColor)},1,0,0,0,100,100,0,0,3,${Math.round(
      // 박스형(BorderStyle 3)에서 Outline 은 글자 둘레의 여백이다.
      // 너무 키우면 글자를 삼켜 글자색이 묻힌다.
      titleSize * 0.25
    )},0,8,${Math.round(width * 0.05)},${Math.round(width * 0.05)},${Math.round(height * 0.05)},1`,
  ];

  const events: string[] = [];

  if (t.titleBar && opts.title) {
    events.push(
      `Dialogue: 0,${assTime(0)},${assTime(opts.durationSec)},Title,,0,0,0,,${escapeAss(opts.title)}`
    );
  }

  for (const c of opts.captions) {
    events.push(
      `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Caption,,0,0,0,,${escapeAss(c.text)}`
    );
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styles.join("\n")}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}
