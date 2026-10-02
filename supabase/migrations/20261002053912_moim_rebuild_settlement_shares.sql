-- T-503 스냅샷 생성·재계산.
-- 재계산은 "기존 shares 전부 삭제 → 새로 삽입"이다. 클라이언트에서 두 번에 나눠 쓰면
-- 사이에 실패했을 때 입금 기록이 통째로 날아간다. 함수 본문은 한 트랜잭션이므로
-- 삭제만 되고 끝나는 상태가 존재하지 않는다.
--
-- security definer가 아니다. 주최자는 settlement_shares_host_all 정책으로 자기 정산을
-- 이미 쓸 수 있고, definer로 만들면 get_advisors가 새 경고를 띄워 T-110에서 수락한
-- 목록과 어긋난다. 호스트가 아닌 호출자는 RLS에 걸려 0행만 건드리고 조용히 끝난다.
--
-- **금액은 계산하지 않고 받는다.** 1인당 분담금 산출은 lib/moim/settlement.ts(T-502)의
-- 순수 함수 하나가 책임진다 — 같은 수를 SQL에서 또 구하면 화면과 DB가 어긋난다.
create function public.rebuild_settlement_shares(
  p_settlement_id uuid,
  p_amount int,
  -- [{"rsvp_id": uuid, "display_name": text}, ...] — 스냅샷 시점의 참석자
  p_payers jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_paid jsonb;
  v_unmatched text[];
  v_carried int;
begin
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

  -- 호스트가 아니면 위의 쓰기가 전부 0행이므로 여기도 0행이다.
  update public.settlements s
     set snapshot_at = now()
   where s.id = p_settlement_id;

  return jsonb_build_object('carried', v_carried, 'unmatched', to_jsonb(v_unmatched));
end;
$$;

-- T-104에서 실증한 함정: 함수를 만들면 PUBLIC에 EXECUTE가 붙는다.
revoke execute on function public.rebuild_settlement_shares(uuid, int, jsonb) from public, anon;
grant execute on function public.rebuild_settlement_shares(uuid, int, jsonb) to authenticated;
