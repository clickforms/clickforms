/** Split a form name into two title parts for dual-color display (e.g. "Incident Report"). */
export function splitFormTitle(title: string): { primary: string; secondary: string | null } {
  const trimmed = title.trim();
  const spaceIndex = trimmed.indexOf(' ');

  if (spaceIndex === -1) {
    return { primary: trimmed, secondary: null };
  }

  return {
    primary: trimmed.slice(0, spaceIndex),
    secondary: trimmed.slice(spaceIndex + 1).trim() || null,
  };
}

/** Leading image fields on a page render as header logos above the form title. */
export function partitionHeaderLogos(
  fieldIds: string[],
  fields: Record<string, { type: string } | undefined>,
): { headerLogoIds: string[]; bodyFieldIds: string[] } {
  const headerLogoIds: string[] = [];
  const bodyFieldIds: string[] = [];
  let collectingLogos = true;

  for (const fieldId of fieldIds) {
    const field = fields[fieldId];
    if (collectingLogos && field?.type === 'image') {
      headerLogoIds.push(fieldId);
      continue;
    }
    collectingLogos = false;
    bodyFieldIds.push(fieldId);
  }

  return { headerLogoIds, bodyFieldIds };
}
