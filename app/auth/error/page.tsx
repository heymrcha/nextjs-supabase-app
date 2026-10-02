import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

import { authErrorMessage } from "@/lib/moim/auth-errors";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        // 원문은 Supabase가 내려준 영어 메시지나 코드다. 그대로 보여 주지 않는다(T-602)
        <p className="text-sm text-muted-foreground">
          {authErrorMessage(
            new Error(params.error),
            "링크가 만료되었거나 이미 사용되었습니다. 다시 시도해 주세요.",
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          알 수 없는 오류가 발생했습니다.
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">문제가 발생했습니다</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
