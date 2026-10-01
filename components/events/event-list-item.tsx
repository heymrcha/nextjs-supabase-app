import Link from "next/link";
import { CalendarIcon, MapPinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatKrw } from "@/lib/moim/format";
import type { DashboardEvent } from "@/lib/moim/dashboard";

/**
 * 대시보드의 이벤트 한 줄. 행 전체가 링크다 — 좁은 화면에서 작은 링크를 겨냥하는 것보다
 * 행 전체를 누르는 쪽이 쉽다.
 */
export function EventListItem({ event }: { event: DashboardEvent }) {
  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-medium">{event.title}</h3>
          {event.hasSettlement && (
            <Badge variant={event.unpaidTotal > 0 ? "destructive" : "outline"}>
              {event.unpaidTotal > 0
                ? `미수금 ${formatKrw(event.unpaidTotal)}`
                : "정산 완료"}
            </Badge>
          )}
        </div>

        <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt className="sr-only">일시</dt>
            <CalendarIcon size={14} aria-hidden />
            <dd>{formatDateTime(event.startsAt)}</dd>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">장소</dt>
              <MapPinIcon size={14} aria-hidden />
              <dd>{event.location}</dd>
            </div>
          )}
        </dl>

        <p className="text-sm">
          <span className="font-medium">참석 {event.counts.attending}명</span>
          {event.capacity !== null && (
            <span className="text-muted-foreground">
              {" "}
              / 정원 {event.capacity}명
            </span>
          )}
          <span className="text-muted-foreground">
            {" · "}불참 {event.counts.declined}명 · 미정 {event.counts.maybe}명
          </span>
        </p>
      </Link>
    </li>
  );
}
