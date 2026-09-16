/** 자막 템플릿 · 화면 비율. 웹 버전(src/lib/templates.ts)과 같은 값. */

export const TEMPLATES = [
  {
    id: "sandpaper", name: "샌드페이퍼", tagline: "따뜻한 종이 질감. 정보·교양 채널.",
    fontColor: "0x2B2118", borderColor: "0xF4E9D8", borderWidth: 6,
    boxColor: "0xF4E9D8@0.92", subtitleY: 0.76,
    titleBar: true, titleBarColor: "0xF4E9D8@0.95", titleColor: "0x2B2118",
    preview: "linear-gradient(135deg,#f4e9d8,#d9c3a1)",
  },
  {
    id: "minimal", name: "미니멀", tagline: "군더더기 없는 흰 자막. 어떤 영상에도 무난.",
    fontColor: "0xFFFFFF", borderColor: "0x000000", borderWidth: 4,
    boxColor: null, subtitleY: 0.8,
    titleBar: false, titleBarColor: "0x000000@0.0", titleColor: "0xFFFFFF",
    preview: "linear-gradient(135deg,#1c1c1e,#3a3a3c)",
  },
  {
    id: "vibrant", name: "바이브런트", tagline: "형광 포인트 컬러. 게임·챌린지.",
    fontColor: "0xFFFFFF", borderColor: "0x7B2BF5", borderWidth: 8,
    boxColor: null, subtitleY: 0.72,
    titleBar: true, titleBarColor: "0x7B2BF5@0.9", titleColor: "0xF6FF3C",
    preview: "linear-gradient(135deg,#7b2bf5,#f6ff3c)",
  },
  {
    id: "greenline", name: "그린라인", tagline: "자막 하단 라인 강조. 브이로그·여행.",
    fontColor: "0xFFFFFF", borderColor: "0x0B3D2E", borderWidth: 5,
    boxColor: "0x0B3D2E@0.7", subtitleY: 0.78,
    titleBar: true, titleBarColor: "0x1DB954@0.9", titleColor: "0x081C14",
    preview: "linear-gradient(135deg,#0b3d2e,#1db954)",
  },
  {
    id: "newsletter", name: "뉴스레터", tagline: "뉴스 자막 스타일. 시사·리뷰.",
    fontColor: "0xFFFFFF", borderColor: "0x101010", borderWidth: 3,
    boxColor: "0x101010@0.85", subtitleY: 0.84,
    titleBar: true, titleBarColor: "0xE02424@0.95", titleColor: "0xFFFFFF",
    preview: "linear-gradient(135deg,#101010,#e02424)",
  },
];

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

/**
 * 폰에서 1080x1920 인코딩은 무겁다. 720x1280 을 기본으로 두되
 * 쇼츠 업로드 화질로는 충분하다. SHORTFLOW_HQ=1 이면 1080 으로 올린다.
 */
const HQ = process.env.SHORTFLOW_HQ === "1";

export const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16 세로 (쇼츠·릴스·틱톡)", width: HQ ? 1080 : 720, height: HQ ? 1920 : 1280 },
  { id: "1:1", label: "1:1 정사각 (피드)", width: HQ ? 1080 : 720, height: HQ ? 1080 : 720 },
  { id: "16:9", label: "16:9 가로 (유튜브)", width: HQ ? 1920 : 1280, height: HQ ? 1080 : 720 },
];

export const getAspect = (id) => ASPECT_RATIOS.find((a) => a.id === id) ?? ASPECT_RATIOS[0];
