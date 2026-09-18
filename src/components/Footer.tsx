import Link from "next/link";

const COLUMNS = [
  {
    title: "서비스",
    links: [
      { href: "/pricing", label: "요금제" },
      { href: "/tools", label: "무료 도구" },
      { href: "/dashboard", label: "내 작업실" },
    ],
  },
  {
    title: "지원",
    links: [
      { href: "/guide", label: "사용 가이드" },
      { href: "/faq", label: "자주 묻는 질문" },
      { href: "mailto:help@shortflow.example", label: "문의하기" },
    ],
  },
  {
    title: "약관",
    links: [
      { href: "/legal/terms", label: "이용약관" },
      { href: "/legal/privacy", label: "개인정보처리방침" },
      { href: "/legal/refund", label: "환불정책" },
      { href: "/legal/oss", label: "오픈소스 고지" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-ink-line)] bg-[color:var(--color-ink-soft)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--color-brand)] text-white">
              ▶
            </span>
            <span className="text-lg">숏플로우</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
            롱폼 영상 하나를 넣으면 AI가 하이라이트를 찾아 자막까지 넣은 쇼츠로 만들어 드립니다.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/50">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[color:var(--color-ink-line)] px-5 py-6 text-center text-xs text-white/35 sm:px-8">
        <p>숏플로우 · 오픈소스 예제 프로젝트 · 실제 영업 중인 법인이 아닙니다.</p>
        <p className="mt-1">© {new Date().getFullYear()} shortflow-kr contributors. MIT License.</p>
      </div>
    </footer>
  );
}
