"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatKrw } from "@/lib/moim/format";
import {
  calculateSettlement,
  sumUnpaid,
  type SettlementPayer,
} from "@/lib/moim/settlement";
import { createClient } from "@/lib/supabase/client";

/** 스냅샷 한 행. `rsvpId`는 응답이 삭제되면 null이 된다(on delete set null) */
export type SettlementShare = {
  id: string;
  rsvpId: string | null;
  displayName: string;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
};

/**
 * `rebuild_settlement_shares`의 반환을 좁히는 관문. 제네릭 rpc의 반환은 `Json`이라
 * 그대로 쓰면 `result.carreid` 같은 오타가 런타임까지 통과한다(`guest-payload.ts`와 같은 이유).
 */
const rebuildResultSchema = z.object({
  carried: z.number().int(),
  unmatched: z.array(z.string()),
});

/**
 * 분담금 계산(T-502) · 스냅샷(T-503) · 입금 추적(T-504) · 게스트 공개(T-505).
 *
 * 금액 계산은 이 컴포넌트가 하지 않는다. `lib/moim/settlement.ts`의 순수 함수가 유일한
 * 산출 지점이고, 여기서는 그 결과를 보여 주고 DB 함수에 넘기기만 한다.
 *
 * **스냅샷이 화면의 기준이다.** 위쪽 "계산 미리보기"는 지금 참석자로 계산하면 얼마가
 * 되는지를 보여 줄 뿐이고, 아래 명단과 미수금은 마지막으로 [계산]을 누른 시점의 값이다.
 * 둘이 다를 수 있다는 것이 T-503의 요점이다 — RSVP가 바뀌어도 이미 걷기 시작한 금액이
 * 저절로 흔들리지 않는다.
 */
export function SettlementPanel({
  settlementId,
  roundingUnit,
  total,
  snapshotAt,
  isPublished,
  payers,
  shares,
  bankAccount,
}: {
  settlementId: string | null;
  roundingUnit: number;
  total: number;
  snapshotAt: string | null;
  isPublished: boolean;
  payers: SettlementPayer[];
  shares: SettlementShare[];
  bankAccount: string | null;
}) {
  const router = useRouter();
  const [isRebuildOpen, setIsRebuildOpen] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  // 토글 중인 행만 잠근다. 전체를 잠그면 다른 행을 눌러 보고 멈춘 줄 안다
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const preview = calculateSettlement({
    total,
    payerCount: payers.length,
    roundingUnit,
  });
  const unpaidTotal = sumUnpaid(
    shares.map((share) => ({ amount: share.amount, is_paid: share.isPaid })),
  );
  const paidCount = shares.filter((share) => share.isPaid).length;
  const hasSnapshot = shares.length > 0;

  const handleRebuild = async () => {
    if (!settlementId || !preview) return;
    setIsRebuilding(true);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("rebuild_settlement_shares", {
      p_settlement_id: settlementId,
      p_amount: preview.perPerson,
      p_payers: payers.map((payer) => ({
        rsvp_id: payer.rsvpId,
        display_name: payer.displayName,
      })),
    });

    setIsRebuilding(false);

    const parsed = rebuildResultSchema.safeParse(data);

    if (error || !parsed.success) {
      // DB 오류 코드를 그대로 노출하지 않는다(T-602)
      toast.error("분담금을 계산하지 못했습니다");
      return;
    }

    setIsRebuildOpen(false);
    toast.success(`${payers.length}명의 분담금을 계산했습니다`);

    // 입금 기록이 조용히 사라지면 주최자가 두 번 받게 된다. 반드시 알린다
    if (parsed.data.unmatched.length > 0) {
      toast.warning(
        `입금 기록을 옮기지 못한 ${parsed.data.unmatched.length}명이 있습니다: ${parsed.data.unmatched.join(", ")}`,
      );
    }

    router.refresh();
  };

  const togglePaid = async (share: SettlementShare) => {
    setTogglingId(share.id);

    const supabase = createClient();
    // paid_at은 is_paid와 짝을 이뤄야 한다 — DB의 settlement_shares_paid_at_consistent가
    // 미입금인데 시각만 남은 행을 거부하므로 둘을 같이 쓴다
    const { data, error } = await supabase
      .from("settlement_shares")
      .update({
        is_paid: !share.isPaid,
        paid_at: share.isPaid ? null : new Date().toISOString(),
      })
      .eq("id", share.id)
      .select("id");

    setTogglingId(null);

    if (error || !data?.length) {
      toast.error("입금 상태를 바꾸지 못했습니다");
      return;
    }

    router.refresh();
  };

  const togglePublished = async () => {
    if (!settlementId) return;
    setIsPublishing(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("settlements")
      .update({ is_published: !isPublished })
      .eq("id", settlementId)
      .select("id");

    setIsPublishing(false);

    if (error || !data?.length) {
      toast.error("공개 설정을 바꾸지 못했습니다");
      return;
    }

    setIsPublishOpen(false);
    toast.success(
      isPublished ? "정산을 비공개로 바꿨습니다" : "정산을 공개했습니다",
    );
    router.refresh();
  };

  return (
    <>
      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">분담금</h2>

        {preview === null ? (
          <p className="text-sm text-muted-foreground">
            참석자가 없어 분담금을 계산할 수 없습니다. 응답을 받은 뒤 다시 와
            주세요.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {formatKrw(preview.perPerson)}
              </span>
              <span className="text-sm text-muted-foreground">
                × 참석 {preview.payerCount}명 ={" "}
                <span className="tabular-nums">
                  {formatKrw(preview.collected)}
                </span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              전체 비용 {formatKrw(preview.total)} · {roundingUnit}원 단위 절상
              {preview.hostDiff > 0 && (
                <> · 주최자에게 {formatKrw(preview.hostDiff)} 남음</>
              )}
            </p>
          </>
        )}

        {snapshotAt && (
          <p className="text-sm text-muted-foreground">
            마지막 계산 {formatDateTime(snapshotAt)}
          </p>
        )}

        <div>
          <Button
            type="button"
            className="h-11"
            // 정산 행이 없으면 비용 항목도 없다 — 계산할 것이 없다
            disabled={!settlementId || preview === null}
            onClick={() => setIsRebuildOpen(true)}
          >
            {hasSnapshot ? "분담금 재계산" : "분담금 계산"}
          </Button>
        </div>
      </section>

      {hasSnapshot && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              입금 현황 ({paidCount}/{shares.length})
            </h2>
            <span className="text-sm">
              미수금{" "}
              <span
                className={
                  unpaidTotal === 0
                    ? "font-medium tabular-nums"
                    : "font-medium tabular-nums text-destructive"
                }
              >
                {formatKrw(unpaidTotal)}
              </span>
            </span>
          </div>

          <ul className="flex flex-col divide-y rounded-lg border">
            {shares.map((share) => (
              <li
                key={share.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                {/* 체크박스 자체는 16px이라 터치 영역에 못 미친다. label로 감싸
                    행 전체를 누를 수 있게 하고 최소 높이를 44px로 올린다 */}
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={share.isPaid}
                    disabled={togglingId === share.id}
                    onCheckedChange={() => togglePaid(share)}
                  />
                  <span className="break-all text-sm">{share.displayName}</span>
                  {share.rsvpId === null && (
                    <Badge variant="outline" className="shrink-0">
                      응답 삭제됨
                    </Badge>
                  )}
                </label>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatKrw(share.amount)}
                </span>
              </li>
            ))}
          </ul>

          {unpaidTotal === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-sm">
              전원 입금이 끝났습니다. 정산 완료입니다.
            </p>
          )}
        </section>
      )}

      {hasSnapshot && (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              참여자 공개
            </h2>
            <Badge variant={isPublished ? "secondary" : "outline"}>
              {isPublished ? "공개 중" : "비공개"}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            {isPublished
              ? "참여자가 공유 링크에서 본인 분담금과 입금 상태를 봅니다. 타인의 금액은 보이지 않습니다."
              : "공개하기 전에는 참여자 화면에 정산이 어떤 형태로도 나타나지 않습니다."}
          </p>

          {!bankAccount && !isPublished && (
            <p className="text-sm text-muted-foreground">
              설정에 계좌 안내를 적어 두면 공개할 때 함께 보여 줍니다.
            </p>
          )}

          <div>
            <Button
              type="button"
              variant={isPublished ? "outline" : "default"}
              className="h-11"
              onClick={() => setIsPublishOpen(true)}
            >
              {isPublished ? "비공개로 바꾸기" : "참여자에게 공개"}
            </Button>
          </div>
        </section>
      )}

      <Dialog open={isRebuildOpen} onOpenChange={setIsRebuildOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hasSnapshot
                ? "분담금을 다시 계산할까요?"
                : "분담금을 계산할까요?"}
            </DialogTitle>
            <DialogDescription>
              {preview &&
                `지금 참석자 ${preview.payerCount}명 기준으로 1인당 ${formatKrw(preview.perPerson)}이 됩니다.`}
              {hasSnapshot &&
                " 기존 명단과 금액은 지금 참석자로 교체되고, 입금 완료 표시는 그대로 옮깁니다."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setIsRebuildOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              className="h-11"
              disabled={isRebuilding}
              onClick={handleRebuild}
            >
              {isRebuilding ? "계산하는 중…" : "계산"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPublishOpen} onOpenChange={setIsPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPublished
                ? "정산을 비공개로 바꿀까요?"
                : "참여자에게 공개할까요?"}
            </DialogTitle>
            <DialogDescription>
              {isPublished
                ? "참여자 화면에서 정산 영역이 사라집니다. 입금 기록은 지워지지 않습니다."
                : "공유 링크를 가진 사람이 본인 분담금과 입금 상태를 보게 됩니다. 타인의 금액과 메모는 공개되지 않습니다."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setIsPublishOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              className="h-11"
              disabled={isPublishing}
              onClick={togglePublished}
            >
              {isPublishing ? "바꾸는 중…" : isPublished ? "비공개로" : "공개"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
