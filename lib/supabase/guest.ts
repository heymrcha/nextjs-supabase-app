import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * 게스트 경로 전용 클라이언트. `lib/supabase/{client,server,proxy}.ts`와 역할이 겹치지 않는다.
 *
 * `@supabase/ssr`이 아니라 `@supabase/supabase-js`를 쓰는 이유: 게스트는 로그인하지 않으므로
 * 세션 쿠키를 읽거나 쓸 일이 없다. SSR 클라이언트를 쓰면 쿠키 핸들러를 넘겨야 하는데
 * 그 쿠키는 이 경로에서 아무 의미가 없고, 세션이 있는 것처럼 오해하게 만든다.
 * (게스트 식별 쿠키 `moim_gk_*`는 Route Handler가 직접 다룬다 — `lib/moim/guest-cookie.ts`)
 *
 * `db.schema: "api"`가 핵심이다. 게스트 RPC는 `api` 스키마에만 있고 기본 스키마는 `public`인데,
 * `public`은 `anon`에게 usage조차 없다(T-104). 이 옵션이 REST 호출에
 * `Accept-Profile: api` / `Content-Profile: api` 헤더를 붙여 준다 — curl로 수동 검증할 때
 * 직접 넣어야 하는 그 헤더다.
 *
 * `persistSession: false`: 서버에서 매 요청마다 새로 만들고 버리므로 세션을 들고 있을 이유가 없다.
 */
export function createGuestClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "api" },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
