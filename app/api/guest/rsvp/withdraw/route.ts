/**
 * 응답 철회. 제출(`../route.ts`)과 한 Handler로 묶지 않는다 — body 스키마가 다르고
 * 오류 매핑도 달라서, 합치면 "이름이 없는 제출"과 "철회"를 구분하는 분기가 생긴다.
 *
 * 철회는 기존 응답이 있어야 성립하므로 쿠키 키가 **필수**다. 제출과 달리 새로 발급하지 않는다.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  guestError,
  malformedResultError,
  mapRpcError,
  mapZodError,
  parseRsvpResult,
  readJsonBody,
} from "@/lib/moim/guest-api";
import { readGuestKey, setGuestKeyCookie } from "@/lib/moim/guest-cookie";
import { guestWithdrawSchema } from "@/lib/moim/schemas";
import { createGuestClient } from "@/lib/supabase/guest";
import type { GuestRpcArgs } from "@/types/moim";

export async function POST(request: NextRequest) {
  const parsed = guestWithdrawSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return mapZodError(parsed.error);

  const { token, eventId } = parsed.data;
  const guestKey = eventId ? readGuestKey(request.cookies, eventId) : null;

  // 쿠키가 없으면 철회할 응답을 특정할 수 없다. DB까지 가지 않고 여기서 끝낸다
  if (!guestKey) return guestError("GUEST_KEY_REQUIRED");

  const args: GuestRpcArgs["guest_withdraw_rsvp"] = {
    p_token: token,
    p_guest_key: guestKey,
  };

  const { data, error } = await createGuestClient().rpc(
    "guest_withdraw_rsvp",
    args,
  );
  if (error) return mapRpcError(error);

  const result = parseRsvpResult(data);
  if (!result) return malformedResultError(data);

  const response = NextResponse.json({ ok: true, rsvpId: result.rsvp_id });
  // 철회도 유효한 사용이므로 쿠키 수명을 다시 180일로 늘린다
  setGuestKeyCookie(response, result.event_id, guestKey);
  return response;
}
