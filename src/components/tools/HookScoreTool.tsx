"use client";

import { useMemo, useState } from "react";
import { scoreText, HOOK_PATTERNS } from "@/lib/hookPatterns";

const SAMPLE = "사실 이 방법 하나만 바꿔도 조회수가 3배 올라갑니다. 왜 그런지 아세요?";

export default function HookScoreTool() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo(() => scoreText(text), [text]);
  // 9점 정도면 충분히 훅으로 쓸 만하다는 경험칙을 기준선으로 잡았다.
  const percent = Math.min(100, Math.round((result.score / 9) * 100));

  const verdict =
    percent >= 80
      ? { label: "첫 문장으로 바로 써도 됩니다", tone: "text-[color:var(--color-mint)]" }
      : percent >= 45
        ? { label: "괜찮지만 더 뾰족하게 만들 수 있습니다", tone: "text-yellow-300" }
        : { label: "훅으로 쓰기엔 약합니다", tone: "text-red-300" };

  return (
    <section className="card">
      <h2 className="text-xl font-bold">훅 문장 점수 측정기</h2>
      <p className="mt-2 text-sm text-white/55">
        숏플로우가 하이라이트를 고를 때 쓰는 것과 같은 규칙으로 문장을 채점합니다. 쇼츠 첫 문장을
        넣어 보세요.
      </p>

      <textarea
        className="input mt-5 min-h-24 resize-y"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="쇼츠 첫 문장을 입력하세요"
      />

      <div className="mt-5 flex items-center gap-4">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[color:var(--color-brand)] transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="w-14 text-right text-sm font-semibold">{percent}점</span>
      </div>
      <p className={`mt-2 text-sm font-medium ${verdict.tone}`}>{verdict.label}</p>

      <div className="mt-6">
        <p className="text-sm font-medium text-white/70">감지된 요소</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {HOOK_PATTERNS.map((p) => {
            const hit = result.labels.includes(p.label);
            return (
              <span
                key={p.label}
                className={`rounded-full border px-3 py-1 text-xs ${
                  hit
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/15 text-[color:var(--color-brand-soft)]"
                    : "border-[color:var(--color-ink-line)] text-white/35"
                }`}
              >
                {p.label} {hit ? `+${p.weight}` : ""}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
