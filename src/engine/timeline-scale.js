import { addDays, daysBetween, formatDate, parseDate } from "./date-utils.js";

export function createScale(timeline, pixelsPerDay) {
  const totalDays = Math.max(1, daysBetween(timeline.start_date, timeline.end_date));
  return {
    start: parseDate(timeline.start_date),
    end: parseDate(timeline.end_date),
    pixelsPerDay,
    width: Math.max(900, totalDays * pixelsPerDay),
  };
}

export function dateToX(date, scale) {
  return daysBetween(scale.start, date) * scale.pixelsPerDay;
}

export function xToDate(x, scale) {
  const days = Math.round(x / scale.pixelsPerDay);
  return formatDate(addDays(scale.start, days));
}

export function getScaleMode(pixelsPerDay) {
  if (pixelsPerDay >= 26) return { unit: "day", step: 1 };
  if (pixelsPerDay >= 10) return { unit: "week", step: 1 };
  if (pixelsPerDay >= 3) return { unit: "month", step: 1 };
  return { unit: "quarter", step: 1 };
}

export function generateTicks(scale) {
  const mode = getScaleMode(scale.pixelsPerDay);
  const ticks = [];
  let cursor = new Date(scale.start);

  if (mode.unit === "week") {
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  } else if (mode.unit === "month" || mode.unit === "quarter") {
    cursor.setDate(1);
    if (mode.unit === "quarter") cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
  }

  while (cursor <= scale.end) {
    if (cursor >= scale.start) {
      ticks.push({
        date: formatDate(cursor),
        x: dateToX(cursor, scale),
        mode: mode.unit,
        isWeekend: mode.unit === "day" && (cursor.getDay() === 0 || cursor.getDay() === 6),
      });
    }
    if (mode.unit === "day") cursor.setDate(cursor.getDate() + 1);
    if (mode.unit === "week") cursor.setDate(cursor.getDate() + 7);
    if (mode.unit === "month") cursor.setMonth(cursor.getMonth() + 1);
    if (mode.unit === "quarter") cursor.setMonth(cursor.getMonth() + 3);
  }
  return ticks;
}

function getIsoWeek(date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
}

export function generateCalendarContext(scale) {
  const mode = getScaleMode(scale.pixelsPerDay).unit;
  if (mode !== "day" && mode !== "week") return { weeks: [], months: [] };

  const weeks = [];
  const months = [];
  if (mode === "day") {
    const weekCursor = new Date(scale.start);
    weekCursor.setDate(weekCursor.getDate() - ((weekCursor.getDay() + 6) % 7));
    while (weekCursor <= scale.end) {
      if (weekCursor >= scale.start) {
        weeks.push({ x: dateToX(weekCursor, scale), label: `S${getIsoWeek(weekCursor)}` });
      }
      weekCursor.setDate(weekCursor.getDate() + 7);
    }
  }

  const monthCursor = new Date(scale.start.getFullYear(), scale.start.getMonth(), 1);
  while (monthCursor <= scale.end) {
    months.push({
      x: Math.max(0, dateToX(monthCursor, scale)),
      label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(monthCursor),
    });
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }
  return { weeks, months };
}

export function formatTick(tick) {
  const date = parseDate(tick.date);
  if (tick.mode === "day") return String(date.getDate());
  if (tick.mode === "week") return `S${getIsoWeek(date)}`;
  if (tick.mode === "quarter") return `T${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(date);
}