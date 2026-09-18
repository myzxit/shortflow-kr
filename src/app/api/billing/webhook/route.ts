import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { grantSeconds } from "@/lib/credits";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** Stripe 결제 완료 웹훅. 크레딧 지급은 여기서만 일어난다. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "결제가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "서명이 없습니다." }, { status: 400 });
  }

  // 서명 검증에는 원문 그대로가 필요하다. JSON 파싱을 먼저 하면 안 된다.
  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `서명 검증 실패: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const checkout = event.data.object as {
    id: string;
    metadata?: { userId?: string; minutes?: string; packId?: string } | null;
  };

  const userId = checkout.metadata?.userId;
  const minutes = Number.parseInt(checkout.metadata?.minutes ?? "0", 10);
  if (!userId || !minutes) {
    return NextResponse.json({ error: "메타데이터가 비어 있습니다." }, { status: 400 });
  }

  // 같은 결제가 두 번 들어와도 크레딧이 두 번 들어가지 않게 한다.
  const already = await prisma.creditTransaction.findFirst({
    where: { reference: checkout.id, reason: "purchase" },
  });
  if (already) return NextResponse.json({ received: true, duplicate: true });

  await grantSeconds(userId, minutes * 60, { reason: "purchase", reference: checkout.id });

  return NextResponse.json({ received: true });
}
