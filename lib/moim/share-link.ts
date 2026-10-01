/**
 * 공유 링크를 다루는 유틸. 카카오톡에 그대로 붙일 용도라 상대 경로로는 쓸모가 없고
 * 반드시 절대 URL이어야 한다.
 */

/**
 * 앱의 기준 origin. `app/layout.tsx`의 `metadataBase` 계산과 같은 규칙이고,
 * 여기로 모아 두 곳이 어긋나지 않게 한다.
 *
 * 클라이언트에서는 `window.location.origin`을 먼저 쓴다 — 프리뷰 배포처럼
 * `VERCEL_URL`이 실제 접속 주소와 다른 환경에서 복사한 링크가 열리지 않는 것을 막는다.
 */
export function getAppOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

export function buildShareUrl(token: string): string {
  return `${getAppOrigin()}/e/${token}`;
}

/** Asia/Seoul의 UTC 오프셋(+09:00). 한국은 서머타임이 없어 고정값이다 */
const SEOUL_OFFSET = "+09:00";

/**
 * 모임 당일 자정(KST 23:59:59)을 ISO 문자열로 돌려준다. 만료 시각의 기본값이다.
 *
 * 서버는 UTC로 도는데 "모임 당일"은 한국 날짜 기준이어야 하므로, 로컬 타임존에
 * 기대지 않고 Asia/Seoul로 날짜 부분을 뽑은 뒤 +09:00을 붙여 해석시킨다.
 * `new Date(startsAt).getDate()`를 쓰면 서버에서는 전날이 나올 수 있다.
 */
export function defaultShareExpiry(startsAt: string | Date): string {
  const seoulDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(startsAt)); // en-CA는 YYYY-MM-DD로 포맷된다

  return new Date(`${seoulDate}T23:59:59${SEOUL_OFFSET}`).toISOString();
}

/**
 * `<input type="datetime-local">`이 요구하는 `YYYY-MM-DDTHH:mm` 형식으로 바꾼다.
 * 역시 Asia/Seoul 기준이어야 주최자가 보는 시각과 일치한다.
 */
export function toDateTimeLocal(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** datetime-local 입력값(타임존 없음)을 Asia/Seoul로 해석해 ISO로 바꾼다 */
export function fromDateTimeLocal(value: string): string {
  return new Date(`${value}:00${SEOUL_OFFSET}`).toISOString();
}
