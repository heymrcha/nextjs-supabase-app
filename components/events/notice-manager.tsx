"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PinIcon, PinOffIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/moim/format";
import {
  noticeSchema,
  type NoticeFormValues,
  type NoticeInput,
} from "@/lib/moim/schemas";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** 서버가 내려주는 한 행. 정렬은 서버가 끝내고 여기서 다시 하지 않는다 */
export type ManagedNotice = {
  id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
};

/**
 * 주최자의 공지 CRUD(T-401)와 고정 토글(T-402).
 *
 * 작성과 수정이 **같은 폼 하나**를 쓴다 — 폼을 둘로 나누면 글자 수 제한·오류 문구가
 * 두 곳으로 갈라지고 한쪽만 고치는 일이 생긴다. `editingId`가 있으면 수정 모드다.
 *
 * 고정은 `is_pinned: true`만 보낸다. **기존 고정을 해제하는 호출을 하지 않는다** —
 * `event_notices_unpin_others` 트리거가 같은 트랜잭션에서 처리하므로(T-402)
 * 클라이언트가 두 번 왕복하는 사이에 고정이 0건으로 남는 창이 없다.
 *
 * 쓰기는 Server Action 없이 브라우저 클라이언트로 직접 한다(`shrimp-rules.md` §4).
 */
export function NoticeManager({
  eventId,
  notices,
}: {
  eventId: string;
  notices: ManagedNotice[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedNotice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // 토글 중인 행만 비활성화한다. 전체를 잠그면 다른 행을 눌러 보고 멈춘 줄 안다
  const [pinningId, setPinningId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NoticeFormValues, unknown, NoticeInput>({
    resolver: zodResolver(noticeSchema),
    defaultValues: { body: "" },
  });

  const onSubmit = async (values: NoticeInput) => {
    const supabase = createClient();

    if (editingId) {
      // PostgREST의 UPDATE는 매칭 0행도 오류가 아니다. 다른 탭에서 이미 삭제한
      // 공지를 저장해도 성공으로 보이므로 반환 행을 직접 확인한다
      const { data, error } = await supabase
        .from("event_notices")
        .update({ body: values.body })
        .eq("id", editingId)
        .select("id");

      if (error || !data?.length) {
        // DB 오류 코드를 그대로 노출하지 않는다(T-602)
        setError("root", {
          message: "공지를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        });
        return;
      }

      setEditingId(null);
      reset({ body: "" });
      toast.success("공지를 수정했습니다");
      router.refresh();
      return;
    }

    const { data, error } = await supabase
      .from("event_notices")
      .insert({ event_id: eventId, body: values.body })
      .select("id")
      .single();

    if (error || !data) {
      setError("root", {
        message: "공지를 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    reset({ body: "" });
    toast.success("공지를 등록했습니다");
    router.refresh();
  };

  const startEdit = (notice: ManagedNotice) => {
    setEditingId(notice.id);
    // 편집 대상이 바뀌면 이전 입력과 오류가 남지 않게 폼을 통째로 되맞춘다
    reset({ body: notice.body });
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset({ body: "" });
  };

  const togglePin = async (notice: ManagedNotice) => {
    setPinningId(notice.id);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("event_notices")
      .update({ is_pinned: !notice.is_pinned })
      .eq("id", notice.id)
      .select("id");

    setPinningId(null);

    if (error || !data?.length) {
      toast.error("고정 상태를 바꾸지 못했습니다");
      return;
    }

    toast.success(
      notice.is_pinned ? "고정을 해제했습니다" : "공지를 고정했습니다",
    );
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const supabase = createClient();
    // RLS가 남의 이벤트 행을 애초에 안 보여주므로 호스트 조건을 또 붙이지 않는다.
    // 다만 매칭 0행도 오류가 아니므로 삭제된 행을 직접 확인한다
    const { data, error } = await supabase
      .from("event_notices")
      .delete()
      .eq("id", deleteTarget.id)
      .select("id");

    setIsDeleting(false);

    if (error || !data?.length) {
      toast.error("공지를 삭제하지 못했습니다");
      return;
    }

    // 지우는 공지를 편집 중이었다면 폼도 비운다. 그러지 않으면 사라진 행을
    // 가리키는 editingId로 저장을 눌러 0행 오류를 보게 된다
    if (editingId === deleteTarget.id) cancelEdit();

    setDeleteTarget(null);
    toast.success("공지를 삭제했습니다");
    router.refresh();
  };

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <Label htmlFor="body">
          {editingId ? "공지 수정" : "새 공지"}
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </Label>
        <Textarea
          id="body"
          rows={4}
          placeholder="참여자에게 전할 내용을 적어 주세요"
          aria-required
          aria-invalid={Boolean(errors.body)}
          {...register("body")}
        />
        {errors.body?.message ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.body.message}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            최대 2000자. 참여자에게 공유 링크 페이지에서 그대로 보입니다.
          </p>
        )}

        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="h-11" disabled={isSubmitting}>
            {isSubmitting ? "저장하는 중…" : editingId ? "저장" : "공지 등록"}
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

      {notices.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          아직 공지가 없습니다. 첫 공지를 쓰면 공유 링크 페이지 상단에 걸립니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notices.map((notice) => (
            <li
              key={notice.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-4",
                // 편집 중인 행을 표시한다 — 폼이 목록 위에 있어 어느 행을
                // 고치는 중인지 보이지 않으면 엉뚱한 공지를 덮어쓴다
                editingId === notice.id && "border-foreground",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {notice.is_pinned && (
                  <Badge variant="secondary" className="gap-1">
                    <PinIcon size={12} aria-hidden />
                    고정
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(notice.created_at)}
                </span>
              </div>

              <p className="whitespace-pre-wrap break-words text-sm">
                {notice.body}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 gap-1"
                  disabled={pinningId === notice.id}
                  onClick={() => togglePin(notice)}
                >
                  {notice.is_pinned ? (
                    <PinOffIcon size={14} aria-hidden />
                  ) : (
                    <PinIcon size={14} aria-hidden />
                  )}
                  {notice.is_pinned ? "고정 해제" : "고정"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 gap-1"
                  onClick={() => startEdit(notice)}
                >
                  <PencilIcon size={14} aria-hidden />
                  수정
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 gap-1 text-destructive"
                  onClick={() => setDeleteTarget(notice)}
                >
                  <Trash2Icon size={14} aria-hidden />
                  삭제
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 공지를 삭제할까요?</DialogTitle>
            <DialogDescription>
              삭제하면 공유 링크 페이지에서도 즉시 사라집니다. 되돌릴 수
              없습니다.
            </DialogDescription>
          </DialogHeader>
          {/* 본문을 다시 보여 준다. 공지는 제목이 없어 Dialog 제목만으로는
              어느 것을 지우는지 확인할 수 없다 */}
          {deleteTarget && (
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">
              {deleteTarget.body}
            </p>
          )}
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
