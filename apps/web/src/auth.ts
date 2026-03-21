export const AUTH_USERNAME_MIN_LENGTH = 2;
export const AUTH_PASSWORD_MIN_LENGTH = 8;

export function validateAuthCredentials(username: string, password: string): string | null {
  const normalizedUsername = username.trim();

  if (normalizedUsername.length < AUTH_USERNAME_MIN_LENGTH) {
    return `사용자 이름은 ${AUTH_USERNAME_MIN_LENGTH}자 이상이어야 합니다.`;
  }

  if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return `비밀번호는 최소 ${AUTH_PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }

  return null;
}
