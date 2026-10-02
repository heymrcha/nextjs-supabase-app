/**
 * 주최자의 공지 관리(T-401). 공지는 게스트에게 그대로 보이는 유일한 주최자 입력이다
 * (`/e/[token]`의 고정 영역 + 목록, T-403).
 *
 * 정렬은 `api.guest_get_event`가 게스트에게 쓰는 것과 **같은 규칙**(`is_pinned desc,
 * created_at desc`)을 쓴다. 두 화면이 다른 순서를 보여 주면 고정이 먹었는지 확인할 수 없다.
 */

import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  NoticeManager,
  type ManagedNotice,
} from "@/components/events/notice-manager";
import { createClient } from "@/lib/supabase/server";

async function EventNotices({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createClient();

  // RLS가 남의 이벤트에 0행을 주므로 "없음"과 "권한 없음"이 같은 화면이 된다(의도)
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const { data: notices } = await supabase
    .from("event_notices")
    .select("id, body, is_pinned, created_at")
    .eq("event_id", eventId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const managed: ManagedNotice[] = notices ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">공지</h1>
        <p className="text-sm text-muted-foreground">
          고정한 공지 1개가 공유 링크 페이지 맨 위에 걸립니다. 다른 공지를
          고정하면 기존 고정은 자동으로 풀립니다.
        </p>
      </div>

      <NoticeManager eventId={event.id} notices={managed} />
    </div>
  );
}

function NoticesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy role="status">
      <span className="sr-only">공지를 불러오는 중입니다</span>
      <div className="h-16 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="h-44 animate-pulse rounded-lg bg-muted/40" aria-hidden />
    </div>
  );
}

/**
 * 페이지는 async가 아니고 params를 await하지 않는다 — cacheComponents에서 동적 params를
 * 페이지가 await하면 정적 셸을 만들지 못한다(`app/events/[id]/responses/page.tsx`와 같은 패턴).
 */
export default function EventNoticesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<NoticesSkeleton />}>
      <EventNotices params={params} />
    </Suspense>
  );
}
