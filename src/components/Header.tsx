"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const NAV = [
  { href: "/pricing", label: "요금제" },
  { href: "/guide", label: "사용 가이드" },
  { href: "/faq", label: "자주 묻는 질문" },
  { href: "/tools", label: "무료 도구" },
];

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-ink-line)] bg-[color:var(--color-ink)]/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--color-brand)] text-white">
            ▶
          </span>
          <span className="text-lg">숏플로우</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {status === "loading" ? null : session?.user ? (
            <>
              <Link href="/dashboard" className="btn-ghost px-4 py-2">
                내 작업실
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-ghost px-4 py-2">
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-4 py-2">
                로그인
              </Link>
              <Link href="/login?mode=signup" className="btn-primary px-4 py-2">
                무료로 시작
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
