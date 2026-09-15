/** Builds the public URL for accepting a pending user invite. */
export function inviteAcceptUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/signup/accept?token=${token}`;
}

/** Builds the public URL for accepting a pending /admin "Team" (platform admin) invite. */
export function platformAdminInviteAcceptUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/team/accept?token=${token}`;
}
