/**
 * 주최자의 정산(Phase 5). 비용 항목(T-501) → 분담금 계산(T-502) → 스냅샷(T-503) →
 * 입금 추적(T-504) → 참여자 공개(T-505)가 한 화면에 세로로 쌓인다.
 *
 * `settlements`는 이벤트당 1개이고 **첫 비용 항목을 추가할 때 생긴다.** 그래서 이
 * 페이지는 행이 없는 경우를 정상으로 다룬다 — 없으면 `settlementId`가 null이고
 * 항목·스냅샷도 비어 있다.
 *
 * 금액 계산은 여기서 하지 않는다. `lib/moim/settlement.ts`의 순수 함수가 유일한
 * 산출 지점이다(`lib/moim/dashboard.ts`가 같은 이유로 계산을 갖지 않는다).
 */

import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  SettlementItems,
  type SettlementItem,
} from "@/components/events/settlement-items";
import {
  SettlementPanel,
  type SettlementShare,
} from "@/components/events/settlement-panel";
import { sumItemAmounts, type SettlementPayer } from "@/lib/moim/settlement";
import { createClient } from "@/lib/supabase/server";

async function EventSettlement({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  const supabase = await createClient();

  /**
   * 한 번에 읽는다. 정산 → 항목 → 스냅샷을 따로 조회하려면 앞선 id를 알아야 해서
   * 왕복이 세 번이 되고, 정산이 없는 경우의 분기도 그만큼 늘어난다.
   *
   * `settlements`가 배열이 아니라 단일 객체로 추론되는 것은 `event_id` UNIQUE 덕이다
   * (`lib/moim/dashboard.ts`에 같은 주석이 있다).
   */
  const { data: event } = await supabase
    .from("events")
    .select(
      `id, bank_account,
       rsvps(id, display_name, status, responded_at),
       settlements(id, rounding_unit, snapshot_at, is_published,
                   settlement_items(id, label, amount, created_at),
                   settlement_shares(id, rsvp_id, display_name, amount, is_paid, paid_at, created_at))`,
    )
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();

  // RLS가 남의 이벤트에 0행을 주므로 "없음"과 "권한 없음"이 같은 화면이 된다(의도)
  if (!event) {
    notFound();
  }

  const settlement = event.settlements;

  // 입력한 순서대로 보여 준다. 금액순 정렬은 "무엇을 적었는지" 훑는 데 방해가 된다
  const items: SettlementItem[] = (settlement?.settlement_items ?? [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ id, label, amount }) => ({ id, label, amount }));

  /**
   * 정산 대상은 `attending`뿐이다. 그 이유(PRD §6의 "기한 초과가 아닌" 조건을 왜
   * 옮기지 않았는지)는 `lib/moim/settlement.ts` 상단에 적어 두었다.
   *
   * 이름은 표시용 라벨(`buildRoster`의 동명이인 번호)이 아니라 `display_name` 원본을
   * 넘긴다 — 스냅샷의 입금 승계가 이름 대조로 떨어질 때 번호가 붙어 있으면 맞지 않는다.
   */
  const payers: SettlementPayer[] = event.rsvps
    .filter((rsvp) => rsvp.status === "attending")
    .sort((a, b) => a.responded_at.localeCompare(b.responded_at))
    .map((rsvp) => ({ rsvpId: rsvp.id, displayName: rsvp.display_name }));

  const shares: SettlementShare[] = (settlement?.settlement_shares ?? [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((share) => ({
      id: share.id,
      rsvpId: share.rsvp_id,
      displayName: share.display_name,
      amount: share.amount,
      isPaid: share.is_paid,
      paidAt: share.paid_at,
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">정산</h1>
        <p className="text-sm text-muted-foreground">
          지출한 항목을 적고 분담금을 계산하면, 그 시점 참석자 명단이 그대로
          저장됩니다. 이후 응답이 바뀌어도 [재계산]을 누르기 전까지 금액은
          그대로입니다.
        </p>
      </div>

      <SettlementItems
        eventId={event.id}
        settlementId={settlement?.id ?? null}
        items={items}
      />

      <SettlementPanel
        settlementId={settlement?.id ?? null}
        roundingUnit={settlement?.rounding_unit ?? 10}
        total={sumItemAmounts(items)}
        snapshotAt={settlement?.snapshot_at ?? null}
        isPublished={settlement?.is_published ?? false}
        payers={payers}
        shares={shares}
        bankAccount={event.bank_account}
      />
    </div>
  );
}

function SettlementSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy role="status">
      <span className="sr-only">정산 정보를 불러오는 중입니다</span>
      <div className="h-16 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="h-44 animate-pulse rounded-lg bg-muted/40" aria-hidden />
      <div className="h-32 animate-pulse rounded-lg bg-muted/40" aria-hidden />
    </div>
  );
}

/**
 * 페이지는 async가 아니고 params를 await하지 않는다 — cacheComponents에서 동적 params를
 * 페이지가 await하면 정적 셸을 만들지 못한다(`app/events/[id]/notices/page.tsx`와 같은 패턴).
 */
export default function EventSettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<SettlementSkeleton />}>
      <EventSettlement params={params} />
    </Suspense>
  );
}
