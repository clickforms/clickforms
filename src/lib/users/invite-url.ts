/** Builds the public URL for accepting a pending user invite. */
export function inviteAcceptUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/signup/accept?token=${token}`;
}
