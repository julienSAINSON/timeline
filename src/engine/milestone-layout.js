import { dateToX } from "./timeline-scale.js";

export function estimateLabelWidth(label) {
  return Math.max(116, Math.min(240, label.length * 7.5 + 34));
}

function estimateLabelHeight(item) {
  const charactersPerLine = Math.max(10, Math.floor((estimateLabelWidth(item.label) - 20) / 7.5));
  return 14 + Math.ceil(item.label.length / charactersPerLine) * 16;
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

function firstAvailableLevel(lane, interval) {
  let level = 0;
  while (lane.some((existing) => existing.level === level && overlaps(interval, existing.interval))) level += 1;
  return level;
}

export function layoutMilestones(items, scale) {
  const lanes = { top: [], bottom: [] };
  return [...items]
    .sort((left, right) => dateToX(left.start_date, scale) - dateToX(right.start_date, scale))
    .map((item, index) => {
      const x = dateToX(item.start_date, scale);
      const width = estimateLabelWidth(item.label);
      const interval = { start: x - width / 2, end: x + width / 2 };
      const preferredSide = index % 2 === 0 ? "top" : "bottom";
      const alternateSide = preferredSide === "top" ? "bottom" : "top";
      const preferredLevel = firstAvailableLevel(lanes[preferredSide], interval);
      const alternateLevel = firstAvailableLevel(lanes[alternateSide], interval);
      const side = alternateLevel < preferredLevel ? alternateSide : preferredSide;
      const lane = lanes[side];
      const level = firstAvailableLevel(lane, interval);
      lane.push({ interval, level });
      return { ...item, x, width, side, level };
    });
}

export function positionMilestoneLanes(items, { axisTop, calendarTop, bottomTop, gap = 8 }) {
  const placeSide = (side, firstPosition, direction) => {
    const levels = [...new Set(items.filter((item) => item.side === side).map((item) => item.level))].sort((left, right) => left - right);
    let cursor = firstPosition;
    const positions = new Map();
    levels.forEach((level) => {
      const laneItems = items.filter((item) => item.side === side && item.level === level);
      const height = Math.max(...laneItems.map(estimateLabelHeight));
      const cardTop = direction === "up" ? cursor - height : cursor;
      laneItems.forEach((item) => positions.set(item.id, { cardTop, cardHeight: estimateLabelHeight(item) }));
      cursor = direction === "up" ? cardTop - gap : cardTop + height + gap;
    });
    return positions;
  };

  const topPositions = placeSide("top", calendarTop - gap, "up");
  const bottomPositions = placeSide("bottom", bottomTop, "down");
  return items.map((item) => ({ ...item, ...(item.side === "top" ? topPositions.get(item.id) : bottomPositions.get(item.id)), axisTop }));
}