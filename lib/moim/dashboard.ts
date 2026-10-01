/**
 * `/events` 대시보드가 쓰는 집계·분류 로직. 화면에서 분리해 둔 이유는 Supabase 응답
 * 모양과 표시 규칙을 떼어 놓기 위해서다 — 나중에 집계를 DB 뷰로 옮겨도 화면은 그대로다.
 *
 * 분담금을 여기서 계산하지 않는다. 1인당 금액 산출은 `lib/moim/settlement.ts`(T-502)의
 * 몫이고, 이 파일은 `settlement_shares`에 이미 스냅샷으로 저장된 금액을 더하기만 한다.
 * 같은 수를 두 곳에서 따로 구하면 대시보드 배지와 정산 화면이 어긋난다.
 */

import type { RsvpStatus } from "@/types/moim";

/** Supabase 중첩 select가 내려주는 모양. 필요한 컬럼만 좁게 받는다 */
export type DashboardEventRow = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  capacity: number | null;
  rsvps: { status: RsvpStatus }[];
  /**
   * 이벤트당 정산은 0개 또는 1개다(T-102의 `settlements.event_id` UNIQUE). 그래서
   * supabase-js가 배열이 아니라 단일 객체 또는 null로 추론한다 — 유니크 제약을 풀면
   * 이 타입이 배열로 바뀌므로 생성 타입을 다시 확인해야 한다.
   */
  settlements: {
    settlement_shares: { amount: number; is_paid: boolean }[];
  } | null;
};

export type RsvpCounts = {
  attending: number;
  declined: number;
  maybe: number;
};

export type DashboardEvent = {
  id: string;
  title: string;
  location: string | null;
  startsAt: string;
  capacity: number | null;
  counts: RsvpCounts;
  /** 미입금 분담금 합계. 정산 스냅샷이 없으면 0 */
  unpaidTotal: number;
  /** 정산 스냅샷이 만들어졌는지. 0원과 "아직 정산 안 함"을 구분하려고 둔다 */
  hasSettlement: boolean;
};

export type DashboardGroups = {
  upcoming: DashboardEvent[];
  past: DashboardEvent[];
};

export function countRsvps(rsvps: { status: RsvpStatus }[]): RsvpCounts {
  const counts: RsvpCounts = { attending: 0, declined: 0, maybe: 0 };

  for (const rsvp of rsvps) {
    counts[rsvp.status] += 1;
  }

  return counts;
}

export function toDashboardEvent(row: DashboardEventRow): DashboardEvent {
  const shares = row.settlements?.settlement_shares ?? [];

  return {
    id: row.id,
    title: row.title,
    location: row.location,
    startsAt: row.starts_at,
    capacity: row.capacity,
    counts: countRsvps(row.rsvps),
    unpaidTotal: shares
      .filter((share) => !share.is_paid)
      .reduce((sum, share) => sum + share.amount, 0),
    hasSettlement: shares.length > 0,
  };
}

/**
 * 시작 시각 기준으로 다가오는 모임과 지난 모임을 가른다.
 *
 * 다가오는 모임은 가까운 순(오름차순), 지난 모임은 최근 순(내림차순)이다. 주최자가
 * 다음에 할 일은 가장 임박한 모임에 있고, 돌아볼 일은 가장 최근에 끝난 모임에 있다.
 */
export function groupByTime(
  events: DashboardEvent[],
  now: Date = new Date(),
): DashboardGroups {
  const nowMs = now.getTime();
  const upcoming: DashboardEvent[] = [];
  const past: DashboardEvent[] = [];

  for (const event of events) {
    if (new Date(event.startsAt).getTime() >= nowMs) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  }

  upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  past.sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return { upcoming, past };
}
