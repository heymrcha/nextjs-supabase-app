"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  RsvpTimeline,
  type RsvpChange,
} from "@/components/events/rsvp-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RSVP_STATUS_LABEL, formatDateTime } from "@/lib/moim/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { RsvpStatus } from "@/types/moim";

const STATUS_ORDER: RsvpStatus[] = ["attending", "maybe", "declined"];

/** 서버가 만들어 내려주는 한 행. 표시 값은 `buildRoster`가 이미 계산했다 */
export type ManagedRsvp = {
  id: string;
  /** 동명이인 번호가 붙은 표시용 이름 */
  label: string;
  status: RsvpStatus;
  /** **이 화면에만 보이는 값**(수정 사항 4). 게스트 payload에는 본인 것만 들어간다 */
  note: string | null;
  respondedAt: string;
  waitlistNumber: number | null;
  isOverCapacity: boolean;
  isDeadlinePassed: boolean;
  changes: RsvpChange[];
};

/**
 * 주최자의 응답 관리. 3탭 · 인원 수 · 정원 초과 표시 · 이력 펼치기 · 중복 응답 삭제.
 *
 * 표시 규칙은 서버에서 `lib/moim/roster.ts`로 계산해 내려받는다 — 게스트 명단과 같은
 * 함수를 쓰므로 같은 데이터가 두 화면에서 다르게 보이지 않는다.
 *
 * **병합은 구현하지 않는다.** 중복 응답 정리는 삭제로 갈음한다 — 병합은 "어느 쪽 메모와
 * 이력을 남기는가"를 정해야 하고, 그 판단을 MVP 단계에서 고정하면 되돌리기 어렵다.
 * 삭제해도 `rsvp_changes`와 `settlement_shares`는 `on delete set null`로 보존된다.
 */
export function RsvpManager({
  rsvps,
  capacity,
}: {
  rsvps: ManagedRsvp[];
  capacity: number | null;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [target, setTarget] = useState<ManagedRsvp | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!target) return;
    setIsDeleting(true);

    const supabase = createClient();
    // RLS가 남의 이벤트 행을 애초에 안 보여주므로 호스트 조건을 또 붙이지 않는다.
    // 다만 매칭 0행도 오류가 아니므로 삭제된 행을 직접 확인한다
    const { data, error } = await supabase
      .from("rsvps")
      .delete()
      .eq("id", target.id)
      .select("id");

    setIsDeleting(false);

    if (error || !data?.length) {
      toast.error("응답을 삭제하지 못했습니다");
      return;
    }

    setTarget(null);
    toast.success("응답을 삭제했습니다");
    router.refresh();
  };

  return (
    <>
      <Tabs defaultValue="attending">
        <TabsList className="min-h-[52px] w-full overflow-x-auto">
          {STATUS_ORDER.map((status) => (
            <TabsTrigger key={status} value={status}>
              {RSVP_STATUS_LABEL[status]}{" "}
              {rsvps.filter((rsvp) => rsvp.status === status).length}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_ORDER.map((status) => {
          const rows = rsvps.filter((rsvp) => rsvp.status === status);

          return (
            <TabsContent key={status} value={status}>
              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {RSVP_STATUS_LABEL[status]} 응답이 아직 없습니다.
                </p>
              ) : (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {rows.map((rsvp) => (
                    <li key={rsvp.id} className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                        <button
                          type="button"
                          // 행 전체가 펼치기 버튼이다. 이력은 부가 정보이므로
                          // 별도 아이콘 버튼을 두는 것보다 터치 영역이 넓은 편이 낫다
                          className="flex min-h-11 flex-1 items-center gap-2 text-left text-sm"
                          aria-expanded={expandedId === rsvp.id}
                          aria-controls={`timeline-${rsvp.id}`}
                          onClick={() =>
                            setExpandedId(
                              expandedId === rsvp.id ? null : rsvp.id,
                            )
                          }
                        >
                          <ChevronDownIcon
                            size={16}
                            aria-hidden
                            className={cn(
                              "shrink-0 transition-transform",
                              expandedId === rsvp.id && "rotate-180",
                            )}
                          />
                          <span
                            className={cn(
                              "break-all",
                              rsvp.isOverCapacity && "text-muted-foreground",
                            )}
                          >
                            {rsvp.label}
                          </span>
                          {rsvp.waitlistNumber !== null && (
                            <Badge variant="secondary" className="shrink-0">
                              대기 {rsvp.waitlistNumber}번
                            </Badge>
                          )}
                          {rsvp.isDeadlinePassed && (
                            <Badge variant="outline" className="shrink-0">
                              기한 초과
                            </Badge>
                          )}
                        </button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0 text-destructive"
                          onClick={() => setTarget(rsvp)}
                        >
                          <Trash2Icon size={16} aria-hidden />
                          <span className="sr-only">
                            {rsvp.label} 응답 삭제
                          </span>
                        </Button>
                      </div>

                      {/* 메모는 이 화면에만 나타난다. 접지 않고 항상 보여준다 —
                          주최자가 응답 목록을 훑는 이유의 절반이 메모다 */}
                      {rsvp.note && (
                        <p className="whitespace-pre-wrap break-words px-4 pb-3 text-sm text-muted-foreground">
                          {rsvp.note}
                        </p>
                      )}

                      {expandedId === rsvp.id && (
                        <div
                          id={`timeline-${rsvp.id}`}
                          className="flex flex-col gap-2 bg-muted/30 px-4 py-3"
                        >
                          <p className="text-sm font-medium">변경 이력</p>
                          <RsvpTimeline changes={rsvp.changes} />
                          <p className="text-sm text-muted-foreground">
                            최초 응답 {formatDateTime(rsvp.respondedAt)}
                          </p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {capacity !== null && (
        <p className="text-sm text-muted-foreground">
          정원 {capacity}명. 초과 응답은 거부하지 않고 대기 순번으로 표시합니다.
        </p>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 응답을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {target?.label} 님의 응답을 삭제합니다. 되돌릴 수 없습니다. 변경
              이력과 이미 만들어진 정산 스냅샷의 이름 · 금액은 남습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setTarget(null)}
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
