import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      {displayName(user)}님
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">로그인</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">가입</Link>
      </Button>
    </div>
  );
}

/**
 * 카카오 로그인은 비즈 앱이 아니면 이메일 동의를 받을 수 없어 email이 비어 있을 수 있다.
 * 그때는 카카오 닉네임(user_metadata)으로, 그것도 없으면 일반 호칭으로 떨어진다.
 */
function displayName(claims: {
  email?: string;
  user_metadata?: unknown;
}): string {
  if (claims.email) return claims.email;

  const metadata = claims.user_metadata;
  if (typeof metadata === "object" && metadata !== null) {
    for (const key of ["name", "full_name", "preferred_username"]) {
      const value = (metadata as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return "회원";
}
