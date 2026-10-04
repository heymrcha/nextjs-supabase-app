import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

const FEATURES = [
  {
    emoji: "📣",
    title: "링크 하나로 공지",
    body: "일시·장소·준비물을 한 페이지에 모아 공유합니다. 참여자는 가입하지 않아도 열어볼 수 있습니다.",
  },
  {
    emoji: "🙋",
    title: "참석 집계",
    body: "참석·불참·미정을 이름만으로 응답받고, 정원 초과와 응답 변경 이력까지 주최자가 확인합니다.",
  },
  {
    emoji: "💸",
    title: "비용 정산",
    body: "비용 항목을 넣으면 참석자 균등분할과 1인당 금액을 계산하고, 입금 여부를 추적합니다.",
  },
];

// 세션 확인은 동적이므로 페이지에서 직접 await하지 않는다(cacheComponents)
async function PrimaryCta() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return data?.claims ? (
    <Button asChild size="lg">
      <Link href="/events">내 모임 보기</Link>
    </Button>
  ) : (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <Link href="/auth/sign-up">시작하기</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/auth/login">로그인</Link>
      </Button>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center">
      <div className="flex w-full flex-1 flex-col items-center">
        <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
          <div className="flex w-full max-w-5xl items-center justify-between gap-3 p-3 px-4 text-sm sm:px-6">
            <Link href="/" className="font-display text-lg">
              <span aria-hidden>🎉 </span>모임
            </Link>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>

        <div className="flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-10 sm:gap-20 sm:px-6 sm:py-16">
          {/* blob이 가로 스크롤을 만들지 않도록 overflow-hidden 컨테이너 안에 가둔다 */}
          <section className="relative flex flex-col items-start gap-6 overflow-hidden rounded-3xl py-6 sm:py-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 -z-10 size-64 rounded-full bg-primary/20 blur-3xl sm:size-96"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 left-1/3 -z-10 size-56 rounded-full bg-accent blur-3xl sm:size-80"
            />
            <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl md:text-5xl">
              모임 공지와 정산을
              <br />
              링크 하나로 끝냅니다
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              단발 모임의 공지·참석 집계·비용 정산을 한곳에서 처리합니다.
              참여자는 가입하지 않고 링크만으로 응답합니다.
            </p>
            <Suspense fallback={<div className="h-11" />}>
              <PrimaryCta />
            </Suspense>
          </section>

          <section className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-2 rounded-2xl border border-transparent bg-secondary/60 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span aria-hidden className="text-4xl">
                  {feature.emoji}
                </span>
                <h2 className="font-semibold">{feature.title}</h2>
                <p className="text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </section>
        </div>

        <footer className="mx-auto flex w-full items-center justify-center gap-6 border-t px-4 py-8 text-center text-xs sm:gap-8 sm:py-10">
          <p className="text-muted-foreground">모임</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
