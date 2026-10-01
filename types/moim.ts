/**
 * 화면이 소비하는 뷰 타입. DB 생성 타입(`types/database.ts`, T-109)과 역할이 다르다 —
 * 생성 타입은 손으로 고치지 않는 산출물이고, 이 파일은 손으로 쓴 계약이다.
 *
 * `GuestEventPayload`의 필드 이름은 `api.guest_get_event`가 내려주는 jsonb 키와
 * 1:1로 맞춘다(그래서 snake_case다). 경계에서 이름을 바꾸면 PRD와 대조가 어려워진다.
 */

export type RsvpStatus = "attending" | "declined" | "maybe";

/** `guest_get_event`의 `event` 객체. share_token·deleted_at 등 내부 컬럼은 내려오지 않는다 */
export type GuestEventSummary = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  capacity: number | null;
  rsvp_closes_at: string | null;
  maybe_deadline: string | null;
  bank_account: string | null;
};

export type GuestNotice = {
  id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
};

/**
 * 명단 한 줄. 참석·불참·미정 전원이 공개된다.
 * `note`는 본인 행에만 값이 있다 — 타인의 메모는 주최자 전용이므로 DB 함수가 null로 내린다.
 */
export type GuestRsvp = {
  id: string;
  display_name: string;
  status: RsvpStatus;
  note: string | null;
  responded_at: string;
  is_mine: boolean;
};

/** 본인 분담금. 스냅샷에 본인 행이 없으면 null */
export type GuestShare = {
  amount: number;
  is_paid: boolean;
};

/** 정산이 공개(is_published)되지 않았으면 payload에 null로 들어온다 */
export type GuestSettlement = {
  total: number;
  my_share: GuestShare | null;
};

export type GuestEventPayload = {
  event: GuestEventSummary;
  notices: GuestNotice[];
  rsvps: GuestRsvp[];
  settlement: GuestSettlement | null;
};

/**
 * `guest_submit_rsvp` / `guest_withdraw_rsvp`의 반환.
 * 쿠키 이름이 event_id 기반이라 Route Handler가 쿠키를 심으려면 event_id가 필요하다 —
 * 그래서 rsvp_id만 돌려주지 않는다.
 */
export type GuestRsvpResult = {
  rsvp_id: string;
  event_id: string;
};

/**
 * `api` 스키마 RPC 3개의 호출 인자. `types/database.ts`에 없어서 여기 둔다 —
 * MCP 타입 생성기는 기본 스키마(`public`)만 내보내고 스키마를 고를 옵션이 없다.
 * 스키마를 바꾸면 이 타입도 손으로 맞춰야 한다(생성으로 잡히지 않는다).
 *
 * `p_status`가 enum이 아니라 `string`인 이유: PostgREST가 `anon` 역할로
 * `public.rsvp_status` 타입을 참조하는데 `anon`에게 `public` usage가 없어
 * `permission denied for schema public`이 났다. 함수가 text로 받아 내부에서 검증·캐스팅한다.
 */
export type GuestRpcArgs = {
  guest_get_event: { p_token: string; p_guest_key?: string | null };
  guest_submit_rsvp: {
    p_token: string;
    p_guest_key: string;
    p_name: string;
    p_status: RsvpStatus;
    p_note?: string | null;
  };
  guest_withdraw_rsvp: { p_token: string; p_guest_key: string };
};

/**
 * 게스트 RPC가 올리는 오류 코드. 전부 sqlstate P0001이고, 구분은 메시지로 한다.
 * 예외는 EVENT_UNAVAILABLE(P0002)이다 — 존재하지 않음·삭제됨·만료됨을 구분하지 않는다.
 * T-302가 이것을 HTTP 상태 코드로 옮긴다.
 */
export type GuestRpcErrorCode =
  | "EVENT_UNAVAILABLE"
  | "RSVP_CLOSED"
  | "GUEST_KEY_REQUIRED"
  | "INVALID_NAME"
  | "INVALID_NOTE"
  | "INVALID_STATUS"
  | "RATE_LIMITED";

/** 주최자 화면의 정산 요약. DB 구조가 아니라 계산 결과이므로 camelCase를 쓴다 */
export type SettlementSummary = {
  total: number;
  perPerson: number;
  attendeeCount: number;
  unpaidTotal: number;
};
