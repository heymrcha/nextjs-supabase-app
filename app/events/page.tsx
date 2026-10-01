import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarPlusIcon } from "lucide-react";

import { EventListItem } from "@/components/events/event-list-item";
import { Button } from "@/components/ui/button";
import { groupByTime, toDashboardEvent } from "@/lib/moim/dashboard";
import { createClient } from "@/lib/supabase/server";

/**
 * 인원 요약과 미수금을 중첩 select 한 번으로 가져온다. 이벤트마다 추가 질의를 보내면
 * N+1이 되고, 집계 뷰를 따로 두기에는 MVP 규모(주최자 1명당 이벤트 수십 건, 이벤트당
 * 응답 수십 건)에서 얻을 것이 없다. 행이 늘어 느려지면 그때 뷰로 옮긴다.
 *
 * deleted_at이 있는 행은 제외한다 — 소프트 삭제는 주최자에게도 삭제로 보여야 한다.
 */
const EVENT_SELECT =
  "id, title, location, starts_at, capacity, rsvps(status), settlements(settlement_shares(amount, is_paid))";

async function EventList() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  // proxy가 이미 막지만, 데이터를 읽기 직전에 한 번 더 확인하는 이중 안전장치
  if (claimsError || !claims?.claims) {
    redirect("/auth/login");
  }

  // host_id 조건을 걸지 않는다. events_host_all 정책이 host_id = auth.uid()로
  // 이미 거르므로, 여기서 또 거는 것은 RLS가 동작하지 않을 때를 가정하는 셈이 된다
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false });

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
        모임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const events = data.map(toDashboardEvent);

  if (events.length === 0) {
    return <EmptyState />;
  }

  const { upcoming, past } = groupByTime(events);

  return (
    <div className="flex flex-col gap-8">
      <EventSection
        title="다가오는 모임"
        events={upcoming}
        emptyText="예정된 모임이 없습니다."
      />
      <EventSection
        title="지난 모임"
        events={past}
        emptyText="지난 모임이 없습니다."
      />
    </div>
  );
}

function EventSection({
  title,
  events,
  emptyText,
}: {
  title: string;
  events: ReturnType<typeof toDashboardEvent>[];
  emptyText: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} {events.length > 0 && `(${events.length})`}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <EventListItem key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-10 text-center">
      <CalendarPlusIcon
        size={32}
        className="text-muted-foreground"
        aria-hidden
      />
      <div className="flex flex-col gap-1">
        <p className="font-medium">아직 만든 모임이 없습니다</p>
        <p className="text-sm text-muted-foreground">
          모임을 만들면 링크 하나로 공지와 참석 집계, 비용 정산을 끝낼 수
          있습니다.
        </p>
      </div>
      <Button asChild>
        <Link href="/events/new">첫 모임 만들기</Link>
      </Button>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="h-28 animate-pulse rounded-lg border bg-muted/40"
        />
      ))}
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">내 모임</h1>
        <Button asChild>
          <Link href="/events/new">모임 만들기</Link>
        </Button>
      </div>

      {/* cacheComponents: true라 데이터를 읽는 부분은 페이지에서 직접 await하지 않는다 */}
      <Suspense fallback={<EventListSkeleton />}>
        <EventList />
      </Suspense>
    </div>
  );
}
