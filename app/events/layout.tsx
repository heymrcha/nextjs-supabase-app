/**
 * 주최자 화면의 공통 컨테이너. 주최자도 카카오톡에서 링크를 복사해 붙이는 흐름이라
 * 모바일에서 모임을 만드는 경우가 흔하다 — 게스트와 같은 모바일 퍼스트 규칙을 따른다.
 *
 * 게스트보다 넓은 `max-w-5xl`을 쓰는 것은 응답 명단·정산 표가 넓은 화면에서 유리하기
 * 때문이고, 좁은 폭에서 깨지지 않게 하는 책임은 각 표가 진다(`components/ui/table.tsx`가
 * 가로 스크롤 컨테이너를 이미 갖고 있다).
 *
 * nav(로그인 상태 · 테마 전환)는 T-202에서 이 레이아웃에 추가한다.
 */
export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      {children}
    </main>
  );
}
