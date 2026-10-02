/**
 * 주최자의 응답 관리. **메모(`note`)와 변경 이력이 보이는 유일한 화면**이다
 * (수정 사항 4 · PRD 8절). 게스트 경로는 본인 메모만 받고 이력은 전혀 받지 않는다.
 *
 * 표시 규칙은 `lib/moim/roster.ts`로 계산한다 — 게스트 명단과 같은 함수를 쓰므로
 * 같은 데이터가 두 화면에서 다른 순번·번호로 보이지 않는다.
 */

import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  RsvpManager,
  type ManagedRsvp,
} from "@/components/events/rsvp-manager";
import type { RsvpChange } from "@/components/events/rsvp-timeline";
import { buildRoster } from "@/lib/moim/roster";
import { createClient } from "@/lib/supabase/server";

async function EventResponses({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, capacity, maybe_deadline, rsvps(id, display_name, status, note, responded_at)",
    )
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();

  // RLS가 남의 이벤트에 0행을 주므로 "없음"과 "권한 없음"이 같은 화면이 된다(의도)
  if (!event) {
    notFound();
  }

  /**
   * 이력은 `rsvp_id`가 아니라 `event_id`로 한 번에 읽는다. 행마다 조회하면 응답 수만큼
   * 왕복이 늘고(N+1), 삭제된 응답의 이력(`rsvp_id`가 null)도 같은 쿼리에 들어온다 —
   * 지금은 쓰지 않지만 "이력은 남는다"는 사실을 확인할 수 있는 자리다.
   */
  const { data: changes } = await supabase
    .from("rsvp_changes")
    .select("rsvp_id, from_status, to_status, from_name, to_name, changed_at")
    .eq("event_id", eventId)
    .order("changed_at", { ascending: true });

  const changesByRsvp = new Map<string, RsvpChange[]>();
  for (const change of changes ?? []) {
    if (change.rsvp_id === null) continue;
    const list = changesByRsvp.get(change.rsvp_id) ?? [];
    list.push(change);
    changesByRsvp.set(change.rsvp_id, list);
  }

  const roster = buildRoster(event.rsvps, {
    capacity: event.capacity,
    maybeDeadline: event.maybe_deadline,
  });

  // note는 roster 입력 타입에 없다(게스트 경로와 공유하는 파일이므로 일부러 뺐다).
  // 여기서 rsvp id로 다시 붙인다
  const noteById = new Map(event.rsvps.map((rsvp) => [rsvp.id, rsvp.note]));
  const respondedAtById = new Map(
    event.rsvps.map((rsvp) => [rsvp.id, rsvp.responded_at]),
  );

  const managed: ManagedRsvp[] = roster.map((entry) => ({
    id: entry.id,
    label: entry.label,
    status: entry.status,
    note: noteById.get(entry.id) ?? null,
    respondedAt: respondedAtById.get(entry.id) ?? "",
    waitlistNumber: entry.waitlistNumber,
    isOverCapacity: entry.isOverCapacity,
    isDeadlinePassed: entry.isDeadlinePassed,
    changes: changesByRsvp.get(entry.id) ?? [],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">응답 관리</h1>
        <p className="text-sm text-muted-foreground">
          메모와 변경 이력은 주최자인 나에게만 보입니다. 행을 누르면 이력이
          펼쳐집니다.
        </p>
      </div>

      {event.rsvps.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          아직 응답이 없습니다. 공유 링크를 보내 참석 여부를 받아 보세요.
        </p>
      ) : (
        <RsvpManager rsvps={managed} capacity={event.capacity} />
      )}
    </div>
  );
}

function ResponsesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy role="status">
      <span className="sr-only">응답을 불러오는 중입니다</span>
      <div className="h-16 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="h-52 animate-pulse rounded-lg bg-muted/40" aria-hidden />
    </div>
  );
}

/**
 * 페이지는 async가 아니고 params를 await하지 않는다 — cacheComponents에서 동적 params를
 * 페이지가 await하면 정적 셸을 만들지 못한다(`app/events/[id]/page.tsx`와 같은 패턴).
 */
export default function EventResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ResponsesSkeleton />}>
      <EventResponses params={params} />
    </Suspense>
  );
}
