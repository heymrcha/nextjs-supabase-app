-- Supabase 스타터 튜토리얼의 데모 테이블. 참조 코드는 T-001에서 삭제했고(app/instruments/),
-- 유입 FK·의존 뷰가 없으며 내용은 데모 데이터 3행(violin, viola, cello)뿐이다.
-- 남겨 두면 T-103의 "7개 테이블" 범위와 T-110의 보안 점검에서 노이즈가 된다.
drop table public.instruments;
