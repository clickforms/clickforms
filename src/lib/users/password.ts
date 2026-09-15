import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_HINT =
  'At least 8 characters, with one uppercase letter, one number, and one special character';

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/** Shared by every "set a password" API (signup verify, invite accept, reset, change). */
export const passwordSchema = z.string().refine(isStrongPassword, {
  message: PASSWORD_REQUIREMENTS_MESSAGE,
});
