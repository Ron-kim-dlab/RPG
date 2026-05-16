export const AUTH_USERNAME_MIN_LENGTH = 2;
export const AUTH_USERNAME_MAX_LENGTH = 24;
export const AUTH_PASSWORD_MIN_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/u;

export function validateAuthCredentials(username: string, password: string): string | null {
  const normalizedUsername = username.trim();

  if (normalizedUsername.length < AUTH_USERNAME_MIN_LENGTH) {
    return `사용자 이름은 ${AUTH_USERNAME_MIN_LENGTH}자 이상이어야 합니다.`;
  }

  if (normalizedUsername.length > AUTH_USERNAME_MAX_LENGTH) {
    return `사용자 이름은 ${AUTH_USERNAME_MAX_LENGTH}자 이하여야 합니다.`;
  }

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return "사용자 이름은 영문, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.";
  }

  if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return `비밀번호는 최소 ${AUTH_PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }

  return null;
}
