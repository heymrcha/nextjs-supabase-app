/**
 * 게스트 화면이 공유하는 읽기 경로. **서버 전용**이다(`next/headers`를 쓴다).
 *
 * `/e/[token]`과 `/e/[token]/respond`가 같은 2단 호출을 해야 하므로 한곳에 모았다 —
 * 두 벌로 두면 한쪽만 2차 호출을 빠뜨려 "응답했는데 내 응답이 안 보인다"가 된다.
 */

import { cookies } from "next/headers";

import { readGuestKey } from "@/lib/moim/guest-cookie";
import { parseGuestEventPayload } from "@/lib/moim/guest-payload";
import { createGuestClient } from "@/lib/supabase/guest";
import type { GuestEventPayload, GuestRpcArgs } from "@/types/moim";

/**
 * 2단 호출이 D1(쿠키 이름을 `event_id` 기반으로 유지)의 대가다. 쿠키 이름을 만들려면
 * event_id가 필요하고 게스트 경로는 token만 안다 — 1차는 키 없이 불러 event_id를 얻고,
 * 쿠키가 있을 때만 2차로 `is_mine`과 본인 `note`를 채운다. 쿠키 이름을 token 기반으로
 * 바꾸는 대안은 `share_token` 재발급(T-205)이 쿠키를 고아로 만들어 "재발급 후에도 기존
 * 응답은 유지한다"는 결정과 충돌해서 택하지 않았다.
 *
 * 최초 방문자(가장 흔한 경로)는 1회로 끝나고, `guest_get_event`는 stable이라
 * 재방문자의 2회도 단발 모임 규모에서는 무해하다.
 *
 * null은 "없음 · 삭제됨 · 만료됨"을 구분하지 않는 하나의 실패다. 호출부가 만료 화면으로
 * 보낸다 — 여기서 redirect하지 않는 이유는 `redirect()`가 예외를 throw해서,
 * 유틸이 제어 흐름을 가로채면 호출부가 그 사실을 읽기 어려워지기 때문이다.
 */
export async function loadGuestEvent(
  token: string,
): Promise<GuestEventPayload | null> {
  const supabase = createGuestClient();

  const firstArgs: GuestRpcArgs["guest_get_event"] = {
    p_token: token,
    p_guest_key: null,
  };
  const first = await supabase.rpc("guest_get_event", firstArgs);
  if (first.error) return null;

  const payload = parseGuestEventPayload(first.data);
  if (!payload) return null;

  const guestKey = readGuestKey(await cookies(), payload.event.id);
  if (!guestKey) return payload;

  const secondArgs: GuestRpcArgs["guest_get_event"] = {
    p_token: token,
    p_guest_key: guestKey,
  };
  const second = await supabase.rpc("guest_get_event", secondArgs);

  // 2차가 실패해도 1차 결과로 그린다. 본인 표시만 빠지고 읽기는 된다
  if (second.error) return payload;
  return parseGuestEventPayload(second.data) ?? payload;
}

/** 명단에서 본인 행을 찾는다. `is_mine`은 2차 호출에서만 true가 된다 */
export function findMyRsvp(payload: GuestEventPayload) {
  return payload.rsvps.find((rsvp) => rsvp.is_mine) ?? null;
}
