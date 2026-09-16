import type { Metadata } from "next";
import PricingCards from "@/components/PricingCards";
import { FaqList } from "@/components/landing/Sections";
import { SIGNUP_BONUS_SECONDS, SECONDS_PER_SHORT } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "요금제",
  description: "원본 영상 길이만큼만 차감되는 크레딧 요금제. 가입 시 30분 무료.",
};

export default function PricingPage() {
  return (
    <div className="section">
      <p className="eyebrow">요금제</p>
      <h1 className="heading">원본 길이만큼만 차감됩니다</h1>
      <p className="mt-4 max-w-2xl text-white/60">
        크레딧 단위는 “처리한 원본 영상의 분”입니다. 10분 영상을 넣으면 10분이 빠지고, 거기서 쇼츠를
        5개 뽑든 10개 뽑든 차감량은 같습니다. 다시 만들기도 무료입니다.
      </p>

      <div className="mt-10 card">
        <h2 className="text-lg font-semibold">무료 체험</h2>
        <p className="mt-2 text-sm text-white/60">
          가입하면 {SIGNUP_BONUS_SECONDS / 60}분이 자동으로 들어갑니다. 카드 등록은 필요 없습니다.
          원본 {SECONDS_PER_SHORT / 60}분당 쇼츠 1개가 기본이므로, 약 15개까지 만들어 볼 수 있습니다.
        </p>
      </div>

      <div className="mt-10">
        <PricingCards />
      </div>

      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {[
          { t: "추가 과금 없음", b: "쇼츠 개수, 재렌더링 횟수, 템플릿 변경은 모두 무료입니다." },
          { t: "유효기간 없음", b: "구매한 크레딧은 만료되지 않습니다. 필요할 때 꺼내 쓰면 됩니다." },
          { t: "실패 시 자동 복구", b: "처리 도중 오류가 나면 차감된 크레딧이 자동으로 되돌아갑니다." },
        ].map((item) => (
          <div key={item.t} className="card">
            <h3 className="font-semibold">{item.t}</h3>
            <p className="mt-2 text-sm text-white/55">{item.b}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-20 text-2xl font-bold">요금 관련 질문</h2>
      <FaqList limit={4} />
    </div>
  );
}
