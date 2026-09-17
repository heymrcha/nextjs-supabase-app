import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Vercel 등 프록시 뒤에서는 origin이 내부 호스트를 가리키므로 x-forwarded-host를 우선한다
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (!isLocalEnv && forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}/protected`);
      }
      return NextResponse.redirect(`${origin}/protected`);
    }
  }

  // 동의 화면에서 취소한 경우(code 없음)와 코드 교환 실패 모두 여기로 온다
  const message = encodeURIComponent(
    "Google 로그인에 실패했습니다. 다시 시도해 주세요.",
  );
  return NextResponse.redirect(`${origin}/auth/error?error=${message}`);
}
