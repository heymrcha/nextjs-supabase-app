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

/** 주최자 화면의 정산 요약. DB 구조가 아니라 계산 결과이므로 camelCase를 쓴다 */
export type SettlementSummary = {
  total: number;
  perPerson: number;
  attendeeCount: number;
  unpaidTotal: number;
};
