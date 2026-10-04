/**
 * 게스트가 링크로 들어오는 화면. 로그인하지 않은 사람이 보는 유일한 읽기 경로다.
 *
 * 공개 범위(PRD 8절): 명단은 참석·불참·미정 전원이 보이지만 **타인의 메모는 보이지 않고**
 * guest_key는 어디에도 나타나지 않는다. 그 차단은 `api.guest_get_event`가 payload 단계에서
 * 하므로(T-105) 이 화면은 받은 것을 그리기만 한다 — 화면에서 걸러 내는 구조가 아니다.
 *
 * 모든 출력은 React 기본 이스케이프에 맡기고 `dangerouslySetInnerHTML`을 쓰지 않는다.
 * 이름에 따옴표·역슬래시가 들어가도 깨지지 않아야 한다(PRD 4절 엣지 케이스).
 *
 * 여백은 `app/e/layout.tsx`가 책임진다 — 여기서 `px-*`를 다시 걸지 않는다.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarIcon, MapPinIcon, PinIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRsvpClosed } from "@/lib/moim/event-status";
import { findMyRsvp, loadGuestEvent } from "@/lib/moim/guest-event";
import {
  buildRoster,
  countRsvps,
  groupRosterByStatus,
  type RosterEntry,
} from "@/lib/moim/roster";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatKrw,
  RSVP_STATUS_EMOJI,
  RSVP_STATUS_LABEL,
  RSVP_STATUS_TONE,
} from "@/lib/moim/format";
import type {
  GuestEventPayload,
  GuestNotice,
  GuestRsvp,
  RsvpStatus,
} from "@/types/moim";

const STATUS_ORDER: RsvpStatus[] = ["attending", "maybe", "declined"];

async function GuestEvent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await loadGuestEvent(token);

  // EVENT_UNAVAILABLE(없음·삭제됨·만료됨)을 구분하지 않는다. redirect로 통일해
  // 같은 결과를 내게 한다 — 404와 200이 섞이면 토큰의 존재 여부가 새어 나간다.
  // redirect()는 예외를 throw하므로 try/catch로 감싸지 않는다.
  if (!payload) redirect("/e/expired");

  // 마감 판정은 서버에서 하고 결과만 내린다 — 렌더 본문에서 시계를 읽으면
  // react-hooks/purity에 걸리고 서버·클라이언트 시각 차이로 표시가 흔들린다
  // 표시 규칙도 시계를 읽는다(미정 기한 초과). 마감 판정과 같은 이유로 여기서 계산한다
  const roster = buildRoster(payload.rsvps, {
    capacity: payload.event.capacity,
    maybeDeadline: payload.event.maybe_deadline,
  });

  return (
    <GuestEventView
      token={token}
      payload={payload}
      roster={roster}
      isClosed={isRsvpClosed(payload.event.rsvp_closes_at)}
    />
  );
}

function GuestEventView({
  token,
  payload,
  roster,
  isClosed,
}: {
  token: string;
  payload: GuestEventPayload;
  roster: RosterEntry[];
  isClosed: boolean;
}) {
  const { event, notices, settlement } = payload;
  const mine = findMyRsvp(payload);

  return (
    <div className="flex flex-col gap-6">
      <EventHeader event={event} />
      <NoticeSection notices={notices} />
      <MyRsvpCard token={token} mine={mine} isClosed={isClosed} />
      <RosterTabs roster={roster} myRsvpId={mine?.id ?? null} />
      {settlement && <SettlementSection settlement={settlement} />}
    </div>
  );
}

function EventHeader({ event }: { event: GuestEventPayload["event"] }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-gradient-to-br from-primary/15 via-accent to-secondary p-5">
      <h1 className="break-words font-display text-3xl font-normal">
        {event.title}
      </h1>

      <dl className="flex flex-col gap-1 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <dt className="sr-only">일시</dt>
          <CalendarIcon size={14} className="mt-0.5 shrink-0" aria-hidden />
          <dd>{formatDateTime(event.starts_at)}</dd>
        </div>
        {event.location && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">장소</dt>
            <MapPinIcon size={14} className="mt-0.5 shrink-0" aria-hidden />
            {/* 장소는 길 수 있다. 좁은 폭에서 잘리지 않게 줄바꿈을 허용한다 */}
            <dd className="break-words">{event.location}</dd>
          </div>
        )}
        {event.capacity !== null && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">정원</dt>
            <UsersIcon size={14} className="mt-0.5 shrink-0" aria-hidden />
            <dd>정원 {event.capacity}명</dd>
          </div>
        )}
      </dl>

      {event.description && (
        <p className="whitespace-pre-wrap break-words text-sm">
          {event.description}
        </p>
      )}

      {event.rsvp_closes_at && (
        <p className="text-sm text-muted-foreground">
          응답 마감 {formatDateTime(event.rsvp_closes_at)}
        </p>
      )}
    </section>
  );
}

/**
 * 공지는 DB가 `is_pinned desc, created_at desc`로 정렬해 내려준다(T-105).
 * 여기서 다시 정렬하지 않는다 — 두 곳에서 정렬하면 규칙이 갈린다.
 *
 * 고정은 이벤트당 최대 1개다 — `event_notices_unpin_others` 트리거와 부분 유니크
 * 인덱스가 DB에서 보장하므로(T-402) `find`로 하나만 뽑아도 빠지는 공지가 없다.
 * 상단 고정 영역에 그 1개를 두고 나머지를 아래 목록으로 돌린다(T-403).
 */
function NoticeSection({ notices }: { notices: GuestNotice[] }) {
  if (notices.length === 0) return null;

  const pinned = notices.find((notice) => notice.is_pinned) ?? null;
  const rest = notices.filter((notice) => notice.id !== pinned?.id);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">공지</h2>
      {pinned && <NoticeCard notice={pinned} isPinned />}
      {rest.map((notice) => (
        <NoticeCard key={notice.id} notice={notice} isPinned={false} />
      ))}
    </section>
  );
}

/**
 * 고정 공지는 테두리와 배경으로만 구분한다. 글자 크기를 키우지 않는 이유는
 * 본문이 2000자까지 들어올 수 있어서다 — 긴 공지가 화면을 전부 먹는다.
 */
function NoticeCard({
  notice,
  isPinned,
}: {
  notice: GuestNotice;
  isPinned: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4",
        isPinned && "border-foreground bg-muted/30",
      )}
    >
      <div className="flex items-center gap-2">
        {isPinned && (
          <Badge variant="secondary" className="gap-1">
            <PinIcon size={12} aria-hidden />
            고정
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {formatDateTime(notice.created_at)}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{notice.body}</p>
    </article>
  );
}

/**
 * 내 응답 카드. `is_mine`은 2차 호출(쿠키 있는 경우)에서만 true가 되므로,
 * 응답했는데 이 카드가 "아직 응답하지 않았습니다"로 보이면 2차 호출 경로를 의심한다.
 *
 * 본인 메모를 보여주는 **유일한 게스트 화면**이다. 타인 메모는 payload에 아예 없다.
 *
 * 버튼 높이를 `h-11`(44px)로 올린 이유: 게스트 화면은 카카오톡 인앱 브라우저가 기본이고
 * shadcn 기본값 `h-9`(36px)는 권장 터치 영역에 미달한다.
 */
function MyRsvpCard({
  token,
  mine,
  isClosed,
}: {
  token: string;
  mine: GuestRsvp | null;
  isClosed: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium text-muted-foreground">내 응답</h2>

      {mine ? (
        <div className="flex flex-col gap-2">
          {/* Badge가 <div>를 렌더하므로 <p>로 감쌀 수 없다 — 중첩이 무효라 hydration 오류가 난다 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-medium">{mine.display_name}</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                RSVP_STATUS_TONE[mine.status],
              )}
            >
              <span aria-hidden>{RSVP_STATUS_EMOJI[mine.status]}&nbsp;</span>
              {RSVP_STATUS_LABEL[mine.status]}
            </span>
          </div>
          {mine.note && (
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {mine.note}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          아직 응답하지 않았습니다.
        </p>
      )}

      {isClosed ? (
        <p className="text-sm text-muted-foreground">
          응답이 마감되었습니다. 변경이 필요하면 주최자에게 알려 주세요.
        </p>
      ) : (
        <Button asChild className="h-11 w-full sm:w-fit">
          <Link href={`/e/${token}/respond`}>
            {mine ? "응답 수정하기" : "응답하기"}
          </Link>
        </Button>
      )}
    </section>
  );
}

/**
 * 명단 3탭. 표시 규칙(동명이인 번호 · 정원 초과 대기 순번 · 미정 기한 초과 배지)은
 * `lib/moim/roster.ts`가 계산한 결과를 그대로 그린다 — 주최자 화면(T-306)도 같은
 * 함수를 쓰므로 두 화면의 표시가 어긋나지 않는다.
 *
 * `TabsList`는 `inline-flex`라 넘쳐도 줄바꿈되지 않는다. `overflow-x-auto`를 걸어
 * 가로로 흘러가게 하면 좁은 폭에서도 탭 줄 높이가 변하지 않는다.
 */
function RosterTabs({
  roster,
  myRsvpId,
}: {
  roster: RosterEntry[];
  myRsvpId: string | null;
}) {
  const groups = groupRosterByStatus(roster);
  const counts = countRsvps(roster);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">참석 명단</h2>
      <Tabs defaultValue="attending">
        {/* 52px인 이유: TabsList의 p-[3px]과 트리거의 h-[calc(100%-1px)]를 빼면
            트리거 자체가 44px 이상이 되어야 터치 영역 기준을 만족한다.
            h-9는 group-data 변형이라 h-*로는 덮이지 않지만 min-height는 height를 이긴다 */}
        <TabsList className="min-h-[52px] w-full overflow-x-auto">
          {STATUS_ORDER.map((status) => (
            <TabsTrigger key={status} value={status}>
              <span aria-hidden>{RSVP_STATUS_EMOJI[status]}&nbsp;</span>
              {RSVP_STATUS_LABEL[status]} {counts[status]}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_ORDER.map((status) => (
          <TabsContent key={status} value={status}>
            <RosterList
              entries={groups[status]}
              status={status}
              myRsvpId={myRsvpId}
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function RosterList({
  entries,
  status,
  myRsvpId,
}: {
  entries: RosterEntry[];
  status: RsvpStatus;
  myRsvpId: string | null;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {RSVP_STATUS_LABEL[status]} 응답이 아직 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            "flex flex-wrap items-center gap-2 px-4 py-3 text-sm",
            // 정원 초과분은 거부하지 않고 회색으로 구분한다(PRD 4절)
            entry.isOverCapacity && "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
              RSVP_STATUS_TONE[status],
            )}
          >
            <span aria-hidden>{RSVP_STATUS_EMOJI[status]}&nbsp;</span>
            {RSVP_STATUS_LABEL[status]}
          </span>
          {/* 이름은 20자까지 자유 입력이다. 좁은 폭에서 넘치지 않게 break-all */}
          <span className="break-all">{entry.label}</span>
          {entry.id === myRsvpId && (
            <Badge variant="outline" className="shrink-0">
              나
            </Badge>
          )}
          {entry.waitlistNumber !== null && (
            <Badge variant="secondary" className="shrink-0">
              대기 {entry.waitlistNumber}번
            </Badge>
          )}
          {entry.isDeadlinePassed && (
            <Badge variant="outline" className="shrink-0">
              기한 초과
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * 정산 영역. `settlement`가 null이면(= 미공개) 이 컴포넌트 자체가 렌더되지 않는다 —
 * 공개 전에는 "정산 준비 중" 같은 흔적조차 남기지 않는다(T-505).
 * 타인의 분담금·입금 상태는 payload에 없다.
 */
function SettlementSection({
  settlement,
}: {
  settlement: NonNullable<GuestEventPayload["settlement"]>;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium text-muted-foreground">내 분담금</h2>

      {settlement.my_share ? (
        <div className="flex flex-col gap-2">
          {/* Badge가 <div>를 렌더하므로 <p>로 감쌀 수 없다 — 중첩이 무효라 hydration 오류가 난다 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold">
              {formatKrw(settlement.my_share.amount)}
            </span>
            <Badge
              variant={settlement.my_share.is_paid ? "secondary" : "outline"}
            >
              {settlement.my_share.is_paid ? "입금 완료" : "입금 전"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            전체 비용 {formatKrw(settlement.total)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          분담금 계산에 포함되지 않았습니다.
        </p>
      )}

      {settlement.bank_account && (
        <p className="whitespace-pre-wrap break-words text-sm">
          {settlement.bank_account}
        </p>
      )}
    </section>
  );
}

function GuestEventSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy role="status">
      <span className="sr-only">모임 정보를 불러오는 중입니다</span>
      <div className="h-24 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="h-28 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="h-40 animate-pulse rounded-lg bg-muted/40" aria-hidden />
    </div>
  );
}

/**
 * 페이지는 async가 아니고 params를 await하지 않는다. cacheComponents에서 동적 params는
 * 런타임 데이터라, 페이지에서 await하면 정적 셸을 만들지 못해 프리렌더가 실패한다.
 * params promise를 경계 안쪽으로 내려 거기서 await한다(`app/events/[id]/page.tsx`와 같은 패턴).
 */
export default function GuestEventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<GuestEventSkeleton />}>
      <GuestEvent params={params} />
    </Suspense>
  );
}
