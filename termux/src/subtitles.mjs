/** 자막 덩어리 분할 + ASS 생성. 웹 버전(worker/subtitles.ts)과 같은 규칙. */

const MAX_CAPTION_CHARS = 16;
const MAX_CAPTION_SEC = 2.2;

/** 원본 시각 → 무음을 잘라낸 뒤의 출력 타임라인 시각 */
export function mapToOutputTime(t, ranges) {
  let acc = 0;
  for (const r of ranges) {
    if (t < r.start) return acc;
    if (t <= r.end) return acc + (t - r.start);
    acc += r.end - r.start;
  }
  return acc;
}

export const totalDuration = (ranges) => ranges.reduce((s, r) => s + (r.end - r.start), 0);

export function buildCaptions(segments, window, ranges) {
  const captions = [];

  const push = (start, end, text) => {
    const clean = text.trim();
    if (!clean) return;
    const s = mapToOutputTime(Math.max(start, window.start), ranges);
    const e = mapToOutputTime(Math.min(end, window.end), ranges);
    if (e - s < 0.2) return;
    captions.push({ start: s, end: e, text: clean });
  };

  for (const seg of segments) {
    if (seg.end < window.start || seg.start > window.end) continue;

    const words = (seg.words ?? []).filter((w) => w.end >= window.start && w.start <= window.end);
    if (words.length === 0) {
      push(seg.start, seg.end, seg.text);
      continue;
    }

    let chunk = [];
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

  captions.sort((a, b) => a.start - b.start);
  for (let i = 1; i < captions.length; i++) {
    if (captions[i].start < captions[i - 1].end) captions[i - 1].end = captions[i].start;
  }
  return captions.filter((c) => c.end > c.start);
}

/** "0xRRGGBB" 또는 "0xRRGGBB@0.8" → ASS 색상(&HAABBGGRR) */
export function toAssColor(value) {
  const [hexPart, alphaPart] = String(value).split("@");
  const hex = hexPart.replace(/^0x/i, "").padStart(6, "0");
  const [rr, gg, bb] = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
  const opacity = alphaPart ? Number.parseFloat(alphaPart) : 1;
  const alpha = Math.round((1 - Math.min(Math.max(opacity, 0), 1)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `&H${alpha}${bb}${gg}${rr}`.toUpperCase();
}

const assTime = (seconds) => {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
};

const escapeAss = (t) => t.replace(/\{/g, "(").replace(/\}/g, ")").replace(/\r?\n/g, "\\N");

export function buildAss({ captions, title, template: t, width, height, durationSec, fontName }) {
  const fontSize = Math.round(height * 0.042);
  const titleSize = Math.round(height * 0.034);
  // ASS 의 MarginV 는 하단 기준이라 subtitleY(상단 기준)를 뒤집는다.
  const marginV = Math.round(height * (1 - t.subtitleY));
  const side = Math.round(width * 0.06);

  const styles = [
    `Style: Caption,${fontName},${fontSize},${toAssColor(t.fontColor)},&H000000FF,` +
      `${toAssColor(t.borderColor)},${t.boxColor ? toAssColor(t.boxColor) : "&HFF000000"},` +
      `1,0,0,0,100,100,0,0,${t.boxColor ? 3 : 1},${t.borderWidth},${t.boxColor ? 0 : 2},2,` +
      `${side},${side},${marginV},1`,
    `Style: Title,${fontName},${titleSize},${toAssColor(t.titleColor)},&H000000FF,` +
      `${toAssColor(t.titleBarColor)},${toAssColor(t.titleBarColor)},` +
      // 박스형에서 Outline 은 글자 둘레 여백이다. 크게 주면 글자를 삼킨다.
      `1,0,0,0,100,100,0,0,3,${Math.round(titleSize * 0.25)},0,8,` +
      `${Math.round(width * 0.05)},${Math.round(width * 0.05)},${Math.round(height * 0.05)},1`,
  ];

  const events = [];
  if (t.titleBar && title) {
    events.push(`Dialogue: 0,${assTime(0)},${assTime(durationSec)},Title,,0,0,0,,${escapeAss(title)}`);
  }
  for (const c of captions) {
    events.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Caption,,0,0,0,,${escapeAss(c.text)}`);
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
