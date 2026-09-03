import { addDays, addMonths, formatDate, parseDate } from "./date-utils.js";

function advance(date, frequency, amount) {
  if (frequency === "month") return addMonths(date, amount);
  return addDays(date, frequency === "week" ? amount * 7 : amount);
}

export function generateOccurrences(definition) {
  const occurrences = [];
  let start = parseDate(definition.start_date);
  const duration = definition.duration_unit === "month"
    ? null
    : definition.duration * (definition.duration_unit === "week" ? 7 : 1);
  const interval = definition.interval * (definition.frequency === "week" ? 7 : 1);

  for (let index = 1; index <= definition.occurrences; index += 1) {
    const end = duration === null
      ? addMonths(start, definition.duration)
      : addDays(start, duration - 1);
    occurrences.push({
      id: crypto.randomUUID(),
      timeline_id: definition.timeline_id,
      type: definition.type,
      label: `${definition.label} ${index}`,
      start_date: formatDate(start),
      end_date: definition.type === "period" ? formatDate(end) : null,
      color: definition.color,
      render_mode: definition.render_mode || "bracket",
      recurrence_id: definition.id,
    });
    start = definition.type === "period"
      ? addDays(end, interval + 1)
      : advance(start, definition.frequency, definition.interval || 1);
  }
  return occurrences;
}