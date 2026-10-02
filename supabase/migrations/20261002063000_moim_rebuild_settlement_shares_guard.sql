-- T-503 보완(코드 리뷰 대응). 재계산이 "앱이 읽은 참석자"와 "지금 참석자"의 불일치를
-- 검증하지 않아, 다이얼로그를 열어 둔 사이 명단이 바뀌면 낡은 기준으로 만든 스냅샷이
-- 오류 없이 저장됐다. D3의 결정("조용히 틀린 금액을 쓰지 않는다")이 문서에만 있고
-- 함수에는 없던 것을 여기서 메운다.
--
-- 금액 산출은 그대로 lib/moim/settlement.ts(T-502)의 몫이다. 이 함수는 계산하지 않고,
-- 넘겨받은 기준이 아직 유효한지만 확인한다 — 검증과 계산은 다른 일이다.
create or replace function public.rebuild_settlement_shares(
  p_settlement_id uuid,
  p_amount int,
  -- [{"rsvp_id": uuid, "display_name": text}, ...] — 앱이 계산에 쓴 참석자
  p_payers jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_current uuid[];
  v_sent uuid[];
  v_paid jsonb;
  v_unmatched text[];
  v_carried int;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  -- settlements 행을 먼저 잠근다. 같은 정산에 재계산이 동시에 들어오면(더블 클릭,
  -- 탭 2개) delete → select → insert가 서로 끼어들 수 있다. 여기서 직렬화한다.
  select s.event_id into v_event_id
    from public.settlements s
   where s.id = p_settlement_id
     for update;

  -- RLS가 남의 정산을 걸러내므로 호스트가 아니면 여기서 끝난다. 없는 id와 남의 id를
  -- 구분하지 않는 것은 regenerate_share_token과 같은 판단이다(존재 여부를 숨긴다).
  if v_event_id is null then
    raise exception 'SETTLEMENT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- 참석자 행을 잠가 읽는다. 잠그지 않으면 아래 비교를 통과한 직후에 상태가 바뀌어도
  -- 커밋까지 막을 방법이 없다. 게스트의 응답 쓰기는 이 트랜잭션 동안만 기다린다.
  with locked as (
    select r.id
      from public.rsvps r
     where r.event_id = v_event_id
       and r.status = 'attending'
       for update
  )
  select array_agg(id order by id) into v_current from locked;

  select array_agg((p->>'rsvp_id')::uuid order by (p->>'rsvp_id')::uuid)
    into v_sent
    from jsonb_array_elements(p_payers) p;

  -- 인원 수가 아니라 집합을 비교한다. 한 명이 빠지고 한 명이 들어오면 수는 같지만
  -- 분담 대상은 다른 사람이다.
  if v_current is distinct from v_sent then
    raise exception 'PAYERS_CHANGED' using errcode = 'P0001';
  end if;

  -- 참석자 0명이면 계산할 것이 없다. 여기까지 와서 전부 지우면 이미 걷은 입금 기록이
  -- 사라지므로 막는다(화면은 애초에 [계산]을 막지만 RPC는 직접 호출될 수 있다).
  if v_current is null then
    raise exception 'NO_PAYERS' using errcode = 'P0001';
  end if;

  -- 입금 완료된 행만 보존 대상이다. 미입금 행은 되살릴 내용이 없다.
  select coalesce(jsonb_agg(jsonb_build_object(
           'rsvp_id', s.rsvp_id, 'display_name', s.display_name, 'paid_at', s.paid_at)), '[]'::jsonb)
    into v_paid
    from public.settlement_shares s
   where s.settlement_id = p_settlement_id and s.is_paid;

  -- 승계되지 못한 입금 기록. 응답이 삭제된 뒤 이름까지 바뀐 경우가 여기 걸린다.
  select coalesce(array_agg(o->>'display_name' order by o->>'display_name'), '{}')
    into v_unmatched
    from jsonb_array_elements(v_paid) o
   where not exists (
     select 1 from jsonb_array_elements(p_payers) p
      where (o->>'rsvp_id') = (p->>'rsvp_id')
         or ((o->>'rsvp_id') is null and (o->>'display_name') = (p->>'display_name'))
   );

  delete from public.settlement_shares s where s.settlement_id = p_settlement_id;

  insert into public.settlement_shares (
    settlement_id, rsvp_id, display_name, amount, is_paid, paid_at
  )
  select p_settlement_id,
         (p->>'rsvp_id')::uuid,
         p->>'display_name',
         p_amount,
         m.paid_at is not null,
         m.paid_at
    from jsonb_array_elements(p_payers) p
    -- rsvp_id 일치를 먼저 쓰고, rsvp_id가 null이 된 과거 행만 이름으로 대조한다.
    left join lateral (
      select (o->>'paid_at')::timestamptz as paid_at
        from jsonb_array_elements(v_paid) o
       where (o->>'rsvp_id') = (p->>'rsvp_id')
          or ((o->>'rsvp_id') is null and (o->>'display_name') = (p->>'display_name'))
       order by ((o->>'rsvp_id') = (p->>'rsvp_id')) desc nulls last
       limit 1
    ) m on true;

  select count(*) into v_carried
    from public.settlement_shares s
   where s.settlement_id = p_settlement_id and s.is_paid;

  update public.settlements s
     set snapshot_at = now()
   where s.id = p_settlement_id;

  return jsonb_build_object('carried', v_carried, 'unmatched', to_jsonb(v_unmatched));
end;
$$;

-- create or replace는 기존 권한을 유지하므로 grant를 다시 하지 않는다. 20261002053912에서
-- PUBLIC·anon을 회수하고 authenticated에만 준 상태가 그대로다.
