/** Friendly first name for greetings — avoids showing full email local parts. */
export function displayFirstName(
  email?: string | null,
  fullName?: string | null
): string {
  if (fullName?.trim()) {
    return fullName.trim().split(/\s+/)[0];
  }
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  const segment = local.split(/[._-]/)[0] ?? local;
  if (!segment) return "there";
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

export function greetingName(
  email?: string | null,
  fullName?: string | null
): string {
  return `Hi, ${displayFirstName(email, fullName)}`;
}
