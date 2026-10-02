/**
 * 게스트 Route Handler 2개(`/api/guest/rsvp`, `/api/guest/rsvp/withdraw`)가 공유하는
 * 응답 형태와 오류 매핑. 두 곳이 같은 형태를 내야 클라이언트가 분기를 한 번만 쓴다.
 *
 * 원칙: **DB 원문을 클라이언트로 보내지 않는다.** PostgreSQL 메시지·sqlstate·함수명이
 * 그대로 나가면 스키마 구조가 드러나고, 23514 같은 코드는 사용자에게 아무 뜻이 없다.
 * 아는 오류는 한국어 문구로 바꾸고, 모르는 오류는 500 + 일반 문구로 떨어뜨린 뒤
 * 원문은 서버 로그에만 남긴다.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import type { GuestRpcErrorCode, GuestRsvpResult } from "@/types/moim";

/**
 * 게스트 RPC 오류 코드 → HTTP 상태.
 *
 * 410(Gone)은 EVENT_UNAVAILABLE 전용이다 — 없음·삭제됨·만료됨을 구분하지 않는다는
 * DB 쪽 결정(T-105)을 HTTP 층에서도 유지한다. 404로 내리면 "없음"과 "만료"가
 * 다른 코드로 갈라져 토큰 존재 여부를 알려 주는 신호가 된다.
 */
const ERROR_STATUS: Record<GuestRpcErrorCode, number> = {
  EVENT_UNAVAILABLE: 410,
  RSVP_CLOSED: 409,
  GUEST_KEY_REQUIRED: 400,
  INVALID_NAME: 400,
  INVALID_NOTE: 400,
  INVALID_STATUS: 400,
  RATE_LIMITED: 429,
};

const ERROR_MESSAGE: Record<GuestRpcErrorCode, string> = {
  EVENT_UNAVAILABLE: "링크가 만료되었거나 더 이상 유효하지 않습니다",
  RSVP_CLOSED: "응답이 마감되었습니다",
  // 쿠키가 차단된 브라우저에서 일어난다. 사용자가 할 수 있는 조치를 알려 준다
  GUEST_KEY_REQUIRED:
    "쿠키를 사용할 수 없어 기존 응답을 찾지 못했습니다. 브라우저에서 쿠키를 허용해 주세요",
  INVALID_NAME: "이름은 1~20자로 입력해 주세요",
  INVALID_NOTE: "메모는 200자 이내로 입력해 주세요",
  INVALID_STATUS: "참석 여부를 다시 선택해 주세요",
  RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요",
};

const ERROR_CODES = Object.keys(ERROR_STATUS) as GuestRpcErrorCode[];

export function guestError(
  code: GuestRpcErrorCode,
  message?: string,
): NextResponse {
  return NextResponse.json(
    { error: { code, message: message ?? ERROR_MESSAGE[code] } },
    { status: ERROR_STATUS[code] },
  );
}

/** 알 수 없는 실패. 원인은 서버 로그에만 남기고 클라이언트에는 일반 문구를 준다 */
function unknownError(context: string, detail: unknown): NextResponse {
  console.error(`[guest] ${context}`, detail);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요",
      },
    },
    { status: 500 },
  );
}

/**
 * RPC 오류를 HTTP로 옮긴다. 게스트 함수는 전부 `raise exception '<코드>'` 형태라
 * 메시지 자체가 코드다(sqlstate는 P0001/P0002로만 갈린다 — 구분에 쓸 수 없다).
 */
export function mapRpcError(error: { message?: string }): NextResponse {
  const raised = error.message?.trim();
  const code = ERROR_CODES.find((candidate) => candidate === raised);
  if (code) return guestError(code);

  return unknownError("unmapped rpc error", error);
}

/**
 * zod 실패를 DB와 같은 코드로 옮긴다. 두 층이 다른 코드를 내면 클라이언트가
 * "어느 층에서 걸렸는지"에 따라 분기해야 한다 — 같은 코드로 모은다.
 */
export function mapZodError(error: z.ZodError): NextResponse {
  const [issue] = error.issues;
  const field = issue?.path[0];

  if (field === "name") return guestError("INVALID_NAME", issue.message);
  if (field === "note") return guestError("INVALID_NOTE", issue.message);
  if (field === "status") return guestError("INVALID_STATUS");

  // token·eventId가 깨진 경우. 정상 화면에서는 일어나지 않으므로 문구를 다듬지 않는다
  return NextResponse.json(
    { error: { code: "INVALID_REQUEST", message: "잘못된 요청입니다" } },
    { status: 400 },
  );
}

/**
 * RPC 반환값을 검증해서 쓴다. 제네릭 없는 supabase-js 클라이언트의 `rpc()`는
 * 반환 타입이 `any`라 그대로 흘리면 `any` 금지 규칙이 무력화된다 —
 * 경계에서 한 번 파싱해 `GuestRsvpResult`로 좁힌다.
 */
const rsvpResultSchema = z.object({
  rsvp_id: z.uuid(),
  event_id: z.uuid(),
});

export function parseRsvpResult(data: unknown): GuestRsvpResult | null {
  const parsed = rsvpResultSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function malformedResultError(data: unknown): NextResponse {
  return unknownError("unexpected rpc payload", data);
}

/** body가 JSON이 아닐 때. 폼에서는 일어나지 않지만 외부 호출은 무엇이든 보낼 수 있다 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
