"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKrw } from "@/lib/moim/format";
import {
  settlementItemSchema,
  type SettlementItemFormValues,
  type SettlementItemInput,
} from "@/lib/moim/schemas";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** 서버가 내려주는 비용 항목 한 줄 */
export type SettlementItem = {
  id: string;
  label: string;
  amount: number;
};

/**
 * 비용 항목 CRUD(T-501). 금액은 원 단위 정수만 받는다 — 검증은
 * `settlementItemSchema`가 하고 DB의 `amount > 0`이 최후 방어선이다.
 *
 * `settlements` 행은 **첫 항목을 추가할 때 만든다**(지연 생성). 정산 탭을 열기만 해도
 * 행이 생기면 "정산을 시작하지 않은 모임"과 "항목이 0건인 모임"을 구분할 수 없고,
 * 서버 컴포넌트에서 쓰기를 하게 되어 cacheComponents의 프리렌더가 깨진다.
 *
 * 분담금 계산·스냅샷·입금 추적은 T-502~T-504다. 여기서는 항목과 총액까지만 다룬다.
 */
export function SettlementItems({
  eventId,
  settlementId,
  items,
}: {
  eventId: string;
  /** 아직 정산을 시작하지 않았으면 null. 첫 항목 추가 시 만들어진다 */
  settlementId: string | null;
  items: SettlementItem[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettlementItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettlementItemFormValues, unknown, SettlementItemInput>({
    resolver: zodResolver(settlementItemSchema),
    defaultValues: { label: "", amount: "" },
  });

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  /**
   * 정산 행을 보장하고 id를 돌려준다. `event_id`가 unique이므로 두 탭이 동시에
   * 첫 항목을 넣어도 한쪽은 충돌한다 — `ignoreDuplicates`로 그 충돌을 오류가 아닌
   * "이미 있음"으로 흡수하고, 그때는 0행이 돌아오므로 기존 행을 다시 읽는다.
   */
  const ensureSettlementId = async (): Promise<string | null> => {
    if (settlementId) return settlementId;

    const supabase = createClient();
    const { data: created } = await supabase
      .from("settlements")
      .upsert(
        { event_id: eventId },
        { onConflict: "event_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    if (created) return created.id;

    const { data: existing } = await supabase
      .from("settlements")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    return existing?.id ?? null;
  };

  const onSubmit = async (values: SettlementItemInput) => {
    const supabase = createClient();

    if (editingId) {
      // PostgREST의 UPDATE는 매칭 0행도 오류가 아니다. 다른 탭에서 이미 지운
      // 항목을 저장해도 성공으로 보이므로 반환 행을 직접 확인한다
      const { data, error } = await supabase
        .from("settlement_items")
        .update({ label: values.label, amount: values.amount })
        .eq("id", editingId)
        .select("id");

      if (error || !data?.length) {
        // DB 오류 코드를 그대로 노출하지 않는다(T-602)
        setError("root", {
          message: "항목을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        });
        return;
      }

      setEditingId(null);
      reset({ label: "", amount: "" });
      toast.success("항목을 수정했습니다");
      router.refresh();
      return;
    }

    const targetId = await ensureSettlementId();

    if (!targetId) {
      setError("root", {
        message: "정산을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("settlement_items")
      .insert({
        settlement_id: targetId,
        label: values.label,
        amount: values.amount,
      })
      .select("id")
      .single();

    if (error || !data) {
      setError("root", {
        message: "항목을 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    reset({ label: "", amount: "" });
    toast.success("항목을 추가했습니다");
    router.refresh();
  };

  const startEdit = (item: SettlementItem) => {
    setEditingId(item.id);
    // 편집 대상이 바뀌면 이전 입력과 오류가 남지 않게 폼을 통째로 되맞춘다
    reset({ label: item.label, amount: String(item.amount) });
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset({ label: "", amount: "" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const supabase = createClient();
    // RLS가 남의 이벤트 행을 애초에 안 보여주므로 호스트 조건을 또 붙이지 않는다.
    // 다만 매칭 0행도 오류가 아니므로 삭제된 행을 직접 확인한다
    const { data, error } = await supabase
      .from("settlement_items")
      .delete()
      .eq("id", deleteTarget.id)
      .select("id");

    setIsDeleting(false);

    if (error || !data?.length) {
      toast.error("항목을 삭제하지 못했습니다");
      return;
    }

    // 지우는 항목을 편집 중이었다면 폼도 비운다. 그러지 않으면 사라진 행을
    // 가리키는 editingId로 저장을 눌러 0행 오류를 보게 된다
    if (editingId === deleteTarget.id) cancelEdit();

    setDeleteTarget(null);
    toast.success("항목을 삭제했습니다");
    router.refresh();
  };

  return (
    <>
      {/* noValidate로 브라우저 기본 검증을 끈다. type="number" + min/step이 걸려 있으면
          "1.5"·"0"에서 네이티브 말풍선이 먼저 submit을 막아 zod의 한국어 문구가 끝내
          나오지 않는다. min/step은 모바일 숫자 키패드와 스피너 힌트로만 남긴다 */}
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <p className="text-sm font-medium">
          {editingId ? "항목 수정" : "비용 항목 추가"}
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="label">
              항목
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="label"
              placeholder="예) 고깃집"
              aria-required
              aria-invalid={Boolean(errors.label)}
              {...register("label")}
            />
            {errors.label?.message && (
              <p role="alert" className="text-sm text-destructive">
                {errors.label.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">
              금액(원)
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="amount"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="40000"
              aria-required
              aria-invalid={Boolean(errors.amount)}
              {...register("amount")}
            />
            {errors.amount?.message && (
              <p role="alert" className="text-sm text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>
        </div>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="h-11" disabled={isSubmitting}>
            {isSubmitting ? "저장하는 중…" : editingId ? "저장" : "항목 추가"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={cancelEdit}
              disabled={isSubmitting}
            >
              취소
            </Button>
          )}
        </div>
      </form>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          아직 비용 항목이 없습니다. 지출한 항목과 금액을 추가하면 총액이
          계산됩니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y rounded-lg border">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 px-4 py-3",
                  // 편집 중인 행을 표시한다 — 폼이 목록 위에 있어 어느 항목을
                  // 고치는 중인지 보이지 않으면 엉뚱한 금액을 덮어쓴다
                  editingId === item.id && "bg-muted/40",
                )}
              >
                {/* 항목 이름은 100자까지 자유 입력이다. 좁은 폭에서 넘치지 않게 break-all */}
                <span className="flex-1 break-all text-sm">{item.label}</span>
                {/* 금액은 자릿수를 비교하며 읽으므로 고정폭 숫자로 둔다 */}
                <span className="shrink-0 text-sm tabular-nums">
                  {formatKrw(item.amount)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  onClick={() => startEdit(item)}
                >
                  <PencilIcon size={16} aria-hidden />
                  <span className="sr-only">{item.label} 항목 수정</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 text-destructive"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2Icon size={16} aria-hidden />
                  <span className="sr-only">{item.label} 항목 삭제</span>
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border p-4">
            <span className="text-sm text-muted-foreground">
              전체 비용 ({items.length}건)
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {formatKrw(total)}
            </span>
          </div>
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 항목을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {deleteTarget &&
                `${deleteTarget.label} ${formatKrw(deleteTarget.amount)}을 총액에서 뺍니다. 되돌릴 수 없습니다.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "삭제하는 중…" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
