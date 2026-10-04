import { ImageResponse } from "next/og";

import { loadJuaSubset } from "@/lib/moim/og-font";

export const OG_SIZE = { width: 1200, height: 630 };

// satori는 CSS 변수를 읽지 못하므로 app/globals.css의 라이트 팔레트 값을 옮겨 적는다
const CREAM = "hsl(30, 50%, 98%)";
const PEACH = "hsl(22, 80%, 90%)";
const CORAL = "hsl(12, 76%, 46%)";
const INK = "hsl(20, 25%, 12%)";
const MUTED = "hsl(25, 10%, 40%)";

/**
 * 메인·초대장 OG 이미지가 공유하는 카드. 두 이미지가 같은 틀을 써야 카톡 대화방에서
 * 한 서비스의 링크로 읽힌다 — 문구만 다르게 넘긴다.
 */
export async function renderOgCard({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle: string;
}) {
  const font = await loadJuaSubset(`${badge}${title}${subtitle}`);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 96px",
        background: `linear-gradient(135deg, ${CREAM} 0%, ${PEACH} 100%)`,
        fontFamily: "Jua",
        color: INK,
      }}
    >
      <div
        style={{
          display: "flex",
          alignSelf: "flex-start",
          padding: "12px 28px",
          borderRadius: 999,
          background: CORAL,
          color: "white",
          fontSize: 36,
        }}
      >
        {badge}
      </div>
      <div style={{ display: "flex", marginTop: 40, fontSize: 88 }}>
        {title}
      </div>
      <div
        style={{ display: "flex", marginTop: 24, fontSize: 40, color: MUTED }}
      >
        {subtitle}
      </div>
    </div>,
    {
      ...OG_SIZE,
      emoji: "twemoji",
      fonts: [{ name: "Jua", data: font, style: "normal", weight: 400 }],
    },
  );
}
