/**
 * `api.guest_get_event`의 jsonb를 `GuestEventPayload`로 좁히는 단 하나의 관문.
 *
 * 왜 필요한가: 제네릭 없는 supabase-js의 `rpc()`는 반환이 `any`다. 그대로 쓰면
 * `payload.event.titel`처럼 오타가 런타임까지 통과하고, `any` 금지 규칙이 조용히 무너진다.
 * 여기서 한 번 파싱하면 그 뒤의 화면 코드는 전부 타입이 선다.
 *
 * 스키마는 `types/moim.ts`의 손으로 쓴 계약과 **구조가 같아야 한다** —
 * 아래 `satisfies z.ZodType<GuestEventPayload>`가 어긋남을 컴파일 시점에 잡는다.
 */

import { z } from "zod";

import type { GuestEventPayload } from "@/types/moim";

const eventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  starts_at: z.string(),
  capacity: z.number().int().nullable(),
  rsvp_closes_at: z.string().nullable(),
  maybe_deadline: z.string().nullable(),
});

const noticeSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  is_pinned: z.boolean(),
  created_at: z.string(),
});

const rsvpSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  status: z.enum(["attending", "declined", "maybe"]),
  // 본인 행에만 값이 있다. 타인 행은 DB 함수가 null로 내린다(수정 사항 4)
  note: z.string().nullable(),
  responded_at: z.string(),
  is_mine: z.boolean(),
});

const settlementSchema = z.object({
  total: z.number().int(),
  // 공개 게이트 안쪽이다 — settlement가 null이면 계좌도 함께 사라진다
  bank_account: z.string().nullable(),
  my_share: z
    .object({ amount: z.number().int(), is_paid: z.boolean() })
    .nullable(),
});

const payloadSchema = z.object({
  event: eventSchema,
  notices: z.array(noticeSchema),
  rsvps: z.array(rsvpSchema),
  // 정산이 공개되지 않았으면 DB가 이 키를 null로 내린다(T-505의 공개 게이트)
  settlement: settlementSchema.nullable(),
}) satisfies z.ZodType<GuestEventPayload>;

/**
 * 파싱 실패는 "DB 함수와 이 파일이 어긋났다"는 뜻이다 — 사용자 입력으로는 일어나지 않는다.
 * 호출부가 null을 만료 화면으로 처리하되, 원인은 서버 로그에 남겨야 추적할 수 있다.
 */
export function parseGuestEventPayload(
  data: unknown,
): GuestEventPayload | null {
  const parsed = payloadSchema.safeParse(data);
  if (parsed.success) return parsed.data;

  console.error(
    "[guest] guest_get_event payload mismatch",
    parsed.error.issues,
  );
  return null;
}
