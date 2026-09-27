// Aturan input akun, disamakan dengan schema backend (password min_length, token OTP 6 digit).
export const MIN_PASSWORD_LENGTH = 6;
export const OTP_LENGTH = 6;

const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

export function isValidOtp(code: string): boolean {
  return OTP_PATTERN.test(code);
}

export function isValidEmail(email: string): boolean {
  return email.includes('@');
}

export function isPasswordTooShort(password: string): boolean {
  return password.length < MIN_PASSWORD_LENGTH;
}
