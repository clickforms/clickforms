/** Builds the public URL for the "set your password" step of self-service signup. */
export function signupVerifyUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/signup/verify?token=${token}`;
}
