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
