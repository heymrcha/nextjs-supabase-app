-- 7개 테이블 전부 RLS 활성 + authenticated 대상 정책만.
-- anon 대상 정책을 하나도 만들지 않는다 — 정책 부재 = 전면 거부.
-- 게스트는 api 스키마 함수(T-105)로만 들어온다.

alter table public.events enable row level security;
alter table public.event_notices enable row level security;
alter table public.rsvps enable row level security;
alter table public.rsvp_changes enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_items enable row level security;
alter table public.settlement_shares enable row level security;

-- events의 RLS를 우회해 호스트를 판정해야 하므로 security definer다.
-- 그래서 함수 안에서 호출자 신원을 직접 확인한다 — 이 확인을 빼면 누구나
-- 아무 이벤트의 호스트로 판정될 수 있다.
-- set search_path = '' 없이는 get_advisors가 mutable search_path 경고를 낸다(T-110).
create function public.is_event_host(p_event_id uuid) returns boolean
  language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.host_id = (select auth.uid())
  )
$$;

-- settlement_items·settlement_shares는 event_id를 직접 갖지 않는다. 정책마다 중첩 exists를
-- 쓰면 네 곳에 같은 조건이 흩어지므로 여기 한 번만 쓴다.
create function public.is_settlement_host(p_settlement_id uuid) returns boolean
  language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1
    from public.settlements s
    join public.events e on e.id = s.event_id
    where s.id = p_settlement_id and e.host_id = (select auth.uid())
  )
$$;

-- PostgreSQL은 함수 생성 시 PUBLIC에 EXECUTE를 기본 부여한다. anon만 회수하면
-- PUBLIC 경유로 남으므로 PUBLIC에서 먼저 걷고 authenticated에만 다시 준다.
-- authenticated는 정책이 이 함수를 호출하므로 EXECUTE가 필요하다.
revoke execute on function public.is_event_host(uuid) from public;
revoke execute on function public.is_settlement_host(uuid) from public;
grant execute on function public.is_event_host(uuid) to authenticated;
grant execute on function public.is_settlement_host(uuid) to authenticated;

-- events는 host_id를 직접 비교한다. 자기 테이블 정책에서 is_event_host를 쓰면
-- 같은 테이블을 한 번 더 조회하게 되므로 불필요하다.
-- deleted_at은 정책에서 걸러내지 않는다 — 소프트 삭제 필터는 조회하는 쪽의 책임이고,
-- 정책은 소유권만 판정한다.
create policy events_host_all on public.events
  for all to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

-- 헬퍼 호출을 (select ...)로 감싸는 것은 RLS 성능 관용구다(행마다 재평가 억제).
create policy event_notices_host_all on public.event_notices
  for all to authenticated
  using ((select public.is_event_host(event_id)))
  with check ((select public.is_event_host(event_id)));

create policy rsvps_host_all on public.rsvps
  for all to authenticated
  using ((select public.is_event_host(event_id)))
  with check ((select public.is_event_host(event_id)));

-- append-only. INSERT/UPDATE/DELETE 정책을 만들지 않아 주최자도 이력을 조작할 수 없다.
-- 기록은 T-106의 security definer 트리거만 수행한다.
create policy rsvp_changes_host_select on public.rsvp_changes
  for select to authenticated
  using ((select public.is_event_host(event_id)));

create policy settlements_host_all on public.settlements
  for all to authenticated
  using ((select public.is_event_host(event_id)))
  with check ((select public.is_event_host(event_id)));

create policy settlement_items_host_all on public.settlement_items
  for all to authenticated
  using ((select public.is_settlement_host(settlement_id)))
  with check ((select public.is_settlement_host(settlement_id)));

create policy settlement_shares_host_all on public.settlement_shares
  for all to authenticated
  using ((select public.is_settlement_host(settlement_id)))
  with check ((select public.is_settlement_host(settlement_id)));
