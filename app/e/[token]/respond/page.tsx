/**
 * 게스트 응답 폼 페이지. 데이터는 `/e/[token]`과 같은 `loadGuestEvent`로 읽는다 —
 * 폼을 위해 RPC를 따로 부르지 않는다.
 *
 * 마감 판정을 여기서 하지만 **최종 방어선은 DB**다(`api.guest_submit_rsvp`가
 * `RSVP_CLOSED`를 올린다). 폼을 숨기는 것은 사용자 편의이고, 막는 것은 서버의 일이다.
 *
 * 여백은 `app/e/layout.tsx`가 책임진다 — 여기서 `px-*`를 다시 걸지 않는다.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeftIcon } from "lucide-react";

import { GuestRsvpForm } from "@/components/guest/rsvp-form";
import { Button } from "@/components/ui/button";
import { isRsvpClosed } from "@/lib/moim/event-status";
import { formatDateTime } from "@/lib/moim/format";
import { findMyRsvp, loadGuestEvent } from "@/lib/moim/guest-event";

async function GuestRespond({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await loadGuestEvent(token);

  // 없음·삭제됨·만료됨을 구분하지 않는다(T-303과 같은 처리)
  if (!payload) redirect("/e/expired");

  const { event } = payload;
  const mine = findMyRsvp(payload);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="h-11 gap-1 self-start px-2">
          <Link href={`/e/${token}`}>
            <ChevronLeftIcon size={16} aria-hidden />
            모임으로 돌아가기
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {mine ? "응답 수정" : "참석 여부 응답"}
        </h1>
        <p className="break-words text-sm text-muted-foreground">
          {event.title} · {formatDateTime(event.starts_at)}
        </p>
      </div>

      {isRsvpClosed(event.rsvp_closes_at) ? (
        <section className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
          <h2 className="font-medium">응답이 마감되었습니다</h2>
          <p className="text-sm text-muted-foreground">
            {event.rsvp_closes_at &&
              `${formatDateTime(event.rsvp_closes_at)}에 마감되었습니다. `}
            변경이 필요하면 주최자에게 알려 주세요. 명단은 계속 볼 수 있습니다.
          </p>
        </section>
      ) : (
        <GuestRsvpForm
          token={token}
          eventId={event.id}
          defaults={
            mine
              ? {
                  display_name: mine.display_name,
                  status: mine.status,
                  note: mine.note,
                }
              : null
          }
          // 본인 행은 제외한다. 응답을 고치면서 이름을 그대로 두는 것은 충돌이 아니다
          otherNames={payload.rsvps
            .filter((rsvp) => !rsvp.is_mine)
            .map((rsvp) => rsvp.display_name)}
        />
      )}
    </div>
  );
}

function RespondSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy role="status">
      <span className="sr-only">응답 폼을 불러오는 중입니다</span>
      <div className="h-20 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="h-48 animate-pulse rounded-lg bg-muted/40" aria-hidden />
    </div>
  );
}

/**
 * 페이지는 async가 아니고 params를 await하지 않는다 — cacheComponents에서 동적 params를
 * 페이지가 await하면 정적 셸을 만들지 못한다(`app/e/[token]/page.tsx`와 같은 패턴).
 */
export default function GuestRespondPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<RespondSkeleton />}>
      <GuestRespond params={params} />
    </Suspense>
  );
}
