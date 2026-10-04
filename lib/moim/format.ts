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

/** 상태별 이모지. 라벨 옆에 장식으로만 쓰므로 소비 쪽에서 aria-hidden 처리한다 */
export const RSVP_STATUS_EMOJI: Record<RsvpStatus, string> = {
  attending: "🙌",
  maybe: "🤔",
  declined: "🙅",
};

/**
 * 상태별 pill 색. 게스트 명단과 주최자 화면이 같은 상태를 같은 색으로 보여야
 * 화면을 오갈 때 "초록=참석"이 학습되므로 한 곳에 모은다. 라이트·다크 모두
 * 배경 대비 텍스트가 4.5:1 이상이 되도록 100/800, 900/40%+200 조합을 쓴다.
 */
export const RSVP_STATUS_TONE: Record<RsvpStatus, string> = {
  attending:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  maybe: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  declined: "bg-muted text-muted-foreground",
};

/**
 * 이력 타임라인용 짧은 일시(`10. 2. 09:12`). 한 행에 여러 건이 쌓이는 자리라
 * 긴 형식(`2026년 10월 2일 (금) 오전 9:12`)을 쓰면 변경 내용이 밀려 읽히지 않는다.
 * 연도를 빼지 않는 이유: 지난 모임의 이력을 볼 때 연도가 없으면 언제 일인지 모른다.
 */
const shortDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL,
  year: "2-digit",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatShortDateTime(value: string | Date): string {
  return shortDateTimeFormatter.format(new Date(value));
}
