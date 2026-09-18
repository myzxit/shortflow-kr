import { loadEnv } from "./env";

loadEnv();

import { prisma } from "../src/lib/prisma";
import { runPipeline, rerenderShort, failProject } from "./pipeline";

const POLL_MS = Number.parseInt(process.env.WORKER_POLL_MS || "3000", 10);
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.WORKER_CONCURRENCY || "1", 10));
const MAX_ATTEMPTS = 2;
/** 워커가 죽어서 running 으로 남은 작업을 회수하는 기준 */
const STALE_MS = 1000 * 60 * 60;

let running = 0;
let stopping = false;

function log(...args: unknown[]) {
  console.log(`[worker ${new Date().toISOString()}]`, ...args);
}

/**
 * queued 작업 하나를 잡는다. updateMany 의 조건부 갱신으로
 * 여러 워커가 같은 작업을 집어가지 않도록 한다.
 */
async function claimJob() {
  const candidate = await prisma.job.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.job.updateMany({
    where: { id: candidate.id, status: "queued" },
    data: {
      status: "running",
      lockedAt: new Date(),
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  if (claimed.count === 0) return null;

  return prisma.job.findUnique({ where: { id: candidate.id } });
}

/** 죽은 워커가 물고 있던 작업을 다시 큐로 돌린다. */
async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await prisma.job.updateMany({
    where: { status: "running", lockedAt: { lt: cutoff } },
    data: { status: "queued", lockedAt: null },
  });
  if (stale.count > 0) log(`중단된 작업 ${stale.count}건을 큐로 되돌렸습니다.`);
}

async function runJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  log(`작업 시작: ${job.type} (${job.id})`);

  try {
    if (job.type === "pipeline") {
      await runPipeline(job.projectId);
    } else if (job.type === "rerender") {
      const payload = JSON.parse(job.payload || "{}") as { shortId?: string };
      if (!payload.shortId) throw new Error("shortId 가 없습니다.");
      await rerenderShort(payload.shortId);
      await prisma.project.update({
        where: { id: job.projectId },
        data: { status: "done", progress: 100, stage: null },
      });
    } else {
      throw new Error(`알 수 없는 작업 유형: ${job.type}`);
    }

    await prisma.job.update({
      where: { id: job.id },
      data: { status: "done", finishedAt: new Date(), error: null },
    });
    log(`작업 완료: ${job.id}`);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    log(`작업 실패: ${job.id} — ${message}`);

    const retriable = job.attempts < MAX_ATTEMPTS && /ENOENT|ETIMEDOUT|network|일시/i.test(message);

    if (retriable) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "queued", lockedAt: null, error: message.slice(0, 1000) },
      });
      return;
    }

    await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", finishedAt: new Date(), error: message.slice(0, 1000) },
    });
    await failProject(job.projectId, message);
  }
}

async function tick() {
  while (running < CONCURRENCY && !stopping) {
    const job = await claimJob();
    if (!job) break;

    running += 1;
    void runJob(job.id).finally(() => {
      running -= 1;
    });
  }
}

async function main() {
  log(`숏플로우 워커 시작 (동시 처리 ${CONCURRENCY}건, 폴링 ${POLL_MS}ms)`);
  await recoverStaleJobs();

  const timer = setInterval(() => {
    void tick().catch((err) => log("폴링 오류:", err));
  }, POLL_MS);

  const shutdown = async () => {
    stopping = true;
    clearInterval(timer);
    log("종료 신호를 받았습니다. 진행 중인 작업을 기다립니다…");
    while (running > 0) await new Promise((r) => setTimeout(r, 500));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await tick();
}

void main();
