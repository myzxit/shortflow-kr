import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ConvertForm from "@/components/ConvertForm";
import { formatDuration, formatDate, STATUS_LABEL } from "@/lib/format";
import { isUnlimited } from "@/lib/credits";

export const metadata: Metadata = { title: "내 작업실" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { _count: { select: { shorts: true } } },
  });

  const unlimited = isUnlimited(user);

  const totalShorts = await prisma.short.count({
    where: { project: { userId: user.id }, status: "done" },
  });

  return (
    <div className="section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">내 작업실</p>
          <h1 className="heading">{user.name || user.email}님</h1>
        </div>
        {!unlimited && (
          <Link href="/pricing" className="btn-ghost">
            크레딧 충전
          </Link>
        )}
      </div>

      {unlimited && (
        <p className="mt-6 rounded-xl bg-[color:var(--color-mint)]/10 px-5 py-3 text-sm text-[color:var(--color-mint)]">
          관리자 계정입니다. 크레딧 차감 없이 무제한으로 사용합니다.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "남은 크레딧", value: unlimited ? "무제한" : formatDuration(user.creditSeconds) },
          { label: "만든 프로젝트", value: `${projects.length}개` },
          { label: "완성한 쇼츠", value: `${totalShorts}개` },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <div className="text-sm text-white/50">{stat.label}</div>
            <div className="mt-2 text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {!unlimited && user.creditSeconds <= 0 && (
        <p className="mt-6 rounded-xl bg-yellow-500/10 px-5 py-4 text-sm text-yellow-200">
          남은 크레딧이 없습니다. 새 영상을 처리하려면{" "}
          <Link href="/pricing" className="underline">
            충전
          </Link>
          이 필요합니다.
        </p>
      )}

      <h2 className="mt-16 text-xl font-bold">새 영상 올리기</h2>
      <div className="mt-5 max-w-2xl">
        <ConvertForm />
      </div>

      <h2 className="mt-16 text-xl font-bold">지난 작업</h2>
      {projects.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[color:var(--color-ink-line)] px-6 py-12 text-center text-sm text-white/40">
          아직 만든 프로젝트가 없습니다. 위에서 첫 영상을 올려보세요.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[color:var(--color-ink-line)] overflow-hidden rounded-xl border border-[color:var(--color-ink-line)]">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-4 bg-[color:var(--color-ink-soft)] px-5 py-4 transition hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {formatDate(p.createdAt)}
                    {p.durationSec > 0 && ` · 원본 ${formatDuration(p.durationSec)}`}
                    {p._count.shorts > 0 && ` · 쇼츠 ${p._count.shorts}개`}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    p.status === "done"
                      ? "bg-[color:var(--color-mint)]/15 text-[color:var(--color-mint)]"
                      : p.status === "failed"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-white/10 text-white/60"
                  }`}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                  {p.status !== "done" && p.status !== "failed" && ` ${p.progress}%`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
