import fs from "node:fs";
import path from "node:path";
import * as db from "./db.mjs";
import { BIN, projectDir, ensureDir, toRelative, toAbsolute } from "./paths.mjs";
import { checkBinary, downloadYoutube, extractAudio, extractThumbnail, fetchYoutubeTitle, probeDuration } from "./media.mjs";
import { transcribe } from "./whisper.mjs";
import { buildKeepRanges, pickHighlights, plannedShortCount } from "./highlights.mjs";
import { buildCaptions, totalDuration } from "./subtitles.mjs";
import { renderShort } from "./render.mjs";
import { getTemplate } from "./templates.mjs";

const setStatus = (id, fields) => db.updateProject(id, fields);

export async function runPipeline(projectId) {
  const project = db.getProject(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

  await checkBinary(BIN.ffmpeg, "pkg install ffmpeg 로 설치하세요.");
  await checkBinary(BIN.ffprobe, "pkg install ffmpeg 로 설치하세요.");

  const dir = ensureDir(projectDir(projectId));
  const workDir = ensureDir(path.join(dir, "work"));
  const outDir = ensureDir(path.join(dir, "shorts"));

  // 1. 원본 확보
  setStatus(projectId, { status: "downloading", progress: 5, stage: "원본 영상을 준비하고 있습니다" });

  let sourceAbs;
  if (project.source_type === "youtube") {
    sourceAbs = await downloadYoutube(project.source_url, workDir);
    const title = await fetchYoutubeTitle(project.source_url);
    if (title && project.title.startsWith("유튜브 영상")) {
      db.updateProject(projectId, { title: title.slice(0, 120) });
    }
  } else {
    sourceAbs = toAbsolute(project.source_path);
    if (!fs.existsSync(sourceAbs)) throw new Error("업로드한 파일을 찾을 수 없습니다.");
  }

  const durationSec = Math.round(await probeDuration(sourceAbs));
  if (durationSec < 30) throw new Error("영상이 너무 짧습니다. 30초 이상 영상을 올려주세요.");

  db.updateProject(projectId, { source_path: toRelative(sourceAbs), duration_sec: durationSec });

  // 2. 크레딧 (관리자는 0 이 돌아와 차감도 환불 대상도 아니다)
  const charged = db.chargeSeconds(project.user_id, durationSec);
  if (charged === null) {
    throw new Error(`크레딧이 부족합니다. 이 영상은 ${Math.ceil(durationSec / 60)}분이 필요합니다.`);
  }
  if (charged > 0) db.updateProject(projectId, { charged_seconds: charged });

  // 3. 음성 인식 — 폰에서 가장 오래 걸리는 단계
  setStatus(projectId, { status: "transcribing", progress: 15, stage: "음성을 인식하고 있습니다 (가장 오래 걸립니다)" });

  const audioPath = path.join(workDir, "audio.wav");
  await extractAudio(sourceAbs, audioPath);

  const transcript = await transcribe(audioPath, workDir, (pct) => {
    setStatus(projectId, {
      progress: 15 + Math.round((pct / 100) * 45),
      stage: `음성 인식 ${pct}%`,
    });
  });

  db.updateProject(projectId, { transcript_json: JSON.stringify(transcript) });

  // 4. 하이라이트 선정
  setStatus(projectId, { status: "analyzing", progress: 62, stage: "하이라이트를 고르고 있습니다" });

  const highlights = pickHighlights(transcript.segments, {
    count: plannedShortCount(durationSec, project.target_count),
    minSec: project.min_short_sec,
    maxSec: project.max_short_sec,
  });

  if (highlights.length === 0) {
    throw new Error("쓸 만한 하이라이트를 찾지 못했습니다. 말소리가 충분한 영상으로 다시 시도해 주세요.");
  }

  db.replaceShorts(
    projectId,
    highlights.map((h) => ({
      ...h,
      templateId: project.template_id,
      aspectRatio: project.aspect_ratio,
    }))
  );

  // 5. 렌더링
  setStatus(projectId, { status: "rendering", progress: 65, stage: "쇼츠를 만들고 있습니다" });

  const shorts = db.listShorts(projectId);
  for (let i = 0; i < shorts.length; i++) {
    setStatus(projectId, {
      progress: 65 + Math.round(((i + 1) / shorts.length) * 33),
      stage: `쇼츠 ${i + 1}/${shorts.length} 렌더링 중`,
    });
    await renderOne(project, shorts[i], transcript, sourceAbs, outDir);
  }

  setStatus(projectId, { status: "done", progress: 100, stage: null, error: null });
}

/** 쇼츠 1개 렌더링. 하나가 실패해도 나머지는 계속 만든다. */
export async function renderOne(project, short, transcript, sourceAbs, outDir) {
  db.updateShort(short.id, { status: "rendering", error: null });

  try {
    const windowSegments = transcript.segments.filter(
      (s) => s.end > short.start_sec && s.start < short.end_sec
    );

    const ranges = buildKeepRanges(windowSegments, short.start_sec, short.end_sec, {
      removeSilence: project.remove_silence === 1,
    });
    if (totalDuration(ranges) < 3) throw new Error("구간이 너무 짧아 쇼츠를 만들 수 없습니다.");

    const template = getTemplate(short.template_id);
    const captions =
      project.auto_subtitle === 1
        ? buildCaptions(windowSegments, { start: short.start_sec, end: short.end_sec }, ranges)
        : [];

    const result = await renderShort({
      sourcePath: sourceAbs,
      outDir,
      fileBase: `short-${short.idx}`,
      ranges,
      captions,
      title: short.title,
      template,
      aspectRatio: short.aspect_ratio,
      burnSubtitles: project.auto_subtitle === 1 || template.titleBar,
    });

    const thumbPath = path.join(outDir, `short-${short.idx}.jpg`);
    await extractThumbnail(result.videoPath, thumbPath, Math.min(1, result.durationSec / 2));

    db.updateShort(short.id, {
      status: "done",
      file_path: toRelative(result.videoPath),
      thumb_path: toRelative(thumbPath),
      error: null,
    });
  } catch (err) {
    db.updateShort(short.id, { status: "failed", error: String(err.message).slice(0, 500) });
  }
}

export async function rerenderShort(shortId) {
  const short = db.getShort(shortId);
  if (!short) throw new Error("쇼츠를 찾을 수 없습니다.");

  const project = db.getProject(short.project_id);
  if (!project?.transcript_json) throw new Error("자막 데이터가 없어 다시 만들 수 없습니다.");

  const sourceAbs = toAbsolute(project.source_path);
  if (!fs.existsSync(sourceAbs)) throw new Error("원본 영상 파일이 삭제되었습니다.");

  const outDir = ensureDir(path.join(projectDir(project.id), "shorts"));
  await renderOne(project, short, JSON.parse(project.transcript_json), sourceAbs, outDir);
}

function failProject(projectId, message) {
  const project = db.getProject(projectId);
  // 실제로 차감된 만큼만 되돌린다. 차감 전에 실패했거나 관리자면 0 이라 아무 일도 없다.
  if (project && project.charged_seconds > 0) {
    db.grantSeconds(project.user_id, project.charged_seconds);
    db.updateProject(projectId, { charged_seconds: 0 });
  }
  db.updateProject(projectId, { status: "failed", stage: null, error: String(message).slice(0, 1000) });
}

// ─── 작업 루프 ─────────────────────────────────────────────────────────────
// 폰에서는 워커를 따로 띄우지 않고 서버 프로세스 안에서 한 번에 하나씩 돈다.

let running = false;

async function tick() {
  if (running) return;
  const job = db.claimJob();
  if (!job) return;

  running = true;
  console.log(`[job] 시작: ${job.type} (${job.project_id})`);

  try {
    if (job.type === "pipeline") {
      await runPipeline(job.project_id);
    } else if (job.type === "rerender") {
      const { shortId } = JSON.parse(job.payload || "{}");
      await rerenderShort(shortId);
      db.updateProject(job.project_id, { status: "done", progress: 100, stage: null });
    } else {
      throw new Error(`알 수 없는 작업 유형: ${job.type}`);
    }
    db.finishJob(job.id, null);
    console.log(`[job] 완료: ${job.id}`);
  } catch (err) {
    console.error(`[job] 실패: ${job.id} — ${err.message}`);
    db.finishJob(job.id, String(err.message).slice(0, 1000));
    failProject(job.project_id, err.message);
  } finally {
    running = false;
  }
}

export function startWorker(intervalMs = 2000) {
  db.recoverJobs();
  setInterval(() => {
    tick().catch((err) => console.error("[job] 루프 오류:", err));
  }, intervalMs).unref?.();
}
