# 모임 이벤트 관리 MVP 개발 로드맵

> 기준 문서: [`docs/product/moim-mvp-prd-alt.md`](./docs/product/moim-mvp-prd-alt.md) (확정된 단일 기준)
> 대상 리포지토리: `nextjs-supabase-app` · Next.js 16 App Router / Supabase / Tailwind v3.4 / shadcn-ui new-york
> 최종 갱신: 2026-10-01

주최자가 단발 모임의 **공지 · 참석 집계 · 비용 정산**을 링크 하나로 끝내게 한다. 참여자는 가입하지 않는다.

---

## 이 로드맵을 읽는 방법

- 작업 ID는 `T-<단계><순번>` 형식이며 변경하지 않는다. 완료 시 `- [ ]` → `- [x]`.
- **선행**: 해당 작업을 시작하기 전에 완료되어 있어야 하는 작업. 선행이 없는 작업은 병렬 착수 가능.
- 각 단계 끝에 **완료 기준**(무엇이 충족되어야 다음 단계로 가는가)과 **검증 방법**(어떤 명령을 돌리고 브라우저에서 무엇을 보는가)이 붙어 있다.
- 실제로 존재하는 npm 스크립트만 쓴다: `dev`, `build`, `start`, `lint`, `lint:fix`, `typecheck`, `format`, `format:check`, `check`, `check-all`. 테스트 스위트는 없다.
- 데이터를 읽는 서버 컴포넌트는 페이지에서 직접 `await`하지 않고 내부 async 컴포넌트로 분리해 `<Suspense>`로 감싼다(`cacheComponents: true`).
- 세션 확인은 항상 `supabase.auth.getClaims()`. 라우트 보호는 `middleware.ts`가 아니라 루트 `proxy.ts` → `lib/supabase/proxy.ts`.
- 확인 UI는 shadcn `Dialog` + 텍스트 입력. 네이티브 `confirm()` / `alert()` / `prompt()` 금지(브라우저 자동화가 멈춘다).
- `any` 금지. 모르면 `unknown` + 타입 가드. Tailwind v4 문법(`@import "tailwindcss"`, `@theme`) 금지.
- **모든 화면이 모바일 퍼스트다.** 기본 스타일이 모바일이고 `sm:`·`md:`로 확장한다. 공통 컨테이너(`app/e/layout.tsx`, `app/events/layout.tsx`)가 거터와 여백을 책임지므로 페이지에서 다시 `px-*`를 걸지 않는다. 좁은 폭 기준은 375px. 규칙은 `shrimp-rules.md` §7.4.1.

### PRD 대비 반영된 수정 사항 4건

PRD 원문을 그대로 옮기면 동작하지 않는 지점이다. 각 작업 본문에 수정된 형태로 들어가 있다.

| #   | PRD 위치        | 문제                                     | 반영 위치                       |
| --- | --------------- | ---------------------------------------- | ------------------------------- |
| 1   | §7.3            | `grant usage on schema api to anon` 누락 | **T-104**                       |
| 2   | §7.3 (미기술)   | PostgREST 노출 스키마에 `api` 미등록     | **T-108**                       |
| 3   | §6 정산 계산    | 정산 대상 조건의 "기한초과" 항이 사문    | **T-502**                       |
| 4   | §7.3 vs §8 모순 | 게스트 payload의 `r.note` 노출 범위 초과 | **T-105** (DB) · **T-506** (UI) |

---

## Phase 0 — 준비 (스타터 정리 · 의존성 · 골격)

목표: 코드베이스에서 스타터 흔적을 지우고, 이후 모든 단계가 기대는 디렉터리 · 의존성 · 타입 골격을 세운다. 이 단계에는 DB 작업이 없다.

- [x] **T-001 스타터 잔여물 제거**
  - 삭제: `components/tutorial/`(5개 파일), `components/deploy-button.tsx`, `components/hero.tsx`, `components/next-logo.tsx`, `components/supabase-logo.tsx`, `app/instruments/`
  - `app/page.tsx`가 `Hero`를 참조하므로 함께 수정한다 — 로그인 전에는 서비스 소개 + 로그인 CTA, 로그인 상태면 `/events`로 유도하는 최소 랜딩으로 대체
  - `app/protected/`는 남겨 두되 이후 `/events`로 대체되면 T-202에서 제거 판단
  - `lib/supabase/proxy.ts`의 `/instruments` 예외 2줄 제거는 T-201에서 공개 경로 변경과 함께 처리한다(같은 `if` 블록이므로 충돌 방지)
- [x] **T-002 폼 의존성 설치** — `npm i react-hook-form zod @hookform/resolvers`. 현재 `package.json`에 3개 모두 없다. `docs/guides/forms-react-hook-form.md` 패턴을 따른다
- [x] **T-003 shadcn 컴포넌트 추가** — `npx shadcn@latest add dialog tabs textarea select sonner table separator`. `badge`, `card`, `input`, `label`, `button`, `checkbox`, `dropdown-menu`는 이미 있으므로 다시 추가하지 않는다. `sonner`의 `<Toaster />`를 `app/layout.tsx`에 1회 배치
  - 선행: T-001
- [x] **T-004 라우트 골격 생성 (빈 껍데기)** — 아래 경로에 자리만 잡는다. 데이터 연동 없음, "준비 중" 수준의 마크업
  - 주최자: `app/events/page.tsx`, `app/events/new/page.tsx`, `app/events/[id]/page.tsx`, `app/events/[id]/responses/page.tsx`, `app/events/[id]/notices/page.tsx`, `app/events/[id]/settlement/page.tsx`, `app/events/[id]/settings/page.tsx`, 공통 `app/events/[id]/layout.tsx`(탭 네비게이션)
  - 게스트: `app/e/[token]/page.tsx`, `app/e/[token]/respond/page.tsx`, `app/e/expired/page.tsx`
  - Route Handler: `app/api/guest/rsvp/route.ts` (501 반환 스텁)
  - 선행: T-001
- [x] **T-005 도메인 타입 · 유틸 골격**
  - `types/moim.ts`: `RsvpStatus`, `GuestEventPayload`, `SettlementSummary` 등 화면이 소비하는 뷰 타입. DB 생성 타입(T-109)과 역할을 분리한다
  - `lib/moim/` 디렉터리: `format.ts`(원화 · 일시 포맷), `guest-cookie.ts`(쿠키 이름 규칙만 먼저 상수화)
  - `hooks/`, `types/` 디렉터리는 현재 없으므로 여기서 새로 만든다(`docs/guides/project-structure.md`의 목표 구조와 일치시킴)

**완료 기준**

- `grep -r "tutorial\|deploy-button\|next-logo\|supabase-logo\|instruments" app components lib` 결과가 0건(T-201 전이라 `proxy.ts`의 `/instruments`만 예외로 남을 수 있음 → T-201에서 해소)
- 위 11개 라우트가 모두 200으로 열리고 빈 화면을 보여준다
- `react-hook-form`, `zod`, `@hookform/resolvers`가 `package.json` `dependencies`에 존재

**검증 방법**

- `npm run check-all` 통과, `npm run build` 성공
- `npm run dev` 후 `/events`, `/events/new`, `/e/expired`를 브라우저에서 직접 열어 빈 페이지 렌더 확인
- `curl -i -X POST http://localhost:3000/api/guest/rsvp` → 501 스텁 응답

### Phase 0 실행 결과 — 계획과 달라진 5건 (2026-10-01)

실제로 돌려 보니 위 계획이 사실과 어긋난 지점들이다. 이후 단계가 잘못된 전제로 작동하지 않게 여기 남긴다.

| #   | 계획                                                   | 실제                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | T-001은 `app/page.tsx`만 고치면 된다                   | `app/protected/layout.tsx`(`DeployButton`)와 `app/protected/page.tsx`(`FetchDataSteps`)도 삭제 대상을 import하고 있어 함께 고쳐야 빌드가 통과한다. 두 파일은 삭제하지 않고 최소 수정만 했다(T-202에서 제거 판단)      |
| 2   | proxy 공개 경로 변경은 T-201에서                       | 게스트 경로 2줄(`/e/`, `/api/guest/`)만 Phase 0으로 **선반영**했다(커밋 `86bb569`). 그러지 않으면 이 단계의 검증 기준(게스트 라우트 200, rsvp 501)이 성립하지 않는다. T-201에 남은 일은 `/instruments` 2줄 제거뿐이다 |
| 3   | T-005에서 `hooks/` 디렉터리를 만든다                   | **만들지 않았다.** 빈 디렉터리는 git에 남지 않고 커밋할 내용도 없다. `components.json`의 `"hooks": "@/hooks"` alias는 이미 있다. 첫 훅이 생기는 시점(Phase 3 예상)에 만든다                                           |
| 4   | `cacheComponents` 대응은 서버 컴포넌트 `await`만       | **URL을 읽는 클라이언트 훅도 `<Suspense>` 경계를 요구한다.** `usePathname()`을 쓰는 `EventTabs`를 감싸지 않아 `/events/[id]/notices` 프리렌더가 `CLIENT_HOOK_DYNAMIC`으로 실패했다                                    |
| 5   | T-105의 `guest_submit_rsvp`는 `returns uuid`(PRD §7.3) | **`{ rsvp_id, event_id }` jsonb로 바꾼다.** 쿠키 이름이 `moim_gk_<event_id 앞 8자>`인데 Route Handler는 token만 받으므로, event_id 없이는 쿠키를 심을 수 없다. `types/moim.ts`의 `GuestRsvpResult`가 이 형태다        |

추가로 알아 둘 것:

- **`npx shadcn@latest add`는 Tailwind v4 기준 컴포넌트를 내려준다.** 생성 직후 `import { cn } from "cn"`(깨진 경로), `outline-hidden`·`rounded-xs`·`shadow-xs`·`field-sizing-content`, `*:` 자식 변형, `var(--…)`를 색으로 쓰는 코드를 v3 형태로 고쳐야 한다. 절차는 `shrimp-rules.md` §7.5.1에 있다.
- 라우트를 **삭제**한 뒤 `typecheck`가 `.next/dev/types/validator.ts`의 낡은 생성물 때문에 실패할 수 있다. `next build`는 `.next/types`만 재생성하므로 해당 파일을 직접 지운다.
- `field-sizing-content` 제거로 `Textarea`의 자동 높이 조절 기능이 없다. 필요해지면(T-401 공지 작성) JS로 구현한다.

---

## Phase 1 — 스키마와 보안 (여기서 틀리면 전부 다시)

목표: 게스트가 테이블을 전혀 만지지 못하고 `api` 스키마의 함수 3개만 호출하는 구조를 DB 레벨에서 완성한다. 마이그레이션은 `mcp__supabase__apply_migration`으로 하나씩 이름을 붙여 적용한다.

- [x] **T-101 마이그레이션 `moim_core_tables`** — enum `public.rsvp_status`(`attending` / `declined` / `maybe`), 테이블 `events`, `event_notices`, `rsvps`, `rsvp_changes`
  - `events`: PRD §6 컬럼 전체 + `expected_headcount int null`(§9 링크 응답률 측정용 "예상 인원")
  - 인덱스: `events (host_id, starts_at desc)`, `unique (share_token)`, `rsvps (event_id)`, `rsvp_changes (event_id)`, `rsvp_changes (rsvp_id, changed_at)`
  - 제약: `rsvps unique (event_id, guest_key)`, `events.title` 1~100자 체크, `rsvps.display_name` 1~20자 체크, `rsvps.note` 200자 체크
  - 금액·인원은 정수 컬럼만 사용(부동소수 금지). 연락처 컬럼은 어떤 형태로도 만들지 않는다
- [x] **T-102 마이그레이션 `moim_settlement_tables`** — `settlements`(`event_id` UNIQUE, `rounding_unit` default 10, `snapshot_at`, `is_published`), `settlement_items`, `settlement_shares`(`rsvp_id` on delete set null, `unique (settlement_id, rsvp_id)`)
  - 선행: T-101
- [x] **T-103 마이그레이션 `moim_rls_policies`** — 7개 테이블 전부 `enable row level security`, `public.is_event_host(uuid)`(`security definer`, `set search_path = ''`, `stable`), `authenticated` 대상 정책만 작성
  - **`anon` 대상 정책을 하나도 만들지 않는다**(정책 부재 = 전면 거부)
  - 정책 조건의 `auth.uid()`는 반드시 `(select auth.uid())`로 감싼다(행마다 재평가 방지)
  - `rsvp_changes`는 `for select`만. INSERT/UPDATE/DELETE 정책을 만들지 않아 주최자도 이력을 조작할 수 없게 한다
  - 선행: T-101, T-102
- [x] **T-104 마이그레이션 `moim_api_schema_grants`** — 게스트 출입구 스키마와 권한 기본값 정리
  - `create schema if not exists api;`
  - **`grant usage on schema api to anon;`** ← PRD §7.3 누락분. 이게 없으면 함수에 `grant execute`를 줘도 `permission denied for schema api`로 호출이 실패한다. `authenticated`에도 동일하게 부여
  - `revoke all on schema public from anon;`
  - `revoke execute on all functions in schema public from anon, public;`
  - `alter default privileges in schema public revoke execute on functions from anon, public;`
  - ~~`alter default privileges in schema api revoke execute on functions from anon, public;`~~ — **동작하지 않는다.** `ALTER DEFAULT PRIVILEGES`의 REVOKE는 내장 기본값인 PUBLIC EXECUTE를 깎지 못한다(2026-10-01 실증). 기본 권한 행을 만들어도 새 함수 ACL이 `NULL`로 남아 PUBLIC에 EXECUTE가 유지된다. **함수를 만들 때마다 같은 마이그레이션에서 `revoke execute ... from public, anon` 후 필요한 것만 `grant execute ... to anon`** 하는 것이 유일한 수단이다(`shrimp-rules.md` §5.3.1). T-110이 `api`에서 anon 실행 가능 함수 수를 직접 세는 것으로 그물을 대신한다
  - `revoke all on all tables in schema public from anon;`
  - 선행: T-103
- [x] **T-105 마이그레이션 `moim_guest_functions`** — `api` 스키마에 SECURITY DEFINER 함수 3개. 전부 `set search_path = ''` + 모든 참조를 스키마 수식
  - `api.guest_get_event(p_token text, p_guest_key uuid default null) returns jsonb` (stable)
  - `api.guest_submit_rsvp(p_token text, p_guest_key uuid, p_name text, p_status public.rsvp_status, p_note text default null) returns jsonb` — **PRD §7.3의 `returns uuid`를 `{ rsvp_id, event_id }` jsonb로 바꾼다.** 쿠키 이름이 `moim_gk_<event_id 앞 8자>`인데 Route Handler는 token만 받으므로 event_id 없이는 쿠키를 심을 수 없다. `guest_withdraw_rsvp`도 같은 이유로 `returns jsonb` — `select ... for update`로 이벤트 행을 잠가 정원 순번 경합을 막고, 토큰 · 만료 · 마감 · `guest_key` 유무 · 이름 1~20자 · 메모 200자를 **함수 안에서 다시** 검증한 뒤 upsert
  - `api.guest_withdraw_rsvp(p_token text, p_guest_key uuid) returns jsonb` — 행 삭제가 아니라 `declined` 전환(이력 보존)
  - **게스트 payload에서 `r.note`를 제거한다** ← PRD §7.3은 `'note', r.note`를 넣지만 같은 문서 §8은 "공개 범위를 넘는다"며 이력을 게스트에 숨긴다. 메모는 참여자가 사적인 내용을 적을 수 있는 자유 입력이므로 **주최자 전용**으로 확정한다. `guest_get_event`의 `rsvps` 배열은 `id` / `display_name` / `status` / `responded_at` / `is_mine`만 담고, `note`는 `is_mine = true`인 본인 행에만 포함시킨다(본인이 쓴 메모를 수정 폼에 프리필하기 위함). `guest_key`는 어떤 경우에도 payload에 넣지 않는다
  - 실패는 존재하지 않음 / 삭제됨 / 만료됨을 구분하지 않고 모두 `EVENT_UNAVAILABLE`(`errcode = 'P0002'`). 마감은 `RSVP_CLOSED`(`P0001`)
  - 마지막에 함수 3개에만 `grant execute ... to anon` (T-104의 `revoke` 이후에 실행되어야 한다)
  - 선행: T-104
- [x] **T-106 마이그레이션 `moim_rsvp_change_trigger`** — `private.log_rsvp_change()` + `rsvps_log_change` (after insert or update, for each row). 함수를 `public`이 아니라 **`private`에 두었다** — T-103과 같은 이유로 `public`의 SECURITY DEFINER 함수는 어드바이저 경고가 된다. `private.set_updated_at()` before update 트리거 3개도 같은 마이그레이션에서 함께 넣었다(T-101의 부채 해소)
  - `status` 또는 `display_name`이 바뀔 때만 기록. `note`만 바뀐 경우는 기록하지 않는다(노이즈)
  - 이력 기록은 애플리케이션이 아니라 트리거가 담당한다 — RPC · 주최자 편집 · 관리 스크립트 어느 경로로 들어와도 빠지지 않게
  - 선행: T-105
- [x] **T-107 마이그레이션 `moim_guest_rate_limit`** — **`private`.`guest_rsvp_calls(event_id, minute_bucket, call_count)`** 카운터 테이블(`api`가 아니다 — T-108에서 `api`가 노출 스키마가 되면 그 안의 테이블은 `/rest/v1/guest_rsvp_calls` 경로가 생긴다. 권한이 없어 막히지만 표면을 만들지 않는 편이 낫다) + `guest_submit_rsvp` 안에서 `(event_id, date_trunc('minute', now()))` 기준 분당 상한 초과 시 `RATE_LIMITED`(`P0001`) 발생. 테이블은 `anon`에게 어떤 권한도 주지 않고 함수 내부에서만 갱신
  - 선행: T-105
- [x] **T-108 PostgREST 노출 스키마에 `api` 추가 (프로젝트 설정 — 마이그레이션 아님)** — 재현 절차는 `docs/product/supabase-project-setup.md`에 기록했다. 노출 스키마는 `public, graphql_public, api`이고 `private`은 넣지 않는다
  - SQL로 해결되지 않는다. Supabase 대시보드 **Settings → API → Exposed schemas**에 `api`를 추가해야(또는 Management API의 `db_schema` 설정 갱신) `/rest/v1/rpc/guest_get_event`에 도달한다. 누락 시 `grant`가 모두 맞아도 `PGRST106` / 404가 난다
  - 클라이언트에서 `api` 스키마를 쓰는 방법을 함께 확정한다 — `createServerClient(..., { db: { schema: "api" } })`로 게스트 전용 클라이언트를 따로 만들거나 `supabase.schema("api").rpc(...)`를 사용. `lib/supabase/guest.ts`로 한 곳에 모은다
  - 설정 변경은 코드에 남지 않으므로 `docs/product/`에 한 줄 기록을 남기고 `.env.example` 주변 문서에 재현 절차를 적는다
  - 선행: T-105
- [x] **T-109 `types/database.ts` 생성** — `mcp__supabase__generate_typescript_types`로 생성. `api` 스키마 함수 시그니처가 포함되는지 확인한다. **이후 스키마를 바꿀 때마다 재생성**하는 것을 규칙으로 못 박는다(`any` 금지 규칙과 직결)
  - 선행: T-105, T-106, T-107
- [x] **T-110 보안 검증 (이 단계의 관문)** — 통과. 전체 결과는 `docs/product/phase1-security-gate.md`
  - `mcp__supabase__get_advisors`(security) → **경고 0건이 아니다.** WARN 2종 · INFO 1종이 남고 **3건 전부 설계 의도에 따른 영구 예외**로 판정했다(아래). 관문 기준을 "**스키마 설정 오류에서 비롯한 경고 0건**"으로 좁혔다
    - `anon_security_definer_function_executable`(WARN 3건) — 게스트 함수 3개가 anon 실행 가능하다는 지적. 이게 아키텍처의 정의 그 자체다. 경고를 없애는 세 조치(execute 회수 · SECURITY INVOKER 전환 · api 밖으로 이동)가 모두 게스트 기능 폐기와 같다. **4건째가 등장하면 그때가 실제 사고다**
    - `rls_enabled_no_policy`(INFO 1건) — `private.guest_rsvp_calls`. 정책 부재 = 전면 거부가 노린 상태다. 권고대로 정책을 추가하면 오히려 접근 경로를 만든다. RLS는 켠 채 둔다
    - `auth_leaked_password_protection`(WARN 1건) — 스키마가 아닌 프로젝트 Auth 설정이고 MCP에 해당 도구가 없다. 게스트 노출 표면과 무관하므로 Phase 2를 막지 않는다. T-604 이전에 대시보드에서 켠다
  - `anon` publishable key로 4개 테이블 select / insert **6회 시도 전부 실패** — 전부 `401` + `42501 permission denied for schema public`. RLS 평가 전에 스키마 usage 단계에서 막힌다
  - `api.guest_get_event` RPC는 200. 무효 토큰 · 만료 토큰 · 삭제된 이벤트 3케이스의 실패 본문이 **md5까지 동일**(`P0002 EVENT_UNAVAILABLE`)
  - 페이로드 검사: `p_guest_key` 없이 호출하면 전 행 `note: null`, 본인 키로 호출하면 본인 행만 `note` 채움. 응답 전체에 `guest_key` 키 자체가 없다
  - **`api`에서 anon 실행 가능 함수가 정확히 3개**이고 각 `proacl`에 PUBLIC(`=X/`) 항목이 없다. 기본 권한을 믿지 않고 함수별 ACL을 직접 셌다. `api`에 함수를 추가할 때마다 이 계수를 다시 확인한다
  - `public` 스키마에는 함수가 하나도 남지 않았다(헬퍼는 T-103, 트리거 함수는 T-106에서 `private`으로 이동). 따라서 "`public.log_rsvp_change`를 anon이 직접 호출" 시나리오는 대상 자체가 없다
  - `private` 헬퍼 3개는 REST로 도달 불가 — public · api 프로필에서 `PGRST202` 404, `Accept-Profile: private`은 `PGRST106` 406
  - 검증 데이터(이벤트 3건 + 응답 3건 + 공지 1건)는 Phase 2~3 브라우저 검증에 재사용하려고 **보존**했다. 추적용으로 쓴 예측 가능한 토큰은 검증 후 32바이트 난수로 교체했다
  - 선행: T-104 ~ T-109 전부

**완료 기준**

- 7개 테이블 모두 RLS 활성 + `anon` 대상 정책 0개
- `mcp__supabase__get_advisors` security 경고가 **스키마 설정 오류 0건**(T-110에서 기준을 좁혔다 — 남은 WARN 2종·INFO 1종은 설계 의도에 따른 영구 예외이며 근거는 `docs/product/phase1-security-gate.md` 5절)
- **`anon` 키로 테이블 직접 `select` / `insert`가 모두 실패**(권한 오류 또는 0행), RPC 3개만 도달
- `/rest/v1/rpc/guest_get_event`가 404가 아니라 정상 응답(T-108 반영 확인)
- `types/database.ts`가 최신 스키마와 일치

**검증 방법**

```bash
# anon 키로 테이블 직접 접근 — 모두 실패해야 한다
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rsvps?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rsvps" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" -d '{"event_id":"...","display_name":"x","status":"attending"}'

# anon 키로 RPC — 성공해야 한다 (스키마 노출 + usage + execute가 모두 맞는지 동시 검증)
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/guest_get_event" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" -H "Accept-Profile: api" -H "Content-Profile: api" \
  -d '{"p_token":"<발급한 토큰>"}'
```

- `mcp__supabase__get_advisors` (type: security) 실행 결과 캡처
- `mcp__supabase__list_tables`로 RLS 플래그 확인
- 응답 JSON에 `note`(타인 행) · `guest_key`가 **없는지** 눈으로 확인

---

### Phase 1 진행 중 계획과 달라진 점 (2026-10-01, T-101~T-103)

| #   | 계획                                      | 실제                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | `rsvp_changes.rsvp_id`는 cascade (PRD §6) | **`on delete set null`로 바꿨다.** cascade면 응답을 삭제할 때 이력이 함께 사라져 같은 문서 §8.4의 append-only 원칙과 T-306 이력 화면이 무너진다                                                                                                            |
| 7   | RLS 헬퍼는 `public.is_event_host`         | **`private` 스키마로 옮겼다.** `get_advisors`가 public의 SECURITY DEFINER 함수를 WARN으로 지적하고 T-110은 경고 0건이 관문이다. `authenticated`의 EXECUTE를 걷는 방법은 쓸 수 없다 — RLS 정책 평가가 호출자 EXECUTE를 요구해 모든 조회가 막힌다(실증 확인) |
| 8   | 인덱스 5개                                | `event_notices (event_id)`를 추가했다. PRD §6과 로드맵 양쪽에서 빠져 있었는데 FK + cascade + RLS 조건 컬럼이다                                                                                                                                             |
| 9   | 제약은 로드맵에 적힌 4건                  | 8건으로 늘렸다. 특히 `settlements.rounding_unit > 0`은 T-502의 나눗셈 분모라 0이면 0으로 나누기가 된다                                                                                                                                                     |

| 10 | `alter default privileges`로 `api` 자동 공개를 막는다 | **막지 못한다.** REVOKE는 내장 기본값의 PUBLIC EXECUTE를 깎지 않는다. 프로브 함수로 두 번 실증했고, 명시적 `revoke execute ... from public, anon`만 확실히 동작한다(`shrimp-rules.md` §5.3.1) |
| 11 | `revoke all on schema public from anon`으로 USAGE가 걷힌다 | **안 걷힌다.** `public` ACL의 `=U/pg_database_owner`(PUBLIC)를 `anon`이 상속한다. `revoke usage on schema public from public`이 필요했고, 그 부작용으로 PostgREST 접속 역할 `authenticator`도 USAGE를 잃어 명시적으로 복구했다 |

| 12 | `guest_withdraw_rsvp`는 철회만 하면 된다 | 철회할 응답이 없을 때도 `EVENT_UNAVAILABLE`로 떨어뜨린다. 다른 코드를 주면 "이 토큰에 내 응답이 있는가"가 오라클이 되어 이벤트 상태를 추측할 수 있다 |

| 13 | 카운터 테이블은 `api.guest_rsvp_calls` | **`private.guest_rsvp_calls`로 옮겼다.** T-108 이후 `api`의 테이블은 REST 경로가 생긴다. 내부 장부는 노출 스키마에 두지 않는다 |
| 14 | 이력 트리거 함수는 `public.log_rsvp_change()` | **`private.log_rsvp_change()`.** T-103과 같은 이유(어드바이저 경고). `private.set_updated_at()` 트리거 3개도 T-106에서 함께 넣어 T-101의 `updated_at` 부채를 해소했다 |

| 15 | `guest_submit_rsvp`의 `p_status`는 `public.rsvp_status` | **`text`로 바꿨다.** REST 경유 호출이 `permission denied for schema public`으로 실패했다 — PostgREST가 `anon` 역할로 `public.rsvp_status` 타입을 참조하는데 T-104에서 `anon`의 `public` USAGE를 걷었기 때문이다. 함수 안에서 검증 후 캐스팅한다. 새 오류 코드 `INVALID_STATUS`(P0001)가 생겼다 |
| 16 | `set local role anon` SQL 검증으로 충분하다 | **아니다.** T-105는 DB 안에서 전부 통과했는데 REST 경유에서 #15가 터졌다. `api` 스키마 함수는 **반드시 REST로도 검증**해야 한다 — 타입 참조·프로파일 헤더 같은 PostgREST 고유 경로가 SQL 호출에는 없다 |

| 17 | `types/database.ts`에 `api` 함수 3개 시그니처가 들어간다 | **들어가지 않는다.** MCP 생성기는 기본 스키마(`public`)만 내보내고 스키마를 고를 옵션이 없다. `api` RPC 계약은 손으로 쓴 `types/moim.ts`(`GuestRpcArgs`·`GuestRpcErrorCode`)에 두었다 — 생성물과 수작성의 역할 분리와도 맞는다. **`api` 함수를 바꾸면 생성으로 잡히지 않으므로 `moim.ts`를 직접 고쳐야 한다** |

추가로 알아 둘 것:

- **분당 상한은 20회, 이벤트 단위다.** 한 참여자가 같은 분에 다른 참여자의 응답을 막을 수 있지만 모임 규모에서 부딪힐 일이 드물어 수용했다. 필요해지면 키를 `(event_id, guest_key, minute_bucket)`으로 확장한다.
- **상한에 걸린 호출은 롤백되므로 카운터 증가분도 되돌아간다.** 결과적으로 카운터는 "성공한 호출 수"에 고정되고 이후 호출은 계속 거부된다. 반대로 검증에서 떨어지는 요청(이름 오류 등)은 예산을 소모하지 않는다 — 별도 트랜잭션이 필요하고 MVP 범위 밖이다.
- 오래된 bucket은 호출 중 **확률적으로(1%) 정리**한다. `pg_cron` 도입은 MVP 밖이다.
- **`revoke execute ... from public`만으로는 `anon`이 막히지 않는다.** Supabase가 public 스키마 함수의 EXECUTE를 `anon`·`authenticated`·`service_role`에게 기본 권한으로 **명시적으로** 부여하기 때문이다. T-104에서 PUBLIC과 `anon`을 모두 명시해야 한다.
- `is_settlement_host(uuid)` 헬퍼를 추가했다. `settlement_items`·`settlement_shares`는 `event_id`를 직접 갖지 않아 정책 4곳에 중첩 `exists`가 흩어진다.
- **적용한 마이그레이션 SQL을 `supabase/migrations/`에 남긴다**(`shrimp-rules.md` §5.3). `apply_migration`은 원격에만 적용하므로 파일이 없으면 스키마가 저장소에 존재하지 않는다.
- ~~`updated_at` 자동 갱신 수단이 없다~~ → **T-106에서 해소**했다. `private.set_updated_at()` before update 트리거를 `events`·`event_notices`·`rsvps` 세 테이블에 달았다. 애플리케이션이 과거 시각을 직접 넣어도 트리거가 `now()`로 덮는다. `rsvps.responded_at`은 건드리지 않으므로 정원 순번 기준이 보존된다.
- `get_advisors`에 `auth_leaked_password_protection` WARN이 남아 있다. 스키마가 아니라 프로젝트 Auth 설정이므로 마이그레이션으로 해결할 수 없다. **T-110에서 범위 밖으로 명시해 통과시켰다**(게스트 노출 표면과 무관). 아직 꺼져 있으므로 T-604 이전에 대시보드 → Authentication → Password에서 켠다.

---

## Phase 2 — 주최자 코어

목표: 로그인한 주최자가 이벤트를 만들고, 공유 링크를 발급해 카카오톡에 붙일 수 있는 상태까지. 게스트 화면은 아직 없다.

- [ ] **T-201 `proxy.ts` 공개 경로 정리** — `lib/supabase/proxy.ts`의 접근 제어 `if`를 수정
  - ~~추가: `!request.nextUrl.pathname.startsWith("/e/")`, `!request.nextUrl.pathname.startsWith("/api/guest/")`~~ → **Phase 0에서 선반영 완료**(커밋 `86bb569`). 다시 넣지 않는다
  - 제거: `/instruments` 예외 2줄(T-001에서 페이지를 삭제했으므로)
  - 로컬에서 "로그인 안 했는데 보호 페이지가 열린다"면 `.env.local`의 두 변수 누락으로 `hasEnvVars`가 falsy가 된 경우다. 이 함정은 스타터 동작 그대로 유지한다
  - 선행: T-001
- [ ] **T-202 `/events` 대시보드** — 내 이벤트 목록(다가오는 / 지난 분리), 인원 요약(참석 / 불참 / 미정), 미수금 배지, 빈 상태 CTA
  - 목록 조회 async 컴포넌트를 분리하고 `<Suspense fallback={<스켈레톤 />}>`로 감싼다
  - 세션은 `getClaims()`. 여기까지 오면 `app/protected/`를 삭제할지 결정한다
  - 선행: T-109, T-201
- [ ] **T-203 `/events/new` 이벤트 생성 폼** — 제목 · 일시 · 장소 · 설명 · 정원 · 응답 마감 · 미정 확정 기한 · 예상 인원 · 계좌 안내 문자열
  - `react-hook-form` + `zod`(`@hookform/resolvers/zod`). zod 스키마는 `lib/moim/schemas.ts`에 두고 T-302의 서버 검증과 공유
  - `share_token`은 생성 시 `crypto.randomBytes(32).toString("base64url")`로 서버에서 만든다. 클라이언트가 정하지 않는다
  - 성공 시 `/events/[id]`로 이동
  - 선행: T-202
- [ ] **T-204 `/events/[id]` 개요** — 이벤트 요약, 인원 카운터 3개, 최신 공지 미리보기, `app/events/[id]/layout.tsx`의 탭 네비게이션 활성화
  - 선행: T-203
- [ ] **T-205 공유 링크 카드** — 링크 복사, 만료 시각 설정(기본값: 모임 당일 자정), 재발급
  - 재발급은 `Dialog` + "재발급" 텍스트 입력 확인. 기존 `share_token`을 교체해 옛 링크를 즉시 무효화하고, **기존 응답은 유지**한다(PRD §11-4 현재 결정)
  - 복사 성공은 `sonner` 토스트로 알린다(`alert()` 금지)
  - 선행: T-204
- [ ] **T-206 `/events/[id]/settings`** — 이벤트 수정, 응답 즉시 마감, 삭제
  - 삭제는 `Dialog`에 **이벤트 제목을 그대로 재입력**해야 버튼이 활성화되는 방식. `deleted_at` 소프트 삭제
  - 삭제 후 게스트 링크는 만료와 동일 화면으로 떨어진다(T-303에서 확인)
  - 선행: T-204

**완료 기준**

- 로그인 없이 `/events*`는 `/auth/login`으로, `/e/*`와 `/api/guest/*`는 리다이렉트 없이 열린다
- 이벤트 생성 → 개요 → 링크 복사 → 만료 설정 → 재발급 → 수정 → 삭제가 한 번의 브라우저 세션에서 끊김 없이 된다
- 삭제 확인은 제목 재입력 없이는 실행되지 않는다

**검증 방법**

- `npm run dev` 후 시크릿 창(비로그인)으로 `/events` → 로그인 리다이렉트, `/e/expired` → 정상 표시
- 로그인 후 T-202 ~ T-206 플로우를 직접 클릭해 통과
- `mcp__supabase__execute_sql`로 `events` 행의 `share_token` 교체 · `deleted_at` 기록 확인
- `npm run check-all` + `npm run build`

---

## Phase 3 — 게스트 RSVP (제품의 심장)

목표: 가입하지 않은 참여자가 링크만으로 응답 · 수정하고, 주최자가 그것을 이력까지 본다.

- [ ] **T-301 게스트 쿠키 유틸** — `lib/moim/guest-cookie.ts`
  - 이름 `moim_gk_<event_id 앞 8자>`, 값은 `crypto.randomUUID()`, 속성 `httpOnly` · `secure` · `sameSite=lax` · `path=/` · `maxAge=180일`
  - 쿠키에 이름 · 연락처를 넣지 않는다. 이벤트별로 분리해 한 이벤트의 키가 다른 이벤트 응답을 건드리지 못하게 한다
  - 선행: T-005
- [ ] **T-302 `POST /api/guest/rsvp` Route Handler** — 게스트 쓰기의 유일한 입구
  - zod로 body 검증 → 쿠키에서 `guest_key` 읽기(없으면 발급) → `api.guest_submit_rsvp` RPC → 응답에 쿠키 심기
  - **body의 `guest_key`는 무조건 무시하고 항상 쿠키 값만 사용한다.** 클라이언트가 남의 키를 지정할 수 없어야 한다
  - 오류 코드 매핑: `EVENT_UNAVAILABLE` → 410, `RSVP_CLOSED` → 409, `INVALID_NAME` / `INVALID_NOTE` / `INVALID_STATUS` / `GUEST_KEY_REQUIRED` → 400, `RATE_LIMITED` → 429. 응답 형태를 하나로 통일하고 내부 메시지를 흘리지 않는다
  - 철회 경로도 같은 Handler에서 처리하거나 `POST /api/guest/rsvp/withdraw`로 분리(결정 후 기록)
  - 선행: T-105, T-107, T-301
- [ ] **T-303 `/e/[token]` + `/e/expired`** — 서버 컴포넌트에서 `api.guest_get_event(p_token, p_guest_key)` 호출
  - 공지(고정 우선) + 일시 · 장소 + 내 응답 카드 + 명단 3탭 + (공개 시) 내 분담금
  - `EVENT_UNAVAILABLE`이면 `/e/expired`로. 이벤트 존재 여부조차 노출하지 않는다
  - 데이터 읽기 async 컴포넌트 분리 + `<Suspense>`. 모든 출력은 React 기본 이스케이프에 맡기고 `dangerouslySetInnerHTML`을 쓰지 않는다
  - **모바일 퍼스트로 만든다(T-603에서 고치는 것이 아니다).** 375px에서 가로 스크롤이 없어야 하고, 명단 3탭이 넘치면 줄바꿈이 아니라 가로 스크롤로 흘린다. 컨테이너는 `app/e/layout.tsx`가 이미 잡아 뒀다
  - 선행: T-108, T-302
- [ ] **T-304 `/e/[token]/respond` 응답 폼** — 이름 + 참석 / 불참 / 미정 + 메모(200자)
  - 쿠키가 있으면 기존 값 프리필(본인 `note` 포함), 없으면 신규 입력
  - 쿠키 삭제 후 같은 이름 재응답: "동일 이름 응답이 있습니다. 새 응답으로 추가할까요?" 선택지를 `Dialog`로 제시(병합은 주최자만)
  - 응답 마감 후: 폼 대신 "응답이 마감되었습니다" 안내(읽기는 가능)
  - **모바일 퍼스트.** 입력 필드와 제출 버튼의 터치 영역을 최소 44px로 두고, 375px에서 한 손으로 끝까지 제출되는지 확인한다
  - 선행: T-303
- [ ] **T-305 명단 표시 규칙** — 게스트 · 주최자 화면이 공유하는 표시 로직을 `lib/moim/roster.ts`에 모은다
  - 동명이인: 이름 중복 허용, 응답 순서로 `김민수`, `김민수 (2)`
  - 정원 초과: 거부하지 않고 `attending` + 대기 순번 표시(`responded_at` 순), 초과분은 회색 처리
  - 미정 확정 기한 경과: 자동 전환하지 않고 "기한 초과" 배지만 부여
  - 선행: T-303
- [ ] **T-306 `/events/[id]/responses` 응답 관리** — 참석 / 불참 / 미정 3탭(`Tabs`), 인원 수 집계, 정원 초과 표시, 중복 응답 삭제(`Dialog` 확인), 응답 행 펼치면 `rsvp_changes` 타임라인(`2/14 09:12 미정 → 참석`)
  - **메모(`note`)는 이 화면에만 보인다**(수정 사항 4). 이력도 주최자 전용
  - 선행: T-305

**완료 기준**

- 쿠키 없는 브라우저에서 링크 → 이름 입력 → 응답 → 명단에 즉시 반영, 재방문 시 본인 응답이 강조된다
- 응답 수정 2회 후 주최자 화면에 이력 3건(최초 + 변경 2)이 시간순으로 보인다
- 무효 토큰 · 만료 토큰 · 삭제된 이벤트가 모두 **구분 불가능한** 만료 화면으로 떨어진다
- 게스트 화면 어디에도 타인의 `note`와 `guest_key`, 이력이 나타나지 않는다

**검증 방법**

- 브라우저 프로필 2개(또는 일반 창 + 시크릿 창)로 서로 다른 게스트가 되어 응답 → 기기별 별개 응답 생성 확인
- 개발자도구 Application → Cookies에서 `moim_gk_*`가 `HttpOnly`인지, JS `document.cookie`로 읽히지 않는지 확인
- `mcp__supabase__execute_sql`로 `rsvp_changes` 행 증가 확인, `note`만 수정했을 때 이력이 **늘지 않는지** 확인
- 페이지 HTML 소스에서 `guest_key` 문자열 검색 → 0건
- `npm run check-all` + `npm run build`

---

## Phase 4 — 공지

목표: 최신 · 고정 공지가 게스트 페이지 상단에 걸린다.

- [ ] **T-401 `/events/[id]/notices` CRUD** — 공지 목록 · 작성 · 수정 · 삭제(`Dialog` 확인). 본문은 여러 줄 `Textarea`
  - 선행: T-204
- [ ] **T-402 고정 공지 1개 제한** — 새 공지를 고정하면 기존 고정이 해제된다. 경합을 피하려면 단일 트랜잭션(또는 부분 유니크 인덱스 `unique (event_id) where is_pinned`)으로 보장하고, 인덱스를 쓰면 마이그레이션 추가 후 T-109 타입 재생성
  - 선행: T-401
- [ ] **T-403 게스트 페이지 공지 반영** — `guest_get_event`가 이미 `is_pinned desc, created_at desc`로 정렬해 내려주므로, `/e/[token]` 상단 고정 영역 + 나머지 목록으로 렌더
  - 선행: T-303, T-402

**완료 기준**

- 공지 작성 직후 게스트 페이지를 새로 고치면 상단에 보이고, 고정은 항상 최대 1개
- 공지가 0건일 때 게스트 페이지가 깨지지 않고 빈 상태를 보여준다

**검증 방법**

- 공지 3건 작성 → 두 번째를 고정 → 게스트 페이지에서 순서 확인 → 세 번째를 고정 → 두 번째 고정이 해제되었는지 확인
- `npm run check-all` + `npm run build`

---

## Phase 5 — 정산

목표: 비용 항목 입력 → 참석자 균등분할 → 입금 추적 → 게스트가 본인 분담금 확인.

- [ ] **T-501 비용 항목 CRUD** — `/events/[id]/settlement`에서 `settlements`(이벤트당 1개) 지연 생성 + `settlement_items` 추가 · 수정 · 삭제. 금액은 **원 단위 정수**만 받는다(부동소수 금지). 총액 표시
  - 선행: T-102, T-204
- [ ] **T-502 분담금 계산 로직** — `lib/moim/settlement.ts`에 순수 함수로 구현
  ```
  total      = Σ settlement_items.amount
  payers     = 스냅샷 시점의 status = 'attending' 인 rsvp 집합
  per_person = ceil(total / count(payers) / rounding_unit) * rounding_unit
  collected  = per_person * count(payers)
  host_diff  = collected - total        -- 양수면 주최자에게 남는 잔액
  ```
  - **PRD §6의 "이고 기한초과가 아닌" 조건을 삭제한다** ← "기한 초과"는 `maybe` 상태에만 성립하는 배지이므로 `attending`과 동시에 성립할 수 없다. 원문 그대로 구현하면 항이 항상 참인 사문(死文)이 되어 읽는 사람을 오해시킨다. 정산 대상은 `status = 'attending'`으로 단순화하고, "미정 기한 초과자는 정산 대상에서 제외된다"는 §4 엣지 케이스는 **미정이 참석으로 전환되지 않으므로 자동 충족**된다는 사실을 코드 주석으로 남긴다
  - 참석자 0명: 계산하지 않고 "참석자가 없어 분담금을 계산할 수 없습니다"
  - 절상 단위는 `settlements.rounding_unit`(기본 10원)
  - 선행: T-501
- [ ] **T-503 스냅샷 생성 · 재계산** — `settlement_shares`에 계산 시점 참석자와 이름 · 금액을 복사한다. 이후 RSVP 변경이 이미 산출된 금액을 흔들지 않는다
  - [분담금 재계산]은 `Dialog` 확인 후 스냅샷을 다시 만들고, `is_paid = true`인 행의 입금 상태를 `rsvp_id` 기준으로 승계한다(`rsvp_id`가 `null`이 된 행은 이름으로 대조하고, 대조 실패 시 사용자에게 알린다)
  - 선행: T-502
- [ ] **T-504 입금 토글 · 미수금 합계** — 참석자별 `is_paid` 토글(`paid_at` 기록), 미수금 = `per_person × 미입금 인원`. `/events` 대시보드 배지와 값을 일치시킨다
  - 선행: T-503
- [ ] **T-505 게스트 정산 공개** — `settlements.is_published = true`일 때만 `guest_get_event`가 `my_share`를 내려준다. 게스트 페이지에 본인 분담금 · 입금 상태 · 계좌 안내 문자열 표시
  - 공개 전에는 정산 영역 자체를 감춘다. 타인의 분담금 · 입금 상태는 노출하지 않는다
  - 선행: T-303, T-504
- [ ] **T-506 `note` 노출 범위 최종 점검 (수정 사항 4의 UI 측)** — 게스트에게 렌더되는 모든 경로에서 타인의 메모가 새지 않는지 확인한다
  - `/e/[token]` 명단 3탭, `/e/[token]/respond` 프리필, 정산 영역, 페이지 HTML 소스 · JSON payload 전부
  - 본인 메모만 본인에게 보이고, 전체 메모는 `/events/[id]/responses`에만 나타난다
  - 선행: T-105, T-306, T-505

**완료 기준**

- 항목 2건(40,000 / 12,000) + 참석 7명 → 52,000 ÷ 7 = 7,428.57원이 10원 단위로 절상되어 **1인당 7,430원**, 총 징수 52,010원, 주최자 잔액 +10원이 화면에 정확히 표시된다(계산식을 실제 값으로 1회 검산)
  - PRD §4 시나리오의 "7,430원 → 7,500원 절상"은 오류다. `rounding_unit = 10`이므로 7,430원이 맞다. PRD를 고칠 때 함께 반영한다
- 스냅샷 생성 후 참석자 1명이 불참으로 바꿔도 이미 산출된 금액이 변하지 않고, [재계산]을 눌러야 갱신된다
- 미수금이 0원이 되면 정산 완료 상태로 보인다
- `is_published = false`인 정산은 게스트 화면에 어떤 형태로도 드러나지 않는다

**검증 방법**

- 참석자 7명을 실제로 만들어 위 수치를 브라우저에서 확인
- 참석자 0명 상태에서 정산 화면 진입 → 안내 문구 확인
- 재계산 전후 `settlement_shares`를 `mcp__supabase__execute_sql`로 비교, `is_paid` 승계 확인
- 게스트 페이지 HTML에서 타인 이름 + 금액 조합 검색 → 0건
- `npm run check-all` + `npm run build`

---

## Phase 6 — 마감

목표: 엣지 케이스 표를 한 줄씩 소진하고 릴리스 가능 상태로 만든다.

- [ ] **T-601 엣지 케이스 전수 확인** — PRD §4 엣지 케이스 표 14행을 브라우저에서 한 줄씩 재현하고 결과를 표에 체크로 기록
  - 동명이인 2명 / 쿠키 삭제 후 재방문 / 여러 기기 / 정원 초과 / 응답 마감 후 / 링크 만료 후 / 미정 기한 경과 / 참석→불참 후 정산 / 나누어떨어지지 않는 총액 / 이벤트 삭제 후 접근 / 참석자 0명 정산 / 이름에 따옴표·역슬래시 / 토큰 무차별 대입
  - 선행: Phase 1~5 전부
- [ ] **T-602 한국어 문구 · 빈 상태 점검** — 모든 빈 상태 · 오류 · 확인 문구를 한국어로 통일. DB 오류 코드가 그대로 사용자에게 보이지 않는지 확인. 날짜 · 금액 포맷 일관성(`lib/moim/format.ts` 경유)
  - 선행: T-601
- [ ] **T-603 반응형 · 접근성 · 다크모드 검증** — 모바일 퍼스트는 Phase 0에서 구조를 잡고 T-303·T-304에서 구현한다. **여기서는 처음 적용하는 것이 아니라 전 화면을 훑어 확인한다**(375px 가로 스크롤 0, 터치 영역 44px, 넘치는 요소의 가로 스크롤 처리). 그 위에 탭 · Dialog의 키보드 조작, 포커스 이동, 대비를 확인하고 다크모드(`next-themes`)에서 깨지는 곳을 잡는다
  - 선행: T-601
- [ ] **T-604 보안 재점검 · 최종 검사** — 스키마가 Phase 1 이후 바뀌었을 수 있으므로 `get_advisors`를 다시 돌려 경고 0건을 재확인하고, `anon` 직접 접근 실패도 다시 확인. `types/database.ts` 재생성 후 타입 검사
  - 선행: T-602, T-603
- [ ] **T-605 미해결 질문 결론 기록** — PRD §11의 4개 질문(쿠키 180일 / 정원 초과 대기 순번 / 기한 초과자 정산 제외 / 재발급 시 응답 유지)에 대해 실사용 1건 후 판단하고 `docs/product/`에 결론을 남긴다
  - 선행: T-604

**완료 기준**

- §4 엣지 케이스 14행 전부 체크
- `mcp__supabase__get_advisors` 경고 0건(재확인)
- `npm run check-all` 통과, `npm run build` 성공
- 주최자 1명 + 게스트 3명으로 개설 → 응답 → 공지 → 정산 → 입금 완료 전 구간을 브라우저에서 1회 완주

**검증 방법**

```bash
npm run check-all   # lint + typecheck + format:check
npm run build
```

- 위 완주 시나리오를 실제 기기 폭(모바일 · 데스크톱)에서 각 1회
- 커밋 시 `.husky/pre-commit`(eslint --fix + prettier), 푸시 시 `.husky/pre-push`(typecheck + lint), GitHub CI(lint → typecheck → format:check → build)가 모두 통과

---

## 단계 요약

| 단계     | 주제          | 작업 수 | 관문                                            |
| -------- | ------------- | ------- | ----------------------------------------------- |
| Phase 0  | 준비 · 골격   | 5       | 11개 라우트가 빈 화면으로 열림                  |
| Phase 1  | 스키마 · 보안 | 10      | `get_advisors` 0건 + `anon` 직접 접근 전부 실패 |
| Phase 2  | 주최자 코어   | 6       | 개설 → 링크 발급 → 삭제 플로우 완주             |
| Phase 3  | 게스트 RSVP   | 6       | 비로그인 응답 · 수정 · 이력                     |
| Phase 4  | 공지          | 3       | 고정 공지 1개 제한 + 게스트 상단 반영           |
| Phase 5  | 정산          | 6       | 스냅샷 · 재계산 · 미수금 0원                    |
| Phase 6  | 마감          | 5       | 엣지 케이스 14행 + `check-all` + `build`        |
| **합계** |               | **41**  |                                                 |

---

## MVP 밖 (후속)

카풀 → 정기 모임 → 알림 → 참여자 계정(선택 가입). 카풀이 첫 후보이며, 그때 좌석 · 출발지 스키마와 연락처 수집 여부를 다시 결정한다. 이 로드맵에 끌어오지 않는다.
