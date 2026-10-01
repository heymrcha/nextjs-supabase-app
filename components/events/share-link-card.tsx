"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
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
import {
  buildShareUrl,
  fromDateTimeLocal,
  toDateTimeLocal,
} from "@/lib/moim/share-link";
import { createClient } from "@/lib/supabase/client";

/** Dialog에서 정확히 이 글자를 입력해야 재발급이 실행된다 */
const CONFIRM_WORD = "재발급";

/** DB 값을 입력칸이 쓰는 문자열로. null("만료 없음")은 빈 문자열이다 */
function toExpiryInput(value: string | null): string {
  return value ? toDateTimeLocal(value) : "";
}

export function ShareLinkCard({
  eventId,
  shareToken,
  shareExpiresAt,
}: {
  eventId: string;
  shareToken: string;
  shareExpiresAt: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState(shareToken);
  /**
   * null은 "만료 없음"이라는 유효한 상태이고, 여기서 기본값을 꾸며 넣지 않는다.
   * 기본 만료(모임 당일 자정)는 insert 트리거가 DB에서 채우므로 이 값이 곧 진실이다 —
   * 예전처럼 화면에서만 기본값을 보여 주면 실제로는 영구 유효한 링크를 두고
   * 주최자가 "모임 다음 날 닫힌다"고 오인한다.
   */
  const [savedExpiresAt, setSavedExpiresAt] = useState(shareExpiresAt);
  const [expiryInput, setExpiryInput] = useState(toExpiryInput(shareExpiresAt));
  const [confirmText, setConfirmText] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSavingExpiry, setIsSavingExpiry] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const shareUrl = buildShareUrl(token);
  const isExpiryDirty = expiryInput !== toExpiryInput(savedExpiresAt);

  const handleCopy = async () => {
    try {
      // clipboard API는 보안 컨텍스트(https 또는 localhost)에서만 동작한다
      await navigator.clipboard.writeText(shareUrl);
      toast.success("링크를 복사했습니다");
    } catch {
      toast.error("자동 복사에 실패했습니다. 링크를 길게 눌러 복사해 주세요.");
    }
  };

  /**
   * 만료 시각 저장. 입력칸의 `onChange`가 아니라 명시적인 동작으로만 쓴다.
   *
   * `type="datetime-local"`의 onChange는 연·월·일·시·분을 고칠 때마다 발생하고
   * 편집 중간에는 값이 ""가 되는 순간이 있다. 거기에 붙여 두면 날짜를 고치는 동안
   * `share_expires_at = null`(= 영구 링크)이 저장되고, 연속 입력의 응답 순서가
   * 보장되지 않아 마지막에 넣은 값이 아닌 것이 최종 상태로 남을 수 있었다.
   */
  const saveExpiry = async (nextIso: string | null) => {
    setIsSavingExpiry(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("events")
      .update({ share_expires_at: nextIso })
      .eq("id", eventId)
      // 소프트 삭제된 이벤트는 손대지 않는다. 읽기 경로에만 필터를 걸면
      // 화면에 없는 행이 조용히 갱신될 수 있다
      .is("deleted_at", null);

    setIsSavingExpiry(false);

    if (error) {
      toast.error("만료 시각을 바꾸지 못했습니다");
      return;
    }

    setSavedExpiresAt(nextIso);
    setExpiryInput(toExpiryInput(nextIso));
    toast.success(
      nextIso ? "만료 시각을 바꿨습니다" : "만료 없음으로 바꿨습니다",
    );
    router.refresh();
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);

    const supabase = createClient();
    // 토큰 생성은 DB 함수 하나가 책임진다(D2). 클라이언트는 값을 만들지 않는다
    const { data, error } = await supabase.rpc("regenerate_share_token", {
      p_event_id: eventId,
    });

    setIsRegenerating(false);

    if (error || !data) {
      toast.error("링크를 재발급하지 못했습니다");
      return;
    }

    setToken(data);
    setConfirmText("");
    setIsDialogOpen(false);
    toast.success(
      "링크를 재발급했습니다. 이전 링크는 더 이상 열리지 않습니다.",
    );
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">공유 링크</h2>
        <p className="text-sm text-muted-foreground">
          이 링크를 받은 사람은 가입 없이 응답할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={shareUrl} aria-label="공유 링크" />
        <Button
          type="button"
          onClick={handleCopy}
          className="gap-2 sm:shrink-0"
        >
          <CopyIcon size={16} aria-hidden />
          링크 복사
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shareExpiresAt">만료 시각</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="shareExpiresAt"
            type="datetime-local"
            value={expiryInput}
            onChange={(event) => setExpiryInput(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="sm:shrink-0"
            disabled={!isExpiryDirty || expiryInput === "" || isSavingExpiry}
            onClick={() => saveExpiry(fromDateTimeLocal(expiryInput))}
          >
            {isSavingExpiry ? "저장하는 중…" : "만료 시각 저장"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {savedExpiresAt
            ? `${formatDateTime(savedExpiresAt)}에 링크가 닫힙니다.`
            : "현재 이 링크는 만료되지 않습니다."}
        </p>
        {savedExpiresAt && (
          <Button
            type="button"
            variant="ghost"
            className="self-start text-sm"
            disabled={isSavingExpiry}
            onClick={() => saveExpiry(null)}
          >
            만료 없이 계속 열어 두기
          </Button>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="gap-2 self-start">
            <RefreshCwIcon size={16} aria-hidden />
            링크 재발급
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공유 링크를 재발급할까요?</DialogTitle>
            <DialogDescription>
              이전 링크는 즉시 사용할 수 없게 되며, 이미 받은 응답은 그대로
              유지됩니다. 응답한 분들은 새 링크에서도 본인 응답을 그대로 찾을 수
              있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="regenerateConfirm">
              확인을 위해 <span className="font-medium">{CONFIRM_WORD}</span>을
              입력해 주세요
            </Label>
            <Input
              id="regenerateConfirm"
              value={confirmText}
              autoComplete="off"
              onChange={(event) => setConfirmText(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText !== CONFIRM_WORD || isRegenerating}
              onClick={handleRegenerate}
            >
              재발급
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
