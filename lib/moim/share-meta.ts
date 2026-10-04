import type { Metadata, ResolvingMetadata } from "next";

/** 무효·만료·삭제 링크가 공통으로 쓰는 미리보기 문구. 셋을 구분하지 않는다(T-303) */
export const UNAVAILABLE_SHARE_TEXT = {
  title: "모임 초대",
  description: "링크를 눌러 모임 정보를 확인하고 참석 여부를 알려주세요",
};

/**
 * 제목·설명만 바꾼 공유 메타데이터. openGraph는 키 단위로 통째로 덮어써져서,
 * 상위에서 정한 이미지(app/e/opengraph-image.tsx)와 siteName·locale을 다시 실어
 * 주지 않으면 미리보기에서 이미지가 빠진다.
 */
export async function buildShareMetadata(
  parent: ResolvingMetadata,
  { title, description }: { title: string; description: string },
): Promise<Metadata> {
  const inherited = (await parent).openGraph;

  return {
    title,
    description,
    openGraph: {
      siteName: inherited?.siteName,
      locale: inherited?.locale,
      images: inherited?.images,
      type: "website",
      title,
      description,
    },
  };
}
