import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Doc = { title: string; updated: string; sections: Array<{ h: string; p: string[] }> };

const DOCS: Record<string, Doc> = {
  terms: {
    title: "이용약관",
    updated: "2026-09-16",
    sections: [
      {
        h: "제1조 (목적)",
        p: [
          "이 약관은 숏플로우(이하 “서비스”)가 제공하는 영상 자동 편집 서비스의 이용 조건과 절차, 회사와 이용자의 권리·의무를 정하는 것을 목적으로 합니다.",
          "숏플로우는 오픈소스 예제 프로젝트이며, 이 문서는 실제 서비스를 운영할 때 채워 넣을 내용을 보여주는 견본입니다. 상업적으로 운영하려면 변호사의 검토를 받은 약관으로 교체해야 합니다.",
        ],
      },
      {
        h: "제2조 (서비스의 내용)",
        p: [
          "서비스는 이용자가 제공한 영상 또는 영상 주소를 분석해 짧은 영상(쇼츠)을 자동으로 생성합니다.",
          "생성 결과물의 품질은 원본 영상의 음질, 발화량, 화질에 따라 달라질 수 있으며 회사는 특정 수준의 조회수나 성과를 보장하지 않습니다.",
        ],
      },
      {
        h: "제3조 (이용자의 의무)",
        p: [
          "이용자는 본인이 저작권을 보유하거나 적법하게 이용할 권리가 있는 영상만 업로드해야 합니다.",
          "타인의 저작물을 무단으로 처리해 발생한 분쟁의 책임은 이용자에게 있습니다.",
          "서비스를 통해 불법 정보, 타인의 명예를 훼손하는 내용, 음란물을 제작·유통해서는 안 됩니다.",
        ],
      },
      {
        h: "제4조 (크레딧)",
        p: [
          "크레딧은 처리 가능한 원본 영상의 시간(분)을 단위로 합니다.",
          "크레딧은 원본 영상의 길이만큼 차감되며, 생성된 쇼츠의 개수나 재생성 횟수에 따라 추가 차감되지 않습니다.",
          "처리 과정에서 오류가 발생해 결과물이 생성되지 않은 경우 차감된 크레딧은 자동으로 복구됩니다.",
        ],
      },
      {
        h: "제5조 (책임의 제한)",
        p: [
          "천재지변, 외부 서비스(영상 플랫폼 등)의 정책 변경, 이용자의 귀책사유로 발생한 손해에 대해 회사는 책임지지 않습니다.",
          "서비스는 있는 그대로 제공되며, 특정 목적에의 적합성을 보증하지 않습니다.",
        ],
      },
    ],
  },
  privacy: {
    title: "개인정보처리방침",
    updated: "2026-09-16",
    sections: [
      {
        h: "1. 수집하는 항목",
        p: [
          "필수: 이메일 주소, 비밀번호(단방향 암호화된 값), 소셜 로그인 시 해당 제공자가 전달하는 식별자·이름·프로필 이미지.",
          "자동 수집: 서비스 이용 기록(프로젝트 생성 시각, 처리 상태), 크레딧 증감 내역.",
          "이용자가 업로드한 영상과 그 음성 인식 결과.",
        ],
      },
      {
        h: "2. 이용 목적",
        p: [
          "회원 식별과 로그인 유지, 쇼츠 생성 처리, 크레딧 정산, 오류 원인 파악과 서비스 개선에 사용합니다.",
          "수집한 정보를 광고 목적으로 제3자에게 제공하지 않습니다.",
        ],
      },
      {
        h: "3. 보관과 파기",
        p: [
          "업로드한 원본 영상과 생성된 쇼츠는 서비스를 운영하는 서버의 저장소에 보관됩니다.",
          "이용자가 프로젝트를 삭제하면 원본과 결과물, 음성 인식 결과가 함께 삭제됩니다.",
          "회원 탈퇴 시 계정 정보와 관련 파일을 지체 없이 파기합니다. 단, 관계 법령이 정한 보존 의무가 있는 거래 기록은 해당 기간 동안 보관합니다.",
        ],
      },
      {
        h: "4. 처리 위탁",
        p: [
          "직접 설치해 운영하는 경우 음성 인식과 영상 처리는 모두 운영자의 서버 안에서 수행되며 외부로 전송되지 않습니다.",
          "결제를 연동한 경우 결제 대행사에 결제에 필요한 최소 정보가 전달됩니다.",
        ],
      },
    ],
  },
  refund: {
    title: "환불정책",
    updated: "2026-09-16",
    sections: [
      {
        h: "1. 미사용 크레딧",
        p: [
          "구매일로부터 7일 이내이고 해당 결제분의 크레딧을 전혀 사용하지 않은 경우 전액 환불합니다.",
          "일부를 사용한 경우, 남은 크레딧에 해당하는 금액을 결제 단가 기준으로 환불합니다.",
        ],
      },
      {
        h: "2. 처리 실패",
        p: [
          "영상 다운로드 실패, 음성 인식 실패 등으로 쇼츠가 생성되지 않은 경우 차감된 크레딧이 자동으로 복구됩니다. 별도의 신청이 필요하지 않습니다.",
          "결과물이 생성되었으나 품질이 기대에 못 미치는 경우는 환불 대상이 아닙니다. 구간과 옵션을 바꿔 다시 만들어 보시기 바랍니다. 재생성에는 크레딧이 들지 않습니다.",
        ],
      },
      {
        h: "3. 신청 방법",
        p: [
          "help@shortflow.example 로 결제한 계정 이메일과 결제 일시를 보내주시면 영업일 기준 3일 이내에 처리합니다.",
        ],
      },
    ],
  },
  oss: {
    title: "오픈소스 고지",
    updated: "2026-09-16",
    sections: [
      {
        h: "사용 중인 주요 오픈소스",
        p: [
          "Next.js (MIT) — 웹 프레임워크",
          "React (MIT) — UI 라이브러리",
          "Tailwind CSS (MIT) — 스타일",
          "Prisma (Apache-2.0) — 데이터베이스 접근",
          "Auth.js / next-auth (ISC) — 인증",
          "FFmpeg (LGPL-2.1 이상 / 빌드 구성에 따라 GPL) — 영상 처리",
          "yt-dlp (Unlicense) — 영상 다운로드",
          "faster-whisper (MIT), CTranslate2 (MIT) — 음성 인식",
          "OpenAI Whisper 모델 가중치 (MIT)",
          "Pretendard (SIL Open Font License 1.1) — 본문 글꼴",
        ],
      },
      {
        h: "FFmpeg 라이선스 유의사항",
        p: [
          "FFmpeg는 빌드 시 포함한 코덱 구성에 따라 적용되는 라이선스가 달라집니다. 상업적으로 배포할 때는 사용 중인 빌드의 구성(--enable-gpl 여부 등)을 확인하고 그에 맞는 고지 의무를 이행해야 합니다.",
        ],
      },
      {
        h: "이 프로젝트의 라이선스",
        p: [
          "숏플로우 자체 코드는 MIT 라이선스로 공개되어 있습니다. 자유롭게 포크해 수정·배포할 수 있습니다.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCS[slug];
  return { title: doc?.title ?? "약관" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();

  return (
    <div className="section max-w-3xl">
      <h1 className="text-3xl font-bold">{doc.title}</h1>
      <p className="mt-2 text-sm text-white/40">최종 수정일: {doc.updated}</p>

      <div className="mt-12 space-y-10">
        {doc.sections.map((section) => (
          <section key={section.h}>
            <h2 className="text-lg font-semibold">{section.h}</h2>
            <div className="mt-3 space-y-2">
              {section.p.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-white/60">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
