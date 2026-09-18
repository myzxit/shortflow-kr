import { NextResponse } from "next/server";
import fs from "node:fs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectDir, resolveSafe } from "@/lib/paths";

/** 처리 상태 폴링용. 프로젝트 + 쇼츠 목록을 함께 준다. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: { shorts: { orderBy: { index: "asc" } } },
  });

  if (!project) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  // 자막 원본은 용량이 커서 폴링 응답에서 뺀다.
  const { transcriptJson, ...rest } = project;
  return NextResponse.json({ project: { ...rest, hasTranscript: Boolean(transcriptJson) } });
}

/** 프로젝트 삭제: DB 레코드와 저장된 파일을 함께 지운다. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });
  fs.rmSync(projectDir(id), { recursive: true, force: true });

  // 업로드 원본은 projects/ 밖(uploads/)에 있으므로 따로 지운다.
  if (project.sourceType === "upload" && project.sourcePath) {
    const abs = resolveSafe(project.sourcePath);
    if (abs) fs.rmSync(abs, { force: true });
  }

  return NextResponse.json({ ok: true });
}
