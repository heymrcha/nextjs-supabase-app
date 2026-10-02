-- T-506 보완(T-601 검증 중 발견). 계좌 안내 문자열이 공개 게이트 밖에 있었다.
--
-- guest_get_event가 bank_account를 event 객체에 무조건 넣고 있었다. 화면은
-- SettlementSection 안에서만 렌더하므로 HTML에는 새지 않지만, 토큰을 쥔 사람이 RPC를
-- 직접 호출하면 정산이 비공개거나 아예 없는 단계에서도 계좌가 읽혔다. T-506의 기준은
-- "렌더되는 경로"가 아니라 "JSON payload 전부"이므로 이것은 기준 위반이다.
--
-- 계좌는 분담금을 받기 위한 정보다. 공개된 정산과 생명주기가 같으므로 settlement 객체
-- 안으로 옮긴다 — is_published가 아니면 settlement 자체가 null이 되어 함께 사라진다.
create or replace function api.guest_get_event(
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
      'maybe_deadline', v_event.maybe_deadline
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
    -- is_published가 아니면 이 키 자체가 null이 된다(T-505의 공개 게이트).
    -- bank_account가 이 안에 있는 이유: 게이트를 통과하지 못하면 계좌도 같이 사라져야 한다.
    'settlement', (
      select jsonb_build_object(
               'total', (select coalesce(sum(i.amount), 0)
                         from public.settlement_items i
                         where i.settlement_id = s.id),
               'bank_account', v_event.bank_account,
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
