/**
 * 금액·일시 표시의 단일 출처. 화면에서 toLocaleString을 직접 부르지 않는다.
 *
 * timeZone을 명시하는 이유: 서버는 UTC, 브라우저는 사용자 로컬 타임존으로 동작해
 * 같은 값이 서로 다른 문자열로 렌더되면 hydration 불일치가 난다.
 */

const SEOUL = "Asia/Seoul";

const krwFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL,
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

/** 금액은 원 단위 정수만 다룬다(부동소수 금지) */
export function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}
