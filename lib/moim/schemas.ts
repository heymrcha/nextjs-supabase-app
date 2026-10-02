/**
 * 폼과 서버가 공유하는 zod 스키마. 값은 DB 제약(T-101)과 일치해야 한다 —
 * 어긋나면 클라이언트는 통과시키고 DB가 거부해 사용자에게 23514 같은 코드가 새어 나간다.
 *
 * | 필드               | DB 제약                                  |
 * | ------------------ | ---------------------------------------- |
 * | title              | char_length 1~100                        |
 * | capacity           | null 또는 > 0                            |
 * | expected_headcount | null 또는 > 0                            |
 * | display_name       | char_length 1~20                         |
 * | note               | null 또는 char_length <= 200             |
 * | body (공지)        | char_length 1~2000                       |
 * | label (비용 항목)  | char_length 1~100                        |
 * | amount (비용 항목) | int, > 0                                 |
 *
 * share_token은 어떤 스키마에도 넣지 않는다. 클라이언트가 정할 수 있는 값이 아니고
 * before insert 트리거가 덮어쓴다(D2).
 */

import { z } from "zod";

import {
  isValidDateTimeLocal,
  parseDateTimeLocal,
} from "@/lib/moim/share-link";

/** 빈 문자열을 null로 바꾼다. <input>은 미입력을 ""로 주지만 DB는 null을 원한다 */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

/**
 * datetime-local 입력값(`2026-10-08T19:00`)을 받는다. 타임존이 없는 문자열이므로
 * 해석 규칙을 어딘가에서 정해야 하는데, 이 앱은 **Asia/Seoul 한 가지**로 통일한다
 * (`lib/moim/share-link.ts`의 `parseDateTimeLocal`/`toDateTimeLocal`).
 *
 * `new Date(값)`을 쓰면 브라우저 로컬 타임존으로 해석되어 입력칸을 채우는 규칙과
 * 어긋난다. 여기서도 비교에 `new Date()`를 쓰지 않는 이유다.
 */
const dateTimeLocal = z
  .string()
  .min(1, "일시를 입력해 주세요")
  // 빈 값은 위 min이 이미 잡는다. 여기서 또 잡으면 오류 메시지가 두 개 쌓인다
  .refine((value) => value === "" || isValidDateTimeLocal(value), {
    message: "올바른 일시를 입력해 주세요",
  });

const optionalDateTimeLocal = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || isValidDateTimeLocal(value), {
    message: "올바른 일시를 입력해 주세요",
  });

/**
 * 양의 정수 또는 미입력. `<input type="number">`가 문자열을 주므로 직접 변환한다.
 * `z.coerce.number()`를 쓰지 않는 이유: ""를 0으로 바꿔 버려 "미입력"과 "0명"이 섞인다.
 */
const optionalPositiveInt = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .nullable()
  .refine((value) => value === null || Number.isInteger(value), {
    message: "정수로 입력해 주세요",
  })
  .refine((value) => value === null || value > 0, {
    message: "1 이상으로 입력해 주세요",
  });

export const eventCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "제목을 입력해 주세요")
      .max(100, "제목은 100자 이내로 입력해 주세요"),
    startsAt: dateTimeLocal,
    location: optionalText,
    description: optionalText,
    capacity: optionalPositiveInt,
    expectedHeadcount: optionalPositiveInt,
    rsvpClosesAt: optionalDateTimeLocal,
    maybeDeadline: optionalDateTimeLocal,
    bankAccount: optionalText,
  })
  .refine(
    (data) =>
      !data.rsvpClosesAt ||
      parseDateTimeLocal(data.rsvpClosesAt).getTime() <=
        parseDateTimeLocal(data.startsAt).getTime(),
    {
      message: "응답 마감은 모임 일시보다 늦을 수 없습니다",
      path: ["rsvpClosesAt"],
    },
  )
  .refine(
    (data) =>
      !data.maybeDeadline ||
      parseDateTimeLocal(data.maybeDeadline).getTime() <=
        parseDateTimeLocal(data.startsAt).getTime(),
    {
      message: "미정 확정 기한은 모임 일시보다 늦을 수 없습니다",
      path: ["maybeDeadline"],
    },
  );

/** 파싱 전(폼이 다루는 문자열) / 파싱 후(DB에 넣을 값) 타입을 구분한다 */
export type EventCreateFormValues = z.input<typeof eventCreateSchema>;
export type EventCreateInput = z.output<typeof eventCreateSchema>;

/**
 * 게스트 응답 제출 body(T-302). **guest_key 필드를 정의하지 않는다** —
 * 정의하지 않으면 body로 남의 키를 보내는 공격이 "무시된다"가 아니라 아예 표현 불가능해진다.
 * Route Handler는 guest_key를 쿠키에서만 읽는다.
 *
 * `eventId`는 쿠키 이름을 만들기 위한 **조회용 힌트**일 뿐이고 권한 판정에 쓰지 않는다.
 * 쿠키 이름이 event_id 기반인데(D1) Handler는 RPC를 호출한 뒤에야 event_id를 알기 때문에,
 * 재방문자의 기존 키를 찾으려면 클라이언트가 이미 아는 값(payload.event.id)을 받아야 한다.
 * 위조해도 다른 이벤트의 쿠키를 읽을 수 있을 뿐이고, 그 키로 이 이벤트의 남의 응답을
 * 건드릴 수는 없다 — rsvps의 unique (event_id, guest_key)가 키마다 다른 행을 가리키게 한다.
 */
const guestNote = z
  .string()
  .trim()
  .max(200, "메모는 200자 이내로 입력해 주세요")
  .nullish()
  // 미입력("")·null·키 없음을 한 가지(null)로 모은다
  .transform((value) => (value ? value : null));

/** DB의 public.rsvp_status와 같은 값이어야 한다. 어긋나면 함수가 INVALID_STATUS로 거부한다 */
const guestStatus = z.enum(["attending", "declined", "maybe"]);

export const guestRsvpSchema = z.object({
  token: z.string().min(1, "잘못된 요청입니다"),
  eventId: z.uuid().nullish(),
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요")
    .max(20, "이름은 20자 이내로 입력해 주세요"),
  status: guestStatus,
  note: guestNote,
});

export type GuestRsvpFormValues = z.input<typeof guestRsvpSchema>;
export type GuestRsvpInput = z.output<typeof guestRsvpSchema>;

/** 철회는 이름·메모가 필요 없다. 스키마를 나눠 두면 오류 매핑도 단순해진다 */
export const guestWithdrawSchema = z.object({
  token: z.string().min(1, "잘못된 요청입니다"),
  eventId: z.uuid().nullish(),
});

/**
 * 공지 본문(T-401). DB 제약은 `event_notices_body_len`(1~2000자) 하나뿐이다 —
 * `is_pinned`은 폼이 다루지 않는다(토글 버튼이 별도로 보내고, 기존 고정 해제는
 * `event_notices_unpin_others` 트리거가 한다. T-402).
 */
export const noticeSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "공지 내용을 입력해 주세요")
    .max(2000, "공지는 2000자 이내로 입력해 주세요"),
});

export type NoticeFormValues = z.input<typeof noticeSchema>;
export type NoticeInput = z.output<typeof noticeSchema>;

/**
 * 비용 항목 금액(T-501). **원 단위 정수만 받는다** — 부동소수가 들어오면 분담금
 * 계산(T-502)의 올림이 1원 단위로 흔들리고, DB의 `amount int`가 23502가 아니라
 * 22P02로 거부해 사용자에게 코드가 샌다.
 *
 * `z.coerce.number()`도 `<input type="number">`의 값도 "1.5"·"1e3"을 통과시키므로
 * 정규식으로 먼저 막는다. 상한은 int4(2,147,483,647) 안쪽이면서 오타를 걸러 내는
 * 선으로 1억 원을 쓴다 — DB에는 상한 제약이 없고 이 값은 화면 쪽 방어선이다.
 */
const wonAmount = z
  .string()
  .trim()
  .min(1, "금액을 입력해 주세요")
  .refine((value) => /^\d+$/.test(value), {
    message: "원 단위 정수로 입력해 주세요",
  })
  .transform(Number)
  .refine((value) => value > 0, { message: "1원 이상으로 입력해 주세요" })
  .refine((value) => value <= 100_000_000, {
    message: "1억 원 이하로 입력해 주세요",
  });

export const settlementItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "항목 이름을 입력해 주세요")
    .max(100, "항목 이름은 100자 이내로 입력해 주세요"),
  amount: wonAmount,
});

export type SettlementItemFormValues = z.input<typeof settlementItemSchema>;
export type SettlementItemInput = z.output<typeof settlementItemSchema>;
