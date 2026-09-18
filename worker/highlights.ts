import type { Segment } from "./transcribe";
import { scoreText, MIN_SEGMENT_CHARS } from "../src/lib/hookPatterns";

export type Highlight = {
  index: number;
  title: string;
  startSec: number;
  endSec: number;
  score: number;
  reason: string;
  segments: Segment[];
};

/** 세그먼트 하나의 매력도를 점수화한다. 규칙은 src/lib/hookPatterns.ts 와 공유한다. */
function scoreSegment(seg: Segment): { score: number; labels: string[] } {
  const text = seg.text.trim();
  if (text.length < MIN_SEGMENT_CHARS) return { score: 0, labels: [] };

  const { score, labels } = scoreText(text, seg.end - seg.start);
  return { score, labels };
}

function cleanTitle(text: string, maxLen = 24): string {
  let title = text
    .replace(/\s+/g, " ")
    .replace(/^[,.\-–—·"'“”‘’\s]+/, "")
    .replace(/[,.\s]+$/, "")
    .trim();

  if (title.length > maxLen) {
    // 어절 단위로 자른다.
    const words = title.split(" ");
    title = "";
    for (const w of words) {
      if ((title + " " + w).trim().length > maxLen) break;
      title = (title + " " + w).trim();
    }
    if (!title) title = text.slice(0, maxLen);
    title += "…";
  }
  return title || "하이라이트";
}

/**
 * 하이라이트 구간을 고른다.
 *
 * - 점수가 가장 높은 세그먼트를 "앵커"로 잡고, 그 앵커가 결과물의 앞 3초 안에
 *   들어오도록 윈도우를 붙인다(첫 3초 훅).
 * - 경계는 항상 세그먼트(문장) 경계에 맞춰 말이 잘리지 않게 한다.
 * - 이미 고른 구간과 겹치면 버린다.
 */
export function pickHighlights(
  segments: Segment[],
  opts: { count: number; minSec: number; maxSec: number; hookLeadSec?: number }
): Highlight[] {
  const hookLead = opts.hookLeadSec ?? 3;
  const scored = segments.map((seg) => ({ seg, ...scoreSegment(seg) }));

  const candidates: Array<Omit<Highlight, "index">> = [];

  for (let anchorIdx = 0; anchorIdx < scored.length; anchorIdx++) {
    const anchor = scored[anchorIdx];
    if (anchor.score <= 0) continue;

    // 앵커가 앞 hookLead 초 안에 들어오도록 시작점을 잡는다.
    let startIdx = anchorIdx;
    while (startIdx > 0) {
      const candidateStart = scored[startIdx - 1].seg.start;
      if (anchor.seg.start - candidateStart > hookLead) break;
      startIdx -= 1;
    }

    const startSec = scored[startIdx].seg.start;
    let endIdx = anchorIdx;
    let endSec = anchor.seg.end;

    // 최소 길이를 채울 때까지 뒤로 확장하되 최대 길이는 넘지 않는다.
    while (endIdx + 1 < scored.length) {
      const next = scored[endIdx + 1];
      if (next.seg.end - startSec > opts.maxSec) break;
      endIdx += 1;
      endSec = next.seg.end;
      if (endSec - startSec >= opts.minSec && /[.!?。…]$/.test(next.seg.text)) break;
    }

    const length = endSec - startSec;
    if (length < Math.min(opts.minSec, 10)) continue;

    const windowSegments = scored.slice(startIdx, endIdx + 1);
    const total = windowSegments.reduce((sum, s) => sum + s.score, 0);
    // 길이로 나눠 "밀도 높은 구간"이 유리하도록 정규화한다.
    const normalized = total / Math.sqrt(length);

    const labels = Array.from(new Set(windowSegments.flatMap((s) => s.labels))).slice(0, 3);

    candidates.push({
      title: cleanTitle(anchor.seg.text),
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      score: Number(normalized.toFixed(3)),
      reason: labels.length
        ? `${labels.join(" · ")}이(가) 몰려 있는 구간입니다.`
        : "말의 밀도가 높아 몰입도가 유지되는 구간입니다.",
      segments: windowSegments.map((s) => s.seg),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // 겹치지 않게 상위부터 고른다 (non-maximum suppression).
  const picked: Array<Omit<Highlight, "index">> = [];
  for (const cand of candidates) {
    if (picked.length >= opts.count) break;
    const overlaps = picked.some(
      (p) => cand.startSec < p.endSec - 1 && cand.endSec > p.startSec + 1
    );
    if (!overlaps) picked.push(cand);
  }

  // 원본 등장 순서로 정렬해 번호를 매긴다.
  picked.sort((a, b) => a.startSec - b.startSec);
  return picked.map((p, i) => ({ ...p, index: i + 1 }));
}

/**
 * 무음 제거용 유지 구간 계산.
 * 세그먼트 사이 공백이 threshold 를 넘으면 잘라낸다.
 */
export function buildKeepRanges(
  segments: Segment[],
  startSec: number,
  endSec: number,
  opts: { removeSilence: boolean; thresholdSec?: number; padSec?: number }
): Array<{ start: number; end: number }> {
  if (!opts.removeSilence || segments.length === 0) {
    return [{ start: startSec, end: endSec }];
  }

  const threshold = opts.thresholdSec ?? 0.6;
  const pad = opts.padSec ?? 0.12;
  const ranges: Array<{ start: number; end: number }> = [];

  for (const seg of segments) {
    const start = Math.max(startSec, seg.start - pad);
    const end = Math.min(endSec, seg.end + pad);
    if (end - start <= 0.05) continue;

    const last = ranges[ranges.length - 1];
    if (last && start - last.end < threshold) {
      last.end = Math.max(last.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  if (ranges.length === 0) return [{ start: startSec, end: endSec }];
  return ranges;
}
