-- T-402 고정 공지 1개 제한.
-- 고정 해제를 애플리케이션에 맡기지 않는 이유: 쓰기 경로가 늘어날 때마다 규칙이
-- 새어 나가고, "기존 해제 → 새 고정" 두 번의 왕복 사이에 실패하면 고정이 0건으로 남는다.
--
-- 함수를 private에 두는 이유는 T-103·T-106과 같다 — public의 함수는 get_advisors가
-- 지적하고 T-110은 경고 0건을 관문으로 삼는다. private은 PostgREST 노출 스키마가 아니다.
--
-- security definer를 붙이지 않는다. 주최자는 event_notices_host_all 정책으로 자기
-- 이벤트 행을 이미 전부 쓸 수 있으므로 권한 상승이 필요 없다.
create function private.unpin_other_notices() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  update public.event_notices
     set is_pinned = false
   where event_id = new.event_id and id <> new.id and is_pinned;
  return new;
end;
$$;

-- T-104에서 실증한 함정: 함수를 만들면 PUBLIC에 EXECUTE가 붙는다.
-- 트리거 함수는 직접 호출될 이유가 없으므로 걷어 둔다.
revoke execute on function private.unpin_other_notices() from public, anon;

-- when 절이 재귀를 막는다. 안쪽 update가 쓰는 값은 is_pinned=false이므로 조건을
-- 만족하지 않아 트리거가 다시 돌지 않는다.
-- `update of is_pinned`로 좁혀 본문만 고치는 수정에서는 아무 일도 하지 않게 한다.
create trigger event_notices_unpin_others
  before insert or update of is_pinned on public.event_notices
  for each row when (new.is_pinned)
  execute function private.unpin_other_notices();

-- 트리거가 이미 보장하지만 최후 방어선으로 둔다. before 트리거가 먼저 돌아 기존 고정을
-- 해제하므로 정상 경로에서는 충돌하지 않는다.
create unique index event_notices_one_pinned_idx
  on public.event_notices (event_id) where is_pinned;
