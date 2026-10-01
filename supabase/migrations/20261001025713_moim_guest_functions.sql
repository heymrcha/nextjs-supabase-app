-- 게스트가 호출할 수 있는 전부. PRD 7.3 기준이며 두 지점에서 원문과 다르다:
--   (1) 쓰기 함수 2개의 반환을 uuid/void → { rsvp_id, event_id } jsonb.
--       쿠키 이름이 moim_gk_<event_id 앞 8자>인데 Route Handler는 token만 받으므로
--       event_id 없이는 쿠키를 심을 수 없다.
--   (2) 게스트 payload에서 타인의 note를 제거(수정 사항 4). PRD 7.3은 r.note를 무조건
--       넣지만 같은 문서 8절은 공개 범위 초과라고 한다. 메모는 주최자 전용이다.
-- guest_key는 어떤 경우에도 payload에 넣지 않는다.

-- (1) 이벤트 + 공지 + 명단 + (공개된) 내 분담금 읽기
create function api.guest_get_event(
  p_token text,
  p_guest_key uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' stable
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
      'id', v_event.id,
      'title', v_event.title,
      'description', v_event.description,
      'location', v_event.location,
      'starts_at', v_event.starts_at,
      'capacity', v_event.capacity,
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
    -- 참석/불참/미정 전원 공개. 단 note는 본인 행에만, guest_key는 어디에도 없다
    'rsvps', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id,
               'display_name', r.display_name,
               'status', r.status,
               'responded_at', r.responded_at,
               'is_mine', (p_guest_key is not null and r.guest_key = p_guest_key),
               -- 메모는 자유 입력이라 사적 내용이 들어갈 수 있다. 본인 것만 내려준다
               'note', case
                         when p_guest_key is not null and r.guest_key = p_guest_key
                         then r.note
                         else null
                       end)
               order by r.responded_at), '[]'::jsonb)
      from public.rsvps r where r.event_id = v_event.id
    ),
    -- is_published가 아니면 이 키 자체가 null이 된다(T-505의 공개 게이트)
    'settlement', (
      select jsonb_build_object(
               'total', (select coalesce(sum(i.amount), 0)
                         from public.settlement_items i
                         where i.settlement_id = s.id),
               'my_share', (select jsonb_build_object('amount', sh.amount,
                                                      'is_paid', sh.is_paid)
                            from public.settlement_shares sh
                            join public.rsvps r2 on r2.id = sh.rsvp_id
                            where sh.settlement_id = s.id
                              and p_guest_key is not null
                              and r2.guest_key = p_guest_key))
      from public.settlements s
      where s.event_id = v_event.id and s.is_published
    )
  ) into v_result;

  return v_result;
end;
$$;

-- (2) 응답 생성/수정 (upsert). 이력은 트리거가 남긴다(T-106)
create function api.guest_submit_rsvp(
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

-- (3) 본인 응답 철회. 행 삭제가 아니라 declined 전환으로 이력을 보존한다
create function api.guest_withdraw_rsvp(
  p_token text,
  p_guest_key uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.events;
  v_id uuid;
begin
  select * into v_event
  from public.events e
  where e.share_token = p_token
    and e.deleted_at is null
    and (e.share_expires_at is null or e.share_expires_at > now())
  for update;

  if not found then
    raise exception 'EVENT_UNAVAILABLE' using errcode = 'P0002';
  end if;

  if v_event.rsvp_closes_at is not null and v_event.rsvp_closes_at <= now() then
    raise exception 'RSVP_CLOSED' using errcode = 'P0001';
  end if;

  if p_guest_key is null then
    raise exception 'GUEST_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  update public.rsvps
    set status = 'declined', updated_at = now()
  where event_id = v_event.id and guest_key = p_guest_key
  returning id into v_id;

  if v_id is null then
    -- 철회할 응답이 없다. 이벤트 존재 여부와 구분되지 않게 같은 코드로 떨어뜨린다
    raise exception 'EVENT_UNAVAILABLE' using errcode = 'P0002';
  end if;

  return jsonb_build_object('rsvp_id', v_id, 'event_id', v_event.id);
end;
$$;

-- ★ T-104에서 실증: ALTER DEFAULT PRIVILEGES의 REVOKE는 내장 기본값인 PUBLIC EXECUTE를
-- 깎지 못한다. 함수를 만들면 PUBLIC에 EXECUTE가 붙고 anon은 api 스키마에 USAGE가 있으므로
-- 아래 revoke를 빠뜨리면 그 함수가 anon에게 그대로 공개된다. 반드시 먼저 걷고 나서 준다.
revoke execute on function api.guest_get_event(text, uuid) from public, anon;
revoke execute on function api.guest_submit_rsvp(text, uuid, text, public.rsvp_status, text) from public, anon;
revoke execute on function api.guest_withdraw_rsvp(text, uuid) from public, anon;

grant execute on function api.guest_get_event(text, uuid) to anon;
grant execute on function api.guest_submit_rsvp(text, uuid, text, public.rsvp_status, text) to anon;
grant execute on function api.guest_withdraw_rsvp(text, uuid) to anon;
