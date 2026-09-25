/**
 * Standard date formatting utility for DD-MM-YYYY presentation across the app.
 * Handles both YYYY-MM-DD (e.g., 2026-10-18) and YYYY-DD-MM (e.g., 2026-18-10) safely.
 */

export function parseYMDorYDM(inputStr: string): { day: number; month: number; year: number } | null {
  const match = inputStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const p1 = parseInt(match[2], 10);
  const p2 = parseInt(match[3], 10);

  let day: number;
  let month: number;

  if (p1 > 12 && p2 <= 12) {
    // YYYY-DD-MM format (p1 is day > 12, p2 is month <= 12)
    day = p1;
    month = p2;
  } else if (p2 > 12 && p1 <= 12) {
    // YYYY-MM-DD format (p2 is day > 12, p1 is month <= 12)
    month = p1;
    day = p2;
  } else {
    // Standard ISO YYYY-MM-DD when ambiguous (both <= 12)
    month = p1;
    day = p2;
  }

  return { day, month, year };
}

export function formatDateDDMMYYYY(input: string | Date | null | undefined): string {
  if (!input) return '';

  if (typeof input === 'string') {
    const parsedYMD = parseYMDorYDM(input);
    if (parsedYMD) {
      const d = String(parsedYMD.day).padStart(2, '0');
      const m = String(parsedYMD.month).padStart(2, '0');
      return `${d}-${m}-${parsedYMD.year}`;
    }

    // Try parsing date string
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) return input;
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
  }

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return '';
    const d = String(input.getDate()).padStart(2, '0');
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const y = input.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return String(input);
}

export function formatDateTimeDDMMYYYY(input: string | Date | null | undefined): string {
  if (!input) return '';

  if (typeof input === 'string') {
    const parsedYMD = parseYMDorYDM(input);
    const timeMatch = input.match(/(\d{2}):(\d{2})/);
    if (parsedYMD) {
      const d = String(parsedYMD.day).padStart(2, '0');
      const m = String(parsedYMD.month).padStart(2, '0');
      if (timeMatch) {
        return `${d}-${m}-${parsedYMD.year} ${timeMatch[1]}:${timeMatch[2]}`;
      }
      return `${d}-${m}-${parsedYMD.year}`;
    }
  }

  const dateObj = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(dateObj.getTime())) return String(input);

  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');

  return `${d}-${m}-${y} ${hours}:${mins}`;
}

export function formatDateWithDayDDMMYYYY(input: string | Date | null | undefined): string {
  if (!input) return '';

  let dateObj: Date | null = null;

  if (typeof input === 'string') {
    const parsedYMD = parseYMDorYDM(input);
    if (parsedYMD) {
      dateObj = new Date(parsedYMD.year, parsedYMD.month - 1, parsedYMD.day);
    } else {
      dateObj = new Date(input);
    }
  } else if (input instanceof Date) {
    dateObj = input;
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return formatDateDDMMYYYY(input);
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[dateObj.getDay()];
  const formattedDate = formatDateDDMMYYYY(input);

  return `${formattedDate} (${dayName})`;
}
