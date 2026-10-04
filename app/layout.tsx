import { Toaster } from "@/components/ui/sonner";
import { getAppOrigin } from "@/lib/moim/share-link";
import type { Metadata, Viewport } from "next";
import { Geist, Jua } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  // origin 계산은 공유 링크와 한 규칙을 쓴다(lib/moim/share-link.ts)
  metadataBase: new URL(getAppOrigin()),
  title: {
    default: "모임 — 공지·참석·정산을 링크 하나로",
    template: "%s · 모임",
  },
  description: "모임 공지와 참석 집계, 비용 정산을 링크 하나로 끝냅니다",
  // 이미지는 app/opengraph-image.tsx(파일 규약)가 채운다. 여기에 images를 적으면 둘이 엇갈린다
  openGraph: {
    siteName: "모임",
    locale: "ko_KR",
    type: "website",
    title: "모임 — 공지·참석·정산을 링크 하나로",
    description: "모임 공지와 참석 집계, 비용 정산을 링크 하나로 끝냅니다",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale·userScalable을 지정하지 않는다 — 확대를 막으면 작은 글씨를 읽어야 하는
  // 사용자가 갇힌다. 게스트 화면은 카카오톡 인앱 브라우저에서 열리므로 특히 중요하다
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

// 한글 글리프는 unicode-range 조각으로 나뉘어 있어 preload 대상을 특정할 수 없다
const jua = Jua({
  weight: "400",
  variable: "--font-display",
  display: "swap",
  preload: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.className} ${jua.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* ThemeProvider 안에 두어 토스트가 다크모드 테마를 물려받게 한다 */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
