"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CREDIT_PACKS, formatKrw, pricePerShort, SECONDS_PER_SHORT } from "@/lib/pricing";

export default function PricingCards() {
  const router = useRouter();
  const { status } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packId: string) {
    setError(null);

    if (status !== "authenticated") {
      router.push(`/login?mode=signup&next=/pricing`);
      return;
    }

    setBusyId(packId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "결제를 시작하지 못했습니다.");

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      // 결제 키가 없는 환경: 모의 결제로 크레딧이 바로 지급된다.
      router.push("/dashboard?charged=1");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => {
          const shorts = Math.round((pack.minutes * 60) / SECONDS_PER_SHORT);
          return (
            <div
              key={pack.id}
              className={`card flex flex-col ${
                pack.highlight ? "border-[color:var(--color-brand)] ring-1 ring-[color:var(--color-brand)]/40" : ""
              }`}
            >
              {pack.highlight && (
                <span className="mb-3 w-fit rounded-full bg-[color:var(--color-brand)]/15 px-3 py-1 text-xs font-semibold text-[color:var(--color-brand-soft)]">
                  가장 많이 쓰는 팩
                </span>
              )}
              <h3 className="text-lg font-bold">{pack.name}</h3>
              <p className="mt-1 text-sm text-white/50">{pack.note}</p>

              <div className="mt-6">
                <div className="text-3xl font-bold">{formatKrw(pack.priceKrw)}</div>
                <div className="mt-1 text-sm text-white/50">
                  원본 {pack.minutes}분 · 쇼츠 약 {shorts}개
                </div>
              </div>

              <ul className="mt-6 space-y-2 text-sm text-white/60">
                <li>· 쇼츠 1개당 약 {formatKrw(pricePerShort(pack))}</li>
                <li>· 재렌더링·편집 무제한</li>
                <li>· 템플릿 5종, 비율 3종 전부 사용</li>
                <li>· 크레딧 유효기간 없음</li>
              </ul>

              <button
                onClick={() => buy(pack.id)}
                disabled={busyId === pack.id}
                className={`mt-8 w-full ${pack.highlight ? "btn-primary" : "btn-ghost"}`}
              >
                {busyId === pack.id ? "처리 중…" : "이 팩 구매하기"}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-5 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
