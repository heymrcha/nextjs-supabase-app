import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * 404 화면. 두지 않으면 Next.js 기본 영어 문구("This page could not be found")가 뜬다(T-602).
 *
 * 주최자가 남의 이벤트 id로 접근할 때도 여기로 온다 — `/events/[id]`가 RLS의 0행을
 * `notFound()`로 바꾸기 때문이다. 그래서 "없음"과 "권한 없음"을 구분하는 문구를 쓰지 않는다.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          주소가 바뀌었거나 더 이상 볼 수 없는 페이지입니다. 공유 링크로 들어온
          경우에는 주최자에게 새 링크를 요청해 주세요.
        </p>
        <Button asChild className="min-h-11">
          <Link href="/">처음으로</Link>
        </Button>
      </div>
    </div>
  );
}
