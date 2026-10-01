/**
 * 공유 링크를 다루는 유틸. 카카오톡에 그대로 붙일 용도라 상대 경로로는 쓸모가 없고
 * 반드시 절대 URL이어야 한다.
 */

/**
 * 앱의 기준 origin. `app/layout.tsx`의 `metadataBase` 계산과 같은 규칙이고,
 * 여기로 모아 두 곳이 어긋나지 않게 한다.
 *
 * 우선순위가 `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → localhost 인 이유:
 * 서버와 클라이언트가 **같은 값**을 내야 한다. 예전에는 클라이언트에서
 * `window.location.origin`을 먼저 썼는데, 커스텀 도메인 배포에서는 서버가
 * `https://<project>.vercel.app`, 클라이언트가 `https://<커스텀 도메인>`을 만들어
 * 링크 입력칸의 value가 SSR 결과와 달라지고 hydration 불일치가 났다.
 * `NEXT_PUBLIC_*`는 빌드 시 양쪽에 같은 문자열로 박히므로 그 어긋남이 생기지 않는다.
 */
export function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    // 끝의 슬래시를 떼어 `${origin}/e/...`가 `//`로 겹치지 않게 한다
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }

  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 서버 전용 폴백. 클라이언트에서는 undefined 이므로 아래 localhost 로 떨어진다
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function buildShareUrl(token: string): string {
  return `${getAppOrigin()}/e/${token}`;
}

/** Asia/Seoul의 UTC 오프셋(+09:00). 한국은 서머타임이 없어 고정값이다 */
const SEOUL_OFFSET = "+09:00";

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

/**
 * datetime-local 입력값(타임존 없음)을 Asia/Seoul로 해석해 Date로 만든다.
 * 잘못된 입력이면 Invalid Date를 돌려준다 — 유효성 검사가 예외 없이 판정할 수 있어야 한다.
 */
export function parseDateTimeLocal(value: string): Date {
  return new Date(`${value}:00${SEOUL_OFFSET}`);
}

/** Asia/Seoul로 해석했을 때 실제 시각이 되는 입력인지 본다 */
export function isValidDateTimeLocal(value: string): boolean {
  return !Number.isNaN(parseDateTimeLocal(value).getTime());
}

/**
 * datetime-local 입력값을 Asia/Seoul로 해석해 ISO로 바꾼다.
 * Invalid Date에서는 `toISOString()`이 RangeError를 던지므로, 호출 전에
 * `isValidDateTimeLocal`로 걸러진 값만 넘긴다(zod 스키마가 그 역할을 한다).
 */
export function fromDateTimeLocal(value: string): string {
  return parseDateTimeLocal(value).toISOString();
}
