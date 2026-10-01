-- 토큰을 쥔 사람의 대량 등록을 막는 분당 상한.
--
-- 카운터 테이블을 api가 아니라 private에 둔다(로드맵은 api.guest_rsvp_calls로 적고 있다).
-- T-108에서 api가 PostgREST 노출 스키마가 되면 api의 테이블은 /rest/v1/guest_rsvp_calls로
-- 경로가 생긴다. 권한이 없어 42501로 막히지만 애초에 표면을 만들지 않는 편이 낫고,
-- 이 테이블은 security definer 함수만 만지는 내부 장부라 private이 맞다(T-103·T-106과 같은 기준).
create table private.guest_rsvp_calls (
  event_id uuid not null,
  minute_bucket timestamptz not null,
  call_count int not null default 0,
  primary key (event_id, minute_bucket)
);

-- 정책을 하나도 만들지 않는다 = 전면 거부. grant도 주지 않는다.
alter table private.guest_rsvp_calls enable row level security;

-- guest_submit_rsvp를 교체해 상한 검사를 넣는다.
-- 반환 형태 { rsvp_id, event_id }는 그대로 유지해야 한다 — T-302가 쿠키를 심는 데 쓴다.
create or replace function api.guest_submit_rsvp(
  p_token text,
  p_guest_key uuid,
  p_name text,
  p_status public.rsvp_status,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events;
  v_id uuid;
  v_name text;
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
  -- 매 호출마다 전역 delete를 돌리는 것은 낭비이고, 1%면 테이블이 무한히 자라지 않는다.
  if random() < 0.01 then
    delete from private.guest_rsvp_calls where minute_bucket < now() - interval '1 hour';
  end if;

  -- 정원 초과를 거부하지 않는다. attending으로 받고 대기 순번은 표시 로직(T-305)이 맡는다.
  -- responded_at은 갱신하지 않는다 — 정원 순번의 기준이기 때문이다.
  insert into public.rsvps (event_id, guest_key, display_name, status, note)
  values (v_event.id, p_guest_key, v_name, p_status, p_note)
  on conflict (event_id, guest_key) do update
    set display_name = excluded.display_name,
        status = excluded.status,
        note = excluded.note,
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('rsvp_id', v_id, 'event_id', v_event.id);
end;
$$;

-- create or replace는 기존 ACL을 유지하지만, 명시적으로 다시 확인해 둔다(T-104의 함정).
revoke execute on function api.guest_submit_rsvp(text, uuid, text, public.rsvp_status, text) from public;
grant execute on function api.guest_submit_rsvp(text, uuid, text, public.rsvp_status, text) to anon;
