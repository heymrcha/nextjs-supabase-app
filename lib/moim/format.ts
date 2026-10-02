/**
 * 금액·일시 표시의 단일 출처. 화면에서 toLocaleString을 직접 부르지 않는다.
 *
 * timeZone을 명시하는 이유: 서버는 UTC, 브라우저는 사용자 로컬 타임존으로 동작해
 * 같은 값이 서로 다른 문자열로 렌더되면 hydration 불일치가 난다.
 */

import type { RsvpStatus } from "@/types/moim";

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

/**
 * 응답 상태의 한국어 라벨. 게스트 화면·응답 폼·주최자 응답 관리가 같은 문자열을 써야
 * "참석"과 "참석함"이 화면마다 갈리지 않는다. 금액·일시와 같은 이유로 여기 모은다.
 */
export const RSVP_STATUS_LABEL: Record<RsvpStatus, string> = {
  attending: "참석",
  declined: "불참",
  maybe: "미정",
};
