import { NextResponse } from "next/server";

// 게스트 쓰기의 유일한 입구. 실제 구현은 T-302에서 채운다.
// 실패 응답 형태를 지금 고정해 두어 이후 오류 코드 매핑이 한 형태로 모이게 한다
export function POST() {
  return NextResponse.json(
    { error: { code: "NOT_IMPLEMENTED", message: "아직 구현되지 않았습니다" } },
    { status: 501 },
  );
}
