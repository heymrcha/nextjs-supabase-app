import { OG_SIZE, renderOgCard } from "@/lib/moim/og-card";

// 모임마다 이미지를 만들지 않고 /e/* 전체가 이 한 장을 상속한다.
// 모임 정보는 generateMetadata의 제목·설명 문구가 맡는다
export const alt = "모임 초대장";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({
    badge: "🎉 모임 초대장",
    title: "모임에 초대합니다",
    subtitle: "링크를 눌러 참석 여부를 알려주세요",
  });
}
