import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "숏플로우 — 롱폼 영상 하나로 쇼츠 10개",
    template: "%s | 숏플로우",
  },
  description:
    "유튜브 링크만 넣으면 AI가 하이라이트를 찾아 자막까지 넣은 쇼츠를 자동으로 만들어 드립니다. 가입하면 30분 무료.",
  openGraph: {
    title: "숏플로우 — 롱폼 영상 하나로 쇼츠 10개",
    description: "AI가 하이라이트를 찾아 자막까지 넣은 쇼츠를 자동으로 만들어 드립니다.",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen">
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
