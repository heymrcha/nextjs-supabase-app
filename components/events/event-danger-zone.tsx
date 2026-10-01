"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/moim/format";
import { createClient } from "@/lib/supabase/client";

/**
 * 응답 마감과 삭제. 되돌리기 어려운 동작만 모아 둔 자리다.
 *
 * 마감은 별도 상태 컬럼을 두지 않고 `rsvp_closes_at`을 앞으로 당긴다.
 * 컬럼을 새로 만들면 "마감인가?" 판정이 두 곳으로 갈라진다.
 */
export function EventDangerZone({
  eventId,
  title,
  startsAt,
  rsvpClosesAt,
  isClosed,
}: {
  eventId: string;
  title: string;
  startsAt: string;
  rsvpClosesAt: string | null;
  /**
   * 마감 여부는 서버에서 판정해 받는다. 렌더 본문에서 `Date.now()`를 부르면
   * `react-hooks/purity`에 걸리고, 서버·클라이언트 시각이 달라 hydration도 흔들린다.
   */
  isClosed: boolean;
}) {
  const router = useRouter();
  const [confirmTitle, setConfirmTitle] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  // 두 동작이 상태를 공유하면 한쪽 진행이 다른 쪽 버튼까지 잠근다
  const [isClosing, setIsClosing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCloseRsvp = async () => {
    setIsClosing(true);
    const supabase = createClient();

    /**
     * 마감 시각을 `min(지금, 모임 일시)`로 둔다. 그냥 `지금`을 쓰면 이미 시작한 모임에서
     * `rsvp_closes_at > starts_at`이 되는데, 설정 폼의 zod refine("응답 마감은 모임
     * 일시보다 늦을 수 없습니다")이 그 상태를 거부해 이후 어떤 필드도 저장할 수 없게 된다.
     */
    const now = new Date();
    const closesAt = new Date(
      Math.min(now.getTime(), new Date(startsAt).getTime()),
    ).toISOString();

    const { data, error } = await supabase
      .from("events")
      .update({ rsvp_closes_at: closesAt })
      .eq("id", eventId)
      .is("deleted_at", null)
      // PostgREST의 UPDATE는 매칭 0행도 오류가 아니다. 다른 탭에서 이미 삭제했거나
      // RLS가 막은 경우를 성공으로 보고하지 않으려면 반환 행을 직접 확인해야 한다
      .select("id");

    setIsClosing(false);

    if (error || !data?.length) {
      toast.error("응답을 마감하지 못했습니다");
      return;
    }

    setIsCloseOpen(false);
    toast.success("응답을 마감했습니다");
    router.refresh();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    // 소프트 삭제. 하드 삭제하면 응답·정산 기록까지 cascade로 사라진다
    const { data, error } = await supabase
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", eventId)
      .is("deleted_at", null)
      // 0행이면 이미 삭제된 모임이다. 그대로 두면 "삭제했습니다"가 거짓이 된다
      .select("id");
    setIsDeleting(false);

    if (error || !data?.length) {
      toast.error("모임을 삭제하지 못했습니다");
      return;
    }

    toast.success("모임을 삭제했습니다");
    router.push("/events");
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-destructive/40 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">응답 마감과 삭제</h2>
        <p className="text-sm text-muted-foreground">
          되돌리기 어려운 작업입니다.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="gap-2 self-start"
              disabled={isClosed}
            >
              <LockIcon size={16} aria-hidden />
              {isClosed ? "이미 마감되었습니다" : "응답 즉시 마감"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>응답을 지금 마감할까요?</DialogTitle>
              <DialogDescription>
                지금부터 응답을 받지 않습니다. 이미 받은 응답은 그대로 유지되고,
                설정에서 마감 시각을 다시 뒤로 미룰 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCloseOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                disabled={isClosing}
                onClick={handleCloseRsvp}
              >
                {isClosing ? "마감하는 중…" : "마감"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <p className="text-sm text-muted-foreground">
          {rsvpClosesAt
            ? `현재 마감 시각은 ${formatDateTime(rsvpClosesAt)}입니다.`
            : "마감 시각이 설정되어 있지 않습니다."}
        </p>
      </div>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="destructive"
            className="gap-2 self-start"
          >
            <Trash2Icon size={16} aria-hidden />
            모임 삭제
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>모임을 삭제할까요?</DialogTitle>
            <DialogDescription>
              삭제하면 목록에서 사라지고 공유 링크도 열리지 않습니다. 되돌릴 수
              없습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="deleteConfirm">
              확인을 위해 모임 제목 <span className="font-medium">{title}</span>
              을(를) 그대로 입력해 주세요
            </Label>
            <Input
              id="deleteConfirm"
              value={confirmTitle}
              autoComplete="off"
              onChange={(event) => setConfirmTitle(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmTitle !== title || isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "삭제하는 중…" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
