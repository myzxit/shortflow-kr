import { FEATURES, STEPS, REVIEWS, FAQS } from "@/lib/content";
import { TEMPLATES } from "@/lib/templates";

export function Features() {
  return (
    <section id="features" className="section">
      <p className="eyebrow">편집 기능</p>
      <h2 className="heading">손으로 하던 일을 그대로 자동으로</h2>
      <p className="mt-4 max-w-2xl text-white/60">
        쇼츠 편집에서 반복되는 작업은 정해져 있습니다. 구간 찾기, 자막 달기, 늘어지는 부분 자르기.
        숏플로우는 그 세 가지를 먼저 해두고, 나머지 취향은 직접 고치도록 남겨둡니다.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Steps() {
  return (
    <section className="border-y border-[color:var(--color-ink-line)] bg-[color:var(--color-ink-soft)]">
      <div className="section">
        <p className="eyebrow">동작 방식</p>
        <h2 className="heading">링크를 넣고, 결과를 고르기만 하면 됩니다</h2>

        <div className="mt-12 grid gap-8 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.step}>
              <div className="text-sm font-bold text-[color:var(--color-brand)]">{s.step}</div>
              <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TemplateGallery() {
  return (
    <section id="templates" className="section">
      <p className="eyebrow">쇼츠 템플릿</p>
      <h2 className="heading">다섯 가지 자막 스타일</h2>
      <p className="mt-4 max-w-2xl text-white/60">
        템플릿은 자막 색·외곽선·타이틀 바를 한 묶음으로 정의한 값입니다. 만들기 전에 골라도 되고,
        만든 뒤에 바꿔서 다시 뽑아도 됩니다.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="overflow-hidden rounded-2xl border border-[color:var(--color-ink-line)]"
          >
            <div className="aspect-[9/16] w-full" style={{ background: t.preview }} />
            <div className="bg-[color:var(--color-ink-soft)] p-4">
              <h3 className="text-sm font-semibold">{t.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{t.tagline}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Reviews() {
  return (
    <section className="border-y border-[color:var(--color-ink-line)] bg-[color:var(--color-ink-soft)]">
      <div className="section">
        <p className="eyebrow">사용 후기</p>
        <h2 className="heading">편집 시간을 줄인 사람들</h2>
        <p className="mt-3 text-sm text-white/40">
          예시 프로젝트의 샘플 후기입니다. 실제 이용자의 발언이 아닙니다.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure key={r.name} className="card">
              <blockquote className="text-sm leading-relaxed text-white/75">“{r.body}”</blockquote>
              <figcaption className="mt-5">
                <div className="text-sm font-semibold">{r.name}</div>
                <div className="text-xs text-white/45">{r.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqList({ limit }: { limit?: number }) {
  const items = limit ? FAQS.slice(0, limit) : FAQS;

  return (
    <div className="mt-10 divide-y divide-[color:var(--color-ink-line)] border-y border-[color:var(--color-ink-line)]">
      {items.map((item) => (
        <details key={item.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
            {item.q}
            <span className="text-white/40 transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-white/60">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
