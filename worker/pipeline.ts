import fs from "node:fs";
import path from "node:path";
import type { Project, Short } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { projectDir, ensureDir, toRelative, toAbsolute } from "../src/lib/paths";
import { plannedShortCount } from "../src/lib/pricing";
import { getTemplate } from "../src/lib/templates";
import { chargeSeconds, refundProject, InsufficientCreditError } from "../src/lib/credits";
import { FFMPEG, FFPROBE, ensureBinary, extractAudio, extractThumbnail, probeDuration } from "./ffmpeg";
import { downloadYoutube, fetchYoutubeTitle } from "./download";
import { transcribe, type Transcript } from "./transcribe";
import { buildKeepRanges, pickHighlights } from "./highlights";
import { buildCaptions, totalDuration } from "./subtitles";
import { renderShort } from "./render";

async function setStatus(
  projectId: string,
  data: { status?: string; progress?: number; stage?: string | null; error?: string | null }
) {
  await prisma.project.update({ where: { id: projectId }, data });
}

/** 파이프라인 전체: 원본 확보 → 음성 인식 → 하이라이트 선정 → 쇼츠 렌더링 */
export async function runPipeline(projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

  await ensureBinary(FFMPEG, "ffmpeg 를 설치하고 FFMPEG_PATH 를 확인하세요.");
  await ensureBinary(FFPROBE, "ffprobe 를 설치하고 FFPROBE_PATH 를 확인하세요.");

  const dir = ensureDir(projectDir(projectId));
  const workDir = ensureDir(path.join(dir, "work"));
  const outDir = ensureDir(path.join(dir, "shorts"));

  // 1. 원본 확보 ────────────────────────────────────────────────────────
  await setStatus(projectId, { status: "downloading", progress: 5, stage: "원본 영상을 준비하고 있습니다" });

  let sourceAbs: string;
  if (project.sourceType === "youtube") {
    if (!project.sourceUrl) throw new Error("유튜브 주소가 비어 있습니다.");
    sourceAbs = await downloadYoutube(project.sourceUrl, workDir);

    const fetched = await fetchYoutubeTitle(project.sourceUrl);
    if (fetched && project.title.startsWith("유튜브 영상")) {
      await prisma.project.update({ where: { id: projectId }, data: { title: fetched.slice(0, 120) } });
    }
  } else {
    if (!project.sourcePath) throw new Error("업로드된 파일을 찾을 수 없습니다.");
    sourceAbs = toAbsolute(project.sourcePath);
    if (!fs.existsSync(sourceAbs)) throw new Error("업로드된 파일이 저장소에 없습니다.");
  }

  const durationSec = Math.round(await probeDuration(sourceAbs));
  if (durationSec < 30) throw new Error("영상이 너무 짧습니다. 30초 이상 영상을 올려주세요.");

  await prisma.project.update({
    where: { id: projectId },
    data: { sourcePath: toRelative(sourceAbs), durationSec },
  });

  // 2. 크레딧 차감 (길이를 확인한 뒤에만 청구한다) ────────────────────────
  // 관리자 계정은 charged 가 0 으로 돌아오므로 차감도, 환불 대상도 되지 않는다.
  if (project.chargedSeconds === 0) {
    let charged = 0;
    try {
      charged = await chargeSeconds(project.userId, durationSec, {
        reason: "project_charge",
        projectId,
      });
    } catch (err) {
      if (err instanceof InsufficientCreditError) {
        throw new Error(
          `크레딧이 부족합니다. 이 영상은 ${Math.ceil(durationSec / 60)}분이 필요한데 ` +
            `${Math.floor(err.available / 60)}분이 남아 있습니다.`
        );
      }
      throw err;
    }
    if (charged > 0) {
      await prisma.project.update({
        where: { id: projectId },
        data: { chargedSeconds: charged },
      });
    }
  }

  // 3. 음성 인식 ────────────────────────────────────────────────────────
  await setStatus(projectId, { status: "transcribing", progress: 20, stage: "음성을 인식하고 있습니다" });

  const audioPath = path.join(workDir, "audio.wav");
  await extractAudio(sourceAbs, audioPath);

  const transcript: Transcript = await transcribe(audioPath, workDir, (seconds) => {
    const ratio = Math.min(1, seconds / Math.max(durationSec, 1));
    void setStatus(projectId, {
      progress: 20 + Math.round(ratio * 35),
      stage: `음성 인식 ${Math.round(ratio * 100)}%`,
    }).catch(() => {});
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { transcriptJson: JSON.stringify(transcript) },
  });

  // 4. 하이라이트 선정 ──────────────────────────────────────────────────
  await setStatus(projectId, { status: "analyzing", progress: 60, stage: "하이라이트를 고르고 있습니다" });

  const count = plannedShortCount(durationSec, project.targetCount);
  const highlights = pickHighlights(transcript.segments, {
    count,
    minSec: project.minShortSec,
    maxSec: project.maxShortSec,
  });

  if (highlights.length === 0) {
    throw new Error("쓸 만한 하이라이트를 찾지 못했습니다. 말소리가 충분한 영상으로 다시 시도해 주세요.");
  }

  await prisma.short.deleteMany({ where: { projectId } });
  await prisma.short.createMany({
    data: highlights.map((h) => ({
      projectId,
      index: h.index,
      title: h.title,
      startSec: h.startSec,
      endSec: h.endSec,
      score: h.score,
      reason: h.reason,
      templateId: project.templateId,
      aspectRatio: project.aspectRatio,
      status: "pending",
    })),
  });

  // 5. 렌더링 ──────────────────────────────────────────────────────────
  await setStatus(projectId, { status: "rendering", progress: 65, stage: "쇼츠를 만들고 있습니다" });

  const shorts = await prisma.short.findMany({ where: { projectId }, orderBy: { index: "asc" } });

  for (let i = 0; i < shorts.length; i++) {
    const short = shorts[i];
    await setStatus(projectId, {
      progress: 65 + Math.round(((i + 1) / shorts.length) * 33),
      stage: `쇼츠 ${i + 1}/${shorts.length} 렌더링 중`,
    });
    await renderOne(project, short, transcript, sourceAbs, outDir);
  }

  await setStatus(projectId, { status: "done", progress: 100, stage: null, error: null });
}

/** 쇼츠 1개를 렌더링하고 DB를 갱신한다. 실패해도 나머지 쇼츠는 계속 만든다. */
export async function renderOne(
  project: Project,
  short: Short,
  transcript: Transcript,
  sourceAbs: string,
  outDir: string
): Promise<void> {
  await prisma.short.update({
    where: { id: short.id },
    data: { status: "rendering", error: null },
  });

  try {
    const windowSegments = transcript.segments.filter(
      (s) => s.end > short.startSec && s.start < short.endSec
    );

    const ranges = buildKeepRanges(windowSegments, short.startSec, short.endSec, {
      removeSilence: project.removeSilence,
    });

    if (totalDuration(ranges) < 3) {
      throw new Error("구간이 너무 짧아 쇼츠를 만들 수 없습니다.");
    }

    const captions = project.autoSubtitle
      ? buildCaptions(windowSegments, { start: short.startSec, end: short.endSec }, ranges)
      : [];

    const result = await renderShort({
      sourcePath: sourceAbs,
      outDir,
      fileBase: `short-${short.index}`,
      ranges,
      captions,
      title: short.title,
      template: getTemplate(short.templateId),
      aspectRatio: short.aspectRatio,
      burnSubtitles: project.autoSubtitle || getTemplate(short.templateId).titleBar,
    });

    const thumbPath = path.join(outDir, `short-${short.index}.jpg`);
    await extractThumbnail(result.videoPath, thumbPath, Math.min(1, result.durationSec / 2));

    await prisma.short.update({
      where: { id: short.id },
      data: {
        status: "done",
        filePath: toRelative(result.videoPath),
        thumbPath: toRelative(thumbPath),
        subtitleJson: JSON.stringify(captions),
        error: null,
      },
    });
  } catch (err) {
    await prisma.short.update({
      where: { id: short.id },
      data: { status: "failed", error: (err as Error).message.slice(0, 500) },
    });
  }
}

/** 편집기에서 제목/길이/비율/템플릿을 바꾼 뒤 다시 만들 때 */
export async function rerenderShort(shortId: string): Promise<void> {
  const short = await prisma.short.findUniqueOrThrow({
    where: { id: shortId },
    include: { project: true },
  });
  const project = short.project;

  if (!project.transcriptJson) throw new Error("자막 데이터가 없어 다시 만들 수 없습니다.");
  if (!project.sourcePath) throw new Error("원본 영상이 없어 다시 만들 수 없습니다.");

  const sourceAbs = toAbsolute(project.sourcePath);
  if (!fs.existsSync(sourceAbs)) throw new Error("원본 영상 파일이 삭제되었습니다.");

  const transcript = JSON.parse(project.transcriptJson) as Transcript;
  const outDir = ensureDir(path.join(projectDir(project.id), "shorts"));

  await renderOne(project, short, transcript, sourceAbs, outDir);
}

/** 파이프라인 실패 처리: 상태 기록 + 크레딧 환불 */
export async function failProject(projectId: string, message: string): Promise<void> {
  await refundProject(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "failed", stage: null, error: message.slice(0, 1000) },
  });
}
