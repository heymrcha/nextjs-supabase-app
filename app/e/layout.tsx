/**
 * 게스트 화면의 공통 컨테이너. 카카오톡 인앱 브라우저에서 열리므로 모바일 폭이 기본이고
 * `sm:` 이상에서만 여백을 넓힌다 — 데스크톱 폭을 먼저 잡고 좁히지 않는다.
 *
 * 주최자 nav를 넣지 않는다. 가입하지 않은 사람이 보는 화면이므로 로그인·테마 전환 같은
 * 주최자용 요소가 들어가면 안 된다.
 *
 * `min-h-svh`를 쓰는 이유: 모바일 브라우저의 주소창이 접힐 때 `vh`는 실제 보이는 높이와
 * 어긋난다. `svh`는 가장 작은 뷰포트 높이를 기준으로 삼아 하단이 잘리지 않는다.
 */
export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-screen-sm flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      {children}
    </main>
  );
}
