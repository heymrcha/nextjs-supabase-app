"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { RSVP_STATUS_LABEL } from "@/lib/moim/format";
import {
  guestRsvpSchema,
  type GuestRsvpFormValues,
  type GuestRsvpInput,
} from "@/lib/moim/schemas";
import type { RsvpStatus } from "@/types/moim";

const STATUS_OPTIONS: RsvpStatus[] = ["attending", "maybe", "declined"];

export type GuestRsvpDefaults = {
  display_name: string;
  status: RsvpStatus;
  note: string | null;
};

/**
 * 게스트 응답 폼. 쓰기는 Server Action이 아니라 `POST /api/guest/rsvp` 한 곳을 통한다 —
 * httpOnly 쿠키 발급과 토큰 검증이 그 Handler에 모여 있다(T-302).
 *
 * 검증 스키마는 서버와 **같은 `guestRsvpSchema`**다. 한쪽만 고치면 클라이언트는
 * 통과시키고 DB가 거부해 사용자에게 알 수 없는 오류가 뜨므로, 공유가 이 구조의 핵심이다.
 *
 * `guest_key`는 폼이 다루지 않는다. 쿠키는 `fetch`가 자동으로 보내고(same-origin),
 * Handler가 쿠키 값만 쓴다. 폼이 키를 아는 척할 이유가 없다.
 */
export function GuestRsvpForm({
  token,
  eventId,
  defaults,
  otherNames,
}: {
  token: string;
  eventId: string;
  defaults: GuestRsvpDefaults | null;
  /** 본인 행을 제외한 명단의 이름. 동일 이름 충돌 안내에만 쓴다 */
  otherNames: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<GuestRsvpInput | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GuestRsvpFormValues, unknown, GuestRsvpInput>({
    resolver: zodResolver(guestRsvpSchema),
    defaultValues: {
      // token·eventId는 입력칸이 없는 고정값이다. 스키마를 쪼개지 않고 그대로 쓴다
      token,
      eventId,
      name: defaults?.display_name ?? "",
      status: defaults?.status ?? "attending",
      note: defaults?.note ?? "",
    },
  });

  const submit = async (values: GuestRsvpInput) => {
    const response = await fetch("/api/guest/rsvp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) {
      toast.success(defaults ? "응답을 수정했습니다" : "응답을 보냈습니다");
      router.push(`/e/${token}`);
      return;
    }

    // Handler가 내려주는 문구는 이미 한국어이고 DB 원문이 섞이지 않는다(T-302).
    // 상태 코드로 "어디에 표시할지"만 가른다.
    if (response.status === 410) {
      // 링크가 만료·삭제된 경우. 폼에 오류를 띄워도 할 수 있는 일이 없다
      router.replace("/e/expired");
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    const message = extractMessage(body);

    if (response.status === 400) {
      // 서버 검증이 클라이언트를 통과한 값을 거부한 경우(스키마가 어긋났다는 신호)
      setError("name", { message: message ?? "입력값을 확인해 주세요" });
      return;
    }

    setError("root", {
      message:
        message ?? "응답을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  };

  /**
   * 동일 이름 충돌은 클라이언트가 명단을 보고 판정한다 — 명단은 어차피 전원 공개이므로
   * 정보 노출이 아니다. 서버는 이름 중복을 **거부하지 않는다**(동명이인이 실제로 있다).
   * 중복 정리는 주최자 화면(T-306)에서 **삭제로** 한다 — 병합은 구현하지 않았다.
   * 그래서 Dialog 문구도 "합친다"가 아니라 "정리할 수 있다"로 쓴다.
   */
  const onSubmit = (values: GuestRsvpInput) => {
    const collides = otherNames.some((name) => name === values.name);
    if (collides) {
      setPending(values);
      return;
    }

    return submit(values);
  };

  const confirmDuplicate = async () => {
    if (!pending) return;
    const values = pending;
    setPending(null);
    await submit(values);
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">
            이름
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="name"
            className="h-11"
            placeholder="명단에 보일 이름"
            maxLength={20}
            autoComplete="name"
            aria-required
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name?.message ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.name.message}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              20자 이내로 입력해 주세요.
            </p>
          )}
        </div>

        {/**
         * 네이티브 radio를 쓴다. 보기는 세그먼트 버튼이지만 키보드 방향키 이동과
         * 그룹 의미가 공짜로 따라온다 — 버튼 3개로 만들면 둘 다 직접 구현해야 한다.
         * `sr-only` 입력은 포커스 링이 보이지 않으므로 라벨에 `has-[:focus-visible]`로 건다.
         */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium leading-none">
            참석 여부
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((status) => (
              <label
                key={status}
                className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <input
                  type="radio"
                  value={status}
                  className="sr-only"
                  {...register("status")}
                />
                {RSVP_STATUS_LABEL[status]}
              </label>
            ))}
          </div>
          {errors.status?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.status.message}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="note">메모</Label>
          <Textarea
            id="note"
            rows={3}
            maxLength={200}
            placeholder="예) 30분쯤 늦게 도착합니다"
            aria-invalid={Boolean(errors.note)}
            {...register("note")}
          />
          {errors.note?.message ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.note.message}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              주최자에게만 보입니다. 200자 이내.
            </p>
          )}
        </div>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "보내는 중…" : defaults ? "응답 수정" : "응답 보내기"}
        </Button>
      </form>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>동일 이름 응답이 있습니다</DialogTitle>
            <DialogDescription>
              이미 같은 이름으로 응답한 사람이 있습니다. 새 응답으로 추가하면
              명단에 두 줄로 나타납니다. 본인의 이전 응답을 고치려던 것이라면
              취소하고 주최자에게 알려 주세요 — 중복된 응답은 주최자가 정리할 수
              있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setPending(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              className="h-11"
              disabled={isSubmitting}
              onClick={confirmDuplicate}
            >
              새 응답으로 추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Handler의 실패 응답 형태(`{ error: { code, message } }`)에서 문구만 꺼낸다 */
function extractMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}
