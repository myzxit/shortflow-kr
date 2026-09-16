/**
 * 쇼츠 자막/타이틀 템플릿.
 * 여기 값은 그대로 ffmpeg drawtext 필터 스타일로 변환된다(worker/subtitles.ts).
 */
export type Template = {
  id: string;
  name: string;
  tagline: string;
  /** 자막 글자색 (0xRRGGBB) */
  fontColor: string;
  /** 자막 외곽선 색 */
  borderColor: string;
  borderWidth: number;
  /** 자막 박스 배경 (null = 없음) */
  boxColor: string | null;
  /** 세로 위치 비율 (0 = 맨 위, 1 = 맨 아래) */
  subtitleY: number;
  /** 상단 타이틀 바 사용 여부 */
  titleBar: boolean;
  titleBarColor: string;
  titleColor: string;
  /** 미리보기용 CSS 그라디언트 */
  preview: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "sandpaper",
    name: "샌드페이퍼",
    tagline: "따뜻한 종이 질감. 정보·교양 채널에 잘 맞습니다.",
    fontColor: "0x2B2118",
    borderColor: "0xF4E9D8",
    borderWidth: 6,
    boxColor: "0xF4E9D8@0.92",
    subtitleY: 0.76,
    titleBar: true,
    titleBarColor: "0xF4E9D8@0.95",
    titleColor: "0x2B2118",
    preview: "linear-gradient(135deg,#f4e9d8,#d9c3a1)",
  },
  {
    id: "minimal",
    name: "미니멀",
    tagline: "군더더기 없는 흰 자막. 어떤 영상에도 무난합니다.",
    fontColor: "0xFFFFFF",
    borderColor: "0x000000",
    borderWidth: 4,
    boxColor: null,
    subtitleY: 0.8,
    titleBar: false,
    titleBarColor: "0x000000@0.0",
    titleColor: "0xFFFFFF",
    preview: "linear-gradient(135deg,#1c1c1e,#3a3a3c)",
  },
  {
    id: "vibrant",
    name: "바이브런트",
    tagline: "형광 포인트 컬러. 게임·챌린지 콘텐츠용.",
    fontColor: "0xFFFFFF",
    borderColor: "0x7B2BF5",
    borderWidth: 8,
    boxColor: null,
    subtitleY: 0.72,
    titleBar: true,
    titleBarColor: "0x7B2BF5@0.9",
    titleColor: "0xF6FF3C",
    preview: "linear-gradient(135deg,#7b2bf5,#f6ff3c)",
  },
  {
    id: "greenline",
    name: "그린라인",
    tagline: "자막 하단 라인 강조. 브이로그·여행에 어울립니다.",
    fontColor: "0xFFFFFF",
    borderColor: "0x0B3D2E",
    borderWidth: 5,
    boxColor: "0x0B3D2E@0.7",
    subtitleY: 0.78,
    titleBar: true,
    titleBarColor: "0x1DB954@0.9",
    titleColor: "0x081C14",
    preview: "linear-gradient(135deg,#0b3d2e,#1db954)",
  },
  {
    id: "newsletter",
    name: "뉴스레터",
    tagline: "뉴스 자막 스타일. 시사·리뷰 콘텐츠에 적합합니다.",
    fontColor: "0xFFFFFF",
    borderColor: "0x101010",
    borderWidth: 3,
    boxColor: "0x101010@0.85",
    subtitleY: 0.84,
    titleBar: true,
    titleBarColor: "0xE02424@0.95",
    titleColor: "0xFFFFFF",
    preview: "linear-gradient(135deg,#101010,#e02424)",
  },
];

export const DEFAULT_TEMPLATE_ID = "sandpaper";

export function getTemplate(id: string | null | undefined): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16 세로 (쇼츠·릴스·틱톡)", width: 1080, height: 1920 },
  { id: "1:1", label: "1:1 정사각 (피드)", width: 1080, height: 1080 },
  { id: "16:9", label: "16:9 가로 (유튜브)", width: 1920, height: 1080 },
] as const;

export function getAspect(id: string) {
  return ASPECT_RATIOS.find((a) => a.id === id) ?? ASPECT_RATIOS[0];
}
