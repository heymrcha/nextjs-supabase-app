import Link from "next/link";
import { CalendarIcon, MapPinIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  formatKrw,
  RSVP_STATUS_EMOJI,
  RSVP_STATUS_TONE,
} from "@/lib/moim/format";
import { cn } from "@/lib/utils";
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
        className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-lg font-normal">{event.title}</h3>
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

        {/* 상태별 pill — 숫자·단어는 기존 문구 그대로, 색과 이모지만 얹는다 */}
        <ul className="flex flex-wrap gap-2 text-xs">
          <li
            className={cn(
              "rounded-full px-2.5 py-1 font-medium",
              RSVP_STATUS_TONE.attending,
            )}
          >
            <span aria-hidden>{RSVP_STATUS_EMOJI.attending} </span>
            참석 {event.counts.attending}명
            {event.capacity !== null && <> / 정원 {event.capacity}명</>}
          </li>
          <li
            className={cn("rounded-full px-2.5 py-1", RSVP_STATUS_TONE.maybe)}
          >
            <span aria-hidden>{RSVP_STATUS_EMOJI.maybe} </span>
            미정 {event.counts.maybe}명
          </li>
          <li
            className={cn(
              "rounded-full px-2.5 py-1",
              RSVP_STATUS_TONE.declined,
            )}
          >
            <span aria-hidden>{RSVP_STATUS_EMOJI.declined} </span>
            불참 {event.counts.declined}명
          </li>
        </ul>
      </Link>
    </li>
  );
}
