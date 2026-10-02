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

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarIcon, MapPinIcon, PinIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRsvpClosed } from "@/lib/moim/event-status";
import {
  formatDateTime,
  formatKrw,
  RSVP_STATUS_LABEL,
} from "@/lib/moim/format";
import { parseGuestEventPayload } from "@/lib/moim/guest-payload";
import { readGuestKey } from "@/lib/moim/guest-cookie";
import { createGuestClient } from "@/lib/supabase/guest";
import type {
  GuestEventPayload,
  GuestNotice,
  GuestRpcArgs,
  GuestRsvp,
  RsvpStatus,
} from "@/types/moim";

const STATUS_ORDER: RsvpStatus[] = ["attending", "maybe", "declined"];

async function GuestEvent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createGuestClient();

  /**
   * 2단 호출이 D1(쿠키 이름을 event_id 기반으로 유지)의 대가다. 쿠키 이름을 만들려면
   * event_id가 필요하고, 게스트 경로는 token만 안다 — 그래서 1차는 키 없이 불러 event_id를
   * 얻고, 쿠키가 있을 때만 2차로 본인 표시를 채운다. 쿠키 이름을 token 기반으로 바꾸는
   * 대안은 share_token 재발급(T-205)이 쿠키를 고아로 만들어 "재발급 후에도 기존 응답은
   * 유지한다"는 결정과 충돌해서 택하지 않았다.
   *
   * 최초 방문자(가장 흔한 경로)는 1회로 끝나고, `guest_get_event`는 stable이라
   * 재방문자의 2회도 단발 모임 규모에서는 무해하다.
   */
  const firstArgs: GuestRpcArgs["guest_get_event"] = {
    p_token: token,
    p_guest_key: null,
  };
  const first = await supabase.rpc("guest_get_event", firstArgs);

  // EVENT_UNAVAILABLE(없음·삭제됨·만료됨)을 구분하지 않는다. redirect로 통일해
  // 상태 코드까지 같게 만든다 — 404와 200이 섞이면 토큰의 존재 여부가 새어 나간다.
  // redirect()는 예외를 throw하므로 try/catch로 감싸지 않는다.
  if (first.error) redirect("/e/expired");

  let payload = parseGuestEventPayload(first.data);
  if (!payload) redirect("/e/expired");

  const guestKey = readGuestKey(await cookies(), payload.event.id);
  if (guestKey) {
    const secondArgs: GuestRpcArgs["guest_get_event"] = {
      p_token: token,
      p_guest_key: guestKey,
    };
    const second = await supabase.rpc("guest_get_event", secondArgs);
    // 2차가 실패해도 화면은 1차 결과로 그린다. 본인 표시만 빠지고 읽기는 된다
    const refreshed = second.error ? null : parseGuestEventPayload(second.data);
    if (refreshed) payload = refreshed;
  }

  // 마감 판정은 서버에서 하고 결과만 내린다 — 렌더 본문에서 시계를 읽으면
  // react-hooks/purity에 걸리고 서버·클라이언트 시각 차이로 표시가 흔들린다
  return (
    <GuestEventView
      token={token}
      payload={payload}
      isClosed={isRsvpClosed(payload.event.rsvp_closes_at)}
    />
  );
}

function GuestEventView({
  token,
  payload,
  isClosed,
}: {
  token: string;
  payload: GuestEventPayload;
  isClosed: boolean;
}) {
  const { event, notices, rsvps, settlement } = payload;
  const mine = rsvps.find((rsvp) => rsvp.is_mine) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <EventHeader event={event} />
      <NoticeSection notices={notices} />
      <MyRsvpCard token={token} mine={mine} isClosed={isClosed} />
      <RosterTabs rsvps={rsvps} />
      {settlement && (
        <SettlementSection
          settlement={settlement}
          bankAccount={event.bank_account}
        />
      )}
    </div>
  );
}

function EventHeader({ event }: { event: GuestEventPayload["event"] }) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{event.title}</h1>

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
 * 고정 공지를 상단 영역으로 분리하는 작업은 T-403이다.
 */
function NoticeSection({ notices }: { notices: GuestNotice[] }) {
  if (notices.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">공지</h2>
      {notices.map((notice) => (
        <article
          key={notice.id}
          className="flex flex-col gap-2 rounded-lg border p-4"
        >
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
          <p className="whitespace-pre-wrap break-words text-sm">
            {notice.body}
          </p>
        </article>
      ))}
    </section>
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
          <p className="flex flex-wrap items-center gap-2">
            <span className="break-all font-medium">{mine.display_name}</span>
            <Badge variant="secondary">{RSVP_STATUS_LABEL[mine.status]}</Badge>
          </p>
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
 * 명단 3탭. 표시 규칙(동명이인 번호·정원 초과 대기 순번·미정 기한 초과 배지)은
 * T-305의 `lib/moim/roster.ts`가 맡는다 — 여기서는 상태별 분류와 자리만 잡는다.
 *
 * `TabsList`는 `inline-flex`라 넘쳐도 줄바꿈되지 않는다. `overflow-x-auto`를 걸어
 * 가로로 흘러가게 하면 좁은 폭에서도 탭 줄 높이가 변하지 않는다.
 */
function RosterTabs({ rsvps }: { rsvps: GuestRsvp[] }) {
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
              {RSVP_STATUS_LABEL[status]}{" "}
              {rsvps.filter((rsvp) => rsvp.status === status).length}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_ORDER.map((status) => (
          <TabsContent key={status} value={status}>
            <RosterList
              rsvps={rsvps.filter((rsvp) => rsvp.status === status)}
              status={status}
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function RosterList({
  rsvps,
  status,
}: {
  rsvps: GuestRsvp[];
  status: RsvpStatus;
}) {
  if (rsvps.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {RSVP_STATUS_LABEL[status]} 응답이 아직 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {rsvps.map((rsvp) => (
        <li
          key={rsvp.id}
          className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
        >
          {/* 이름은 20자까지 자유 입력이다. 좁은 폭에서 넘치지 않게 break-all */}
          <span className="break-all">{rsvp.display_name}</span>
          {rsvp.is_mine && (
            <Badge variant="outline" className="shrink-0">
              나
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
  bankAccount,
}: {
  settlement: NonNullable<GuestEventPayload["settlement"]>;
  bankAccount: string | null;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium text-muted-foreground">내 분담금</h2>

      {settlement.my_share ? (
        <div className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold">
              {formatKrw(settlement.my_share.amount)}
            </span>
            <Badge
              variant={settlement.my_share.is_paid ? "secondary" : "outline"}
            >
              {settlement.my_share.is_paid ? "입금 완료" : "입금 전"}
            </Badge>
          </p>
          <p className="text-sm text-muted-foreground">
            전체 비용 {formatKrw(settlement.total)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          분담금 계산에 포함되지 않았습니다.
        </p>
      )}

      {bankAccount && (
        <p className="whitespace-pre-wrap break-words text-sm">{bankAccount}</p>
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
