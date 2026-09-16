import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPack } from "@/lib/pricing";
import { grantSeconds } from "@/lib/credits";
import { stripe } from "@/lib/stripe";

const schema = z.object({ packId: z.string() });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const pack = getPack(parsed.data.packId);
  if (!pack) {
    return NextResponse.json({ error: "존재하지 않는 요금제입니다." }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // 결제 키가 없는 개발 환경: 바로 크레딧을 지급하고 끝낸다.
  if (!stripe) {
    await grantSeconds(session.user.id, pack.minutes * 60, {
      reason: "purchase",
      reference: `mock:${pack.id}`,
    });
    return NextResponse.json({ mock: true, minutes: pack.minutes });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    // 실제 지급은 웹훅에서만 한다. 결제 성공 페이지로 돌아온 것만으로는 지급하지 않는다.
    client_reference_id: session.user.id,
    metadata: { userId: session.user.id, packId: pack.id, minutes: String(pack.minutes) },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "krw",
          unit_amount: pack.priceKrw,
          product_data: {
            name: `숏플로우 ${pack.name} — 원본 ${pack.minutes}분`,
            description: pack.note,
          },
        },
      },
    ],
    success_url: `${siteUrl}/dashboard?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancel`,
  });

  return NextResponse.json({ checkoutUrl: checkout.url });
}
