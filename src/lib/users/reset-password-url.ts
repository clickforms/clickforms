/** Builds the public URL for the "choose a new password" step of the forgot-password flow. */
export function resetPasswordUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/reset-password/${token}`;
}
