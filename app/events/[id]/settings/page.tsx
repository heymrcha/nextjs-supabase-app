import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EventDangerZone } from "@/components/events/event-danger-zone";
import { EventForm } from "@/components/events/event-form";
import { isRsvpClosed } from "@/lib/moim/event-status";
import { createClient } from "@/lib/supabase/server";

async function EventSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, description, location, starts_at, capacity, expected_headcount, rsvp_closes_at, maybe_deadline, bank_account",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  // 개요(T-204)와 같은 규칙 — 없음과 권한 없음을 구분하지 않는다
  if (!event) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">모임 설정</h1>
        {/* 생성 폼을 그대로 재사용한다. 필드 정의가 두 벌로 갈라지지 않는다 */}
        <EventForm defaults={event} />
      </section>

      <EventDangerZone
        eventId={event.id}
        title={event.title}
        rsvpClosesAt={event.rsvp_closes_at}
        isClosed={isRsvpClosed(event.rsvp_closes_at)}
      />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="h-16 animate-pulse rounded-lg bg-muted/40" />
      ))}
    </div>
  );
}

// params를 페이지에서 await하지 않는다(T-204와 같은 이유 — cacheComponents 프리렌더)
export default function EventSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <EventSettings params={params} />
    </Suspense>
  );
}
