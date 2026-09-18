"use client";

import { useState } from "react";

/**
 * 플랫폼별 UI가 가리는 영역. 세로 1920px 기준 대략적인 수치다.
 * (정확한 값은 앱 버전마다 달라지므로 여유를 두고 잡았다.)
 */
const PLATFORMS = [
  { id: "shorts", name: "유튜브 쇼츠", top: 90, bottom: 320, right: 180 },
  { id: "reels", name: "인스타그램 릴스", top: 120, bottom: 400, right: 220 },
  { id: "tiktok", name: "틱톡", top: 110, bottom: 430, right: 240 },
];

export default function SafeAreaTool() {
  const [platformId, setPlatformId] = useState(PLATFORMS[0].id);
  const platform = PLATFORMS.find((p) => p.id === platformId) ?? PLATFORMS[0];

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <section className="card">
      <h2 className="text-xl font-bold">쇼츠 안전 영역 확인</h2>
      <p className="mt-2 text-sm text-white/55">
        플랫폼 UI가 가리는 부분을 1080×1920 기준으로 보여줍니다. 자막이나 중요한 정보는 가운데
        영역 안에 두세요.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatformId(p.id)}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              p.id === platformId
                ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/15 text-white"
                : "border-[color:var(--color-ink-line)] text-white/60 hover:text-white"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative mx-auto aspect-[9/16] w-56 overflow-hidden rounded-xl border border-[color:var(--color-ink-line)] bg-[color:var(--color-ink)]">
          <div
            className="absolute inset-x-0 top-0 bg-red-500/25"
            style={{ height: pct(platform.top, 1920) }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-red-500/25"
            style={{ height: pct(platform.bottom, 1920) }}
          />
          <div
            className="absolute right-0 bg-red-500/25"
            style={{
              width: pct(platform.right, 1080),
              top: pct(platform.top, 1920),
              bottom: pct(platform.bottom, 1920),
            }}
          />
          <div className="absolute inset-0 grid place-items-center text-xs text-white/40">
            안전 영역
          </div>
        </div>

        <dl className="flex-1 space-y-3 text-sm">
          {[
            ["상단 가림", `${platform.top}px`],
            ["하단 가림", `${platform.bottom}px`],
            ["우측 가림", `${platform.right}px`],
            [
              "권장 자막 위치",
              `상단에서 ${Math.round(((1920 - platform.bottom - 200) / 1920) * 100)}% 지점 부근`,
            ],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between border-b border-[color:var(--color-ink-line)] pb-2"
            >
              <dt className="text-white/50">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
