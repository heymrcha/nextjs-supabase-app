import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";

/**
 * 주최자 화면의 공통 컨테이너. 주최자도 카카오톡에서 링크를 복사해 붙이는 흐름이라
 * 모바일에서 모임을 만드는 경우가 흔하다 — 게스트와 같은 모바일 퍼스트 규칙을 따른다.
 *
 * 게스트보다 넓은 `max-w-5xl`을 쓰는 것은 응답 명단·정산 표가 넓은 화면에서 유리하기
 * 때문이고, 좁은 폭에서 깨지지 않게 하는 책임은 각 표가 진다(`components/ui/table.tsx`가
 * 가로 스크롤 컨테이너를 이미 갖고 있다).
 */
export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <nav className="flex w-full justify-center border-b">
        <div className="flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
          <Link href="/events" className="font-semibold">
            모임
          </Link>
          {/* AuthButton은 세션을 읽으므로 cacheComponents 경계가 필요하다 */}
          {hasEnvVars ? (
            <Suspense>
              <AuthButton />
            </Suspense>
          ) : (
            <EnvVarWarning />
          )}
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="flex w-full items-center justify-center gap-6 border-t px-4 py-8 text-center text-xs">
        <p className="text-muted-foreground">모임</p>
        <ThemeSwitcher />
      </footer>
    </div>
  );
}
