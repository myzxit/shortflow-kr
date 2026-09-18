import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEMPLATES, ASPECT_RATIOS } from "@/lib/templates";

const schema = z.object({
  title: z.string().min(1).max(80).optional(),
  startSec: z.number().min(0).optional(),
  endSec: z.number().min(1).optional(),
  templateId: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]).optional(),
  aspectRatio: z.enum(ASPECT_RATIOS.map((a) => a.id) as [string, ...string[]]).optional(),
  rerender: z.boolean().optional(),
});

/** 쇼츠 편집 + 다시 만들기. 재렌더링에는 크레딧이 들지 않는다. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const short = await prisma.short.findFirst({
    where: { id, project: { userId: session.user.id } },
    include: { project: true },
  });
  if (!short) {
    return NextResponse.json({ error: "쇼츠를 찾을 수 없습니다." }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const input = parsed.data;

  const startSec = input.startSec ?? short.startSec;
  const endSec = input.endSec ?? short.endSec;

  if (endSec <= startSec) {
    return NextResponse.json({ error: "끝 지점이 시작 지점보다 뒤여야 합니다." }, { status: 400 });
  }
  if (endSec - startSec < 5) {
    return NextResponse.json({ error: "구간은 5초 이상이어야 합니다." }, { status: 400 });
  }
  if (endSec - startSec > 180) {
    return NextResponse.json({ error: "구간은 3분을 넘을 수 없습니다." }, { status: 400 });
  }
  if (short.project.durationSec > 0 && endSec > short.project.durationSec) {
    return NextResponse.json({ error: "원본 영상 길이를 넘었습니다." }, { status: 400 });
  }

  const updated = await prisma.short.update({
    where: { id },
    data: {
      title: input.title?.trim() ?? short.title,
      startSec,
      endSec,
      templateId: input.templateId ?? short.templateId,
      aspectRatio: input.aspectRatio ?? short.aspectRatio,
      ...(input.rerender ? { status: "pending", error: null } : {}),
    },
  });

  if (input.rerender) {
    // 같은 쇼츠에 대기 중인 재렌더링 작업이 있으면 중복으로 쌓지 않는다.
    const pending = await prisma.job.findFirst({
      where: {
        projectId: short.projectId,
        type: "rerender",
        status: { in: ["queued", "running"] },
        payload: JSON.stringify({ shortId: id }),
      },
    });

    if (!pending) {
      await prisma.job.create({
        data: {
          projectId: short.projectId,
          type: "rerender",
          payload: JSON.stringify({ shortId: id }),
        },
      });
      await prisma.project.update({
        where: { id: short.projectId },
        data: { status: "rendering", stage: `쇼츠 ${short.index} 다시 만드는 중`, error: null },
      });
    }
  }

  return NextResponse.json({ short: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await prisma.short.deleteMany({
    where: { id, project: { userId: session.user.id } },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "쇼츠를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
