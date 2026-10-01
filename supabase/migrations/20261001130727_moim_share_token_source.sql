-- share_token 생성의 단일 출처(D2). events의 default와 재발급(T-205)이 같은 함수를 쓴다.
-- set search_path = '' 때문에 gen_random_bytes를 extensions로 수식해야 한다 — 수식하지 않으면
-- 함수가 런타임에 "function gen_random_bytes(integer) does not exist"로 실패한다.
create or replace function public.generate_share_token()
  returns text
  language sql
  volatile
  set search_path = ''
as $$
  -- base64url: + / 를 - _ 로 바꾸고 패딩(=)을 제거한다. 32바이트 → 43자
  select replace(replace(replace(
           encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
$$;

alter table public.events
  alter column share_token set default public.generate_share_token();

-- default만으로는 클라이언트가 값을 명시하면 우회된다. RLS with check로는
-- "이 컬럼은 클라이언트가 정할 수 없다"를 표현할 수 없어 트리거를 쓴다.
create or replace function private.force_share_token()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.share_token := public.generate_share_token();
  return new;
end;
$$;

-- update에는 걸지 않는다. 재발급(T-205)이 의도된 경로이고, 그쪽도 같은
-- generate_share_token()을 쓰게 해 생성 로직이 갈라지지 않게 한다.
drop trigger if exists events_force_share_token on public.events;
create trigger events_force_share_token
  before insert on public.events
  for each row execute function private.force_share_token();

-- 함수 실행 권한: anon에게 주지 않는다(T-110의 "api 밖 함수는 anon 비공개" 유지)
revoke execute on function public.generate_share_token() from public, anon;
grant execute on function public.generate_share_token() to authenticated;
