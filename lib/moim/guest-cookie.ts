import type { NextResponse } from "next/server";

/**
 * 게스트 식별 쿠키(PRD 7.5). 이름 규칙·속성과 읽기·발급 로직이 모두 여기 모인다.
 *
 * 쿠키에는 guest_key(uuid v4)만 담는다 — 이름·연락처는 넣지 않고 서버가 키로 조회한다.
 * guest_key는 비밀이 아니므로 서명하지 않는다(탈취돼도 그 이벤트의 한 응답만 수정할 수
 * 있고 명단은 어차피 전원 공개다). 대신 Route Handler가 body의 guest_key를 무시하고
 * 항상 쿠키 값만 쓰는 것으로 막는다.
 */

const GUEST_COOKIE_PREFIX = "moim_gk_";

/** 180일 */
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/**
 * 이벤트별로 쿠키를 분리해 한 이벤트의 키가 다른 이벤트의 응답을 건드리지 못하게 한다.
 * event_id 앞 8자(uuid의 32비트)만 쓰므로 이론상 충돌이 가능하지만,
 * 한 브라우저가 수만 개 이벤트에 응답하는 상황은 이 제품에 없다.
 */
export function guestCookieName(eventId: string): string {
  return `${GUEST_COOKIE_PREFIX}${eventId.slice(0, 8)}`;
}

export const GUEST_COOKIE_OPTIONS = {
  httpOnly: true,
  // 로컬 개발은 http라 secure 쿠키가 브라우저에 저장되지 않는다. true로 고정하면
  // 응답 수정 프리필(T-304)이 원인 불명으로 비어 보인다
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: GUEST_COOKIE_MAX_AGE,
} as const;

/**
 * `next/headers`의 `cookies()`와 `NextRequest.cookies`는 타입이 다르지만
 * 여기서 필요한 것은 `get(name)`뿐이다. 공통 부분만 요구해 Server Component와
 * Route Handler가 같은 읽기 함수를 쓰게 한다.
 */
export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
}

/** 해당 이벤트의 guest_key를 읽는다. 최초 방문이면 null. */
export function readGuestKey(
  store: CookieStoreLike,
  eventId: string,
): string | null {
  return store.get(guestCookieName(eventId))?.value ?? null;
}

export function issueGuestKey(): string {
  return crypto.randomUUID();
}

export function setGuestKeyCookie(
  res: NextResponse,
  eventId: string,
  key: string,
): void {
  res.cookies.set(guestCookieName(eventId), key, GUEST_COOKIE_OPTIONS);
}
