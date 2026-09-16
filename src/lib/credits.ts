import { prisma } from "@/lib/prisma";

export class InsufficientCreditError extends Error {
  constructor(public required: number, public available: number) {
    super("크레딧이 부족합니다.");
    this.name = "InsufficientCreditError";
  }
}

/** 크레딧 차감 + 원장 기록을 한 트랜잭션으로 처리한다. */
export async function chargeSeconds(
  userId: string,
  seconds: number,
  opts: { reason: string; projectId?: string }
) {
  if (seconds <= 0) return;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.creditSeconds < seconds) {
      throw new InsufficientCreditError(seconds, user.creditSeconds);
    }
    await tx.user.update({
      where: { id: userId },
      data: { creditSeconds: { decrement: seconds } },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        seconds: -seconds,
        reason: opts.reason,
        projectId: opts.projectId ?? null,
      },
    });
  });
}

/** 충전(구매·보너스·환불) */
export async function grantSeconds(
  userId: string,
  seconds: number,
  opts: { reason: string; reference?: string; projectId?: string }
) {
  if (seconds <= 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { creditSeconds: { increment: seconds } },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        seconds,
        reason: opts.reason,
        reference: opts.reference ?? null,
        projectId: opts.projectId ?? null,
      },
    });
  });
}

/** 파이프라인이 실패했을 때 차감분을 되돌린다. */
export async function refundProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.chargedSeconds <= 0) return;

  await grantSeconds(project.userId, project.chargedSeconds, {
    reason: "refund",
    projectId,
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { chargedSeconds: 0 },
  });
}
