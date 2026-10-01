import { EventTabs } from "@/components/events/event-tabs";
import { Suspense } from "react";

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* cacheComponents에서는 usePathname()처럼 URL을 읽는 클라이언트 훅도
          Suspense 경계가 필요하다. 없으면 프리렌더가 막힌다 */}
      <Suspense fallback={<div className="h-10 border-b" />}>
        <EventTabs />
      </Suspense>
      {children}
    </div>
  );
}
