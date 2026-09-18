/**
 * whisper.cpp 로 음성 인식.
 *
 * faster-whisper 는 안드로이드용 빌드가 없어서 whisper.cpp 로 바꿨다.
 * 순수 C++ 라 폰에서 직접 컴파일되고 ARM 에서 잘 돈다.
 *
 * `-ml 1 -sow` 로 단어 단위 타임스탬프를 받은 뒤, 문장으로 다시 묶는다.
 * (자막 싱크는 단어 타임스탬프가 있어야 안 밀린다.)
 */

import fs from "node:fs";
import path from "node:path";
import { run } from "./media.mjs";
import { BIN, WHISPER_MODEL, WHISPER_LANGUAGE } from "./paths.mjs";

/** 문장을 끊는 기준: 종결부호, 또는 이만큼 벌어진 공백 */
const SENTENCE_GAP_SEC = 0.8;
const SENTENCE_MAX_CHARS = 60;

export async function transcribe(audioPath, workDir, onProgress) {
  if (!fs.existsSync(WHISPER_MODEL)) {
    throw new Error(
      `음성 인식 모델이 없습니다: ${WHISPER_MODEL}\nsetup.sh 를 다시 실행하세요.`
    );
  }

  const outBase = path.join(workDir, "transcript");

  await run(
    BIN.whisper,
    [
      "-m", WHISPER_MODEL,
      "-f", audioPath,
      "-l", WHISPER_LANGUAGE,
      "-oj", "-of", outBase,
      "-ml", "1",          // 세그먼트를 단어 단위로
      "-sow",              // 단어 경계에서 자르기
      "-pp",               // 진행률을 stderr 로
      "-nt",               // 타임스탬프 텍스트 출력 생략
    ],
    {
      onStderr: (chunk) => {
        const m = /progress\s*=\s*(\d+)%/.exec(chunk);
        if (m) onProgress?.(Number.parseInt(m[1], 10));
      },
    }
  );

  const jsonPath = `${outBase}.json`;
  if (!fs.existsSync(jsonPath)) throw new Error("음성 인식 결과 파일이 생성되지 않았습니다.");

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const words = (raw.transcription ?? [])
    .map((s) => ({
      start: s.offsets.from / 1000,
      end: s.offsets.to / 1000,
      word: (s.text ?? "").trim(),
    }))
    .filter((w) => w.word.length > 0);

  if (words.length === 0) {
    throw new Error("음성을 인식하지 못했습니다. 말소리가 없는 영상일 수 있습니다.");
  }

  return { duration: words[words.length - 1].end, segments: groupIntoSentences(words) };
}

/** 단어들을 문장 단위 세그먼트로 다시 묶는다. */
export function groupIntoSentences(words) {
  const segments = [];
  let current = [];

  const flush = () => {
    if (current.length === 0) return;
    segments.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((w) => w.word).join(" ").replace(/\s+/g, " ").trim(),
      words: current,
    });
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    current.push(word);

    const text = current.map((w) => w.word).join(" ");
    const next = words[i + 1];
    const gap = next ? next.start - word.end : Infinity;

    if (/[.!?。…]$/.test(word.word) || gap > SENTENCE_GAP_SEC || text.length > SENTENCE_MAX_CHARS) {
      flush();
    }
  }
  flush();

  return segments.filter((s) => s.text.length > 0);
}
