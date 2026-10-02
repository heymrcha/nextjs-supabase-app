/**
 * 응답 변경 이력 타임라인. **주최자 전용**이다 — 게스트 경로에서 이 컴포넌트를
 * import하면 안 된다(PRD 8절: 이력은 주최자에게만 보인다).
 *
 * 이력은 읽기 전용이다. `rsvp_changes`에는 INSERT/UPDATE/DELETE 정책이 없어(T-103)
 * 주최자도 조작할 수 없고, 기록은 security definer 트리거만 한다(T-106).
 */

import { formatShortDateTime, RSVP_STATUS_LABEL } from "@/lib/moim/format";
import type { RsvpStatus } from "@/types/moim";

export type RsvpChange = {
  from_status: RsvpStatus | null;
  to_status: RsvpStatus;
  from_name: string | null;
  to_name: string | null;
  changed_at: string;
};

/**
 * 한 건의 변경을 한국어 한 줄로 만든다. 상태와 이름이 같이 바뀐 경우 둘 다 보여준다 —
 * 트리거가 두 조건을 한 행에 기록하므로(T-106) 하나만 보여주면 정보가 사라진다.
 */
function describe(change: RsvpChange): string {
  const parts: string[] = [];

  if (change.from_status === null) {
    // 트리거의 INSERT 분기. from_status가 null인 유일한 경우다
    parts.push(`최초 응답: ${RSVP_STATUS_LABEL[change.to_status]}`);
  } else if (change.from_status !== change.to_status) {
    parts.push(
      `${RSVP_STATUS_LABEL[change.from_status]} → ${RSVP_STATUS_LABEL[change.to_status]}`,
    );
  }

  if (
    change.from_name !== null &&
    change.to_name !== null &&
    change.from_name !== change.to_name
  ) {
    parts.push(`이름 변경: ${change.from_name} → ${change.to_name}`);
  }

  // 트리거가 status·display_name 중 하나는 바뀔 때만 기록하므로 빈 문자열은 나오지 않는다.
  // 그래도 조건이 늘어났을 때 빈 줄이 보이는 것보다는 낫다
  return parts.length > 0 ? parts.join(" · ") : "변경";
}

export function RsvpTimeline({ changes }: { changes: RsvpChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        변경 이력이 없습니다. 응답이 트리거보다 먼저 만들어진 경우에만 비어
        있습니다.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {changes.map((change, index) => (
        <li
          // changed_at이 같은 행이 있을 수 있어(같은 트랜잭션) 시각만으로는 키가 겹친다
          key={`${change.changed_at}-${index}`}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
        >
          <time
            dateTime={change.changed_at}
            className="shrink-0 tabular-nums text-muted-foreground"
          >
            {formatShortDateTime(change.changed_at)}
          </time>
          <span className="break-all">{describe(change)}</span>
        </li>
      ))}
    </ol>
  );
}
