-- 모임 이벤트 관리 MVP 핵심 테이블.
-- PRD 6절 기준. 연락처 컬럼은 어떤 형태로도 만들지 않는다(확정 사항: 연락처 수집 안 함).
-- 금액·인원은 정수만. RLS는 T-103에서 일괄 활성화한다.

create type public.rsvp_status as enum ('attending', 'declined', 'maybe');

-- PK를 uuid로 두는 이유: event_id가 게스트 쿠키 이름(moim_gk_<앞 8자>)에 쓰이고,
-- 순차 id는 다른 주최자의 이벤트 수를 추측할 여지를 준다. UUIDv4의 인덱스 단편화는
-- 단발 모임 규모(이벤트당 응답 수백 행)에서 문제되지 않으며 pg_uuidv7은 이 프로젝트에서 쓸 수 없다.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  capacity int,
  expected_headcount int,
  rsvp_closes_at timestamptz,
  maybe_deadline timestamptz,
  share_token text not null unique,
  share_expires_at timestamptz,
  bank_account text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_len check (char_length(title) between 1 and 100),
  constraint events_capacity_positive check (capacity is null or capacity > 0),
  constraint events_expected_headcount_positive check (
    expected_headcount is null or expected_headcount > 0
  )
);

create table public.event_notices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_notices_body_len check (char_length(body) between 1 and 2000)
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- 비밀이 아니다. 탈취돼도 그 이벤트의 한 응답만 수정할 수 있고 명단은 전원 공개다(PRD 7.5)
  guest_key uuid not null,
  display_name text not null,
  status public.rsvp_status not null,
  note text,
  -- 정원 순번의 기준이므로 응답을 수정해도 갱신하지 않는다
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rsvps_event_guest_unique unique (event_id, guest_key),
  constraint rsvps_name_len check (char_length(display_name) between 1 and 20),
  constraint rsvps_note_len check (note is null or char_length(note) <= 200)
);

-- append-only 이력. 기록은 트리거만 수행하고(T-106) write 정책을 만들지 않는다(T-103).
create table public.rsvp_changes (
  id bigint generated always as identity primary key,
  -- PRD 6절은 cascade지만 set null로 바꾼다. cascade면 응답을 삭제할 때 이력이 함께
  -- 사라져 같은 문서의 append-only 원칙과 주최자 이력 화면(T-306)이 무너진다
  rsvp_id uuid references public.rsvps (id) on delete set null,
  event_id uuid not null references public.events (id) on delete cascade,
  from_status public.rsvp_status,
  to_status public.rsvp_status not null,
  from_name text,
  to_name text,
  changed_at timestamptz not null default now()
);

-- 대시보드의 주최자별 목록 조회
create index events_host_id_starts_at_idx on public.events (host_id, starts_at desc);
-- FK + cascade + RLS 조건 컬럼. PRD·로드맵의 인덱스 목록에서 빠져 있던 항목이다
create index event_notices_event_id_idx on public.event_notices (event_id);
create index rsvps_event_id_idx on public.rsvps (event_id);
create index rsvp_changes_event_id_idx on public.rsvp_changes (event_id);
create index rsvp_changes_rsvp_id_changed_at_idx on public.rsvp_changes (
  rsvp_id, changed_at
);
