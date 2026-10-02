/**
 * 분담금 계산(T-502). **순수 함수만 둔다** — DB도 화면도 모르고, 입력이 같으면 결과가
 * 같다. 계산을 한 곳에 모으는 이유는 `lib/moim/dashboard.ts`의 주석과 같다: 같은 수를
 * 두 곳에서 따로 구하면 대시보드 배지와 정산 화면이 어긋난다.
 *
 * 정산 대상은 `status = 'attending'`인 응답뿐이다.
 *
 * PRD §6의 "참석이고 **기한 초과가 아닌**" 조건은 여기에 옮기지 않았다. "기한 초과"는
 * 미정 확정 기한을 넘긴 `maybe` 응답에만 붙는 배지라(`lib/moim/roster.ts`) `attending`과
 * 동시에 성립할 수 없고, 그대로 옮기면 항상 참인 사문(死文)이 되어 읽는 사람에게
 * "참석자 중에도 제외되는 사람이 있다"는 오해를 준다. §4 엣지 케이스의 "미정 기한
 * 초과자는 정산 대상에서 제외된다"는 **미정이 참석으로 자동 전환되지 않으므로**
 * 대상 조건을 `attending`으로 두는 것만으로 이미 충족된다.
 */

/** 스냅샷에 복사할 1명. 이름은 응답이 지워진 뒤에도 남아야 하므로 함께 들고 다닌다 */
export type SettlementPayer = {
  rsvpId: string;
  displayName: string;
};

export type SettlementCalculation = {
  /** Σ settlement_items.amount */
  total: number;
  payerCount: number;
  /** 1인당 분담금. 절상 단위의 배수다 */
  perPerson: number;
  /** perPerson × payerCount. total보다 크거나 같다 */
  collected: number;
  /** collected - total. 양수면 주최자에게 남는 잔액 */
  hostDiff: number;
};

export function sumItemAmounts(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * 참석자가 0명이면 **계산하지 않고 null을 돌려준다.** 0으로 나누면 Infinity가 되고,
 * 그것을 금액으로 렌더하면 화면에 `₩Infinity`가 찍힌다. 호출부가 null을 받아
 * "참석자가 없어 분담금을 계산할 수 없습니다"를 보여 주는 것이 계약이다.
 *
 * `roundingUnit`은 `settlements.rounding_unit`(기본 10원)이고 DB가 `> 0`을 보장한다.
 * 그래도 방어적으로 확인한다 — 0이 들어오면 역시 0으로 나누기가 된다.
 *
 * 올림은 `ceil(total / (payerCount × unit)) × unit` 한 번으로 끝낸다. total과 분모가
 * 모두 정수라 IEEE 나눗셈이 정확히 반올림되므로, 나누어떨어지는 경우에 올림이 한 단위
 * 더 붙는 일이 없다.
 */
export function calculateSettlement({
  total,
  payerCount,
  roundingUnit,
}: {
  total: number;
  payerCount: number;
  roundingUnit: number;
}): SettlementCalculation | null {
  if (payerCount <= 0 || roundingUnit <= 0) return null;

  const perPerson =
    Math.ceil(total / (payerCount * roundingUnit)) * roundingUnit;
  const collected = perPerson * payerCount;

  return {
    total,
    payerCount,
    perPerson,
    collected,
    hostDiff: collected - total,
  };
}

/** 미수금. 스냅샷 행의 금액을 더한다 — `lib/moim/dashboard.ts`의 배지와 같은 식이다 */
export function sumUnpaid(
  shares: { amount: number; is_paid: boolean }[],
): number {
  return shares
    .filter((share) => !share.is_paid)
    .reduce((sum, share) => sum + share.amount, 0);
}
