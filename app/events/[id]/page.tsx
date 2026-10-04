import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarIcon, MapPinIcon, PinIcon, UsersIcon } from "lucide-react";

import { ShareLinkCard } from "@/components/events/share-link-card";
import { Badge } from "@/components/ui/badge";
import { countRsvps, type RsvpCounts } from "@/lib/moim/roster";
import {
  formatDateTime,
  RSVP_STATUS_EMOJI,
  RSVP_STATUS_TONE,
} from "@/lib/moim/format";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

async function EventOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, description, location, starts_at, capacity, expected_headcount, rsvp_closes_at, maybe_deadline, share_token, share_expires_at, rsvps(status)",
    )
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();

  // RLS가 남의 이벤트에 0행을 주므로 "없음"과 "권한 없음"이 같은 화면이 된다.
  // 일부러 구분하지 않는다 — 구분하면 id의 존재 여부가 새어 나간다.
  if (!event) {
    notFound();
  }

  const counts = countRsvps(event.rsvps);

  const { data: notice } = await supabase
    .from("event_notices")
    .select("id, body, is_pinned, created_at")
    .eq("event_id", eventId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-normal">{event.title}</h1>

        <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt className="sr-only">일시</dt>
            <CalendarIcon size={14} aria-hidden />
            <dd>{formatDateTime(event.starts_at)}</dd>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">장소</dt>
              <MapPinIcon size={14} aria-hidden />
              <dd>{event.location}</dd>
            </div>
          )}
          {event.capacity !== null && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">정원</dt>
              <UsersIcon size={14} aria-hidden />
              <dd>정원 {event.capacity}명</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <p className="whitespace-pre-wrap text-sm">{event.description}</p>
        )}

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {event.rsvp_closes_at && (
            <span>응답 마감 {formatDateTime(event.rsvp_closes_at)}</span>
          )}
          {event.maybe_deadline && (
            <span>미정 확정 기한 {formatDateTime(event.maybe_deadline)}</span>
          )}
        </div>
      </section>

      <CounterRow counts={counts} />

      <ShareLinkCard
        eventId={event.id}
        shareToken={event.share_token}
        shareExpiresAt={event.share_expires_at}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">최신 공지</h2>
        {notice ? (
          <article className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              {notice.is_pinned && (
                <Badge variant="secondary" className="gap-1">
                  <PinIcon size={12} aria-hidden />
                  고정
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {formatDateTime(notice.created_at)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{notice.body}</p>
          </article>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            아직 공지가 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}

function CounterRow({ counts }: { counts: RsvpCounts }) {
  const items = [
    { label: "참석", value: counts.attending, status: "attending" as const },
    { label: "불참", value: counts.declined, status: "declined" as const },
    { label: "미정", value: counts.maybe, status: "maybe" as const },
  ];

  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex flex-col items-center gap-1 rounded-2xl p-4",
            RSVP_STATUS_TONE[item.status],
          )}
        >
          <dt className="text-sm">
            <span aria-hidden>{RSVP_STATUS_EMOJI[item.status]} </span>
            {item.label}
          </dt>
          <dd className="text-2xl font-bold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy role="status">
      <span className="sr-only">모임 정보를 불러오는 중입니다</span>
      <div className="h-24 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="grid grid-cols-3 gap-3" aria-hidden>
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="h-20 animate-pulse rounded-lg bg-muted/40"
          />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-muted/40" aria-hidden />
    </div>
  );
}

/**
 * 페이지는 async가 아니고 params를 await하지 않는다. cacheComponents에서 동적
 * params는 런타임 데이터라, 페이지에서 await하면 정적 셸을 못 만들고 프리렌더가
 * `uncached or runtime data` 오류로 실패한다. params promise를 그대로 경계 안쪽으로
 * 내려 보내 거기서 await한다(Next.js 16 캐싱 문서의 권장 패턴).
 */
export default function EventOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <EventOverview params={params} />
    </Suspense>
  );
}
