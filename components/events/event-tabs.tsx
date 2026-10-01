"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "", label: "개요" },
  { segment: "responses", label: "응답" },
  { segment: "notices", label: "공지" },
  { segment: "settlement", label: "정산" },
  { segment: "settings", label: "설정" },
] as const;

export function EventTabs() {
  const pathname = usePathname();
  // /events/<id>/<segment> 구조에서 직접 읽는다. params를 내려받지 않아
  // layout을 서버 컴포넌트로 유지할 수 있다
  const [, , eventId = "", current = ""] = pathname.split("/");

  return (
    // 탭 5개는 좁은 폭(375px)에서 한 줄에 들어가지 않는다. 줄바꿈 대신 가로 스크롤로
    // 흘려 보내 탭 줄의 높이가 변하지 않게 한다
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      {TABS.map((tab) => {
        // 개요는 하위 탭 경로에서도 startsWith가 참이 되므로 정확히 일치로 판정한다
        const isActive = current === tab.segment;

        return (
          <Link
            key={tab.label}
            href={`/events/${eventId}${tab.segment ? `/${tab.segment}` : ""}`}
            aria-current={isActive ? "page" : undefined}
            // min-h-11: 손가락으로 누를 수 있는 최소 높이(약 44px)를 확보한다
            className={cn(
              "flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-4 text-sm transition-colors",
              isActive
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
