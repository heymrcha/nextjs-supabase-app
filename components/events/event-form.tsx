"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  eventCreateSchema,
  type EventCreateFormValues,
  type EventCreateInput,
} from "@/lib/moim/schemas";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/moim/share-link";
import { createClient } from "@/lib/supabase/client";

/** 수정 모드에서 받는 기존 값. DB 행의 모양 그대로다 */
export type EventFormDefaults = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  description: string | null;
  capacity: number | null;
  expected_headcount: number | null;
  rsvp_closes_at: string | null;
  maybe_deadline: string | null;
  bank_account: string | null;
};

/** DB 행을 폼이 다루는 문자열로 바꾼다. null·숫자는 전부 ""로 내린다 */
function toFormValues(event: EventFormDefaults): EventCreateFormValues {
  return {
    title: event.title,
    startsAt: toDateTimeLocal(event.starts_at),
    location: event.location ?? "",
    description: event.description ?? "",
    capacity: event.capacity === null ? "" : String(event.capacity),
    expectedHeadcount:
      event.expected_headcount === null ? "" : String(event.expected_headcount),
    rsvpClosesAt: event.rsvp_closes_at
      ? toDateTimeLocal(event.rsvp_closes_at)
      : "",
    maybeDeadline: event.maybe_deadline
      ? toDateTimeLocal(event.maybe_deadline)
      : "",
    bankAccount: event.bank_account ?? "",
  };
}

/**
 * 이벤트 생성·수정 폼. `defaults`가 있으면 수정 모드다 — 필드 정의가 두 곳으로
 * 갈라지지 않게 한 컴포넌트가 두 경우를 모두 맡는다.
 *
 * 주최자 쪽 쓰기는 Server Action을 쓰지 않고 클라이언트에서 직접
 * `supabase.from(...)`을 호출하는 것이 이 저장소의 관례다(`shrimp-rules.md` §4).
 *
 * share_token은 어디에서도 다루지 않는다. 클라이언트가 값을 보내도 before insert
 * 트리거가 덮어쓰므로(D2), 폼이 토큰을 아는 척할 이유가 없다.
 */
export function EventForm({ defaults }: { defaults?: EventFormDefaults }) {
  const router = useRouter();
  const isEdit = defaults !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventCreateFormValues, unknown, EventCreateInput>({
    resolver: zodResolver(eventCreateSchema),
    defaultValues: defaults
      ? toFormValues(defaults)
      : {
          title: "",
          startsAt: "",
          location: "",
          description: "",
          capacity: "",
          expectedHeadcount: "",
          rsvpClosesAt: "",
          maybeDeadline: "",
          bankAccount: "",
        },
  });

  const onSubmit = async (values: EventCreateInput) => {
    const supabase = createClient();

    // 생성과 수정이 같은 컬럼 묶음을 쓴다. host_id만 생성에서 더 붙는다
    //
    // datetime-local 값은 반드시 fromDateTimeLocal로 해석한다. `new Date(값)`을 쓰면
    // 브라우저 로컬 타임존으로 읽는데, 입력칸을 채울 때 쓰는 toDateTimeLocal은
    // Asia/Seoul 기준이라 두 규칙이 어긋난다 — 해외 타임존 기기에서는 수정 화면을
    // 열어 아무것도 고치지 않고 저장하기만 해도 일시가 오프셋 차이만큼 밀렸다.
    const columns = {
      title: values.title,
      starts_at: fromDateTimeLocal(values.startsAt),
      location: values.location,
      description: values.description,
      capacity: values.capacity,
      expected_headcount: values.expectedHeadcount,
      rsvp_closes_at: values.rsvpClosesAt
        ? fromDateTimeLocal(values.rsvpClosesAt)
        : null,
      maybe_deadline: values.maybeDeadline
        ? fromDateTimeLocal(values.maybeDeadline)
        : null,
      bank_account: values.bankAccount,
    };

    if (defaults) {
      const { data: updated, error } = await supabase
        .from("events")
        .update(columns)
        .eq("id", defaults.id)
        .is("deleted_at", null)
        // PostgREST의 UPDATE는 매칭 0행도 오류가 아니다. 다른 탭에서 이미 삭제된
        // 모임을 저장해도 성공으로 보이므로 반환 행을 직접 확인한다
        .select(
          "id, title, description, location, starts_at, capacity, expected_headcount, rsvp_closes_at, maybe_deadline, bank_account",
        )
        .maybeSingle();

      if (error || !updated) {
        // DB 오류 코드를 그대로 노출하지 않는다(T-602)
        setError("root", {
          message: "모임을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        });
        return;
      }

      // 서버가 정규화한 값(trim 등)으로 폼을 되맞춘다. reset 없이 두면 RHF가 옛
      // 입력값을 들고 있어 화면과 저장된 값이 어긋난다
      reset(toFormValues(updated));
      toast.success("모임 정보를 수정했습니다");
      router.refresh();
      return;
    }

    const { data: claims } = await supabase.auth.getClaims();
    const hostId = claims?.claims?.sub;

    if (!hostId) {
      setError("root", {
        message: "세션이 만료되었습니다. 다시 로그인해 주세요.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .insert({ host_id: hostId, ...columns })
      .select("id")
      .single();

    if (error || !data) {
      setError("root", {
        message: "모임을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    toast.success("모임을 만들었습니다");
    router.push(`/events/${data.id}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Field
        label="제목"
        required
        error={errors.title?.message}
        htmlFor="title"
      >
        <Input
          id="title"
          placeholder="예) 10월 동네 모임"
          aria-required
          aria-invalid={Boolean(errors.title)}
          {...register("title")}
        />
      </Field>

      <Field
        label="일시"
        required
        error={errors.startsAt?.message}
        htmlFor="startsAt"
      >
        <Input
          id="startsAt"
          type="datetime-local"
          aria-required
          aria-invalid={Boolean(errors.startsAt)}
          {...register("startsAt")}
        />
      </Field>

      <Field label="장소" error={errors.location?.message} htmlFor="location">
        <Input
          id="location"
          placeholder="예) 망원동 고깃집"
          {...register("location")}
        />
      </Field>

      <Field
        label="설명"
        error={errors.description?.message}
        htmlFor="description"
      >
        <Textarea
          id="description"
          rows={4}
          placeholder="모임을 소개하는 내용을 적어 주세요"
          {...register("description")}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="정원"
          error={errors.capacity?.message}
          htmlFor="capacity"
          hint="비워 두면 제한하지 않습니다"
        >
          <Input
            id="capacity"
            type="number"
            min={1}
            inputMode="numeric"
            aria-invalid={Boolean(errors.capacity)}
            {...register("capacity")}
          />
        </Field>

        <Field
          label="예상 인원"
          error={errors.expectedHeadcount?.message}
          htmlFor="expectedHeadcount"
          hint="링크 응답률을 보는 데만 씁니다"
        >
          <Input
            id="expectedHeadcount"
            type="number"
            min={1}
            inputMode="numeric"
            aria-invalid={Boolean(errors.expectedHeadcount)}
            {...register("expectedHeadcount")}
          />
        </Field>

        <Field
          label="응답 마감"
          error={errors.rsvpClosesAt?.message}
          htmlFor="rsvpClosesAt"
          hint="이 시각 이후에는 응답할 수 없습니다"
        >
          <Input
            id="rsvpClosesAt"
            type="datetime-local"
            aria-invalid={Boolean(errors.rsvpClosesAt)}
            {...register("rsvpClosesAt")}
          />
        </Field>

        <Field
          label="미정 확정 기한"
          error={errors.maybeDeadline?.message}
          htmlFor="maybeDeadline"
          hint="지나도 자동으로 바뀌지 않고 배지만 붙습니다"
        >
          <Input
            id="maybeDeadline"
            type="datetime-local"
            aria-invalid={Boolean(errors.maybeDeadline)}
            {...register("maybeDeadline")}
          />
        </Field>
      </div>

      <Field
        label="계좌 안내"
        error={errors.bankAccount?.message}
        htmlFor="bankAccount"
        hint="정산을 공개할 때 참여자에게 그대로 보여 줍니다"
      >
        <Input
          id="bankAccount"
          placeholder="예) 토스뱅크 1000-0000-0000 홍길동"
          {...register("bankAccount")}
        />
      </Field>

      {errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? "저장하는 중…"
              : "만드는 중…"
            : isEdit
              ? "저장"
              : "모임 만들기"}
        </Button>
        {!isEdit && (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/events")}
            disabled={isSubmitting}
          >
            취소
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * `*`는 시각 표시일 뿐이라 `aria-hidden`으로 숨기고, 필수 여부는 입력 요소의
 * `aria-required`로 전달한다. 둘 다 빠지면 보조기기에 필수 정보가 닿지 않는다.
 */
function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
