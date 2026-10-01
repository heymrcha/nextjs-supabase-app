-- 게스트 출입구가 될 api 스키마를 만들고 public 쪽 권한을 잠근다.
-- 적용 전 실측: anon이 7개 테이블에 DELETE·INSERT·REFERENCES·SELECT·TRIGGER·TRUNCATE·UPDATE를
-- 전부 갖고 있었다. RLS가 유일한 방어선이던 상태이며 여기서 권한 자체를 없앤다.

create schema if not exists api;

-- ★ PRD 7.3 누락분. 이게 없으면 함수에 grant execute를 줘도
-- 'permission denied for schema api'로 호출이 실패한다.
grant usage on schema api to anon, authenticated;

-- public은 게스트가 들어올 입구가 아니다. 테이블·함수·시퀀스 권한을 전부 걷는다.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
-- PostgreSQL은 함수 생성 시 PUBLIC에 EXECUTE를 기본 부여한다. anon만 걷으면
-- PUBLIC 경유로 남는다(T-103에서 실측으로 확인한 함정이다).
revoke execute on all functions in schema public from public;
revoke all on schema public from anon;

-- 앞으로 추가되는 객체가 자동 공개되지 않게 한다. 공개는 함수별 grant execute로만.
-- 기본 권한은 "부여자별"로 따로 저장되므로 postgres가 만든 것만 여기서 걷힌다.
-- supabase_admin이 부여한 몫은 남지만, 이 프로젝트의 마이그레이션은 postgres로 실행되므로
-- 우리가 만드는 객체에는 아래 설정이 적용된다(T-105 적용 후 실측으로 확인한다).
alter default privileges in schema public revoke execute on functions from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- api 스키마의 방어선. 새 함수를 추가해도 자동으로 anon에게 열리지 않는다.
alter default privileges in schema api revoke execute on functions from anon, public;
alter default privileges in schema api revoke all on tables from anon;
alter default privileges in schema api revoke all on sequences from anon;
