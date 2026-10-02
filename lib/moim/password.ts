/**
 * 비밀번호 정책. **Supabase 대시보드 설정과 반드시 같은 값이어야 한다** —
 * Authentication → Sign In / Providers → Email → Minimum password length.
 *
 * 실제로 거부하는 쪽은 Supabase다. 여기 검증은 왕복 한 번을 아끼고 안내 문구를
 * 한국어로 보여 주기 위한 것이지 강제 수단이 아니다. 두 값이 어긋나면 화면은
 * "8자 이상"이라고 적어 놓고 서버가 다른 기준으로 거부하는 상태가 된다.
 *
 * 8자로 올린 이유: 유출 비밀번호 대조(`Prevent use of leaked passwords`)가 Pro 플랜
 * 전용이라 이 프로젝트(Free)에서는 켤 수 없다. 대조가 없는 만큼 길이로 일부 상쇄한다
 * (`docs/product/phase1-security-gate.md` §5.3).
 */
export const PASSWORD_MIN_LENGTH = 8;

/** 입력칸 아래 안내와 오류 문구가 같은 문장을 쓰도록 모아 둔다 */
export const PASSWORD_HINT = `${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;

/** 통과하면 null, 아니면 보여 줄 한국어 문구 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`;
  }
  return null;
}
