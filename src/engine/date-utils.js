const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date) {
  const normalized = parseDate(date);
  return [
    normalized.getFullYear(),
    String(normalized.getMonth() + 1).padStart(2, "0"),
    String(normalized.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDays(date, days) {
  const result = parseDate(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date, months) {
  const result = parseDate(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function daysBetween(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / DAY_MS);
}

export function compareDates(left, right) {
  return parseDate(left) - parseDate(right);
}

export function isDateInRange(date, start, end) {
  const value = parseDate(date).getTime();
  return value >= parseDate(start).getTime() && value <= parseDate(end).getTime();
}

export function formatHumanDate(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseDate(date));
}