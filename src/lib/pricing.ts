/**
 * 요금 정책
 *
 * 과금 단위는 "원본 영상 길이(초)"다. 쇼츠를 몇 개 뽑든, 몇 번 다시 렌더링하든
 * 추가 과금은 없다 — 원본을 한 번 분석할 때만 크레딧이 빠진다.
 */

export const SIGNUP_BONUS_SECONDS = 30 * 60; // 가입 시 무료 30분

/** 원본 2분당 쇼츠 1개가 기본 산출량 */
export const SECONDS_PER_SHORT = 120;

export type CreditPack = {
  id: string;
  name: string;
  minutes: number;
  priceKrw: number;
  highlight?: boolean;
  note: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "스타터",
    minutes: 60,
    priceKrw: 9900,
    note: "롱폼 1~2편을 돌려보기 좋은 최소 단위입니다.",
  },
  {
    id: "creator",
    name: "크리에이터",
    minutes: 300,
    priceKrw: 39000,
    highlight: true,
    note: "주 2~3회 업로드하는 채널에 맞춘 기본 팩입니다.",
  },
  {
    id: "studio",
    name: "스튜디오",
    minutes: 1200,
    priceKrw: 129000,
    note: "여러 채널을 운영하거나 팀으로 쓰는 경우입니다.",
  },
];

export function getPack(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

/** 팩 기준 쇼츠 1개당 환산 단가 */
export function pricePerShort(pack: CreditPack): number {
  const shorts = (pack.minutes * 60) / SECONDS_PER_SHORT;
  return Math.round(pack.priceKrw / shorts);
}

/** 영상 길이로 뽑을 쇼츠 개수를 정한다. (최소 1개, 최대 10개) */
export function plannedShortCount(durationSec: number, requested = 0): number {
  if (requested > 0) return Math.min(10, Math.max(1, requested));
  return Math.min(10, Math.max(1, Math.round(durationSec / SECONDS_PER_SHORT)));
}

export function formatKrw(value: number): string {
  return `₩${value.toLocaleString("ko-KR")}`;
}
