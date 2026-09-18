import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProjectView from "@/components/ProjectView";

export const metadata: Metadata = { title: "프로젝트" };
export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/projects/${id}`);

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { shorts: { orderBy: { index: "asc" } } },
  });
  if (!project) notFound();

  // 클라이언트로는 JSON 직렬화 가능한 형태만 넘긴다.
  const { transcriptJson, ...rest } = project;

  return (
    <ProjectView
      initial={JSON.parse(JSON.stringify({ ...rest, hasTranscript: Boolean(transcriptJson) }))}
    />
  );
}
