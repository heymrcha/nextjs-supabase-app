-- 정산 테이블. PRD 6절 기준. 금액은 원 단위 정수만(부동소수 금지).
-- RLS는 T-103에서 일괄 활성화한다.

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  -- 이벤트당 1개를 DB가 보장한다. T-501의 지연 생성이 on conflict do nothing으로 끝난다
  event_id uuid not null unique references public.events (id) on delete cascade,
  rounding_unit int not null default 10,
  -- 분담금 확정 시각. 찍힌 뒤에는 RSVP 변경이 shares에 자동 반영되지 않는다
  snapshot_at timestamptz,
  -- 게스트 공개 게이트. false면 guest_get_event가 정산을 아예 내려주지 않는다(T-505)
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  -- T-502의 per_person 계산에서 분모로 쓰인다. 0이면 0으로 나누기가 된다
  constraint settlements_rounding_unit_positive check (rounding_unit > 0)
);

create table public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  label text not null,
  amount int not null,
  created_at timestamptz not null default now(),
  constraint settlement_items_label_len check (char_length(label) between 1 and 100),
  -- 음수 항목은 ceil 계산을 무의미하게 만든다. 환불은 MVP 범위 밖이다
  constraint settlement_items_amount_positive check (amount > 0)
);

-- 스냅샷. rsvp_id가 null이 되어도 자기 행에 display_name·amount를 들고 있어야 하므로
-- 조인이 아니라 복사로 갖는다. T-503의 is_paid 승계가 rsvp_id 우선, 실패 시 이름 대조로
-- 떨어지는 근거다.
create table public.settlement_shares (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  rsvp_id uuid references public.rsvps (id) on delete set null,
  display_name text not null,
  amount int not null,
  is_paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  -- rsvp_id가 null인 행은 여러 개 공존할 수 있다(Postgres의 unique는 null을 중복으로 보지
  -- 않는다). 응답이 여러 건 삭제돼도 각 스냅샷 행이 따로 보존되므로 의도한 동작이다
  constraint settlement_shares_unique unique (settlement_id, rsvp_id),
  -- 참석자 0명이 아니면 total 0일 때 per_person이 0이 될 수 있으므로 0을 허용한다
  constraint settlement_shares_amount_non_negative check (amount >= 0),
  -- 미입금 행에 입금 시각이 남아 있으면 T-504의 미수금 집계를 오해하게 만든다
  constraint settlement_shares_paid_at_consistent check (is_paid or paid_at is null)
);

create index settlement_items_settlement_id_idx on public.settlement_items (
  settlement_id
);
-- shares의 settlement_id는 settlement_shares_unique의 선두 컬럼이라 별도 인덱스가 필요 없다.
-- rsvp_id는 on delete set null 처리에 쓰이고 unique의 두 번째 컬럼이므로 따로 만든다
create index settlement_shares_rsvp_id_idx on public.settlement_shares (rsvp_id);
