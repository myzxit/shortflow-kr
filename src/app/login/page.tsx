import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";
import { isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "로그인",
  description: "숏플로우에 로그인하거나 새 계정을 만듭니다. 가입 시 30분 무료.",
};

export default function LoginPage() {
  return (
    <div className="section max-w-md">
      <Suspense fallback={<p className="text-white/40">불러오는 중…</p>}>
        <LoginForm googleEnabled={isGoogleEnabled} />
      </Suspense>
    </div>
  );
}
