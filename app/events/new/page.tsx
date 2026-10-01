import { EventForm } from "@/components/events/event-form";

export default function NewEventPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">새 모임 만들기</h1>
        <p className="text-sm text-muted-foreground">
          만들고 나면 공유 링크가 발급됩니다. 링크를 받은 사람은 가입 없이
          응답할 수 있습니다.
        </p>
      </div>

      {/* 폼은 세션을 직접 읽지 않고 제출 시점에 확인하므로 Suspense 경계가 필요 없다 */}
      <EventForm />
    </div>
  );
}
