import { dateToX } from "./timeline-scale.js";
import { daysBetween } from "./date-utils.js";

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

export function periodWidth(item, scale) {
  const width = Math.max(32, (daysBetween(item.start_date, item.end_date) + 1) * scale.pixelsPerDay);
  return item.recurrence_id ? Math.max(28, width - 8) : width;
}

function requiredHeight(item, width) {
  if (item.render_mode === "rectangle") return 34;
  const labelFitsInside = width >= item.label.length * 7.5 + 28;
  return labelFitsInside ? 30 : 46;
}

export function layoutPeriods(items, scale) {
  const lanes = [];
  const positioned = [...items]
    .sort((left, right) => dateToX(left.start_date, scale) - dateToX(right.start_date, scale))
    .map((item) => {
      const x = dateToX(item.start_date, scale);
      const width = periodWidth(item, scale);
      const interval = { start: x, end: x + width };
      let lane = lanes.findIndex((entries) => entries.every((entry) => !overlaps(interval, entry.interval)));
      if (lane === -1) {
        lane = lanes.length;
        lanes.push([]);
      }
      const laneHeight = requiredHeight(item, width);
      lanes[lane].push({ interval, laneHeight });
      return { ...item, lane, laneHeight };
    });

  let offset = 0;
  const laneOffsets = lanes.map((entries) => {
    const laneOffset = offset;
    offset += Math.max(...entries.map((entry) => entry.laneHeight)) + 6;
    return laneOffset;
  });
  return positioned.map((item) => ({ ...item, laneOffset: laneOffsets[item.lane] }));
}