/**
 * Supabase Auth가 내려주는 영어 메시지를 한국어로 옮긴다.
 *
 * 인증 폼은 `supabase.auth.*`를 브라우저에서 직접 호출하고 실패하면 `error.message`를
 * 그대로 화면에 뿌렸다 — "Invalid login credentials" 같은 영어가 사용자에게 보인다(T-602).
 *
 * 게스트 쪽(`lib/moim/guest-api.ts`)과 같은 화이트리스트 방식이다. 다만 그쪽은 우리가
 * 정한 코드라 완전 일치로 찾을 수 있고, 여기는 Supabase가 문구를 바꿀 수 있으므로
 * 부분 일치로 찾는다. 목록에 없으면 일반 문구로 떨구고 원문은 콘솔에만 남긴다.
 */
const AUTH_ERROR_MESSAGE: [match: string, message: string][] = [
  ["invalid login credentials", "이메일 또는 비밀번호가 올바르지 않습니다"],
  [
    "email not confirmed",
    "이메일 인증이 끝나지 않았습니다. 받은 메일의 링크를 먼저 눌러 주세요",
  ],
  ["user already registered", "이미 가입된 이메일입니다"],
  ["already been registered", "이미 가입된 이메일입니다"],
  [
    "password should be at least",
    "비밀번호가 너무 짧습니다. 6자 이상으로 입력해 주세요",
  ],
  ["unable to validate email", "이메일 형식이 올바르지 않습니다"],
  ["invalid email", "이메일 형식이 올바르지 않습니다"],
  [
    "new password should be different",
    "새 비밀번호가 기존 비밀번호와 같습니다",
  ],
  [
    "auth session missing",
    "로그인 정보가 만료되었습니다. 다시 로그인해 주세요",
  ],
  ["session_not_found", "로그인 정보가 만료되었습니다. 다시 로그인해 주세요"],
  // 비밀번호 재설정 메일 연속 요청에서 나온다
  ["for security purposes", "잠시 후 다시 시도해 주세요"],
  [
    "email rate limit exceeded",
    "메일 전송 한도를 넘었습니다. 잠시 후 다시 시도해 주세요",
  ],
  ["over_email_send_rate_limit", "잠시 후 다시 시도해 주세요"],
];

/**
 * @param fallback 목록에 없는 실패에 쓸 문구. 화면마다 다르므로 호출하는 쪽이 정한다.
 */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const raw = error.message.toLowerCase();
  const hit = AUTH_ERROR_MESSAGE.find(([match]) => raw.includes(match));
  if (hit) return hit[1];

  // 번역하지 못한 메시지를 삼키면 원인을 찾을 길이 없어진다
  console.error("[auth] 번역되지 않은 오류", error.message);
  return fallback;
}
