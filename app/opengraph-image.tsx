import { OG_SIZE, renderOgCard } from "@/lib/moim/og-card";

export const alt = "모임 — 공지·참석·정산을 링크 하나로";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({
    badge: "🎉 모임",
    title: "공지·참석·정산을",
    subtitle: "링크 하나로 끝냅니다",
  });
}
