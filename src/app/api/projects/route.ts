import { NextResponse } from "next/server";
import fs from "node:fs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toAbsolute, resolveSafe } from "@/lib/paths";
import { TEMPLATES, ASPECT_RATIOS } from "@/lib/templates";
import { isUnlimited } from "@/lib/credits";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const schema = z
  .object({
    sourceType: z.enum(["youtube", "upload"]),
    url: z.string().url().optional(),
    path: z.string().optional(),
    title: z.string().max(200).optional(),
    templateId: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]).optional(),
    aspectRatio: z.enum(ASPECT_RATIOS.map((a) => a.id) as [string, ...string[]]).optional(),
    targetCount: z.number().int().min(0).max(10).optional(),
    minShortSec: z.number().int().min(10).max(90).optional(),
    maxShortSec: z.number().int().min(15).max(180).optional(),
    removeSilence: z.boolean().optional(),
    autoSubtitle: z.boolean().optional(),
  })
  .refine((v) => (v.sourceType === "youtube" ? Boolean(v.url) : Boolean(v.path)), {
    message: "유튜브 주소 또는 업로드한 파일이 필요합니다.",
  });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const input = parsed.data;

  // 크레딧이 완전히 바닥난 상태면 시작 자체를 막는다. 관리자는 예외.
  // (실제 차감은 영상 길이를 확인한 뒤 워커에서 한다.)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!isUnlimited(user) && user.creditSeconds <= 0) {
    return NextResponse.json(
      { error: "남은 크레딧이 없습니다. 요금제 페이지에서 충전해 주세요." },
      { status: 402 }
    );
  }

  let title: string;
  let sourceUrl: string | null = null;
  let sourcePath: string | null = null;

  if (input.sourceType === "youtube") {
    const url = new URL(input.url!);
    if (!YOUTUBE_HOSTS.has(url.hostname)) {
      return NextResponse.json({ error: "유튜브 주소만 넣을 수 있습니다." }, { status: 400 });
    }
    sourceUrl = url.toString();
    title = input.title?.trim() || `유튜브 영상 ${new Date().toLocaleDateString("ko-KR")}`;
  } else {
    // 업로드 경로는 반드시 본인 폴더 안이어야 한다.
    const expectedPrefix = `uploads/${session.user.id}/`;
    if (!input.path!.startsWith(expectedPrefix) || !resolveSafe(input.path!)) {
      return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 });
    }
    if (!fs.existsSync(toAbsolute(input.path!))) {
      return NextResponse.json({ error: "업로드된 파일을 찾을 수 없습니다." }, { status: 400 });
    }
    sourcePath = input.path!;
    title = input.title?.trim() || "업로드한 영상";
  }

  const minShortSec = input.minShortSec ?? 20;
  const maxShortSec = Math.max(minShortSec + 5, input.maxShortSec ?? 60);

  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      title: title.slice(0, 200),
      sourceType: input.sourceType,
      sourceUrl,
      sourcePath,
      templateId: input.templateId ?? "sandpaper",
      aspectRatio: input.aspectRatio ?? "9:16",
      targetCount: input.targetCount ?? 0,
      minShortSec,
      maxShortSec,
      removeSilence: input.removeSilence ?? true,
      autoSubtitle: input.autoSubtitle ?? true,
      status: "queued",
      stage: "대기열에 올렸습니다",
    },
  });

  await prisma.job.create({ data: { projectId: project.id, type: "pipeline" } });

  return NextResponse.json({ id: project.id });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { shorts: true } } },
  });

  return NextResponse.json({ projects });
}
