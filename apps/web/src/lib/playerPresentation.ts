export function getPlayerInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || '?';
}

export function getSeatToneClass(seatIndex: number): string {
  return `seat-tone-${seatIndex % 8}`;
}
