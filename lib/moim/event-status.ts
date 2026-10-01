/**
 * 이벤트의 시각 기반 상태 판정. 한 곳에만 둔다 — 같은 질문("마감인가?")을 화면마다
 * 다시 구현하면 경계 조건이 조금씩 어긋난다.
 *
 * 판정은 **서버에서 하고 결과를 prop으로 내린다.** 클라이언트 컴포넌트의 렌더 본문에서
 * 시계를 읽으면 `react-hooks/purity`에 걸리고, 서버와 클라이언트의 시각이 달라
 * hydration도 흔들린다.
 */

/** 마감 시각이 없으면 열려 있다. 경계(정확히 같은 시각)는 마감으로 본다 */
export function isRsvpClosed(
  rsvpClosesAt: string | null,
  now: Date = new Date(),
): boolean {
  if (rsvpClosesAt === null) {
    return false;
  }

  return new Date(rsvpClosesAt).getTime() <= now.getTime();
}

/**
 * 미정 확정 기한이 지났는지. 지나도 상태를 자동 전환하지 않고 배지만 붙인다(T-305).
 */
export function isMaybeDeadlinePassed(
  maybeDeadline: string | null,
  now: Date = new Date(),
): boolean {
  if (maybeDeadline === null) {
    return false;
  }

  return new Date(maybeDeadline).getTime() <= now.getTime();
}
