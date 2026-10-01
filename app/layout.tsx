import { Toaster } from "@/components/ui/sonner";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "모임",
  description: "모임 공지와 참석 집계, 비용 정산을 링크 하나로 끝냅니다",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
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
