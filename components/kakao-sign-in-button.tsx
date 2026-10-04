"use client";

import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/moim/auth-errors";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function KakaoSignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    // 콜백은 Google과 같은 /auth/callback을 쓴다 — code 교환은 provider와 무관하다
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    // 성공하면 브라우저가 카카오로 이동하므로 로딩 상태를 되돌릴 필요가 없다
    if (error) {
      setError(authErrorMessage(error, "카카오 로그인을 시작하지 못했습니다"));
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 카카오 로그인 디자인 가이드의 고정 색(#FEE500 배경, 85% 검정 글자)이라 테마 토큰을 쓰지 않는다 */}
      <Button
        type="button"
        className="w-full bg-[#FEE500] text-black/85 hover:bg-[#FEE500]/90"
        onClick={handleClick}
        disabled={isLoading}
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            fill="#000"
            d="M12 3C6.48 3 2 6.54 2 10.9c0 2.82 1.88 5.3 4.7 6.7l-.96 3.53c-.08.31.27.56.54.38l4.2-2.78c.5.06 1 .1 1.52.1 5.52 0 10-3.54 10-7.93S17.52 3 12 3z"
          />
        </svg>
        {isLoading ? "이동 중…" : "카카오로 계속하기"}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
