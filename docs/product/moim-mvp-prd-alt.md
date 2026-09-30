# 모임 이벤트 관리 MVP PRD

> 대상 리포지토리: `nextjs-supabase-app` (Next.js 16 / Supabase / Tailwind v3.4 / shadcn-ui new-york)
> 작성일: 2026-09-30 · 상태: 구현 착수 가능

---

## 1. 핵심 정보

**목적**: 단발 모임의 주최자가 공지·참석 집계·비용 정산을 카톡방 스크롤 대신 링크 하나로 끝내게 한다.
**사용자**: 수영·헬스·러닝·친구 모임을 한 번씩 여는 비전문 주최자(주최자만 계정 보유, 참여자는 링크 응답).

---

## 2. 문제 정의

주최자가 카카오톡 단체방에서 실제로 하는 일:

1. 공지를 올리지만 스크롤에 묻혀 "어디서 몇 시였죠?"가 반복된다.
2. 참석 인원을 댓글·이모지로 세다가 중복·번복으로 숫자가 틀린다. 인원 수가 틀리면 예약(레인·코트·식당)이 틀어진다.
3. "나중에 말씀드릴게요"가 그대로 미정으로 남아 확정 시점을 놓친다.
4. 정산 시 1인당 금액을 손계산하고 입금 여부를 한 명씩 추적한다.

MVP는 이 네 가지 통증만 정확히 없앤다. 그 외는 만들지 않는다.

### 설계 제약 (확정 사항)

| #   | 제약                                     | 설계 영향                                        |
| --- | ---------------------------------------- | ------------------------------------------------ |
| 1   | 참여자는 가입하지 않음. 링크 + 이름 입력 | 게스트 쓰기 경로가 필요 → §8 RLS 설계의 핵심     |
| 2   | 단발 이벤트만                            | 반복 규칙(RRULE) 컬럼·UI 없음                    |
| 3   | 공지 / RSVP / 정산 3기능                 | 카풀 테이블·화면 없음                            |
| 4   | 연락처 수집 안 함                        | 게스트 식별 = 표시 이름 + httpOnly 쿠키          |
| 5   | 참석/불참/미정 전원 공개                 | 게스트 읽기 권한이 명단 전체까지 허용됨          |
| 6   | 삭제는 주최자 + 확인 단계                | 텍스트 입력 확인(네이티브 `confirm()` 금지)      |
| 7   | 공유 링크 만료 설정 가능                 | `share_expires_at` + 만료 후 읽기/쓰기 모두 차단 |
| 8   | 미정에 확정 기한 필요                    | `maybe_deadline`, 기한 경과 시 자동 처리 규칙    |
| 9   | 상태별 목록 각각 조회                    | 탭 3개(참석/불참/미정)                           |
| 10  | 응답 수정 가능 + 이력                    | append-only 이력 테이블 + 트리거                 |

---

## 3. MVP 범위

### 포함

| ID   | 기능             | 설명                                                                              |
| ---- | ---------------- | --------------------------------------------------------------------------------- |
| F001 | 이벤트 생성/수정 | 제목, 일시, 장소(자유 텍스트), 설명, 정원, 응답 마감, 미정 확정 기한              |
| F002 | 공지             | 이벤트에 딸린 공지글 N개. 최신 공지가 게스트 페이지 상단에 고정                   |
| F003 | 공유 링크 발급   | 추측 불가 토큰 링크. 만료 시각 설정·재발급(기존 링크 무효화)                      |
| F004 | 게스트 RSVP      | 이름 입력 + 참석/불참/미정 + 한 줄 메모. 쿠키로 재방문 시 본인 응답 인식          |
| F005 | 응답 수정 + 이력 | 게스트가 본인 응답 변경. 모든 변경을 append-only로 기록, 주최자에게 타임라인 노출 |
| F006 | 상태별 명단      | 참석/불참/미정 탭. 전원 공개. 인원 수 집계                                        |
| F007 | 미정 확정 기한   | 기한 표시·카운트다운, 기한 경과 미정자는 명단에서 "기한 초과" 배지                |
| F008 | 정산             | 비용 항목 N개 입력 → 참석 확정자 균등분할 → 1인당 금액 산출                       |
| F009 | 입금 체크        | 주최자가 참석자별 입금 여부 토글. 미수금 합계 표시                                |
| F010 | 정산 공개        | 게스트 페이지에서 본인 분담금과 입금 상태 확인                                    |
| F011 | 주최자 인증      | 기존 이메일/비밀번호 + Google OAuth 그대로 사용                                   |
| F012 | 이벤트 삭제      | 제목 재입력 확인 단계 → 소프트 삭제(`deleted_at`)                                 |

### 제외 (이유 명시)

| 제외 항목        | 이유                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 카풀 배차        | 출발지·경로·좌석 매칭은 지도 연동과 위치 데이터를 부르고, 연락처 없이는 실사용이 안 된다. RSVP가 먼저 동작해야 의미가 생기는 후속 기능 |
| 정기 모임        | 반복 일정은 예외 처리(1회만 취소, 일부만 시간 변경)가 스키마를 통째로 바꾼다. 단발 검증 후                                             |
| 참여자 계정      | 가입 마찰이 이 제품의 최대 이탈 요인. 링크 응답률이 곧 제품 가치                                                                       |
| 연락처 수집      | 개인정보 처리 책임이 1인 개발자 감당 범위를 넘고, 알림 채널로도 쓰지 않으므로 수집 근거 없음                                           |
| 푸시/이메일 알림 | 발신자 인증·발송 비용·스팸 대응이 필요. MVP는 카카오톡에 링크를 다시 붙이는 것으로 대체                                                |
| 결제 연동        | PG 심사·정산 주기 문제. 계좌번호 문자열 노출로 대체                                                                                    |
| 비균등 분할      | 항목별 참여자 선택은 UI 복잡도가 급증. "균등분할 + 주최자가 차액 흡수"로 90% 케이스 커버                                               |
| 댓글/채팅        | 대화는 이미 카카오톡에서 일어난다. 여기서 경쟁하지 않음                                                                                |

---

## 4. 핵심 시나리오

### S1. 주최자 — 개설부터 정산까지

```
로그인 → 대시보드 → [새 이벤트]
  ↓ 제목/일시/장소/정원/응답마감/미정확정기한 입력
이벤트 상세 (주최자 뷰)
  ↓ 공유 링크 생성 (만료: 모임 당일 자정 기본값)
  ↓ 링크 복사 → 카카오톡에 붙여넣기
  ↓ (응답이 쌓임) 탭으로 참석/불참/미정 확인
  ↓ 미정 확정 기한 도래 → 미정자 목록 확인 후 공지 추가
모임 종료
  ↓ 정산 탭 → 비용 항목 입력 (레인 대여 40,000 / 음료 12,000)
  ↓ 1인당 금액 자동 산출 (참석 확정 7명 → 7,430원 → 7,500원 절상)
  ↓ 링크 재공유 → 입금 들어오는 대로 체크
정산 완료 (미수금 0원)
```

### S2. 게스트 — 링크 응답

```
카카오톡 링크 탭
  ↓ /e/[token]
  ├─ 만료/삭제 → 만료 안내 화면 (정보 노출 없음)
  └─ 유효
      ├─ 쿠키에 이 이벤트의 게스트 키 있음 → 내 응답 강조 + [응답 수정]
      └─ 쿠키 없음 → 이름 입력 + 참석/불참/미정 선택 → 제출
                        ↓ 서버가 httpOnly 쿠키 발급
응답 완료 화면 = 이벤트 상세 (공지 + 명단 3탭 + 내 분담금)
```

### 엣지 케이스

| 상황                                     | 처리                                                                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 동명이인 2명                             | 이름 중복 허용. 게스트 키가 다르면 별개 응답. 명단에 `김민수`, `김민수 (2)` 로 표시(순번은 응답 순서)                                                                |
| 쿠키 삭제 후 재방문                      | 본인 응답을 찾지 못함 → 같은 이름으로 재응답 시 "동일 이름 응답이 있습니다. 새 응답으로 추가할까요?" 선택지 제시. 병합은 주최자만 가능(§ 주최자 도구)                |
| 한 사람이 링크를 여러 기기에서 열기      | 기기별 게스트 키 → 중복 응답. 주최자가 명단에서 중복 응답 삭제 가능                                                                                                  |
| 정원 초과 응답                           | 정원 도달 후 참석 선택 시 즉시 거부하지 않고 `attending` + 대기 순번 표시(정원 초과분은 회색 처리). 서버에서 응답 시각 순으로 순번 계산                              |
| 응답 마감 후 접근                        | 읽기 가능, 쓰기 거부. 폼 대신 "응답이 마감되었습니다"                                                                                                                |
| 링크 만료 후 접근                        | 읽기도 거부. 이벤트 존재 여부조차 노출하지 않음(동일한 만료 화면)                                                                                                    |
| 미정 확정 기한 경과                      | 자동으로 불참 전환하지 않는다. 명단에 "기한 초과" 배지만 부여하고 정산 대상에서 제외. 자동 전환은 사람의 의도를 왜곡함                                               |
| 참석 → 불참 변경 후 정산 실행            | 정산은 실행 시점의 참석자 집합을 스냅샷으로 고정(`settlement_shares`). 이후 RSVP 변경이 이미 산출된 금액을 흔들지 않음. 주최자가 [분담금 재계산]으로 명시적으로 갱신 |
| 비용 총액이 인원으로 나누어떨어지지 않음 | 1인당 금액을 10원 단위 절상, 총 징수액 − 총 비용 = 잔액은 주최자 몫으로 표시                                                                                         |
| 이벤트 삭제 후 게스트가 링크 접근        | 만료와 동일 화면                                                                                                                                                     |
| 참석자 0명 상태에서 정산                 | 1인당 금액 계산 불가 → "참석자가 없어 분담금을 계산할 수 없습니다"                                                                                                   |
| 게스트 이름에 따옴표/역슬래시            | 모든 출력은 React 기본 이스케이프. `dangerouslySetInnerHTML` 미사용                                                                                                  |
| 토큰 무차별 대입                         | 토큰 32바이트 base64url. 실패 응답은 만료 화면과 구분 불가. RPC 단위 rate limit(§8.6)                                                                                |

---

## 5. 화면 · 라우트 설계

라우트 보호는 `middleware.ts`가 아니라 루트 `proxy.ts`의 거부 목록으로 처리한다. **`/e/*`를 공개 경로로 추가해야 한다.**

### 주최자 (인증 필요)

| 라우트                    | 화면        | 내용                                                                            |
| ------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `/events`                 | 대시보드    | 내 이벤트 목록(다가오는/지난). 인원 요약, 미수금 배지. 빈 상태 CTA              |
| `/events/new`             | 이벤트 생성 | 제목·일시·장소·설명·정원·응답마감·미정확정기한 폼                               |
| `/events/[id]`            | 개요        | 이벤트 요약, 공유 링크 카드(복사/만료 설정/재발급), 인원 카운터 3개, 최신 공지  |
| `/events/[id]/responses`  | 응답 관리   | 참석/불참/미정 3탭, 정원 초과 표시, 중복 응답 삭제, 응답별 변경 이력 펼치기     |
| `/events/[id]/notices`    | 공지 관리   | 공지 목록·작성·수정·삭제                                                        |
| `/events/[id]/settlement` | 정산        | 비용 항목 CRUD, 1인당 금액, 스냅샷 생성/재계산, 참석자별 입금 토글, 미수금 합계 |
| `/events/[id]/settings`   | 설정        | 이벤트 수정, 응답 마감, 삭제(제목 재입력 확인)                                  |

### 게스트 (공개)

| 라우트               | 화면          | 내용                                                             |
| -------------------- | ------------- | ---------------------------------------------------------------- |
| `/e/[token]`         | 게스트 이벤트 | 공지 + 일시/장소 + 내 응답 카드 + 명단 3탭 + 내 분담금/입금 상태 |
| `/e/[token]/respond` | 응답 폼       | 이름 + 참석/불참/미정 + 메모. 수정 시 기존 값 프리필             |
| `/e/expired`         | 만료 안내     | 만료·삭제·무효 토큰 공통 화면. 어떤 정보도 노출하지 않음         |

### Route Handler (게스트 쓰기 경로)

| 경로                   | 역할                                              |
| ---------------------- | ------------------------------------------------- |
| `POST /api/guest/rsvp` | 게스트 응답 생성·수정. 쿠키 발급/검증 후 RPC 호출 |

게스트 쓰기는 Server Action이 아니라 Route Handler를 쓴다. httpOnly 쿠키 발급과 토큰 검증을 한 지점에 모으고, 실패 응답 형태를 통일하기 위함이다. 주최자 쪽 쓰기는 기존 스타터 관례대로 클라이언트 컴포넌트에서 직접 `supabase.*`를 호출한다.

### 화면 구현 주의 (이 리포지토리 규약)

- `cacheComponents: true` → 데이터를 읽는 서버 컴포넌트는 페이지에서 직접 `await`하지 않고 내부 async 컴포넌트로 분리해 `<Suspense>`로 감싼다.
- 세션 확인은 `getClaims()`.
- 삭제/재발급 확인은 shadcn `Dialog` + 텍스트 입력. `confirm()`/`alert()` 금지(브라우저 자동화가 멈춘다).
- 폼은 `react-hook-form` + `zod` 사용. **아직 미설치이므로 착수 시 `npm i react-hook-form zod @hookform/resolvers`.**

---

## 6. 데이터 모델

```
auth.users
  └─ events (host_id)
       ├─ event_notices
       ├─ rsvps ──┬─ rsvp_changes        (append-only 이력)
       │          └─ settlement_shares   (스냅샷)
       └─ settlements ─┬─ settlement_items
                       └─ settlement_shares
```

### `events`

| 컬럼                        | 타입        | 설명                                           |
| --------------------------- | ----------- | ---------------------------------------------- |
| `id`                        | uuid PK     |                                                |
| `host_id`                   | uuid        | → `auth.users.id`, on delete cascade           |
| `title`                     | text        | 필수, 1~100자                                  |
| `description`               | text        | nullable                                       |
| `location`                  | text        | 자유 텍스트 (좌표 없음)                        |
| `starts_at`                 | timestamptz | 모임 시각                                      |
| `capacity`                  | int         | nullable = 무제한                              |
| `rsvp_closes_at`            | timestamptz | nullable. 경과 시 쓰기 차단                    |
| `maybe_deadline`            | timestamptz | nullable. 미정 확정 기한                       |
| `share_token`               | text UNIQUE | 32바이트 base64url                             |
| `share_expires_at`          | timestamptz | nullable = 무기한. 경과 시 읽기·쓰기 모두 차단 |
| `bank_account`              | text        | nullable. 입금 안내 문자열                     |
| `deleted_at`                | timestamptz | 소프트 삭제                                    |
| `created_at` / `updated_at` | timestamptz |                                                |

인덱스: `(host_id, starts_at desc)`, `unique (share_token)`.

### `event_notices`

| 컬럼                        | 타입        | 설명                    |
| --------------------------- | ----------- | ----------------------- |
| `id`                        | uuid PK     |                         |
| `event_id`                  | uuid        | → `events.id` cascade   |
| `body`                      | text        | 공지 본문               |
| `is_pinned`                 | boolean     | 게스트 페이지 상단 고정 |
| `created_at` / `updated_at` | timestamptz |                         |

### `rsvps`

| 컬럼           | 타입               | 설명                               |
| -------------- | ------------------ | ---------------------------------- |
| `id`           | uuid PK            |                                    |
| `event_id`     | uuid               | → `events.id` cascade              |
| `guest_key`    | uuid               | 쿠키에 담기는 게스트 식별자        |
| `display_name` | text               | 표시 이름 (1~20자)                 |
| `status`       | enum `rsvp_status` | `attending` / `declined` / `maybe` |
| `note`         | text               | nullable, 한 줄 메모               |
| `responded_at` | timestamptz        | 최초 응답 시각 (정원 순번 기준)    |
| `updated_at`   | timestamptz        | 최종 수정 시각                     |

제약: `unique (event_id, guest_key)` — 기기 단위 1응답. 연락처는 어떤 형태로도 저장하지 않는다.

### `rsvp_changes` (append-only)

| 컬럼                    | 타입        | 설명                      |
| ----------------------- | ----------- | ------------------------- |
| `id`                    | bigint PK   |                           |
| `rsvp_id`               | uuid        | → `rsvps.id` cascade      |
| `event_id`              | uuid        | 조회 편의를 위한 비정규화 |
| `from_status`           | enum        | nullable = 최초 응답      |
| `to_status`             | enum        |                           |
| `from_name` / `to_name` | text        | 이름 변경도 기록          |
| `changed_at`            | timestamptz | default `now()`           |

UPDATE/DELETE 권한을 아무 역할에도 주지 않는다. 기록은 트리거만 수행한다(§8.4).

### `settlements`

| 컬럼            | 타입        | 설명                             |
| --------------- | ----------- | -------------------------------- |
| `id`            | uuid PK     |                                  |
| `event_id`      | uuid UNIQUE | 이벤트당 1개                     |
| `rounding_unit` | int         | default 10. 1인당 금액 절상 단위 |
| `snapshot_at`   | timestamptz | nullable. 분담금 확정 시각       |
| `is_published`  | boolean     | true일 때만 게스트에게 노출      |

### `settlement_items`

| 컬럼            | 타입    | 설명                         |
| --------------- | ------- | ---------------------------- |
| `id`            | uuid PK |                              |
| `settlement_id` | uuid    | → `settlements.id` cascade   |
| `label`         | text    | 예: 레인 대여                |
| `amount`        | int     | 원 단위 정수 (부동소수 금지) |

### `settlement_shares` (스냅샷)

| 컬럼            | 타입        | 설명                                                |
| --------------- | ----------- | --------------------------------------------------- |
| `id`            | uuid PK     |                                                     |
| `settlement_id` | uuid        | cascade                                             |
| `rsvp_id`       | uuid        | on delete set null (응답이 지워져도 정산 기록 보존) |
| `display_name`  | text        | 스냅샷 시점 이름 복사                               |
| `amount`        | int         | 1인 분담금                                          |
| `is_paid`       | boolean     | 주최자만 변경                                       |
| `paid_at`       | timestamptz | nullable                                            |

`unique (settlement_id, rsvp_id)`.

### 정산 계산 규칙

```
total       = Σ settlement_items.amount
payers      = 스냅샷 시점의 status = 'attending' 이고 기한초과가 아닌 rsvp 집합
per_person  = ceil(total / count(payers) / rounding_unit) * rounding_unit
collected   = per_person * count(payers)
host_diff   = collected - total     -- 양수면 주최자에게 남는 잔액
```

`snapshot_at`이 찍힌 뒤에는 RSVP 변경이 `settlement_shares`에 자동 반영되지 않는다. 주최자가 [분담금 재계산]을 누르면 스냅샷을 다시 만들고, 이때 `is_paid = true`인 행의 입금 상태는 이름+rsvp_id 기준으로 승계한다.

---

## 7. 게스트 쓰기 문제 (RLS 설계) ⭐

### 7.1 문제

참여자는 로그인하지 않는다. 즉 모든 게스트 요청의 Postgres 역할은 `anon`이고 JWT에 `sub`가 없다. 그런데 게스트는 `rsvps`에 INSERT/UPDATE를 해야 한다. 그대로 두면 두 극단 중 하나가 된다.

- `anon`에게 `rsvps` INSERT/UPDATE를 허용 → publishable key는 브라우저에 그대로 노출되므로, 누구나 Supabase REST로 **임의 이벤트에 무제한 응답을 꽂고 남의 응답을 수정**할 수 있다.
- 아무것도 허용하지 않음 → 게스트가 응답할 수 없다.

서비스 롤 키로 서버에서 우회하는 방법도 있으나, 이 리포지토리는 환경변수가 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 둘뿐이고 서비스 롤 키를 도입하면 "한 번 유출되면 전 DB"라는 위험을 1인 프로젝트가 안게 된다.

### 7.2 해법: 테이블은 게스트에게 전면 차단, 출입구는 SECURITY DEFINER 함수만

**원칙: 게스트는 테이블을 만지지 않는다. 함수만 호출한다.**

1. 모든 테이블에 RLS를 켜고 **`anon` 대상 정책을 하나도 만들지 않는다.** (정책 부재 = 전면 거부)
2. 정책은 `authenticated` 대상만 작성한다 — 조건은 언제나 "이 행이 속한 이벤트의 `host_id`가 나인가".
3. 게스트가 필요한 동작은 `SECURITY DEFINER` 함수 3개로만 노출하고, 첫 인자로 **공유 토큰**을 받아 함수 내부에서 권한을 판정한다. 토큰이 곧 자격증명이다.

```
브라우저(게스트)
   │  POST /api/guest/rsvp  { token, name, status, note }
   ▼
Next.js Route Handler            ← httpOnly 쿠키에서 guest_key 읽기/발급
   │  supabase.rpc('guest_submit_rsvp', { p_token, p_guest_key, ... })
   ▼
Postgres: SECURITY DEFINER 함수   ← 토큰·만료·마감·길이 검증 후 upsert
   ▼
rsvps  (anon 직접 접근은 RLS로 전면 거부)
```

### 7.3 공개 함수 3개

```sql
-- 스키마 분리: 게스트에게 열린 것만 이 스키마에 둔다
create schema if not exists api;
revoke all on schema public from anon;

-- (1) 이벤트 + 공지 + 명단 + (공개된) 내 분담금 읽기
create or replace function api.guest_get_event(
  p_token text,
  p_guest_key uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''            -- search_path 하이재킹 차단, 모든 참조는 스키마 수식
stable
as $$
declare
  v_event public.events;
  v_result jsonb;
begin
  select * into v_event
  from public.events e
  where e.share_token = p_token
    and e.deleted_at is null
    and (e.share_expires_at is null or e.share_expires_at > now());

  if not found then
    -- 존재하지 않음 / 삭제됨 / 만료됨을 구분해서 알려주지 않는다
    raise exception 'EVENT_UNAVAILABLE' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id, 'title', v_event.title,
      'description', v_event.description, 'location', v_event.location,
      'starts_at', v_event.starts_at, 'capacity', v_event.capacity,
      'rsvp_closes_at', v_event.rsvp_closes_at,
      'maybe_deadline', v_event.maybe_deadline,
      'bank_account', v_event.bank_account
    ),
    'notices', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', n.id, 'body', n.body, 'is_pinned', n.is_pinned,
               'created_at', n.created_at)
               order by n.is_pinned desc, n.created_at desc), '[]'::jsonb)
      from public.event_notices n where n.event_id = v_event.id
    ),
    -- 확정 사항 5: 참석/불참/미정 전원 공개. 단 guest_key·note 작성자 매칭은 숨김
    'rsvps', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id, 'display_name', r.display_name,
               'status', r.status, 'note', r.note,
               'responded_at', r.responded_at,
               'is_mine', (p_guest_key is not null and r.guest_key = p_guest_key))
               order by r.responded_at), '[]'::jsonb)
      from public.rsvps r where r.event_id = v_event.id
    ),
    'settlement', (
      select jsonb_build_object(
               'total', (select coalesce(sum(i.amount),0)
                         from public.settlement_items i
                         where i.settlement_id = s.id),
               'my_share', (select jsonb_build_object('amount', sh.amount,
                                                     'is_paid', sh.is_paid)
                            from public.settlement_shares sh
                            join public.rsvps r2 on r2.id = sh.rsvp_id
                            where sh.settlement_id = s.id
                              and r2.guest_key = p_guest_key))
      from public.settlements s
      where s.event_id = v_event.id and s.is_published
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function api.guest_get_event(text, uuid) to anon;
```

```sql
-- (2) 응답 생성/수정 (upsert). 이력은 트리거가 남긴다
create or replace function api.guest_submit_rsvp(
  p_token     text,
  p_guest_key uuid,
  p_name      text,
  p_status    public.rsvp_status,
  p_note      text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_id    uuid;
begin
  select * into v_event
  from public.events e
  where e.share_token = p_token
    and e.deleted_at is null
    and (e.share_expires_at is null or e.share_expires_at > now())
  for update;                                  -- 정원 순번 경합 방지

  if not found then
    raise exception 'EVENT_UNAVAILABLE' using errcode = 'P0002';
  end if;

  if v_event.rsvp_closes_at is not null and v_event.rsvp_closes_at <= now() then
    raise exception 'RSVP_CLOSED' using errcode = 'P0001';
  end if;

  -- 입력 검증을 DB에서 한 번 더 한다 (API를 우회한 직접 RPC 호출 대비)
  if p_guest_key is null then
    raise exception 'GUEST_KEY_REQUIRED' using errcode = 'P0001';
  end if;
  p_name := btrim(p_name);
  if char_length(p_name) between 1 and 20 is not true then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 200 then
    raise exception 'INVALID_NOTE' using errcode = 'P0001';
  end if;

  insert into public.rsvps (event_id, guest_key, display_name, status, note)
  values (v_event.id, p_guest_key, p_name, p_status, p_note)
  on conflict (event_id, guest_key) do update
    set display_name = excluded.display_name,
        status       = excluded.status,
        note         = excluded.note,
        updated_at   = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function api.guest_submit_rsvp(text, uuid, text, public.rsvp_status, text) to anon;
```

```sql
-- (3) 본인 응답 철회 (행 삭제 대신 declined 로 전환해 이력 보존)
create or replace function api.guest_withdraw_rsvp(p_token text, p_guest_key uuid)
returns void language plpgsql security definer set search_path = '' as $$ ... $$;
```

세 함수 외에는 `anon`에게 어떤 실행 권한도 주지 않는다.

```sql
-- 기본 실행 권한을 걷어내는 것이 핵심. 안 하면 새로 만든 함수가 자동 공개된다
alter default privileges in schema public revoke execute on functions from anon, public;
revoke execute on all functions in schema public from anon, public;
```

### 7.4 주최자용 RLS 정책

```sql
alter table public.events         enable row level security;
alter table public.event_notices  enable row level security;
alter table public.rsvps          enable row level security;
alter table public.rsvp_changes   enable row level security;
alter table public.settlements       enable row level security;
alter table public.settlement_items  enable row level security;
alter table public.settlement_shares enable row level security;

-- 주최자: 본인 이벤트 전권
create policy events_host_all on public.events
  for all to authenticated
  using  ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);

-- 자식 테이블: 소유 판정 함수를 한 곳에 모아 정책을 단순하게 유지
create or replace function public.is_event_host(p_event_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.host_id = (select auth.uid())
  );
$$;

create policy rsvps_host_all on public.rsvps
  for all to authenticated
  using (public.is_event_host(event_id))
  with check (public.is_event_host(event_id));
-- event_notices / settlements 계열도 동일 패턴

-- 이력은 읽기만. 쓰기 정책을 만들지 않으므로 주최자도 조작 불가
create policy rsvp_changes_host_select on public.rsvp_changes
  for select to authenticated using (public.is_event_host(event_id));
```

정책 조건에서 `auth.uid()`를 `(select auth.uid())`로 감싸는 것은 행마다 재평가되지 않게 하는 관용구다. RLS 조건에 쓰이는 컬럼(`host_id`, `event_id`)에는 인덱스를 둔다.

### 7.5 게스트 식별: 쿠키

```
이름: moim_gk_<event_id 앞 8자>
값:   uuid v4 (guest_key)
속성: httpOnly, secure, sameSite=lax, path=/, maxAge=180일
```

- Route Handler가 쿠키를 읽고, 없으면 `crypto.randomUUID()`로 발급해 응답에 심는다. 브라우저 JS는 값을 읽을 수 없다.
- 쿠키에는 이름·연락처가 들어가지 않는다. 서버가 `guest_key`로 조회한다.
- 이벤트별로 쿠키를 분리해 한 이벤트의 키가 다른 이벤트의 응답을 건드리지 못하게 한다.
- `guest_key`는 비밀이 아니다(탈취돼도 그 이벤트의 한 응답을 수정할 수 있을 뿐이고, 명단은 어차피 전원 공개다). 그래서 서명까지는 하지 않는다 — 대신 클라이언트가 임의 `guest_key`를 보낼 수 없게 **Route Handler가 body의 `guest_key`를 무시하고 항상 쿠키 값만 사용**한다.

### 7.6 남는 공격면과 대응

| 위협                                    | 대응                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 토큰 무차별 대입                        | 32바이트 난수(≈256bit). 실패 시 모두 동일한 `EVENT_UNAVAILABLE`                                                                               |
| 링크 유출 후 도배 응답                  | 주최자의 [링크 재발급]이 `share_token`을 교체해 기존 링크를 즉시 무효화. 응답 마감·명단 일괄 삭제로 복구                                      |
| 함수 직접 호출(REST `/rest/v1/rpc/...`) | 함수 내부에서 토큰·만료·마감·길이를 모두 재검증. API 계층 검증에 의존하지 않음                                                                |
| 무한 RPC 호출                           | `guest_submit_rsvp`에 `(event_id, date_trunc('minute', now()))` 기준 호출 카운터 테이블로 분당 상한. Supabase 프로젝트 레벨 rate limit도 병행 |
| `search_path` 하이재킹                  | 모든 SECURITY DEFINER 함수에 `set search_path = ''` + 전체 스키마 수식                                                                        |
| 새 함수 자동 공개                       | `alter default privileges ... revoke execute ... from anon` 선행                                                                              |

### 7.7 `proxy.ts` 수정

```ts
// 게스트 공개 경로 추가
request.nextUrl.pathname.startsWith("/e/");
request.nextUrl.pathname.startsWith("/api/guest/");
```

`hasEnvVars`가 falsy면 proxy 인증 검사 전체가 건너뛰어진다는 기존 함정은 그대로 유지된다(로컬에서 "로그인 안 했는데 열린다"의 원인).

---

## 8. 이력 기록 방식

응답 변경 이력은 **애플리케이션이 아니라 트리거가** 남긴다. RPC·주최자 편집·향후 관리 스크립트 어느 경로로 들어와도 빠지지 않게 하기 위함이다.

```sql
create or replace function public.log_rsvp_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rsvp_changes
      (rsvp_id, event_id, from_status, to_status, from_name, to_name)
    values (new.id, new.event_id, null, new.status, null, new.display_name);
  elsif new.status is distinct from old.status
     or new.display_name is distinct from old.display_name then
    insert into public.rsvp_changes
      (rsvp_id, event_id, from_status, to_status, from_name, to_name)
    values (new.id, new.event_id, old.status, new.status,
            old.display_name, new.display_name);
  end if;
  return new;
end;
$$;

create trigger rsvps_log_change
  after insert or update on public.rsvps
  for each row execute function public.log_rsvp_change();
```

- `note`만 바뀐 경우는 기록하지 않는다(노이즈).
- `rsvp_changes`에 UPDATE/DELETE 정책이 없으므로 앱·주최자 모두 사후 조작이 불가능하다. 삭제는 `rsvps` 행이 지워질 때 cascade로만 일어난다.
- 주최자 화면에서는 응답 행을 펼치면 `2/14 09:12 미정 → 참석` 형태의 타임라인이 보인다. 게스트에게는 노출하지 않는다(이력까지 전원 공개는 확정 사항 5의 범위를 넘는다).

---

## 9. 성공 지표

| 지표              | 정의                                    | 목표   |
| ----------------- | --------------------------------------- | ------ |
| 링크 응답률       | 응답 수 ÷ 주최자가 신고한 초대 인원     | ≥ 70%  |
| 첫 응답 소요 시간 | 링크 생성 → 첫 응답                     | ≤ 30분 |
| 응답 완료율       | 폼 진입 → 제출 성공                     | ≥ 90%  |
| 미정 잔존율       | 모임 시작 시점의 미정 비율              | ≤ 10%  |
| 정산 도달률       | 정산 항목을 1개 이상 입력한 이벤트 비율 | ≥ 50%  |
| 정산 종결률       | 미수금 0원에 도달한 정산 비율           | ≥ 80%  |
| 재사용률          | 두 번째 이벤트를 만든 주최자 비율       | ≥ 40%  |

측정은 별도 분석 도구 없이 DB 집계 쿼리로 한다(이벤트 수, 응답 수, 상태 전이 수는 모두 `rsvp_changes`와 `settlement_shares`에 남는다). 초대 인원만 주최자 입력값이 필요하다 — 이벤트 생성 시 "예상 인원" 선택 입력으로 받는다.

---

## 10. 구현 단계 로드맵

### 0단계 — 준비

- 스타터 잔여물 정리(`components/tutorial/`, `deploy-button`, `hero`, `app/instruments`)
- `npm i react-hook-form zod @hookform/resolvers`
- shadcn 추가: `dialog`, `tabs`, `badge`, `textarea`, `select`, `sonner`, `table`, `separator`
- `types/database.ts`를 `mcp__supabase__generate_typescript_types`로 생성하고 이후 스키마 변경마다 재생성 (`any` 금지 규칙과 직결)

### 1단계 — 스키마와 보안 (여기서 틀리면 전부 다시)

- 마이그레이션 1: enum `rsvp_status`, `events`, `event_notices`, `rsvps`, `rsvp_changes` + 인덱스
- 마이그레이션 2: RLS 활성화, `is_event_host()`, `authenticated` 정책
- 마이그레이션 3: `revoke execute` 기본 권한 정리, `api` 스키마, 게스트 함수 3개 + `grant execute to anon`
- 마이그레이션 4: `log_rsvp_change()` 트리거
- 검증: `mcp__supabase__get_advisors`로 RLS 누락·SECURITY DEFINER 경고 0건 확인. `anon` 키로 `rsvps` 직접 select/insert가 **모두 실패**하는지 수동 확인

### 2단계 — 주최자 코어

- `proxy.ts`에 `/e/`, `/api/guest/` 공개 경로 추가
- `/events` 대시보드, `/events/new`, `/events/[id]` (Suspense 분리 패턴)
- 공유 링크 카드: 생성·복사·만료 설정·재발급(Dialog 확인)
- `/events/[id]/settings`: 수정, 삭제(제목 재입력 Dialog)

### 3단계 — 게스트 RSVP

- `POST /api/guest/rsvp` Route Handler: zod 검증 → 쿠키 발급/읽기 → RPC → 오류 코드 매핑
- `/e/[token]` 서버 컴포넌트에서 `api.guest_get_event` 호출, `/e/expired`
- `/e/[token]/respond` 폼, 수정 플로우, 쿠키 없음/동명이인 분기
- `/events/[id]/responses` 3탭 + 정원 순번 + 중복 삭제 + 이력 펼치기

### 4단계 — 공지

- `/events/[id]/notices` CRUD, 고정 공지 1개 제한, 게스트 페이지 상단 반영

### 5단계 — 정산

- `/events/[id]/settlement`: 항목 CRUD, 계산 로직(정수 원 단위, 10원 절상), 스냅샷 생성/재계산, 입금 토글, 미수금 합계
- 게스트 페이지에 `my_share` 표시, `is_published` 게이트

### 6단계 — 마감

- 엣지 케이스 표(§4)를 브라우저에서 한 줄씩 확인
- 빈 상태·오류 문구 한국어 점검
- `npm run check-all` + `npm run build` 통과

### 후속 (MVP 밖)

카풀 → 정기 모임 → 알림 → 참여자 계정(선택 가입). 카풀이 첫 후보이며, 그때 좌석·출발지 스키마와 연락처 수집 여부를 다시 결정한다.

---

## 11. 미해결 질문

1. 게스트 쿠키 180일은 적절한가? 모임 종료 + 30일로 짧게 잡으면 재방문 인식이 끊긴다.
2. 정원 초과 응답을 "대기 순번"으로 받는 것이 맞는가, 아니면 참석 선택 자체를 막는 것이 맞는가? 실사용 1건으로 판단.
3. 미정 확정 기한 경과자를 정산 대상에서 제외하는 규칙이 주최자 직관에 맞는가?
4. 링크 재발급 시 기존 응답을 유지할지 초기화할지 — 현재 설계는 유지.
