-- 재발급도 T-203의 generate_share_token()을 쓴다(D2). before insert 트리거는
-- update에 걸리지 않으므로, 재발급 경로를 호스트 확인이 포함된 함수로 감싼다.
create or replace function public.regenerate_share_token(p_event_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_token text;
begin
  -- security definer라 RLS를 우회한다. 그래서 호스트 확인을 함수가 직접 해야 한다.
  -- 헬퍼는 public이 아니라 private에 있다(T-103).
  if not private.is_event_host(p_event_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update public.events
     set share_token = public.generate_share_token()
   where id = p_event_id
     and deleted_at is null
  returning share_token into v_token;

  -- 삭제된 이벤트는 위 update가 0행이라 v_token이 null로 남는다.
  -- 호스트 확인은 통과했으므로 존재 여부를 숨길 이유가 없다.
  if v_token is null then
    raise exception 'EVENT_UNAVAILABLE' using errcode = 'P0002';
  end if;

  return v_token;
end;
$$;

-- anon에게 주지 않는다. T-104의 기본 권한이 막지만 명시적으로 회수한다
revoke execute on function public.regenerate_share_token(uuid) from public, anon;
grant execute on function public.regenerate_share_token(uuid) to authenticated;
