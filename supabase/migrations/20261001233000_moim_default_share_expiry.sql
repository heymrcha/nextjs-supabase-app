-- 공유 링크 기본 만료의 단일 출처. share_token(D2)과 같은 규칙으로 DB가 값을 정한다.
--
-- 이전에는 생성 경로가 share_expires_at을 아예 보내지 않아 실제 값이 null(= 영구 유효)인데
-- 개요 화면만 "모임 당일 자정"을 채워 보여 줬다. 주최자가 링크 유효기간을 오인하는
-- 상태였고, 공유 링크 제품에서 이는 보안 문제다.
--
-- 날짜 경계는 Asia/Seoul 기준이어야 한다. 서버는 UTC로 돌기 때문에 타임존 변환 없이
-- date_trunc를 쓰면 "모임 당일"이 전날로 잘린다. 한국은 서머타임이 없어 오프셋이 고정이다.
create or replace function private.set_default_share_expiry()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  -- 주최자가 명시한 값은 건드리지 않는다. 기본값을 채우는 것이 이 트리거의 전부다
  if new.share_expires_at is null then
    new.share_expires_at :=
      (
        date_trunc('day', new.starts_at at time zone 'Asia/Seoul')
        + interval '1 day' - interval '1 second'
      ) at time zone 'Asia/Seoul';
  end if;

  return new;
end;
$$;

-- update에는 걸지 않는다. 만료 시각을 비워 "만료 없음"으로 두는 것은 유효한 선택이고,
-- update에 걸면 그 선택을 트리거가 되돌려 버린다.
drop trigger if exists events_set_default_share_expiry on public.events;
create trigger events_set_default_share_expiry
  before insert on public.events
  for each row execute function private.set_default_share_expiry();
