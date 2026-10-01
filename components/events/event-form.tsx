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
import { createClient } from "@/lib/supabase/client";

/**
 * 이벤트 생성 폼. 주최자 쪽 쓰기는 Server Action을 쓰지 않고 클라이언트에서 직접
 * `supabase.from(...)`을 호출하는 것이 이 저장소의 관례다(`shrimp-rules.md` §4).
 *
 * share_token은 어디에서도 다루지 않는다. 클라이언트가 값을 보내도 before insert
 * 트리거가 덮어쓰므로(D2), 폼이 토큰을 아는 척할 이유가 없다.
 */
export function EventForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EventCreateFormValues, unknown, EventCreateInput>({
    resolver: zodResolver(eventCreateSchema),
    defaultValues: {
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
      .insert({
        host_id: hostId,
        title: values.title,
        starts_at: new Date(values.startsAt).toISOString(),
        location: values.location,
        description: values.description,
        capacity: values.capacity,
        expected_headcount: values.expectedHeadcount,
        rsvp_closes_at: values.rsvpClosesAt
          ? new Date(values.rsvpClosesAt).toISOString()
          : null,
        maybe_deadline: values.maybeDeadline
          ? new Date(values.maybeDeadline).toISOString()
          : null,
        bank_account: values.bankAccount,
      })
      .select("id")
      .single();

    if (error || !data) {
      // DB 오류 코드를 그대로 노출하지 않는다(T-602)
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
          {isSubmitting ? "만드는 중…" : "모임 만들기"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/events")}
          disabled={isSubmitting}
        >
          취소
        </Button>
      </div>
    </form>
  );
}

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
