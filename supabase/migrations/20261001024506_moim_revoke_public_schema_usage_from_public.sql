-- revoke all on schema public from anon 이후에도
-- has_schema_privilege('anon','public','usage')가 true였다.
-- public 스키마의 ACL이 '=U/pg_database_owner' 즉 PUBLIC 의사 역할에 USAGE를 주고 있고
-- anon이 그것을 상속받기 때문이다. T-103의 함수 EXECUTE와 같은 함정이다.
--
-- PUBLIC에서 걷어도 다른 역할은 영향받지 않는다 — 적용 전 ACL 실측:
--   postgres=U, authenticated=U, service_role=U 는 모두 "명시적" 부여다.
-- anon만 상속에 의존하고 있었다.
revoke usage on schema public from public;
