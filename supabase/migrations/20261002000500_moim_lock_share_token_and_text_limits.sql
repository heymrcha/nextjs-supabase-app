-- D2("share_token은 클라이언트가 정할 수 없는 값")를 권한으로 실제로 못 박는다.
--
-- before insert 트리거는 insert만 덮어쓴다. update에는 트리거가 없고 authenticated가
-- 테이블 단위 UPDATE를 갖고 있어, 주최자가 PATCH /rest/v1/events 로 share_token에
-- "party" 같은 추측 가능한 문자열을 직접 넣을 수 있었다. RLS는 본인 행만 허용하므로
-- 남의 모임에는 영향이 없지만, 본인 모임 링크가 추측으로 열리는 상태가 된다.
--
-- 컬럼 단위 revoke는 테이블 단위 grant가 남아 있으면 무효다(테이블 권한이 모든 컬럼을
-- 덮는다). 그래서 테이블 단위 UPDATE를 회수하고 share_token을 뺀 나머지에만 다시 준다.
revoke update on public.events from authenticated;

-- 주의: events에 컬럼을 추가하면 이 목록에도 넣어야 한다. 빠뜨리면 그 컬럼이
-- authenticated에게 읽기 전용이 되어 update가 42501로 실패한다 — 조용히 틀리는 게
-- 아니라 요청이 드러나게 깨지므로, 발견은 되지만 목록 갱신을 잊지 말 것.
grant update (
  title,
  description,
  location,
  starts_at,
  capacity,
  expected_headcount,
  rsvp_closes_at,
  maybe_deadline,
  share_expires_at,
  bank_account,
  deleted_at,
  updated_at
) on public.events to authenticated;

-- 주최자 쓰기 경로는 브라우저에서 supabase.from()을 직접 호출하므로 zod는 클라이언트
-- 전용 검증이고, 실질적 경계는 DB CHECK뿐이다. 게스트 화면에 그대로 렌더되는 텍스트가
-- 길이 제한 없이 들어오면 레이아웃과 응답 크기를 망칠 수 있다.
-- 게스트 함수(guest_submit_rsvp)는 이미 같은 이유로 DB에서 재검증한다.
alter table public.events
  add constraint events_location_len
    check (location is null or char_length(location) <= 100),
  add constraint events_description_len
    check (description is null or char_length(description) <= 2000),
  add constraint events_bank_account_len
    check (bank_account is null or char_length(bank_account) <= 100);
