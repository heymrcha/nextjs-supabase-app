-- get_advisors가 public의 SECURITY DEFINER 함수 2개를 경고했다(level WARN):
-- authenticated 역할이 /rest/v1/rpc/is_event_host 로 직접 호출할 수 있다는 지적이다.
-- T-110은 security 경고 0건을 관문으로 삼으므로 해소해야 한다.
--
-- authenticated의 EXECUTE를 걷는 방법은 쓸 수 없다 — 실증해 보니 RLS 정책 평가가
-- 호출자의 EXECUTE 권한을 요구해서 'permission denied for function is_event_host'로
-- 모든 조회가 막힌다. 그래서 PostgREST에 노출되지 않는 스키마로 옮긴다.
-- 노출 스키마는 public(+T-108의 api)뿐이므로 private의 함수는 REST 표면이 없다.

create schema if not exists private;

-- 함수 본문은 그대로다. 스키마만 바뀐다.
create function private.is_event_host(p_event_id uuid) returns boolean
  language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.host_id = (select auth.uid())
  )
$$;

create function private.is_settlement_host(p_settlement_id uuid) returns boolean
  language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1
    from public.settlements s
    join public.events e on e.id = s.event_id
    where s.id = p_settlement_id and e.host_id = (select auth.uid())
  )
$$;

-- 정책 평가에 필요한 최소 권한만 준다. anon에게는 usage조차 주지 않는다.
revoke execute on function private.is_event_host(uuid) from public;
revoke execute on function private.is_settlement_host(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_event_host(uuid) to authenticated;
grant execute on function private.is_settlement_host(uuid) to authenticated;

-- 새 함수를 참조하도록 정책을 다시 만든다.
drop policy event_notices_host_all on public.event_notices;
drop policy rsvps_host_all on public.rsvps;
drop policy rsvp_changes_host_select on public.rsvp_changes;
drop policy settlements_host_all on public.settlements;
drop policy settlement_items_host_all on public.settlement_items;
drop policy settlement_shares_host_all on public.settlement_shares;

create policy event_notices_host_all on public.event_notices
  for all to authenticated
  using ((select private.is_event_host(event_id)))
  with check ((select private.is_event_host(event_id)));

create policy rsvps_host_all on public.rsvps
  for all to authenticated
  using ((select private.is_event_host(event_id)))
  with check ((select private.is_event_host(event_id)));

create policy rsvp_changes_host_select on public.rsvp_changes
  for select to authenticated
  using ((select private.is_event_host(event_id)));

create policy settlements_host_all on public.settlements
  for all to authenticated
  using ((select private.is_event_host(event_id)))
  with check ((select private.is_event_host(event_id)));

create policy settlement_items_host_all on public.settlement_items
  for all to authenticated
  using ((select private.is_settlement_host(settlement_id)))
  with check ((select private.is_settlement_host(settlement_id)));

create policy settlement_shares_host_all on public.settlement_shares
  for all to authenticated
  using ((select private.is_settlement_host(settlement_id)))
  with check ((select private.is_settlement_host(settlement_id)));

-- public 쪽 헬퍼는 더 이상 참조되지 않으므로 제거한다(노출 표면 축소).
drop function public.is_event_host(uuid);
drop function public.is_settlement_host(uuid);
