import Link from "next/link";
import ConvertForm from "@/components/ConvertForm";
import PricingCards from "@/components/PricingCards";
import { Features, Steps, TemplateGallery, Reviews, FaqList } from "@/components/landing/Sections";
import { SECONDS_PER_SHORT } from "@/lib/pricing";

export default function HomePage() {
  return (
    <>
      {/* 히어로 */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(255,90,31,0.22),transparent)]"
        />
        <div className="section grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow">영상 편집자가 만든 자동 편집 도구</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.15] sm:text-5xl">
              롱폼 하나로
              <br />
              <span className="text-[color:var(--color-brand)]">쇼츠 10개</span>를 만듭니다
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
              유튜브 링크를 넣으면 AI가 영상 전체를 듣고 하이라이트를 찾아냅니다. 자막을 달고,
              늘어지는 부분을 잘라내고, 세로 비율로 맞춘 쇼츠가 그대로 나옵니다.
            </p>

            <ul className="mt-8 space-y-2 text-sm text-white/55">
              <li>· 원본 {SECONDS_PER_SHORT / 60}분당 쇼츠 1개, 최대 10개</li>
              <li>· 단어 단위 타임스탬프 기반 자막이라 싱크가 밀리지 않습니다</li>
              <li>· 가입하면 30분 무료. 카드 등록이 필요 없습니다</li>
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login?mode=signup" className="btn-primary">
                30분 무료로 시작하기
              </Link>
              <Link href="/guide" className="btn-ghost">
                어떻게 동작하나요?
              </Link>
            </div>
          </div>

          <ConvertForm />
        </div>
      </section>

      <Steps />
      <Features />
      <TemplateGallery />

      {/* 요금 */}
      <section id="pricing" className="border-y border-[color:var(--color-ink-line)] bg-[color:var(--color-ink-soft)]">
        <div className="section">
          <p className="eyebrow">요금제</p>
          <h2 className="heading">쓴 만큼만, 원본 길이로 계산합니다</h2>
          <p className="mt-4 max-w-2xl text-white/60">
            결과물 개수가 아니라 넣은 영상 길이로 과금합니다. 같은 영상에서 쇼츠를 몇 개 뽑든,
            마음에 들 때까지 몇 번을 다시 만들든 추가 비용은 없습니다.
          </p>
          <div className="mt-12">
            <PricingCards />
          </div>
        </div>
      </section>

      <Reviews />

      {/* FAQ 요약 */}
      <section className="section">
        <p className="eyebrow">자주 묻는 질문</p>
        <h2 className="heading">궁금한 것들</h2>
        <FaqList limit={5} />
        <Link href="/faq" className="btn-ghost mt-8">
          전체 질문 보기
        </Link>
      </section>

      {/* 마무리 CTA */}
      <section className="section text-center">
        <div className="card mx-auto max-w-3xl px-8 py-14">
          <h2 className="text-3xl font-bold">지금 가입하면 30분 무료</h2>
          <p className="mt-4 text-white/60">
            10분짜리 영상 세 편을 돌려볼 수 있는 분량입니다. 결과물이 마음에 들지 않으면 그냥 두고
            나가셔도 됩니다.
          </p>
          <Link href="/login?mode=signup" className="btn-primary mt-8">
            무료로 쇼츠 만들어 보기
          </Link>
        </div>
      </section>
    </>
  );
}
