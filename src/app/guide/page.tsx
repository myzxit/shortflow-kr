import type { Metadata } from "next";
import Link from "next/link";
import { STEPS } from "@/lib/content";
import { TEMPLATES, ASPECT_RATIOS } from "@/lib/templates";

export const metadata: Metadata = {
  title: "사용 가이드",
  description: "링크 입력부터 다운로드까지, 숏플로우를 쓰는 방법과 내부 동작 설명.",
};

export default function GuidePage() {
  return (
    <div className="section max-w-3xl">
      <p className="eyebrow">사용 가이드</p>
      <h1 className="heading">처음부터 끝까지</h1>

      <ol className="mt-12 space-y-10">
        {STEPS.map((s) => (
          <li key={s.step} className="border-l-2 border-[color:var(--color-brand)] pl-6">
            <div className="text-sm font-bold text-[color:var(--color-brand)]">STEP {s.step}</div>
            <h2 className="mt-2 text-xl font-semibold">{s.title}</h2>
            <p className="mt-2 leading-relaxed text-white/60">{s.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-20 text-2xl font-bold">AI가 구간을 고르는 방식</h2>
      <p className="mt-4 leading-relaxed text-white/60">
        음성 인식 결과를 문장 단위로 쪼갠 뒤, 문장마다 점수를 매깁니다. 점수에 들어가는 요소는
        다음과 같습니다.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-white/60">
        <li>· <b className="text-white/85">말의 밀도</b> — 초당 글자 수. 너무 느린 구간은 감점됩니다.</li>
        <li>· <b className="text-white/85">질문형 도입</b> — “왜”, “어떻게”, 물음표로 끝나는 문장.</li>
        <li>· <b className="text-white/85">핵심 정리 표현</b> — “사실은”, “핵심은”, “결론은”.</li>
        <li>· <b className="text-white/85">구체적인 수치</b> — “3배”, “27만 원”처럼 숫자와 단위가 붙은 표현.</li>
        <li>· <b className="text-white/85">전환 지점</b> — “하지만”, “알고 보니”처럼 흐름이 꺾이는 표현.</li>
      </ul>
      <p className="mt-4 leading-relaxed text-white/60">
        점수가 가장 높은 문장을 앵커로 잡고, 그 문장이 결과물의 <b className="text-white/85">앞 3초</b>
        안에 들어오도록 앞뒤 문장을 붙입니다. 경계는 항상 문장 경계에 맞추기 때문에 말이 중간에
        잘리지 않습니다. 마지막으로 서로 겹치는 후보를 걸러 상위 구간만 남깁니다.
      </p>

      <h2 className="mt-16 text-2xl font-bold">템플릿과 비율</h2>
      <div className="mt-6 overflow-hidden rounded-xl border border-[color:var(--color-ink-line)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[color:var(--color-ink-soft)] text-white/70">
            <tr>
              <th className="px-4 py-3 font-semibold">템플릿</th>
              <th className="px-4 py-3 font-semibold">어울리는 콘텐츠</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-ink-line)]">
            {TEMPLATES.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-white/55">{t.tagline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm text-white/60">
        화면 비율은 {ASPECT_RATIOS.map((a) => a.id).join(" · ")} 중에 고릅니다. 원본이 가로 영상이면
        가운데를 기준으로 잘라내 세로로 맞춥니다.
      </p>

      <h2 className="mt-16 text-2xl font-bold">직접 설치해서 쓰기</h2>
      <p className="mt-4 leading-relaxed text-white/60">
        숏플로우는 오픈소스입니다. ffmpeg, yt-dlp, faster-whisper만 설치하면 내 서버에서 그대로
        돌릴 수 있고, 영상이 외부로 나가지 않습니다. 설치 방법은 저장소의 README를 참고하세요.
      </p>

      <Link href="/login?mode=signup" className="btn-primary mt-12">
        30분 무료로 시작하기
      </Link>
    </div>
  );
}
