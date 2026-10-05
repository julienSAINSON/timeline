import { addDays, daysBetween, formatDate, parseDate } from "./date-utils.js";

export const START_PADDING_DAYS = 12;
export const END_PADDING_DAYS = 15;
export const MAX_DAY_ZOOM = 34;
export const MIN_HOUR_ZOOM = 72;
export const MAX_HOUR_ZOOM = 1152;

export function zoomIn(pixelsPerDay, step = 1) {
  if (pixelsPerDay < MAX_DAY_ZOOM) return Math.min(MAX_DAY_ZOOM, pixelsPerDay + step);
  if (pixelsPerDay < MIN_HOUR_ZOOM) return MIN_HOUR_ZOOM;
  return Math.min(MAX_HOUR_ZOOM, Math.round(pixelsPerDay * 1.2));
}

export function zoomOut(pixelsPerDay, minimum, step = 1) {
  if (pixelsPerDay > MIN_HOUR_ZOOM) return Math.max(MIN_HOUR_ZOOM, Math.round(pixelsPerDay / 1.2));
  if (pixelsPerDay >= MIN_HOUR_ZOOM) return MAX_DAY_ZOOM;
  return Math.max(minimum, pixelsPerDay - step);
}

export function createScale(timeline, pixelsPerDay) {
  const start = addDays(timeline.start_date, -START_PADDING_DAYS);
  const end = addDays(timeline.end_date, END_PADDING_DAYS);
  const totalDays = Math.max(1, daysBetween(start, end));
  return {
    start,
    end,
    pixelsPerDay,
    width: Math.max(900, totalDays * pixelsPerDay),
  };
}

export function dateToX(date, scale) {
  return daysBetween(scale.start, date) * scale.pixelsPerDay;
}

export function dateTimeToX(date, time, scale) {
  const x = dateToX(date, scale);
  if (scale.pixelsPerDay < MIN_HOUR_ZOOM || !time) return x;
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return x + ((hours * 60 + minutes) / 1440) * scale.pixelsPerDay;
}

export function xToDate(x, scale) {
  const days = Math.round(x / scale.pixelsPerDay);
  return formatDate(addDays(scale.start, days));
}

export function getScaleMode(pixelsPerDay) {
  if (pixelsPerDay >= MIN_HOUR_ZOOM) return { unit: "hour", step: 1 };
  if (pixelsPerDay >= 26) return { unit: "day", step: 1 };
  if (pixelsPerDay >= 10) return { unit: "week", step: 1 };
  if (pixelsPerDay >= 3) return { unit: "month", step: 1 };
  return { unit: "quarter", step: 1 };
}

export function generateTicks(scale) {
  const mode = getScaleMode(scale.pixelsPerDay);
  const ticks = [];
  let cursor = new Date(scale.start);

  if (mode.unit === "hour") {
    const pixelsPerHour = scale.pixelsPerDay / 24;
    const totalDays = Math.max(1, daysBetween(scale.start, scale.end));
    const totalHours = totalDays * 24;
    const hourStep = pixelsPerHour >= 20 ? 1 : pixelsPerHour >= 10 ? 3 : pixelsPerHour >= 5 ? 6 : 12;
    for (let hourOffset = 0; hourOffset < totalHours; hourOffset += hourStep) {
      const date = addDays(scale.start, Math.floor(hourOffset / 24));
      ticks.push({
        date: formatDate(date),
        hour: hourOffset % 24,
        x: hourOffset * pixelsPerHour,
        mode: "hour",
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }
    const dayLabels = [];
    const midnightTicks = new Map(ticks.filter((tick) => tick.hour === 0).map((tick) => [daysBetween(scale.start, tick.date), tick]));
    for (let day = 0; day < totalDays; day += 1) {
      const date = addDays(scale.start, day);
      const x = day * scale.pixelsPerDay;
      const midnightTick = midnightTicks.get(day);
      if (midnightTick) midnightTick.dayLabel = formatTick({ date: formatDate(date), mode: "day" });
      else dayLabels.push({ date: formatDate(date), x, mode: "day", isWeekend: date.getDay() === 0 || date.getDay() === 6 });
    }
    return [...ticks, ...dayLabels].sort((left, right) => left.x - right.x);
  }

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
  if (mode !== "day" && mode !== "week" && mode !== "hour") return { weeks: [], months: [] };

  const weeks = [];
  const months = [];
  if (mode === "day" || mode === "hour") {
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
  if (tick.mode === "hour") return `${String(tick.hour).padStart(2, "0")}h`;
  if (tick.mode === "day") return String(date.getDate());
  if (tick.mode === "week") return `S${getIsoWeek(date)}`;
  if (tick.mode === "quarter") return `T${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(date);
}