import type { Metadata } from "next";
import SafeAreaTool from "@/components/tools/SafeAreaTool";
import HookScoreTool from "@/components/tools/HookScoreTool";

export const metadata: Metadata = {
  title: "무료 도구",
  description: "가입 없이 쓰는 쇼츠 제작 보조 도구 — 안전 영역 계산기, 훅 문장 점수 측정기.",
};

export default function ToolsPage() {
  return (
    <div className="section max-w-4xl">
      <p className="eyebrow">무료 도구</p>
      <h1 className="heading">가입 없이 바로 쓰는 도구</h1>
      <p className="mt-4 text-white/60">
        브라우저 안에서만 계산합니다. 서버로 아무것도 보내지 않습니다.
      </p>

      <div className="mt-12 space-y-8">
        <HookScoreTool />
        <SafeAreaTool />
      </div>
    </div>
  );
}
