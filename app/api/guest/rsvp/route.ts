/**
 * 게스트 쓰기의 유일한 입구(T-302). 여기서 새는 것이 곧 제품의 구멍이다.
 *
 * 비대칭이 핵심이다: body에서 **eventId는 받고 guest_key는 받지 않는다.**
 * eventId는 쿠키 이름을 만들기 위한 조회용 힌트일 뿐 권한 판정에 쓰이지 않고,
 * guest_key는 `guestRsvpSchema`에 필드 자체가 없어 구조적으로 들어올 수 없다.
 *
 * 이 Handler가 뚫려도 DB가 2차 방어한다 — `api.guest_submit_rsvp`가 토큰 유효성·마감·
 * 이름 길이·메모 길이·status·분당 상한을 다시 검사한다(T-105·T-107).
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  malformedResultError,
  mapRpcError,
  mapZodError,
  parseRsvpResult,
  readJsonBody,
} from "@/lib/moim/guest-api";
import {
  issueGuestKey,
  readGuestKey,
  setGuestKeyCookie,
} from "@/lib/moim/guest-cookie";
import { guestRsvpSchema } from "@/lib/moim/schemas";
import { createGuestClient } from "@/lib/supabase/guest";
import type { GuestRpcArgs } from "@/types/moim";

export async function POST(request: NextRequest) {
  const parsed = guestRsvpSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return mapZodError(parsed.error);

  const { token, eventId, name, status, note } = parsed.data;

  // 재방문이면 기존 키로 같은 행을 수정한다(rsvps의 unique (event_id, guest_key)).
  // 최초 방문이면 여기서 발급하고 RPC 성공 후에 심는다 — 실패한 요청이 쿠키를 남기지 않는다.
  // 쿠키가 차단된 브라우저는 매번 새 키를 받아 응답이 수정이 아니라 추가로 쌓인다.
  // 제출을 막지 않는 쪽을 택했다 — 쿠키를 못 쓰는 사용자도 참석 여부는 전할 수 있어야 하고,
  // 같은 이름의 중복 응답은 주최자가 병합·삭제할 수 있다(T-306).
  const existingKey = eventId ? readGuestKey(request.cookies, eventId) : null;
  const guestKey = existingKey ?? issueGuestKey();

  const args: GuestRpcArgs["guest_submit_rsvp"] = {
    p_token: token,
    p_guest_key: guestKey,
    p_name: name,
    p_status: status,
    p_note: note,
  };

  const { data, error } = await createGuestClient().rpc(
    "guest_submit_rsvp",
    args,
  );
  if (error) return mapRpcError(error);

  const result = parseRsvpResult(data);
  if (!result) return malformedResultError(data);

  const response = NextResponse.json({ ok: true, rsvpId: result.rsvp_id });
  // 쿠키 이름은 **RPC가 돌려준** event_id로 만든다. body의 eventId를 쓰면 위조된 값으로
  // 엉뚱한 이름의 쿠키가 심겨 다음 방문에 본인 응답을 찾지 못한다
  setGuestKeyCookie(response, result.event_id, guestKey);
  return response;
}
