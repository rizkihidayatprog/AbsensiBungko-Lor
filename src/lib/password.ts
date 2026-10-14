/**
 * Validasi kekuatan password untuk akun pengguna.
 * Digunakan saat admin membuat pengguna baru atau mereset password.
 */

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordStrengthResult {
  valid: boolean;
  message?: string;
}

export function validatePasswordStrength(password: unknown): PasswordStrengthResult {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, message: "Password wajib diisi." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`,
    };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password harus memuat huruf dan angka.",
    };
  }

  const commonPasswords = [
    "admin123",
    "guru123",
    "password",
    "password123",
    "12345678",
    "qwerty123",
    "absensi123",
    "sekolah123",
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    return {
      valid: false,
      message: "Password terlalu umum. Pilih kombinasi lain yang lebih unik.",
    };
  }

  return { valid: true };
}
