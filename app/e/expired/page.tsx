import type { Metadata, ResolvingMetadata } from "next";

import {
  buildShareMetadata,
  UNAVAILABLE_SHARE_TEXT,
} from "@/lib/moim/share-meta";

// 무효 토큰의 미리보기와 같은 문구 — 만료 화면으로 리다이렉트된 뒤에 수집돼도
// 모임 존재 여부를 드러내지 않게 한다
export function generateMetadata(
  _props: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return buildShareMetadata(parent, UNAVAILABLE_SHARE_TEXT);
}

export default function GuestExpiredPage() {
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="text-5xl">
        ⌛
      </span>
      <h1 className="font-display text-2xl font-normal">
        링크를 사용할 수 없습니다
      </h1>
      <p className="text-sm text-muted-foreground">
        만료되었거나 더 이상 유효하지 않은 링크입니다. 주최자에게 새 링크를
        요청해 주세요.
      </p>
    </div>
  );
}
