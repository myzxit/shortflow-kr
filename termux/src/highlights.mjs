/** 하이라이트 선정. 규칙은 웹 버전(src/lib/hookPatterns.ts)과 동일하다. */

export const HOOK_PATTERNS = [
  { re: /(왜|어떻게|무엇|뭐가|어디서|누가)/, weight: 2.2, label: "질문형 도입" },
  { re: /[?？]/, weight: 1.8, label: "질문 문장" },
  { re: /(사실|비결|핵심|결론|정답|이유는|포인트)/, weight: 2.4, label: "핵심 정리" },
  { re: /(절대|반드시|무조건|진짜|정말|완전|대박|충격)/, weight: 1.6, label: "강조 표현" },
  { re: /(처음|마지막|최초|유일|최고|최악)/, weight: 1.5, label: "최상급 표현" },
  { re: /\d+(\.\d+)?\s*(개|번|년|월|일|시간|분|초|원|만원|억|퍼센트|%|배)/, weight: 1.7, label: "구체적 수치" },
  { re: /(하지만|그런데|반전|알고 보니|사실은)/, weight: 1.4, label: "전환 지점" },
  { re: /[!！]/, weight: 1.0, label: "감탄 문장" },
];

const MIN_SEGMENT_CHARS = 6;

export function scoreText(text, durationSec) {
  const clean = text.trim();
  if (clean.length < MIN_SEGMENT_CHARS) return { score: 0, labels: [] };

  const duration = Math.max(0.5, durationSec ?? clean.length / 5);
  let score = Math.min(clean.length / duration, 12) * 0.45;

  const labels = [];
  for (const { re, weight, label } of HOOK_PATTERNS) {
    if (re.test(clean)) {
      score += weight;
      labels.push(label);
    }
  }
  if (/[.!?。…]$/.test(clean)) score += 0.8;

  return { score, labels };
}

function cleanTitle(text, maxLen = 24) {
  let title = text.replace(/\s+/g, " ").replace(/^[,.\-–—·"'“”‘’\s]+/, "").replace(/[,.\s]+$/, "").trim();
  if (title.length > maxLen) {
    let cut = "";
    for (const w of title.split(" ")) {
      if ((cut + " " + w).trim().length > maxLen) break;
      cut = (cut + " " + w).trim();
    }
    title = (cut || text.slice(0, maxLen)) + "…";
  }
  return title || "하이라이트";
}

/**
 * 점수가 가장 높은 문장을 앵커로 잡고, 그 문장이 결과물 앞 3초 안에 오도록
 * 앞뒤 문장을 붙인다. 경계는 항상 문장 경계라 말이 중간에 안 잘린다.
 */
export function pickHighlights(segments, { count, minSec, maxSec, hookLeadSec = 3 }) {
  const scored = segments.map((seg) => ({ seg, ...scoreText(seg.text, seg.end - seg.start) }));
  const candidates = [];

  for (let anchorIdx = 0; anchorIdx < scored.length; anchorIdx++) {
    const anchor = scored[anchorIdx];
    if (anchor.score <= 0) continue;

    let startIdx = anchorIdx;
    while (startIdx > 0 && anchor.seg.start - scored[startIdx - 1].seg.start <= hookLeadSec) {
      startIdx -= 1;
    }

    const startSec = scored[startIdx].seg.start;
    let endIdx = anchorIdx;
    let endSec = anchor.seg.end;

    while (endIdx + 1 < scored.length) {
      const next = scored[endIdx + 1];
      if (next.seg.end - startSec > maxSec) break;
      endIdx += 1;
      endSec = next.seg.end;
      if (endSec - startSec >= minSec && /[.!?。…]$/.test(next.seg.text)) break;
    }

    const length = endSec - startSec;
    if (length < Math.min(minSec, 10)) continue;

    const windowSegments = scored.slice(startIdx, endIdx + 1);
    const total = windowSegments.reduce((sum, s) => sum + s.score, 0);
    const labels = [...new Set(windowSegments.flatMap((s) => s.labels))].slice(0, 3);

    candidates.push({
      title: cleanTitle(anchor.seg.text),
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      score: Number((total / Math.sqrt(length)).toFixed(3)),
      reason: labels.length
        ? `${labels.join(" · ")}이(가) 몰려 있는 구간입니다.`
        : "말의 밀도가 높아 몰입도가 유지되는 구간입니다.",
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const picked = [];
  for (const cand of candidates) {
    if (picked.length >= count) break;
    const overlaps = picked.some((p) => cand.startSec < p.endSec - 1 && cand.endSec > p.startSec + 1);
    if (!overlaps) picked.push(cand);
  }

  picked.sort((a, b) => a.startSec - b.startSec);
  return picked.map((p, i) => ({ ...p, index: i + 1 }));
}

/** 무음 제거용 유지 구간. 문장 사이 공백이 기준을 넘으면 잘라낸다. */
export function buildKeepRanges(segments, startSec, endSec, { removeSilence, thresholdSec = 0.6, padSec = 0.12 }) {
  if (!removeSilence || segments.length === 0) return [{ start: startSec, end: endSec }];

  const ranges = [];
  for (const seg of segments) {
    const start = Math.max(startSec, seg.start - padSec);
    const end = Math.min(endSec, seg.end + padSec);
    if (end - start <= 0.05) continue;

    const last = ranges[ranges.length - 1];
    if (last && start - last.end < thresholdSec) last.end = Math.max(last.end, end);
    else ranges.push({ start, end });
  }

  return ranges.length > 0 ? ranges : [{ start: startSec, end: endSec }];
}

/** 원본 2분당 1개, 최대 10개. */
export function plannedShortCount(durationSec, requested = 0) {
  if (requested > 0) return Math.min(10, Math.max(1, requested));
  return Math.min(10, Math.max(1, Math.round(durationSec / 120)));
}
