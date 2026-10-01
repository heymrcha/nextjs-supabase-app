-- REST 경유 호출이 'permission denied for schema public'으로 실패했다.
-- 원인: 파라미터 타입 public.rsvp_status 를 PostgREST가 anon 역할로 참조하는데
-- T-104에서 anon의 public 스키마 USAGE를 걷었기 때문이다.
-- 시그니처에 public 타입이 없는 guest_get_event·guest_withdraw_rsvp는 정상 동작했다.
--
-- anon에게 public USAGE를 돌려주는 것은 T-104의 방어를 되돌리는 일이라 택하지 않았다.
-- 대신 파라미터를 text로 받고 함수 안에서 캐스팅한다 — 함수 본문은 소유자(postgres) 권한으로
-- 실행되므로 public.rsvp_status에 접근할 수 있다.
--
-- 캐스팅 실패를 Postgres 오류(22P02)에 맡기면 enum 값 목록이 메시지로 새어 나가므로
-- 먼저 명시적으로 검증하고 INVALID_STATUS로 떨어뜨린다.
--
-- 시그니처가 바뀌므로 create or replace가 아니라 drop 후 create다(안 그러면 오버로드가 남는다).

drop function api.guest_submit_rsvp(text, uuid, text, public.rsvp_status, text);

create function api.guest_submit_rsvp(
  p_token text,
  p_guest_key uuid,
  p_name text,
  p_status text,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events;
  v_id uuid;
  v_name text;
  v_status public.rsvp_status;
  v_calls int;
  -- 분당 상한. 단발 모임은 참여자가 수십 명 규모이고 같은 분에 전원이 응답하지는 않으므로
  -- 20이면 정상 사용을 막지 않으면서 대량 등록은 걸린다.
  c_limit constant int := 20;
begin
  select * into v_event
  from public.events e
  where e.share_token = p_token
    and e.deleted_at is null
    and (e.share_expires_at is null or e.share_expires_at > now())
  for update;  -- 정원 순번은 이벤트 단위 자원이다. 잠금 대상을 events 한 곳으로 통일해 데드락을 피한다

  if not found then
    raise exception 'EVENT_UNAVAILABLE' using errcode = 'P0002';
  end if;

  if v_event.rsvp_closes_at is not null and v_event.rsvp_closes_at <= now() then
    raise exception 'RSVP_CLOSED' using errcode = 'P0001';
  end if;

  -- Route Handler의 zod 검증만으로는 RPC 직접 호출 경로를 막지 못한다. 여기서 한 번 더 한다.
  if p_guest_key is null then
    raise exception 'GUEST_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  -- 캐스팅을 Postgres에 맡기면 22P02 메시지에 enum 값 목록이 실려 나간다. 먼저 검증한다.
  if p_status is null or p_status not in ('attending', 'declined', 'maybe') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  v_status := p_status::public.rsvp_status;

  v_name := btrim(p_name);
  if coalesce(char_length(v_name), 0) not between 1 and 20 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if p_note is not null and char_length(p_note) > 200 then
    raise exception 'INVALID_NOTE' using errcode = 'P0001';
  end if;

  -- 상한 검사. on conflict do update가 원자적이라 별도 잠금이 필요 없다.
  -- 상한에 걸리면 이 트랜잭션이 롤백되므로 증가분도 되돌아간다 — 카운터는 "성공한 호출 수"에
  -- 고정되고 이후 호출은 계속 거부된다. 반대로 말하면 검증에서 떨어지는 요청은 예산을
  -- 소모하지 않는다(별도 트랜잭션이 필요하고 그건 MVP 범위 밖이다).
  insert into private.guest_rsvp_calls (event_id, minute_bucket, call_count)
  values (v_event.id, date_trunc('minute', now()), 1)
  on conflict (event_id, minute_bucket)
    do update set call_count = private.guest_rsvp_calls.call_count + 1
  returning call_count into v_calls;

  if v_calls > c_limit then
    -- 상한이 이벤트 단위다. 한 참여자가 같은 분에 다른 참여자의 응답을 막을 수 있다 —
    -- 모임 규모에서 실제로 부딪힐 일이 드물어 수용한다. guest_key 단위 상한이 필요해지면
    -- (event_id, guest_key, minute_bucket)으로 키를 확장한다.
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  -- 오래된 bucket 정리. pg_cron 도입은 MVP 밖이므로 호출 중에 확률적으로 치운다.
  if random() < 0.01 then
    delete from private.guest_rsvp_calls where minute_bucket < now() - interval '1 hour';
  end if;

  -- 정원 초과를 거부하지 않는다. attending으로 받고 대기 순번은 표시 로직(T-305)이 맡는다.
  -- responded_at은 갱신하지 않는다 — 정원 순번의 기준이기 때문이다.
  insert into public.rsvps (event_id, guest_key, display_name, status, note)
  values (v_event.id, p_guest_key, v_name, v_status, p_note)
  on conflict (event_id, guest_key) do update
    set display_name = excluded.display_name,
        status = excluded.status,
        note = excluded.note,
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('rsvp_id', v_id, 'event_id', v_event.id);
end;
$$;

revoke execute on function api.guest_submit_rsvp(text, uuid, text, text, text) from public, anon;
grant execute on function api.guest_submit_rsvp(text, uuid, text, text, text) to anon;
