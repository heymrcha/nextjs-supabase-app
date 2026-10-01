-- 응답 변경 이력과 updated_at 자동 갱신을 트리거로 처리한다.
-- 이력을 애플리케이션이 아니라 트리거가 담당하는 이유: RPC·주최자 편집·관리 스크립트
-- 어느 경로로 들어와도 빠지지 않게 하기 위함이다. T-306의 타임라인이 이 데이터에 기댄다.
--
-- 함수를 private 스키마에 두는 이유는 T-103과 같다 — public의 SECURITY DEFINER 함수는
-- get_advisors가 WARN으로 지적하고 T-110은 경고 0건을 관문으로 삼는다. private은
-- PostgREST 노출 스키마가 아니므로 REST 표면이 없다.

-- rsvp_changes에는 insert 정책이 없다(T-103에서 의도적으로 만들지 않았다).
-- 그래서 이 함수가 security definer여야 기록이 된다.
create function private.log_rsvp_change() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rsvp_changes (rsvp_id, event_id, from_status, to_status, to_name, changed_at)
    values (new.id, new.event_id, null, new.status, new.display_name, now());
  -- note만 바뀐 경우는 기록하지 않는다(노이즈). status·display_name은 not null이지만
  -- is distinct from을 쓰는 편이 조건을 확장할 때 null 비교로 빠지지 않는다.
  elsif new.status is distinct from old.status
     or new.display_name is distinct from old.display_name then
    insert into public.rsvp_changes (rsvp_id, event_id, from_status, to_status,
                                     from_name, to_name, changed_at)
    values (new.id, new.event_id, old.status, new.status,
            old.display_name, new.display_name, now());
  end if;
  return new;
end;
$$;

-- updated_at은 T-101에서 default now()만 두어 UPDATE 시 갱신되지 않는 부채로 남아 있었다.
-- 애플리케이션에 맡기면 쓰기 지점(T-203·T-206·T-401·RPC)마다 누락 위험이 생기므로
-- DB가 보장한다. 테이블에 접근하지 않고 NEW만 고치므로 security definer가 필요 없다.
create function private.set_updated_at() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- T-104에서 실증한 함정: 함수를 만들면 PUBLIC에 EXECUTE가 붙는다. 트리거 함수는
-- 직접 호출될 이유가 없으므로 걷어 둔다.
revoke execute on function private.log_rsvp_change() from public, anon;
revoke execute on function private.set_updated_at() from public, anon;

create trigger rsvps_log_change
  after insert or update on public.rsvps
  for each row execute function private.log_rsvp_change();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create trigger event_notices_set_updated_at
  before update on public.event_notices
  for each row execute function private.set_updated_at();

create trigger rsvps_set_updated_at
  before update on public.rsvps
  for each row execute function private.set_updated_at();
