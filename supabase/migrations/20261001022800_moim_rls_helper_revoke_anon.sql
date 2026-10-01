-- revoke ... from public 만으로는 부족하다. Supabase는 public 스키마 함수의 EXECUTE를
-- anon·authenticated·service_role 에게 기본 권한으로 "명시적으로" 부여하므로 PUBLIC을
-- 걷어도 anon의 직접 부여분이 남는다(has_function_privilege('anon', ...) = true 로 확인됨).
-- T-104가 스키마 전체를 한 번 더 걷지만, security definer 함수를 anon이 호출할 수 있는
-- 상태로 두는 구간을 만들지 않는다.
revoke execute on function public.is_event_host(uuid) from anon;
revoke execute on function public.is_settlement_host(uuid) from anon;
