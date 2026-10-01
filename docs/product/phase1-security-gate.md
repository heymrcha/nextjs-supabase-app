# Phase 1 보안 검증 관문 (T-110) 결과

- 검증일: 2026-10-01
- 대상 프로젝트: `zusjztfsmcbkoeffjzto`
- 사용 키: publishable `sb_publishable_PKubJ_…`(anon 역할)
- 재점검 대상: T-604에서 최종 스키마로 같은 검증을 반복한다.

## 결론

4개 항목 전부 통과. advisor는 WARN 2종·INFO 1종이 남았고, 전부 설계 의도에 따른 **명시적 예외**로 판정했다(근거는 아래 4절). 스키마 설정 오류로 인한 경고는 0건이다.

## 1. anon의 테이블 직접 접근 — 6/6 실패

`/rest/v1/<table>`에 publishable 키로 직접 요청한 결과. 전부 `401` + `42501 permission denied for schema public`.

| 시도                                      | 결과        |
| ----------------------------------------- | ----------- |
| `GET /rest/v1/rsvps?select=*`             | 401 / 42501 |
| `GET /rest/v1/events?select=*`            | 401 / 42501 |
| `GET /rest/v1/rsvp_changes?select=*`      | 401 / 42501 |
| `GET /rest/v1/settlement_shares?select=*` | 401 / 42501 |
| `POST /rest/v1/rsvps` (응답 삽입 시도)    | 401 / 42501 |
| `POST /rest/v1/events` (이벤트 삽입 시도) | 401 / 42501 |

RLS 정책 평가에 도달하기도 전에 스키마 usage 단계에서 막힌다(T-104의 `revoke … on schema public from anon`). RLS는 그 뒤의 2차 방어선이다.

## 2. 게스트 RPC — 성공, 그리고 실패 응답의 동일성

`POST /rest/v1/rpc/guest_get_event` + `Accept-Profile: api` / `Content-Profile: api`.

| 케이스                                | 상태 | 본문                                               |
| ------------------------------------- | ---- | -------------------------------------------------- |
| 정상 토큰                             | 200  | event / rsvps / notices / settlement 페이로드      |
| 존재하지 않는 토큰                    | 500  | `{"code":"P0002",…,"message":"EVENT_UNAVAILABLE"}` |
| 만료된 토큰 (`share_expires_at` 과거) | 500  | 동일                                               |
| 삭제된 이벤트 (`deleted_at` 설정)     | 500  | 동일                                               |

세 실패 본문의 md5가 모두 `c1ed258e1e703cb37ebfcd55105e1a4a`로 **바이트 단위 동일**하다. 이벤트의 존재 여부가 응답으로 구분되지 않는다.

> 참고: PostgREST가 `raise exception`을 500으로 내보낸다. 게스트 UI는 이 상태 코드를 직접 보지 않고 서버 컴포넌트(T-303)·Route Handler(T-302)가 `EVENT_UNAVAILABLE`을 410으로 변환한다.

### note·guest_key 노출 범위 (수정 사항 4)

| 호출                      | 결과                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| `p_guest_key` 없이 호출   | 3개 행 전부 `note: null`, `is_mine: false`                       |
| 본인 `p_guest_key`로 호출 | 본인 행만 `note` 채움 + `is_mine: true`, 타인 2행은 `note: null` |

타인 메모로 심어 둔 문자열과 `guest_key` 문자열을 두 응답 전체에 grep한 결과 **0건**이다. 페이로드에 `guest_key` 키 자체가 없다.

## 3. api 스키마 노출 표면 — 정확히 3개

```
proname              proacl                                anon_exec  authenticated_exec  PUBLIC=X
guest_get_event      {postgres=X/postgres,anon=X/postgres}  true       false               없음
guest_submit_rsvp    {postgres=X/postgres,anon=X/postgres}  true       false               없음
guest_withdraw_rsvp  {postgres=X/postgres,anon=X/postgres}  true       false               없음
```

`api` 스키마의 함수는 이 3개가 전부이고, anon 실행 가능 함수도 정확히 3개다. 어떤 ACL에도 PUBLIC 항목(`=X/`)이 없다 — T-104에서 `ALTER DEFAULT PRIVILEGES`의 REVOKE가 내장 PUBLIC EXECUTE를 깎지 못함을 실증했으므로, 기본 권한을 믿지 않고 함수별 ACL을 직접 센 결과다.

**유지 규칙: `api` 스키마에 함수를 추가할 때마다 이 계수를 다시 확인한다.** 기본 권한에 의존하는 방어선이 없으므로 이 검사가 유일한 그물이다.

## 4. 내부 헬퍼의 REST 도달 불가

`private` 스키마에 있는 `is_event_host`, `is_settlement_host`, `log_rsvp_change`를 REST로 호출한 결과:

| 시도                            | 결과                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `Accept-Profile` 없음(= public) | 404 `PGRST202` — public에 해당 함수가 없다                                           |
| `Accept-Profile: api`           | 404 `PGRST202` — api에도 없다                                                        |
| `Accept-Profile: private`       | 406 `PGRST106` `Only the following schemas are exposed: public, graphql_public, api` |

`public` 스키마에는 함수가 하나도 남아 있지 않다(T-103에서 헬퍼를, T-106에서 트리거 함수를 `private`으로 옮겼다). 따라서 "public의 SECURITY DEFINER 함수를 anon이 직접 호출" 시나리오는 대상 자체가 없다.

## 5. get_advisors(security) — 남은 3종의 판정

### 5.1 `anon_security_definer_function_executable` (WARN, 3건) — 의도된 설계

`api.guest_get_event` / `guest_submit_rsvp` / `guest_withdraw_rsvp`가 anon에게 실행 가능한 SECURITY DEFINER 함수라는 경고다. 이건 **이 아키텍처의 정의 그 자체**다. 게스트는 로그인하지 않고 공유 링크만으로 응답해야 하므로, 테이블 권한을 전부 회수하고 검증된 함수 3개만 anon에게 여는 구조를 택했다. 경고를 없애는 조치(execute 회수, SECURITY INVOKER 전환, api 스키마 밖으로 이동)는 모두 게스트 기능을 폐기하는 것과 같다.

경고 대신 지켜야 할 실질 방어선:

- 세 함수 모두 `share_token` 유효성(존재·만료·`deleted_at`)을 먼저 검사하고 실패를 `EVENT_UNAVAILABLE` 하나로 수렴시킨다.
- 반환 페이로드에서 타인 `note`와 모든 `guest_key`를 제거한다(위 2절에서 실측).
- `guest_submit_rsvp`에 분당 상한(T-107)을 둔다.
- `set search_path = ''` + 전 객체 스키마 수식(T-105에서 적용).

**판정: 영구 예외.** T-604에서도 이 3건은 남는 것이 정상이며, 4건째가 등장하면 그때가 실제 사고다.

### 5.2 `rls_enabled_no_policy` (INFO, 1건) — 의도된 설계

`private.guest_rsvp_calls`(T-107의 분당 상한 카운터)에 RLS가 켜져 있고 정책이 0개라는 지적이다. **정책 부재 = 전면 거부**가 노린 상태다. 이 테이블은

- `private` 스키마에 있어 PostgREST 노출 대상이 아니고(위 4절 `PGRST106`),
- anon에게 select 권한이 없으며(`has_table_privilege('anon', …, 'select')` = false),
- `guest_submit_rsvp`(SECURITY DEFINER) 내부에서만 갱신된다.

권고대로 정책을 추가하면 오히려 접근 경로를 만드는 셈이다. **판정: 영구 예외. RLS는 켠 상태로 유지한다.**

### 5.3 `auth_leaked_password_protection` (WARN, 1건) — 사용자 조치 필요

HaveIBeenPwned 대조로 유출된 비밀번호를 거부하는 Auth 기능이 꺼져 있다. 스키마가 아니라 **프로젝트 Auth 설정**이라 마이그레이션으로 해결할 수 없고, MCP에도 해당 설정을 바꾸는 도구가 없다.

조치 경로: Supabase 대시보드 → Authentication → Policies(Password) → Leaked password protection 활성화.

**판정: 관문 기준을 "스키마에서 비롯한 경고 0건"으로 좁히고 통과시킨다.** 근거 — 이 항목은 게스트 노출 표면과 무관하고(게스트는 비밀번호를 쓰지 않는다), 주최자 로그인 품질에만 영향을 준다. Phase 2를 막을 이유가 없다. 단 T-604 이전에 대시보드에서 켜는 것을 권한다.

## 6. 검증 데이터 처리

검증용으로 만든 데이터를 **보존**했다. Phase 2~3의 브라우저 검증(T-202 대시보드 목록, T-303 만료 화면, T-306 응답 관리)에 그대로 재사용하기 위해서다.

- 이벤트 3건: `T110 정상 이벤트`, `T110 만료 이벤트`(`share_expires_at` 과거), `T110 삭제 이벤트`(`deleted_at` 설정)
- 응답 3건(참석·미정·불참) + 메모, 고정 공지 1건 — 모두 정상 이벤트에 속한다

검증 중에는 추적을 위해 `t110_ok_token_…` 같은 예측 가능한 토큰을 썼다. 검증을 마친 뒤 **3건 전부 32바이트 난수 base64url 토큰으로 교체**하고 교체 후에도 RPC가 200을 내는지 재확인했다. 토큰 값은 추측 가능해서는 안 되므로 이 문서에 적지 않는다 — 필요하면 다음으로 조회한다.

```sql
select title, share_token from public.events where title like 'T110 %' order by title;
```

정리하려면:

```sql
delete from public.events where title like 'T110 %';  -- 응답·공지는 cascade
```

## 재현 절차

```bash
URL=$(supabase 프로젝트 API URL)
KEY=$(publishable key)

# 테이블 직접 접근 — 42501 기대
curl -s "$URL/rest/v1/rsvps?select=*" -H "apikey: $KEY"

# 게스트 RPC — 200 기대
curl -s -X POST "$URL/rest/v1/rpc/guest_get_event" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -H "Accept-Profile: api" -H "Content-Profile: api" \
  -d '{"p_token":"<토큰>"}'
```

```sql
-- api 노출 표면 계수
select p.proname, p.proacl::text,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec
from pg_proc p where p.pronamespace = 'api'::regnamespace order by 1;
```

---

## 수락된 advisor 예외 (2026-10-01 갱신)

T-110 시점에는 `get_advisors(security)` 경고가 "설계상 의도된 3건 + 운영 설정 1건"이었다. Phase 2 이후 함수가 늘어 목록이 바뀌었으므로, **무엇을 왜 수락하는지** 여기에 못 박는다. 아래 목록에 없는 경고가 새로 뜨면 수락된 상태가 아니며, T-604에서 그대로 통과시키지 않는다.

| 경고                                                           | 대상                                                                      | 수락 이유                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon_security_definer_function_executable` (WARN ×3)          | `api.guest_get_event`, `api.guest_submit_rsvp`, `api.guest_withdraw_rsvp` | **게스트 출입구 그 자체.** 가입 없는 응답이 제품의 전제이고, `anon`이 호출할 수 있는 함수는 이 3개뿐이다. 함수 내부에서 토큰·만료·소프트 삭제를 전부 확인하고 타인의 `note`·`guest_key`를 payload에서 제외한다.                                                                                                                          |
| `authenticated_security_definer_function_executable` (WARN ×1) | `public.regenerate_share_token(uuid)`                                     | 재발급은 `update`에 트리거가 걸리지 않아 **DB 함수로 감쌀 수밖에 없고**(D2), 클라이언트가 RPC로 부르므로 `public`에 있어야 한다. 권한 우회는 없다 — 함수가 `private.is_event_host()`로 호스트를 직접 확인하고 `search_path = ''`를 잠근다. 호스트가 아니면 `FORBIDDEN`, 없거나 삭제된 모임이면 `EVENT_UNAVAILABLE`로 존재 여부를 숨긴다. |
| `rls_enabled_no_policy` (INFO ×1)                              | `private.guest_rsvp_calls`                                                | 의도. 레이트 리밋 카운터는 `security definer` 함수 내부에서만 갱신되고 `private` 스키마라 REST 표면이 없다. 정책 부재 = 직접 접근 전면 거부.                                                                                                                                                                                             |
| `auth_leaked_password_protection` (WARN ×1)                    | Auth 설정                                                                 | 대시보드 설정이며 코드로 해결되지 않는다. 실사용 전 켠다(T-604).                                                                                                                                                                                                                                                                         |

### 다른 선택지를 남겨 두는 이유

`regenerate_share_token`은 Route Handler를 거치게 바꿔 함수를 `private`로 내릴 수 있다. 지금은 주최자 쓰기를 전부 브라우저에서 직접 호출하는 저장소 관례(`shrimp-rules.md` §4)와 어긋나므로 하지 않는다. 주최자 쓰기를 Server Action/Route Handler로 옮기는 날 함께 처리한다.

### `events` 컬럼 권한 (2026-10-01 추가)

`authenticated`는 더 이상 `events`에 **테이블 단위 UPDATE를 갖지 않는다.** `share_token`을 뺀 컬럼 목록에만 UPDATE가 있다(`moim_lock_share_token_and_text_limits`). D2의 "클라이언트가 정할 수 없는 값"을 권한으로 실제로 막은 것이며, 그 전에는 주최자가 `PATCH /rest/v1/events`로 추측 가능한 토큰을 직접 넣을 수 있었다.

**`events`에 컬럼을 추가하면 그 마이그레이션에서 `grant update (새 컬럼)`도 함께 해야 한다.** 빠뜨리면 해당 컬럼 수정이 42501로 실패한다(조용히 틀리지는 않는다).

확인 쿼리:

```sql
select string_agg(column_name, ', ' order by column_name)
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'events'
  and grantee = 'authenticated' and privilege_type = 'UPDATE';
```
