# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

Supabase 공식 `with-supabase` 스타터(Create Next App)에서 출발한 **연습용 토이 프로젝트**입니다. 스타터의 튜토리얼 컴포넌트(`components/tutorial/`, `deploy-button`, `hero` 등)가 아직 남아 있으며, 이후 MVP로 전환할 예정입니다. 실험 비용을 낮추는 쪽으로 판단하세요 — 예를 들어 Tailwind는 v4 마이그레이션 없이 **v3.4에 머무르기로 결정**했습니다(토큰·작업량 절약 목적). 문서에 v4 문법(`@import "tailwindcss"`, `@theme`)을 도입하지 마세요.

## 명령어

```bash
npm run dev      # 개발 서버 (Turbopack 기본, Next.js 16)
npm run build    # 프로덕션 빌드
npm run lint     # eslint . — flat config, eslint-config-next 16 직접 import
npx tsc --noEmit # 타입 검사 (별도 스크립트 없음)
```

테스트 스위트는 없습니다. 검증은 `lint` + `tsc` + `build`, 그리고 브라우저 확인입니다.

환경 변수는 `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 두 개입니다(`.env.example` 참고). 둘 중 하나라도 없으면 `lib/utils.ts`의 `hasEnvVars`가 falsy가 되어 **proxy의 인증 검사 자체가 건너뛰어지고** UI에는 `EnvVarWarning`이 뜹니다. "로그인 안 했는데 보호 페이지가 열린다"는 현상은 대부분 이것입니다.

## 아키텍처

### Supabase 클라이언트 3종 (`lib/supabase/`)

| 파일 | 어디서 | 특징 |
|---|---|---|
| `client.ts` | `"use client"` 컴포넌트 | `createBrowserClient`. 폼 제출(로그인·가입·비밀번호)이 전부 여기서 직접 `supabase.auth.*`를 호출하고 `router.push`로 이동 — Server Action을 쓰지 않음 |
| `server.ts` | Server Component, Route Handler | `createServerClient` + `next/headers`의 `cookies()`. **매 호출마다 새로 생성**(전역 캐시 금지, Fluid compute 주석 참고). Server Component에서는 쿠키 쓰기가 실패하므로 `setAll`이 try/catch로 삼킴 — 세션 갱신은 proxy가 담당한다는 전제 |
| `proxy.ts` | 루트 `proxy.ts`에서만 | `updateSession()`. 요청/응답 양쪽 쿠키를 동기화하고 `getClaims()`로 세션을 갱신한 뒤 **응답 객체를 그대로 반환해야 함**(새 `NextResponse`를 만들면 쿠키가 유실됨) |

세션 확인은 어디서든 `getUser()`/`getSession()`이 아니라 **`supabase.auth.getClaims()`** 를 씁니다. 스타터가 그렇게 잡혀 있고 `@supabase/ssr` 현행 권장 방식입니다.

### 라우트 보호는 proxy 한 곳의 거부 목록

`lib/supabase/proxy.ts`의 `if` 하나가 전체 접근 제어입니다. 로그인 없이 열리는 경로는 `/`, `/login*`, `/auth/*`, `/instruments`, `/instruments/*`뿐이고 **나머지는 전부 `/auth/login`으로 리다이렉트**됩니다. 새 공개 페이지를 추가하면 이 조건에 경로를 넣어야 합니다(`8ae16d8` 커밋이 `/instruments`를 추가한 예). `app/protected/`는 별도 보호 로직 없이 이 규칙에 기대며, `protected/page.tsx`가 `getClaims()`를 한 번 더 확인하는 것은 이중 안전장치입니다.

`middleware.ts`가 아니라 `proxy.ts`입니다(Next.js 16 규약). 새로 `middleware.ts`를 만들면 안 됩니다.

### Cache Components 모드

`next.config.ts`에 `cacheComponents: true`가 켜져 있습니다. 그래서 데이터를 읽는 서버 컴포넌트(`app/protected/page.tsx`, `app/instruments/page.tsx`)는 **페이지 컴포넌트가 직접 `await`하지 않고, 내부 async 컴포넌트로 분리해 `<Suspense>`로 감쌉니다.** 이 패턴을 따르지 않으면 빌드 시 프리렌더 오류가 납니다.

### 인증 흐름

이메일+비밀번호 방식입니다. 가입·비밀번호 재설정 메일의 링크는 `app/auth/confirm/route.ts`로 들어와 `verifyOtp({ token_hash, type })`를 수행한 뒤 `?next=` 파라미터로 이동합니다. 오류는 `/auth/error?error=<message>`로 보냅니다.

### UI

shadcn/ui `new-york` 스타일, `components/ui/`에 필요한 것만 추가(`npx shadcn@latest add <name>`). `components.json`의 `tailwind.config`가 빈 문자열이지만 실제로는 `tailwind.config.ts`(v3, `tailwindcss-animate` 플러그인)를 씁니다. 테마 색은 `app/globals.css`의 CSS 변수 → `tailwind.config.ts`의 `hsl(var(--…))` 매핑입니다. 다크모드는 `next-themes`(`class` 전략)이고, `components/theme-switcher.tsx`는 hydration 불일치를 피하려고 `useSyncExternalStore` 마운트 가드를 씁니다 — `useEffect` + `setState` 패턴은 eslint-config-next 16의 `react-hooks/set-state-in-effect` 규칙에 걸립니다.

## 문서와 에이전트 설정

`docs/guides/`에 스택별 개발 가이드가 있습니다(`nextjs-16.md`, `styling-guide.md`, `forms-react-hook-form.md`, `component-patterns.md`, `project-structure.md`). 2026-09에 Context7로 대조해 Next.js 16 / Tailwind v3 / Zod 4 기준으로 맞춰 두었습니다. 주의할 점:

- `forms-react-hook-form.md`가 다루는 `react-hook-form`·`zod`·`@hookform/resolvers`는 **아직 설치되어 있지 않습니다.** 폼 작업을 시작할 때 설치하세요.
- `project-structure.md`는 목표 구조를 설명하며 현재 트리와 일치하지 않는 부분이 있습니다(예: `hooks/`, `types/` 디렉터리 없음).

`.claude/`, `.agents/`, `shrimp_data/`는 `.gitignore`에 들어 있어 **서브에이전트·커맨드·스킬 수정은 커밋되지 않습니다.** 이 머신에만 존재한다는 점을 전제로 안내하세요. 반면 `.mcp.json`(Supabase MCP, 프로젝트 ref만 포함)은 커밋 대상입니다.

## 커밋 규칙

`/git:commit` 커맨드가 정의한 형식을 따릅니다: `<이모지> <타입>: <한국어 설명>` (예: `📝 docs: 가이드 문서를 설치된 스택 버전에 맞게 갱신`). 이 커맨드는 **Claude 서명(Co-Authored-By)을 붙이지 않도록** 명시하고 있습니다.
