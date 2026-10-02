/**
 * 명단 표시 규칙(PRD 4절). 게스트 화면과 주최자 화면이 **같은 함수**를 쓴다 —
 * 두 벌로 구현하면 같은 데이터가 화면마다 다른 순번·번호로 보이고, 어느 쪽이 맞는지
 * 판단할 근거가 없어진다.
 *
 * `RosterInput`에 `note`와 `guest_key`가 없는 것은 실수가 아니다. 이 파일은 게스트
 * 경로에서도 쓰이므로, 애초에 들어올 수 없는 필드를 타입에서 배제해 유출 경로를
 * 구조적으로 막는다(수정 사항 4).
 *
 * 모든 함수는 순수하고 `now`를 인자로 받는다. 테스트 스위트가 없으므로 최소한
 * 결정성은 확보한다 — 같은 입력에 같은 출력이면 브라우저 확인으로도 검증할 수 있다.
 */

import { isMaybeDeadlinePassed } from "@/lib/moim/event-status";
import type { RsvpStatus } from "@/types/moim";

/** DB 행에서 표시에 필요한 것만. 게스트 payload(`GuestRsvp`)가 그대로 들어맞는다 */
export type RosterInput = {
  id: string;
  display_name: string;
  status: RsvpStatus;
  responded_at: string;
};

export type RosterEntry = {
  id: string;
  /** 원본 이름. DB 값을 바꾸지 않는다 */
  displayName: string;
  /** 표시용 이름. 동명이인 2번째부터 ` (n)`이 붙는다 */
  label: string;
  status: RsvpStatus;
  /** 정원 초과분의 대기 순번(1부터). 초과가 아니면 null */
  waitlistNumber: number | null;
  isOverCapacity: boolean;
  /** 미정 확정 기한이 지났는지. **상태를 바꾸지 않고 배지만 붙인다** */
  isDeadlinePassed: boolean;
};

export type RsvpCounts = Record<RsvpStatus, number>;

/**
 * 표시용 명단을 만든다. 순서는 `responded_at` 오름차순 — 동명이인 번호와 대기 순번이
 * 모두 "먼저 응답한 사람이 앞"이라는 같은 기준을 쓴다.
 *
 * 동명이인 번호는 **상태와 무관하게 이벤트 전체에서** 센다. 참석한 김민수와 불참한
 * 김민수가 둘 다 `김민수`로 보이면 주최자가 누구에게 연락할지 알 수 없다.
 */
export function buildRoster(
  rsvps: RosterInput[],
  options: { capacity: number | null; maybeDeadline: string | null },
  now: Date = new Date(),
): RosterEntry[] {
  // 입력 배열을 건드리지 않는다. 호출부가 같은 배열을 다른 용도로도 쓴다
  const ordered = [...rsvps].sort((a, b) =>
    a.responded_at.localeCompare(b.responded_at),
  );

  const seenNames = new Map<string, number>();
  let attendingSeen = 0;

  return ordered.map((rsvp) => {
    const seen = (seenNames.get(rsvp.display_name) ?? 0) + 1;
    seenNames.set(rsvp.display_name, seen);

    let waitlistNumber: number | null = null;
    if (rsvp.status === "attending") {
      attendingSeen += 1;
      // 정원이 없으면 초과라는 개념 자체가 없다
      if (options.capacity !== null && attendingSeen > options.capacity) {
        waitlistNumber = attendingSeen - options.capacity;
      }
    }

    return {
      id: rsvp.id,
      displayName: rsvp.display_name,
      label: seen === 1 ? rsvp.display_name : `${rsvp.display_name} (${seen})`,
      status: rsvp.status,
      waitlistNumber,
      isOverCapacity: waitlistNumber !== null,
      /**
       * `maybe`에만 성립한다. 기한이 지나도 `attending`으로 자동 전환하지 않는다 —
       * 이것이 T-502의 정산 대상 조건을 `status = 'attending'` 하나로 단순화할 수 있는
       * 근거다(미정이 참석으로 바뀌지 않으므로 "기한 초과자 제외"가 자동 충족된다).
       */
      isDeadlinePassed:
        rsvp.status === "maybe" &&
        isMaybeDeadlinePassed(options.maybeDeadline, now),
    };
  });
}

/** 상태별로 가른다. 각 묶음의 순서는 `buildRoster`가 정한 응답 순서를 유지한다 */
export function groupRosterByStatus(
  entries: RosterEntry[],
): Record<RsvpStatus, RosterEntry[]> {
  const groups: Record<RsvpStatus, RosterEntry[]> = {
    attending: [],
    declined: [],
    maybe: [],
  };

  for (const entry of entries) {
    groups[entry.status].push(entry);
  }

  return groups;
}

/**
 * 상태별 인원 수. 대시보드(`/events`) · 개요(`/events/[id]`) · 명단 탭이 같은 수를 쓴다.
 * 원래 `lib/moim/dashboard.ts`에 있었는데, 집계는 대시보드 전용이 아니라 명단 규칙의
 * 일부라서 이곳으로 옮겼다.
 */
export function countRsvps(rsvps: { status: RsvpStatus }[]): RsvpCounts {
  const counts: RsvpCounts = { attending: 0, declined: 0, maybe: 0 };

  for (const rsvp of rsvps) {
    counts[rsvp.status] += 1;
  }

  return counts;
}
