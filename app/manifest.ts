import type { MetadataRoute } from "next";

// 색은 app/globals.css의 라이트 토큰을 hex로 옮긴 값이다(--primary 12 76% 46%, --background 30 50% 98%).
// 매니페스트는 CSS 변수를 읽지 못하므로 토큰이 바뀌면 여기도 함께 바꿔야 한다
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "모임 — 공지·참석·정산을 링크 하나로",
    short_name: "모임",
    description: "모임 공지와 참석 집계, 비용 정산을 링크 하나로 끝냅니다",
    lang: "ko",
    // /events로 두면 비로그인 상태에서 로그인 페이지로 튕긴다. /는 공개 페이지이고
    // 로그인 상태면 "내 모임 보기" 버튼이 나온다
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fcfaf7",
    theme_color: "#ce401c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // 로고가 중앙 80% 안전영역 안에 들어가고 배경이 꽉 차 있어 같은 이미지를 마스커블로 쓴다
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
