import type { Database } from "@/types/database";
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // 생성 타입을 붙여 .from()·.select()가 컬럼 단위로 검사되게 한다.
  // 타입이 낡으면 unknown 캐스팅과 any가 슬금슬금 들어온다(스키마 변경 시 재생성).
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
