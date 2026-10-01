# Supabase 프로젝트 설정 (코드에 남지 않는 것들)

마이그레이션이나 환경 변수로 재현되지 않는 설정이다. **프로젝트를 새로 만들거나 복구하면 다시 해야 한다.**

> 이 프로젝트는 2026-10-01에 한 번 사라졌다(DNS NXDOMAIN). 복구 후 아래 설정을 다시 확인해야 했다. 같은 일이 또 생길 수 있으니 재현 절차를 여기 둔다.

현재 프로젝트 ref: `zusjztfsmcbkoeffjzto`

---

## 1. PostgREST 노출 스키마에 `api` 추가 (필수)

**없으면 `grant`가 모두 맞아도 게스트 RPC가 `PGRST106`으로 실패한다.** PRD에 기술되지 않은 항목이며 SQL로는 해결되지 않는다(ROADMAP 수정 사항 2).

경로: **Project Settings → API**(최근 대시보드에서는 **Data API**로 묶여 있다) → `Exposed schemas`

```
https://supabase.com/dashboard/project/<ref>/settings/api
```

|        |                                                                                                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 설정값 | `public`, `graphql_public`, **`api`**                                                                                                                                                                                              |
| 주의   | 기존 값을 **덮어쓰지 않고 추가**한다. `public`을 빼면 주최자 쪽 접근이 전부 끊긴다                                                                                                                                                 |
| 주의   | **`private`을 추가하지 않는다.** RLS 헬퍼(`is_event_host`·`is_settlement_host`), 이력 트리거(`log_rsvp_change`), `updated_at` 트리거, rate limit 카운터(`guest_rsvp_calls`)가 거기 있다. 노출되면 Phase 1에서 세운 경계가 무너진다 |

저장하면 PostgREST가 스키마 캐시를 다시 만든다(몇 초).

검증:

```bash
# 반영 전: PGRST106 "Only the following schemas are exposed: public, graphql_public"
# 반영 후: {"code":"P0002","message":"EVENT_UNAVAILABLE"}  ← api 스키마에 도달해 함수가 실행됨
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/guest_get_event" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: api" -H "Content-Profile: api" \
  -d '{"p_token":"없는토큰"}'

# private은 여전히 막혀야 한다 → PGRST106 "Invalid schema: private"
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/is_event_host" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: private" -H "Content-Profile: private" \
  -d '{"p_event_id":"00000000-0000-4000-8000-000000000000"}'
```

`Accept-Profile` / `Content-Profile` 헤더는 `api` 스키마 RPC를 REST로 직접 부를 때 필요하다. 애플리케이션 코드에서는 `lib/supabase/guest.ts`의 `db: { schema: "api" }`가 이 헤더를 대신 붙인다.

---

## 2. 유출된 비밀번호 차단 켜기

`get_advisors`가 `auth_leaked_password_protection`을 WARN으로 지적하는 항목이다. 스키마가 아니라 Auth 설정이므로 마이그레이션으로 해결할 수 없다.

경로: **Authentication → Sign In / Providers → Email** → `Prevent use of leaked passwords` (HaveIBeenPwned 대조)

```
https://supabase.com/dashboard/project/<ref>/auth/providers
```

---

## 3. 환경 변수

`.env.local`에 두 개뿐이다(`.env.example` 참고). 프로젝트를 새로 만들면 둘 다 바뀐다.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

- 둘 중 하나라도 없으면 `lib/utils.ts`의 `hasEnvVars`가 falsy가 되어 **proxy 인증 검사 전체가 건너뛰어진다.** "로그인 안 했는데 보호 페이지가 열린다"는 거의 항상 이것이다.
- `.mcp.json`의 프로젝트 ref도 함께 바꿔야 Supabase MCP가 새 프로젝트를 가리킨다.

---

## 4. 의도된 어드바이저 예외 3종

`get_advisors(security)`가 아래 세 건을 계속 보고한다. **전부 설계상 의도된 것이며 "해결"하면 제품이 깨진다.** T-110·T-604에서 이 목록과 대조해 "새로 생긴 경고가 없는지"만 본다.

| lint                                        | 레벨 | 대상                                                                      | 왜 의도된 것인가                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon_security_definer_function_executable` | WARN | `api.guest_get_event`, `api.guest_submit_rsvp`, `api.guest_withdraw_rsvp` | **이 제품의 핵심 설계다.** 게스트는 가입하지 않으므로 로그인 없이 호출해야 하고, RLS를 우회해 집계·명단을 만들어야 하므로 `SECURITY DEFINER`여야 한다. 대신 함수 안에서 토큰·만료·마감·입력을 모두 재검증하고, 노출 범위를 payload 수준에서 통제한다(타인 `note`·`guest_key` 제외) |
| `rls_enabled_no_policy`                     | INFO | `private.guest_rsvp_calls`                                                | **정책 부재 = 전면 거부**가 의도다. 이 테이블은 `SECURITY DEFINER` 함수만 만지는 내부 장부이고 `anon`·`authenticated`에게 grant가 없다                                                                                                                                             |
| `auth_leaked_password_protection`           | WARN | Auth 설정                                                                 | 위 2번을 적용하면 사라진다. 남아 있다면 설정이 반영되지 않은 것이다                                                                                                                                                                                                                |

**`api` 스키마를 노출한 대가로 1번 WARN 3건이 생겼다.** 노출 전에는 없던 경고다 — `api`가 REST에 보이지 않으면 `anon`이 호출할 경로도 없기 때문이다. 즉 이 경고는 "게스트 기능이 실제로 동작한다"는 뜻이기도 하다.
