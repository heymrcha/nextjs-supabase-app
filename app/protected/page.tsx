import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { InfoIcon } from "lucide-react";
import { Suspense } from "react";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  // proxy가 이미 막지만, 보호 페이지에서 한 번 더 확인하는 이중 안전장치
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return JSON.stringify(data.claims, null, 2);
}

export default function ProtectedPage() {
  return (
    <div className="flex w-full flex-1 flex-col gap-12">
      <div className="w-full">
        <div className="flex items-center gap-3 rounded-md bg-accent p-3 px-5 text-sm text-foreground">
          <InfoIcon size="16" strokeWidth={2} />
          로그인한 사용자만 볼 수 있는 페이지입니다
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <h2 className="mb-4 text-2xl font-bold">내 계정 정보</h2>
        <pre className="max-h-32 overflow-auto rounded border p-3 font-mono text-xs">
          <Suspense>
            <UserDetails />
          </Suspense>
        </pre>
      </div>
    </div>
  );
}
