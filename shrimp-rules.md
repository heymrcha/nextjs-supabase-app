# Development Guidelines

AI 에이전트 전용 작업 규칙. 이 저장소에서만 통하는 제약과 금지사항만 담는다.
일반 개발 지식은 담지 않는다. 기술 배경 설명은 `CLAUDE.md`, 제품 명세는 `docs/product/`를 본다.

---

## 1. 프로젝트 개요

- 이름: `nextjs-supabase-app`. Supabase `with-supabase` 스타터에서 출발한 연습용 프로젝트이며 **모임 이벤트 관리 MVP**로 전환 중이다.
- 스택: Next.js 16.3 (App Router) · React 19 · Supabase (`@supabase/ssr`) · TypeScript strict · Tailwind CSS **v3.4** · shadcn/ui `new-york`.
- 패키지 매니저는 `npm`만 쓴다. `package-lock.json`이 유일한 락파일이다. `yarn`·`pnpm`·`bun` 명령을 쓰지 않는다.
- **테스트 스위트가 없다.** `npm test`를 실행하지 않는다. 테스트 파일을 새로 만들지 않는다(사용자가 명시 요청한 경우 제외).

---

## 2. 기준 문서와 다중 파일 조정

### 2.1 제품 명세의 단일 기준

| 파일                               | 상태                 | 취급                                    |
| ---------------------------------- | -------------------- | --------------------------------------- |
| `docs/product/moim-mvp-prd-alt.md` | **채택된 유일 기준** | 기능·스키마·보안 판단의 근거는 여기서만 |
| `docs/product/ROADMAP.md`          | **작업 목록**        | 착수 전 해당 Task를 읽는다              |
| `docs/product/moim-mvp-prd.md`     | 미채택 대안          | **읽지 않는다. 인용하지 않는다**        |

- 두 PRD가 충돌하면 항상 `-alt.md`를 따른다. `moim-mvp-prd.md`를 근거로 코드를 쓰면 안 된다.
- `ROADMAP.md`는 프로젝트 루트가 아니라 **`docs/product/ROADMAP.md`** 에 있다. 루트에 `ROADMAP.md`를 새로 만들지 않는다.

### 2.2 함께 고쳐야 하는 파일 조합

| 무엇을 바꿨나                          | 반드시 같이 고칠 것                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| 로그인 없이 열려야 하는 페이지 추가    | `lib/supabase/proxy.ts`의 접근 제어 `if` 조건                                   |
| DB 스키마(테이블·컬럼·enum·함수)       | `mcp__supabase__generate_typescript_types`로 `types/database.ts` 재생성         |
| `ROADMAP.md`의 Task 완료               | 해당 Task를 `- [ ]` → `- [x]`. 별도 완료 목록을 만들지 않는다                   |
| `docs/product/*.md`의 설계 결정 변경   | 해당 결정을 참조하는 `ROADMAP.md` Task 본문                                     |
| 새 npm 스크립트 추가                   | `ROADMAP.md`의 "실제로 존재하는 npm 스크립트" 목록                              |
| 정산 계산 규칙                         | `docs/product/moim-mvp-prd-alt.md` §6 + `ROADMAP.md` Phase 5 완료 기준의 검산값 |
| Supabase 프로젝트 설정(노출 스키마 등) | 코드에 남지 않으므로 `docs/product/`에 재현 절차를 기록                         |

---

## 3. 디렉터리 배치 결정

새 파일을 만들 때 아래 표로 위치를 정한다. 표에 없는 새 최상위 디렉터리를 만들지 않는다.

| 만들려는 것                   | 위치                                          |
| ----------------------------- | --------------------------------------------- |
| 페이지·레이아웃·Route Handler | `app/**`                                      |
| shadcn 생성 컴포넌트          | `components/ui/` (직접 작성하지 않고 CLI로)   |
| 그 외 화면 컴포넌트           | `components/*.tsx` (평평하게, 하위 폴더 금지) |
| Supabase 클라이언트           | `lib/supabase/`                               |
| 도메인 로직·순수 함수·포맷터  | `lib/moim/`                                   |
| 공용 유틸                     | `lib/utils.ts`                                |
| 화면이 소비하는 뷰 타입       | `types/moim.ts`                               |
| DB 생성 타입                  | `types/database.ts` (**직접 수정 금지**)      |
| 커스텀 훅                     | `hooks/`                                      |
| 적용한 마이그레이션 SQL       | `supabase/migrations/` (§5.3 참고)            |
| 제품 문서                     | `docs/product/`                               |
| 스택 가이드                   | `docs/guides/`                                |

- `types/`(`moim.ts`)와 `lib/moim/`는 2026-10-01 T-005에서, `supabase/migrations/`는 같은 날 T-101~T-103 적용분을 내려받으며 생겼다. `hooks/`는 **아직 없다** — 처음 필요할 때 만든다(빈 디렉터리는 git에 남지 않으므로 미리 만들지 않는다).
- `docs/guides/project-structure.md`는 **목표 구조**이며 현재 트리와 다르다. 그 문서에 적힌 디렉터리가 있다고 가정하지 않는다.
- `src/` 디렉터리를 만들지 않는다. `tsconfig.json`의 `paths`는 `@/*` → `./*` 이므로 루트 기준이다.

---

## 4. Next.js 16 규약 (이 프로젝트에서 반드시)

### 4.1 라우트 보호는 `proxy.ts` 한 곳

- 루트 진입점은 `proxy.ts`이고 실제 로직은 `lib/supabase/proxy.ts`의 `updateSession()`이다.
- **`middleware.ts`를 만들지 않는다.** Next.js 16에서 이 프로젝트의 규약은 `proxy.ts`다.
- 접근 제어는 `lib/supabase/proxy.ts`의 **`if` 문 하나**가 전부다. 현재 공개 경로는 `/`, `/login*`, `/auth*`, `/e/*`, `/api/guest/*`, 그리고 사문이 된 `/instruments*`(T-201에서 제거)이며 **그 외 전부 `/auth/login`으로 리다이렉트**된다.

공개 경로 추가 예시 — 해야 하는 것:

```ts
if (
  request.nextUrl.pathname !== "/" &&
  !user &&
  !request.nextUrl.pathname.startsWith("/login") &&
  !request.nextUrl.pathname.startsWith("/auth") &&
  !request.nextUrl.pathname.startsWith("/e/") && // 이미 반영됨
  !request.nextUrl.pathname.startsWith("/api/guest/") // 이미 반영됨
) {
```

하면 안 되는 것: 페이지 쪽에 자체 인증 분기를 넣어 공개시키기. 접근 제어 지점이 둘로 갈라진다.

- `updateSession()`은 **`supabaseResponse` 객체를 그대로 반환해야 한다.** 새 `NextResponse`를 만들면 쿠키가 유실되어 세션이 조용히 끊긴다.
- `createServerClient`와 `supabase.auth.getClaims()` 사이에 **다른 코드를 넣지 않는다.**

### 4.2 Cache Components

`next.config.ts`에 `cacheComponents: true`가 켜져 있다. 데이터를 읽는 서버 컴포넌트는 페이지에서 직접 `await` 하면 **빌드 시 프리렌더 오류**가 난다.

해야 하는 것 (`app/page.tsx`의 `PrimaryCta`가 기준 구현):

```tsx
async function EventList() {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select();
  return <pre>{JSON.stringify(data)}</pre>;
}

export default function Page() {
  return (
    <Suspense fallback={<div>불러오는 중…</div>}>
      <EventList />
    </Suspense>
  );
}
```

하면 안 되는 것:

```tsx
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(); // 빌드 실패
  return <pre>{JSON.stringify(data)}</pre>;
}
```

**서버 `await`만의 문제가 아니다 — URL을 읽는 클라이언트 훅도 `<Suspense>` 경계를 요구한다.** `usePathname()`·`useSearchParams()`를 쓰는 클라이언트 컴포넌트를 감싸지 않으면 `CLIENT_HOOK_DYNAMIC` 오류로 프리렌더가 막힌다(`app/events/[id]/layout.tsx`의 `EventTabs`가 그 예다).

```tsx
// layout은 서버 컴포넌트로 유지하고, URL을 읽는 쪽만 감싼다
<Suspense fallback={<div className="h-10 border-b" />}>
  <EventTabs /> {/* "use client" + usePathname() */}
</Suspense>
```

이 오류는 해당 라우트를 프리렌더하는 **빌드 때만** 드러난다. `npm run dev`에서는 보이지 않으므로 `npm run build`를 돌리기 전에는 통과했다고 판단하지 않는다.

### 4.3 `node_modules/next/dist/docs/`

Next.js 16은 학습 데이터와 API가 다를 수 있다. 라우팅·캐싱·`params`/`searchParams` 취급을 건드리기 전에 이 디렉터리의 해당 가이드를 먼저 읽는다. 기억에 의존해 쓰지 않는다.

---

## 5. Supabase 사용 규칙

### 5.1 클라이언트 3종 — 용도를 섞지 않는다

| 파일                     | 쓰는 곳                       | 규칙                                                         |
| ------------------------ | ----------------------------- | ------------------------------------------------------------ |
| `lib/supabase/client.ts` | `"use client"` 컴포넌트       | `createBrowserClient`                                        |
| `lib/supabase/server.ts` | 서버 컴포넌트 · Route Handler | **매 호출마다 새로 생성.** 전역 변수·모듈 캐시에 담지 않는다 |
| `lib/supabase/proxy.ts`  | `proxy.ts`에서만              | 다른 곳에서 `updateSession()`을 호출하지 않는다              |

- 세션 확인은 항상 **`supabase.auth.getClaims()`** 를 쓴다. `getUser()`·`getSession()`을 쓰지 않는다.
- `server.ts`의 `setAll`이 try/catch로 실패를 삼키는 것은 의도된 것이다. 서버 컴포넌트에서 쿠키 쓰기가 불가능하고 세션 갱신은 proxy가 맡기 때문이다. 이 catch를 제거하지 않는다.

### 5.2 환경 변수

- 변수는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **두 개뿐**이다.
- `.env`·`.env.local` **읽기가 거부되어 있다**(`.claude/settings.json`). 값을 확인해야 하면 사용자에게 요청한다.
- **`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`를 도입하지 않는다.** 채택된 설계는 service role 없이 `api` 스키마 함수로 게스트를 처리한다(§6).
- 둘 중 하나라도 없으면 `lib/utils.ts`의 `hasEnvVars`가 falsy가 되어 **proxy 인증 검사 전체가 건너뛰어진다.** "로그인 안 했는데 보호 페이지가 열린다"는 거의 항상 이것이다. 인증 버그를 조사할 때 이 가능성을 먼저 배제한다.

### 5.3 스키마 변경

- 마이그레이션은 `mcp__supabase__apply_migration`으로 **이름을 붙여 하나씩** 적용한다. `execute_sql`로 DDL을 실행하지 않는다(마이그레이션 이력에 남지 않는다).
- **적용한 SQL을 `supabase/migrations/<version>_<name>.sql`에 같은 내용으로 남기고 커밋한다.** `apply_migration`은 원격에만 적용하므로 이 파일을 쓰지 않으면 스키마가 저장소에 존재하지 않는다. 무료 플랜 프로젝트는 사라질 수 있고(이 프로젝트는 2026-10-01에 한 번 NXDOMAIN 상태가 됐다) 그때 설계가 통째로 날아간다. 리뷰 대상이 되지 않는다는 문제도 같다 — 스키마 결정은 코드로 읽혀야 한다.
  - `version`은 적용 후 `mcp__supabase__list_migrations`가 돌려주는 값을 그대로 쓴다. 손으로 만들지 않는다.
  - 이미 적용한 마이그레이션의 SQL은 `select version, name, array_to_string(statements, E';\n') from supabase_migrations.schema_migrations order by version`으로 되살릴 수 있다. 단 프로젝트가 살아 있을 때만이다.
  - 파일을 고쳐도 원격에는 반영되지 않는다. 적용된 마이그레이션은 수정하지 않고 새 마이그레이션을 추가한다.
- 변경 후 반드시 `mcp__supabase__generate_typescript_types`로 `types/database.ts`를 재생성한다. 타입을 손으로 고치면 다음 생성에서 사라진다.
  - **생성기는 기본 스키마(`public`)만 내보낸다.** 스키마를 고를 파라미터가 없다(CLI의 `--schema public,api`에 해당하는 옵션이 MCP에 없다). 그래서 `api` 스키마 RPC 3개의 계약은 손으로 쓴 `types/moim.ts`의 `GuestRpcArgs`·`GuestRpcErrorCode`에 있다. `api` 함수 시그니처를 바꾸면 **생성으로 잡히지 않으므로 `moim.ts`를 직접 맞춰야 한다.**
  - `lib/supabase/{client,server}.ts`는 `createBrowserClient<Database>` / `createServerClient<Database>`로 제네릭을 받는다. `lib/supabase/guest.ts`는 받지 않는다 — `Database`에 `api` 키가 없어서 `db: { schema: "api" }`가 타입 오류가 된다.
- 스키마·RLS·인덱스·트리거·함수를 쓰기 전에 `supabase-postgres-best-practices` 스킬을 로드한다.
- SQL로 서버 파일을 읽거나 OS 명령을 실행하지 않는다.

#### 5.3.1 함수를 만들 때마다 PUBLIC·anon EXECUTE를 명시적으로 걷는다

**`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ... FROM PUBLIC`은 이 환경에서 동작하지 않는다.** 2026-10-01 T-104에서 실증했다 — 기본 권한 행을 만들어도(`{postgres=X}`) 새로 만든 함수의 ACL은 `NULL`(내장 기본값)로 남고, 내장 기본값은 **PUBLIC에 EXECUTE를 준다**. `ALTER DEFAULT PRIVILEGES`의 GRANT는 내장 기본값에 더해지지만 REVOKE는 내장 기본값을 깎지 못한다.

결과: `api`·`public`에 함수를 추가하면 **`anon`에게 조용히 공개된다**(`anon`은 `api` 스키마에 USAGE를 갖고 있다).

그래서 함수를 만든 **직후 같은 마이그레이션에서** 반드시 아래를 짝지어 쓴다.

```sql
create function api.guest_get_event(...) ... ;
revoke execute on function api.guest_get_event(text, uuid) from public, anon;
-- 게스트에게 열어야 하는 함수만 다시 명시적으로 준다
grant execute on function api.guest_get_event(text, uuid) to anon;
```

- 인자 타입을 포함한 시그니처로 지정한다. 오버로드가 있으면 이름만으로는 대상이 특정되지 않는다.
- `private` 스키마 함수는 `anon`에게 스키마 USAGE가 없어 REST 표면이 없지만, PUBLIC EXECUTE는 같은 이유로 남는다. 같이 걷는다.
- 검증: `has_function_privilege('anon', 'api.f(text,uuid)', 'execute')`로 확인한다. 기본 권한 설정을 믿고 넘기지 않는다.

---

## 6. MVP 도메인 규칙 (게스트 · 정산)

`docs/product/moim-mvp-prd-alt.md`에서 확정된 제약이다. 어기면 설계가 무너진다.

### 6.1 게스트 접근

- **게스트는 테이블을 직접 만지지 않는다.** 모든 게스트 동작은 `api` 스키마의 `SECURITY DEFINER` 함수 3개(`guest_get_event`, `guest_submit_rsvp`, `guest_withdraw_rsvp`)로만 나간다.
- RLS 정책은 **`authenticated` 대상만** 만든다. **`anon` 대상 정책을 하나도 만들지 않는다**(정책 부재 = 전면 거부).
- 모든 `SECURITY DEFINER` 함수에 `set search_path = ''`를 붙이고 모든 객체를 스키마 수식한다.
- 게스트 함수는 토큰·삭제 여부·만료·마감·입력 길이를 **함수 내부에서 다시 검증한다.** API 계층 검증에 의존하지 않는다(REST로 RPC를 직접 호출할 수 있다).
- 게스트에게 내려보내는 payload에 **`guest_key`를 절대 포함하지 않는다.**
- `note`(메모)는 **주최자 전용**이다. 게스트 payload에는 `is_mine = true`인 본인 행에만 넣는다.
- Route Handler는 **body의 `guest_key`를 무시하고 항상 httpOnly 쿠키 값만 쓴다.**
- 실패 응답은 "존재하지 않음 / 삭제됨 / 만료됨"을 구분하지 않고 하나로 통일한다.

### 6.2 데이터 취급

- 금액은 **원 단위 정수(`int`)** 로만 저장·계산한다. 부동소수를 쓰지 않는다.
- **연락처 컬럼(전화번호·뒷자리 등)을 어떤 형태로도 만들지 않는다.**
- 정산 분배 결과는 `settlement_shares`에 **스냅샷으로 저장**한다. 조회 시점에 다시 계산해 보여주지 않는다.
- `deleted_at IS NULL` 조건을 개별 쿼리에 흩뿌리지 않고 조회 헬퍼로 감싼다.
- 미정 확정 기한이 지나도 **상태를 자동으로 바꾸지 않는다.** 배지만 부여한다.

### 6.3 확인 UI

- **`confirm()` / `alert()` / `prompt()`를 쓰지 않는다.** 네이티브 다이얼로그는 브라우저 자동화 세션을 멈춘다.
- 파괴적 동작(삭제·재발급)은 shadcn `Dialog`/`AlertDialog` + **대상 이름 재입력**으로 확인한다.
- 성공 알림은 `sonner` 토스트를 쓴다.

---

## 7. 코드 작성 규칙

### 7.1 TypeScript

- **`any` 금지.** 모르면 `unknown` + 타입 가드. pre-commit의 eslint가 막으므로 우회할 수 없다.
- `catch`는 `catch (error: unknown)` + `error instanceof Error` 분기로 쓴다(`components/login-form.tsx` 기준).
- 네이밍: 변수·함수 `camelCase`, 컴포넌트·클래스 `PascalCase`, 상수 `UPPER_SNAKE_CASE`. **한국어 식별자 금지.**

### 7.2 폼

- 기존 인증 폼은 **Server Action을 쓰지 않는다.** 클라이언트 컴포넌트에서 `supabase.auth.*`를 직접 호출하고 `router.push`로 이동한다. 새 인증 관련 폼도 이 패턴을 따른다.
- 신규 도메인 폼은 `react-hook-form` + `zod` + `@hookform/resolvers`를 쓴다. 세 패키지는 2026-10-01 T-002에서 설치됐다(zod는 4.x). 패턴은 `docs/guides/forms-react-hook-form.md`를 본다.
- zod 스키마는 `lib/moim/schemas.ts`에 두고 클라이언트 검증과 서버 검증이 공유한다.

### 7.3 React

- `useEffect` + `setState` 조합을 쓰지 않는다. `eslint-config-next` 16의 `react-hooks/set-state-in-effect` 규칙에 걸린다.
- 하이드레이션 불일치를 피해야 하는 마운트 가드는 `useSyncExternalStore`를 쓴다(`components/theme-switcher.tsx` 기준).
- `dangerouslySetInnerHTML`을 쓰지 않는다. 사용자 입력은 React 기본 이스케이프에 맡긴다.

### 7.4 스타일

- **Tailwind v3.4에 고정한다.** `@import "tailwindcss"`, `@theme` 등 v4 문법을 코드·문서에 쓰지 않는다.
- 테마 색은 `app/globals.css`의 CSS 변수 → `tailwind.config.ts`의 `hsl(var(--…))` 매핑을 쓴다. 색상 리터럴(`#hex`, `rgb()`)을 컴포넌트에 직접 쓰지 않는다.
- 다크모드는 `next-themes` `class` 전략이다. 다크 대응은 `dark:` 프리픽스로 한다.
- `components.json`의 `tailwind.config`가 빈 문자열이지만 실제 설정은 `tailwind.config.ts`다. 이 빈 값을 "설정이 없다"고 해석하지 않는다.

#### 7.4.1 모바일 퍼스트 (게스트 · 주최자 양쪽)

**모든 화면이 모바일 퍼스트다.** 게스트 화면은 카카오톡 인앱 브라우저에서 열리고, 주최자도 카카오톡에서 링크를 복사해 붙이는 흐름이라 모바일에서 모임을 만드는 경우가 흔하다.

- **기본 스타일이 모바일이고 `sm:`·`md:`로 넓은 화면을 확장한다.** 데스크톱 폭을 먼저 잡고 `max-sm:`으로 좁히지 않는다. 이 방향을 뒤집으면 좁은 폭이 예외 취급을 받아 깨진 채로 남는다.
- 공통 컨테이너가 이미 좌우 거터와 세로 여백을 책임진다. 페이지에서 다시 `px-*`를 걸지 않는다.

  | 경로            | 레이아웃                | 컨테이너                                                      |
  | --------------- | ----------------------- | ------------------------------------------------------------- |
  | `app/e/**`      | `app/e/layout.tsx`      | `max-w-screen-sm`, `px-4 py-6` → `sm:px-6 sm:py-10`. nav 없음 |
  | `app/events/**` | `app/events/layout.tsx` | `max-w-5xl`, 같은 거터 규칙                                   |

- **높이는 `min-h-svh`를 쓴다.** `min-h-screen`(=`100vh`)은 모바일 브라우저의 주소창이 접힐 때 실제 보이는 높이와 어긋나 하단이 잘린다.
- **누르는 요소는 최소 44px 높이를 확보한다**(`min-h-11`). shadcn 기본 `Button`은 충족하지만, 직접 만든 링크·토글은 그렇지 않다.
- **좁은 폭에서 넘치는 것은 줄바꿈이 아니라 가로 스크롤로 흘린다.** 탭 줄이 두 줄이 되면 레이아웃 높이가 변해 더 나쁘다(`components/events/event-tabs.tsx`가 기준: `overflow-x-auto` + `shrink-0` + `whitespace-nowrap`, `-mx-4 px-4`로 스크롤 영역을 화면 끝까지 흘림). 표는 `components/ui/table.tsx`가 이미 가로 스크롤 컨테이너를 갖고 있다.
- **확대를 막지 않는다.** `app/layout.tsx`의 `viewport`에 `maximumScale`·`userScalable`을 추가하지 않는다. 작은 글씨를 읽어야 하는 사용자가 갇힌다.
- 좁은 폭 확인은 **375px**를 기준으로 한다. 가로 스크롤(`body` 레벨)이 생기면 실패다.

### 7.5 shadcn/ui

- `components/ui/`의 컴포넌트를 손으로 새로 작성하지 않는다. `npx shadcn@latest add <name>`으로 추가한다.
- **이미 있는 것을 다시 추가하지 않는다.** 현재 존재: `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `separator`, `sonner`, `table`, `tabs`, `textarea`.
- 아이콘은 `lucide-react`만 쓴다.
- `radix-ui`(통합 패키지)와 `@radix-ui/react-*`(개별 패키지)가 공존한다. 새 컴포넌트는 통합 패키지를 쓰므로 import 출처를 통일하려 기존 파일을 건드리지 않는다.

#### 7.5.1 `shadcn add` 직후 반드시 하는 v3 보정

**레지스트리는 Tailwind v4 기준 컴포넌트를 내려준다.** 이 프로젝트는 v3.4 고정이므로 생성된 파일을 그대로 두면 빌드가 깨지거나 스타일이 조용히 사라진다. `add` 실행 후 아래를 전수 확인하고 고친다.

1. **깨진 import** — 생성 파일이 `import { cn } from "cn"`을 쓴다(존재하지 않는 모듈). `@/lib/utils`로 고친다. 이걸 빠뜨리면 `typecheck`가 즉시 실패한다.
2. **v4 전용 유틸리티** — v3에서는 클래스가 그냥 버려져 스타일만 사라진다(오류가 나지 않아 눈치채기 어렵다). v4에서 스케일이 한 칸 밀렸으므로 이름을 되돌린다.

   | v4 (생성됨)            | v3 (교정)        |
   | ---------------------- | ---------------- |
   | `outline-hidden`       | `outline-none`   |
   | `rounded-xs`           | `rounded-sm`     |
   | `shadow-xs`            | `shadow-sm`      |
   | `field-sizing-content` | 대응 없음 → 제거 |

3. **v4 전용 `*:` 자식 변형** — v3에 없다. 임의 선택자로 바꾼다.
   `*:data-[slot=x]:flex` → `[&>[data-slot=x]]:flex`, `*:[span]:last:flex` → `[&>span:last-child]:flex`
4. **CSS 변수를 색으로 쓰는 코드** — 이 프로젝트의 변수는 HSL 삼중값(`--popover: 0 0% 100%`)이라 `var(--popover)`만으로는 유효한 색이 아니다. `hsl(var(--popover))`로 감싼다. 단위를 가진 변수(`--radius: 0.5rem`)는 그대로 둔다.
5. **Prettier** — CLI 생성 파일은 프로젝트 설정(세미콜론 등)과 다르다. `npx prettier --write <생성된 파일들>`을 돌린다.

확인 명령:

```bash
grep -rnE 'from "cn"|outline-hidden|rounded-xs|shadow-xs|field-sizing|[^*]\*:[a-z[]' components/ui/
```

설정 파일(`tailwind.config.ts`, `app/globals.css`, `components.json`)은 CLI가 건드리지 않는 것이 정상이다. `add` 전후로 `shasum`을 비교해 확인하고, 변경됐다면 되돌린다.

### 7.6 주석

- "무엇을 하는지" 반복하는 주석을 쓰지 않는다. **"왜"만 한국어로 쓴다.**
- 나쁜 예: `// i를 1 증가시킨다` / 좋은 예: `// 페이지네이션은 1부터 시작하므로 0-index를 보정`

---

## 8. 검사와 완료 보고

### 8.1 자동 검사 지점 (우회 금지)

| 시점            | 실행                                            | 정의 위치                  |
| --------------- | ----------------------------------------------- | -------------------------- |
| Edit/Write 직후 | 해당 파일에 `prettier --write`                  | `.claude/settings.json` 훅 |
| `git commit`    | 스테이징 파일에 `eslint --fix` + `prettier`     | `.husky/pre-commit`        |
| `git push`      | `typecheck` + `lint` 전체                       | `.husky/pre-push`          |
| GitHub push/PR  | `lint` → `typecheck` → `format:check` → `build` | `.github/workflows/ci.yml` |

- **`--no-verify`를 쓰지 않는다.** 훅이 막은 것은 코드를 고쳐서 통과시킨다.
- 포맷 문제는 Prettier로만 다룬다. `eslint-config-prettier`가 스타일 규칙을 껐으므로 ESLint로 포맷을 고치려 하지 않는다.
- Prettier 설정: printWidth 80 · semi · double quote · trailingComma all · tabWidth 2. `cn`/`cva`/`clsx` 인자의 클래스도 정렬된다.

### 8.2 완료 보고 기준

코드를 수정한 작업은 아래 **둘 다** 통과해야 완료로 보고한다.

```bash
npm run check-all   # lint + typecheck + format:check
npm run build
```

- `check-all`은 `check`의 별칭이고 **`build`를 포함하지 않는다.** 두 명령을 따로 실행한다.
- 존재하는 스크립트만 쓴다: `dev`, `build`, `start`, `lint`, `lint:fix`, `typecheck`, `format`, `format:check`, `check`, `check-all`.
- 기능 동작은 브라우저에서 확인한다. 테스트로 대체할 수 없다(스위트가 없다).
- 실패한 검사를 "통과했다"고 보고하지 않는다. 건너뛴 단계는 건너뛰었다고 말한다.

---

## 9. 언어 규칙

| 대상                                        | 언어   |
| ------------------------------------------- | ------ |
| 사용자 응답 · 문서 · 주석 · UI 문자열       | 한국어 |
| 커밋 메시지 · PR 설명                       | 한국어 |
| 변수 · 함수 · 클래스 · 파일명 · `data-*` 값 | 영문   |

- 문서화(README·설계 문서)는 **예외 없이 한국어**다.
- 커밋 형식: `<이모지> <타입>: <한국어 설명>` (예: `✨ feat: 이벤트 생성 폼 추가`). 전체 규칙은 `.claude/commands/git/commit.md`.
- 커밋에 **Claude 서명(`Co-Authored-By`)을 붙이지 않는다.** 프로젝트 커맨드가 명시적으로 금지한다.

---

## 10. 금지 사항

### 10.1 파일·설정

- `middleware.ts` 생성 금지 (→ `proxy.ts`)
- 루트 `ROADMAP.md` 생성 금지 (→ `docs/product/ROADMAP.md`)
- `types/database.ts` 수동 편집 금지 (→ MCP로 재생성)
- `src/` 디렉터리 생성 금지
- `.claude/settings.json`·`.claude/agents/`·`.claude/commands/`에 **개인 설정·비밀값 넣기 금지** (git 추적 대상이다). 개인 설정은 `.claude/settings.local.json`에 둔다.
- `package-lock.json` 수동 편집 금지
- `.env`·`.env.local` 읽기 금지 (권한 차단됨)

### 10.2 명령

권한 설정(`.claude/settings.json`)이 거부한다. 우회 시도를 하지 않는다.

- `rm -rf`
- `git push --force` / `git push -f`
- `git reset --hard`
- `git checkout -- .`
- `git clean`

커밋·푸시는 사용자가 요청할 때만 한다.

### 10.3 코드

- `any` 타입
- `confirm()` / `alert()` / `prompt()`
- `dangerouslySetInnerHTML`
- Tailwind v4 문법
- `getUser()` / `getSession()`으로 세션 확인
- Supabase 서버 클라이언트를 전역·모듈 스코프에 캐싱
- `anon` 역할 대상 RLS 정책 생성
- service role 키 도입
- 연락처 컬럼 생성
- 금액을 부동소수로 저장

---

## 11. 애매한 상황의 판단 기준

### 11.1 우선순위

충돌하면 위쪽이 이긴다.

1. 사용자의 이번 지시
2. `shrimp-rules.md` (이 문서)
3. `CLAUDE.md` (프로젝트 → 워크스페이스 → 전역 순)
4. `docs/product/moim-mvp-prd-alt.md`
5. `docs/product/ROADMAP.md`
6. `docs/guides/*.md`
7. 스타터 원본 코드의 관행

### 11.2 결정 트리

**새 페이지를 만든다**

```
로그인이 필요한가?
├─ 예 → app/ 아래에 두고 끝. proxy.ts가 자동으로 막는다
└─ 아니오 → lib/supabase/proxy.ts의 if 조건에 경로를 추가한다 (필수)
            └─ 데이터를 읽는가?
               ├─ 예 → 내부 async 컴포넌트 + <Suspense> 분리
               └─ 아니오 → 그대로
```

**게스트(비로그인)가 DB에 써야 한다**

```
api 스키마에 SECURITY DEFINER 함수를 추가한다
├─ 토큰·만료·마감·입력 길이를 함수 내부에서 재검증한다
├─ set search_path = '' 를 붙인다
├─ 해당 함수에만 grant execute to anon
└─ 절대: anon 정책 추가 / service role 키 도입
```

**라이브러리 API가 확실하지 않다**

```
Context7 MCP로 최신 문서를 조회한다 (resolve-library-id → query-docs)
Next.js 16 관련이면 node_modules/next/dist/docs/ 를 먼저 읽는다
기억으로 쓰지 않는다
```

**스타터 잔여물을 지워야 한다** — 2026-10-01 T-001에서 완료

```
components/tutorial/ · deploy-button · hero · next-logo · supabase-logo · app/instruments/ 삭제됨
app/page.tsx 는 모임 랜딩으로 대체됨. app/protected/ 는 남아 있다(T-202에서 제거 판단)
남은 것: lib/supabase/proxy.ts 의 /instruments 예외 2줄 → T-201에서 제거한다
```

**요구사항이 모호하다**

```
코드베이스·기준 문서로 자체 판단이 가능한가?
├─ 예 → 판단하고 근거를 밝히며 진행. 확인을 먼저 구하지 않는다
└─ 아니오 → 판단에 따라 결과가 크게 갈리는 경우에만 사용자에게 묻는다
            그 외에는 가정을 명시하고 진행한다
```

### 11.3 인증 버그 조사 순서

"로그인 안 했는데 보호 페이지가 열린다" / "로그인해도 계속 튕긴다"

1. `.env.local`에 변수 2개가 다 있는지 사용자에게 확인 → `hasEnvVars`가 falsy면 검사 자체가 건너뛰어진다
2. `lib/supabase/proxy.ts`의 `if` 조건에 해당 경로가 공개로 들어가 있는지
3. `updateSession()`이 `supabaseResponse`를 그대로 반환하는지 (새 `NextResponse` 생성 여부)
4. `createServerClient`와 `getClaims()` 사이에 코드가 끼어 있는지
