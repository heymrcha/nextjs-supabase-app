"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // 기본 높이는 36px이라 모바일 터치 영역 기준(44px)에 못 미친다(T-603)
  return (
    <Button onClick={logout} className="min-h-11">
      로그아웃
    </Button>
  );
}
