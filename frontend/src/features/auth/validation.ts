// Aturan input akun, disamakan dengan schema backend (password min_length=6).
const MIN_PASSWORD_LENGTH = 6;

export function isValidEmail(email: string): boolean {
  return email.includes('@');
}

export function isPasswordTooShort(password: string): boolean {
  return password.length < MIN_PASSWORD_LENGTH;
}
