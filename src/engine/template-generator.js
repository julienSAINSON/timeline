import { addDays, formatDate, parseDate } from "./date-utils.js";

function iterationStart(startDate, iterationIndex, durationDays) {
  return addDays(startDate, iterationIndex * durationDays);
}

function resolveRelativeDate(iterationStartDate, durationDays, position) {
  if (position.kind === "first-day") return iterationStartDate;
  if (position.kind === "last-day") return addDays(iterationStartDate, durationDays - 1);
  if (position.kind === "day-of-iteration") {
    if (!Number.isInteger(position.day) || position.day < 1 || position.day > durationDays) throw new Error("Le jour du jalon doit etre compris dans l'iteration.");
    return addDays(iterationStartDate, position.day - 1);
  }
  if (position.kind === "week-day") {
    if (!Number.isInteger(position.week) || position.week < 1 || !Number.isInteger(position.dayOfWeek) || position.dayOfWeek < 1 || position.dayOfWeek > 7) throw new Error("La semaine et le jour du jalon sont invalides.");
    const offset = (position.week - 1) * 7 + position.dayOfWeek - 1;
    if (offset >= durationDays) throw new Error("La position du jalon depasse la duree de l'iteration.");
    return addDays(iterationStartDate, offset);
  }
  throw new Error(`Position relative inconnue: ${position.kind}`);
}

function itemId() {
  return crypto.randomUUID();
}

export function generateTimelineFromTemplate(template, startDate, options = {}) {
  const numberOfIterations = Number(options.numberOfIterations || template.numberOfIterations);
  const durationDays = Number(template.iterationDurationDays);
  if (!Number.isInteger(numberOfIterations) || numberOfIterations < 1) throw new Error("Le nombre d'iterations doit etre positif.");
  if (!Number.isInteger(durationDays) || durationDays < 1) throw new Error("La duree d'une iteration doit etre positive.");

  const items = [];
  for (let index = 0; index < numberOfIterations; index += 1) {
    const start = iterationStart(startDate, index, durationDays);
    const end = addDays(start, durationDays - 1);
    items.push({
      id: itemId(),
      type: "period",
      label: `${template.iterationLabel || "Iteration"} ${index + 1}`,
      description: "",
      link_alias: "",
      link_url: "",
      start_date: formatDate(start),
      end_date: formatDate(end),
      color: template.iterationColor || "blue",
      render_mode: template.iterationRenderMode || "rectangle",
      recurrence_id: null,
      template_milestone_id: null,
    });

    template.milestones.filter(({ iteration }) => iteration == null || iteration === index + 1).forEach((milestone) => {
      const date = resolveRelativeDate(start, durationDays, milestone.position);
      items.push({
        id: itemId(),
        type: "milestone",
        label: milestone.name,
        description: milestone.description || "",
        time: milestone.time || "",
        link_alias: "",
        link_url: "",
        start_date: formatDate(date),
        end_date: null,
        color: milestone.color || "orange",
        render_mode: "bracket",
        recurrence_id: null,
        template_milestone_id: milestone.id || null,
      });
    });
  }

  const timelineStart = formatDate(parseDate(startDate));
  const timelineEnd = formatDate(addDays(startDate, numberOfIterations * durationDays - 1));
  return {
    start_date: timelineStart,
    end_date: timelineEnd,
    items,
  };
}

export function templateDurationDays(template) {
  return Number(template.iterationDurationDays) * Number(template.numberOfIterations);
}

export function relativePositionLabel(position) {
  if (position.kind === "first-day") return "Premier jour";
  if (position.kind === "last-day") return "Dernier jour";
  if (position.kind === "day-of-iteration") return `Jour ${position.day}`;
  return `Semaine ${position.week}, jour ${position.dayOfWeek}`;
}
