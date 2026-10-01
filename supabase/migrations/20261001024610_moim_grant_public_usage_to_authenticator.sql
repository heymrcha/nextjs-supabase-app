-- 앞의 revoke usage on schema public from public 은 anon을 막는 것이 목적이었지만,
-- PostgREST가 접속하는 authenticator 역할도 USAGE를 PUBLIC 상속으로만 갖고 있어 함께 잃었다.
-- REST 호출은 지금도 동작한다(anon 요청이 42501 permission denied for schema public을 받는다
-- = 접속·역할 전환·쿼리 실행이 모두 성공한다는 뜻이고, 스키마 캐시도 events를 해석하고 있다).
--
-- 그러나 PostgREST가 나중에 스키마 캐시를 다시 만들 때(재시작·reload) introspection이
-- 실패할 여지를 남기고 싶지 않다. 운영 중에 드러나면 최악의 실패 양상이다.
-- authenticator에만 명시적으로 돌려준다. anon은 상속 경로가 끊긴 상태로 유지된다.
grant usage on schema public to authenticator;
