import type { Metadata } from "next";
import { FaqList } from "@/components/landing/Sections";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: "하이라이트 선정 기준, 과금 방식, 결과물 수정, 저장 위치에 대한 답변.",
};

export default function FaqPage() {
  return (
    <div className="section max-w-3xl">
      <p className="eyebrow">자주 묻는 질문</p>
      <h1 className="heading">궁금한 것들</h1>
      <p className="mt-4 text-white/60">
        여기에 없는 내용은 <a className="underline" href="mailto:help@shortflow.example">메일</a>로
        물어봐 주세요.
      </p>
      <FaqList />
    </div>
  );
}
