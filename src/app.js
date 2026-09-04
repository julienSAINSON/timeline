import { COLORS } from "./data.js";
import { addDays, daysBetween, formatDate, formatHumanDate, parseDate } from "./engine/date-utils.js";
import { layoutMilestones, positionMilestoneLanes } from "./engine/milestone-layout.js";
import { layoutPeriods } from "./engine/period-layout.js";
import { generateOccurrences } from "./engine/recurrence.js";
import { createScale, dateToX, formatTick, generateCalendarContext, generateTicks, xToDate } from "./engine/timeline-scale.js";
import { LocalTimelineRepository, PublicTimelineRepository, SupabaseTimelineRepository } from "./repositories.js";
import { getCurrentUser, initAuth, loginWithGoogle, logout } from "../supabase/auth/auth.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const state = { store: { timelines: [], items: [], recurrences: [] }, activeTimelineId: null, zoom: 6, contextDate: null, readOnly: false, selectedItemId: null, skipNextItemClick: false, mode: null, user: null, isDirty: false };
const RECENT_COLORS_KEY = "timeline-recent-colors";
const ACCESS_MODE_KEY = "timeline-access-mode";
const THEME_KEY = "timeline-theme";
const THEMES = {
  atelier: "Atelier Clair",
  tableau: "Tableau Graphique",
  nuit: "Nuit Studio",
  jardin: "Jardin Calme",
  mono: "Mono",
  sketchy: "Sketchy",
  sunlust: "Sunlust"
};
let lastItemClick = { id: null, time: 0 };
const params = new URLSearchParams(location.search);
const publicToken = params.get("view");
state.readOnly = Boolean(publicToken);
let repository = null;

function markDirty() { state.isDirty = true; app.querySelector("[data-action=\"save-timeline\"]")?.removeAttribute("disabled"); }
function createTimeline(store, data) { const timeline = { id: crypto.randomUUID(), public_token: crypto.randomUUID(), is_public: false, is_sandbox: state.mode === "sandbox", ...data }; store.timelines.push(timeline); markDirty(); return timeline; }
function saveItem(store, item) { const index = store.items.findIndex(({ id }) => id === item.id); if (index === -1) store.items.push(item); else store.items[index] = item; markDirty(); }
function deleteItem(store, itemId) { store.items = store.items.filter(({ id }) => id !== itemId); markDirty(); }
function saveStore(store) { return repository?.saveStore(store); }

function hasSupabaseConfig() { return Boolean(window.TIMELINE_CONFIG?.supabaseUrl && window.TIMELINE_CONFIG?.supabaseAnonKey && !window.TIMELINE_CONFIG.supabaseUrl.includes("your-project")); }
async function startSandbox() {
  repository = new LocalTimelineRepository();
  state.mode = "sandbox";
  state.user = null;
  state.store = await repository.loadStore();
  state.activeTimelineId = state.store.timelines[0]?.id || null;
  fitTimelineToViewport();
  state.isDirty = false;
  renderFittedTimeline();
}
async function startAuthenticated(user) {
  repository = new SupabaseTimelineRepository(user);
  state.mode = "authenticated";
  state.user = user;
  state.store = await repository.loadStore();
  state.activeTimelineId = state.store.timelines[0]?.id || null;
  fitTimelineToViewport();
  state.isDirty = false;
  renderFittedTimeline();
}
async function startPublicView() {
  repository = new PublicTimelineRepository();
  state.mode = "public";
  state.user = null;
  state.store = await repository.loadStore(publicToken);
  state.activeTimelineId = state.store.timelines[0].id;
  fitTimelineToViewport();
  state.isDirty = false;
  renderFittedTimeline();
}
async function bootstrap() {
  if (!hasSupabaseConfig()) { renderAccessScreen(); return; }
  initAuth({ supabaseUrl: window.TIMELINE_CONFIG.supabaseUrl, supabaseAnonKey: window.TIMELINE_CONFIG.supabaseAnonKey, redirectTo: window.TIMELINE_CONFIG.supabaseRedirectTo || `${location.origin}${location.pathname}` });
  if (publicToken) { await startPublicView(); return; }
  const user = await getCurrentUser();
  if (user) { await startAuthenticated(user); return; }
  if (localStorage.getItem(ACCESS_MODE_KEY) === "sandbox") { await startSandbox(); return; }
  renderAccessScreen();
}

function activeTimeline() { return state.store.timelines.find(({ id }) => id === state.activeTimelineId); }
function timelineViewportWidth() { return Math.max(900, document.querySelector("#timeline-frame")?.clientWidth || window.innerWidth - (state.readOnly ? 0 : 302)); }
function minimumZoom(timeline = activeTimeline()) { return timeline ? Math.max(1, timelineViewportWidth() / Math.max(1, daysBetween(timeline.start_date, timeline.end_date))) : 1; }
function fitTimelineToViewport() { state.zoom = minimumZoom(); }
function currentScale(timeline = activeTimeline()) { return createScale(timeline, state.zoom); }
function items() { return state.store.items.filter(({ timeline_id }) => timeline_id === state.activeTimelineId); }
function currentTheme() { return THEMES[localStorage.getItem(THEME_KEY)] ? localStorage.getItem(THEME_KEY) : "atelier"; }
function themeOptions() { return Object.entries(THEMES).map(([id, label]) => `<option value="${id}" ${id === currentTheme() ? "selected" : ""}>${label}</option>`).join(""); }
function renderFittedTimeline() {
  render();
  fitTimelineToViewport();
  render();
}
function annotationHeight(item, scale) {
  const width = Math.max(115, (daysBetween(item.start_date, item.end_date) + 1) * scale.pixelsPerDay);
  const charactersPerLine = Math.max(1, Math.floor((width - 22) / 6.5));
  return Math.max(48, 24 + Math.ceil(item.label.length / charactersPerLine) * 16);
}
function layoutTimeline(timelineItems, scale) {
  const axisTop = 280;
  const calendarTop = 218;
  const periodTop = 300;
  const milestoneLayout = layoutMilestones(timelineItems.filter(({ type }) => type === "milestone"), scale);
  const periods = layoutPeriods(timelineItems.filter(({ type }) => type === "period"), scale);
  const periodBottom = Math.max(45, ...periods.map((item) => item.laneOffset + item.laneHeight));
  const bottomMilestoneTop = periodTop + periodBottom + 8;
  const milestones = positionMilestoneLanes(milestoneLayout, { axisTop, calendarTop, bottomTop: bottomMilestoneTop });
  const bottomMilestoneEnd = Math.max(bottomMilestoneTop, ...milestones.filter(({ side }) => side === "bottom").map((item) => item.cardTop + item.cardHeight));
  const annotationTop = Math.max(periodTop + periodBottom + 12, bottomMilestoneEnd + 12);
  const annotationBottom = Math.max(0, ...timelineItems.filter(({ type }) => type === "annotation").map((item) => annotationTop + annotationHeight(item, scale)));
  const contentTop = Math.min(calendarTop, ...milestones.filter(({ side }) => side === "top").map((item) => item.cardTop));
  const contentBottom = Math.max(axisTop + 4, periodTop + periodBottom, bottomMilestoneEnd, annotationBottom);
  return { axisTop, calendarTop, periodTop, periods, milestones, annotationTop, contentTop, contentBottom };
}
function colorOptions(selected = "blue") { return Object.keys(COLORS).map((color) => `<option value="${color}" ${color === selected ? "selected" : ""}>${color}</option>`).join(""); }
function safe(value) { return String(value || "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character])); }
function itemDateLabel(item) { return item.end_date ? `${formatHumanDate(item.start_date)} - ${formatHumanDate(item.end_date)}` : formatHumanDate(item.start_date); }
function parseRaci(value) {
  try {
    const raci = JSON.parse(value || "{}");
    return { responsible: raci.responsible || "", accountable: raci.accountable || "", consulted: raci.consulted || "", informed: raci.informed || "" };
  } catch { return { responsible: "", accountable: "", consulted: "", informed: "" }; }
}
function raciSummary(item) {
  if (item.type !== "milestone") return "";
  return raciEntries(item).map(([role, people]) => `${role}: ${people}`).join(" | ");
}
function raciEntries(item) {
  if (item.type !== "milestone") return [];
  const raci = parseRaci(item.raci);
  return [["R", raci.responsible], ["A", raci.accountable], ["C", raci.consulted], ["I", raci.informed]].filter(([, people]) => people);
}
function chronologicalItems() {
  const typeOrder = { milestone: 0, period: 1, annotation: 2 };
  return [...items()].sort((left, right) => left.start_date.localeCompare(right.start_date) || typeOrder[left.type] - typeOrder[right.type] || left.label.localeCompare(right.label));
}
function colorValue(color) { return COLORS[color] || color; }
function itemLink(item, className = "") { return item.link_alias && /^https?:\/\//i.test(item.link_url || "") ? `<a class="item-link ${className}" data-item-link href="${safe(item.link_url)}" target="_blank" rel="noopener noreferrer">${safe(item.link_alias)}</a>` : ""; }
function recentColors() { try { return JSON.parse(localStorage.getItem(RECENT_COLORS_KEY)) || []; } catch { return []; } }
function rememberColor(color) { localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify([color, ...recentColors().filter((entry) => entry !== color)].slice(0, 10))); }
function colorPalette(selected = "blue") {
  const recent = recentColors();
  const palette = Object.keys(COLORS).filter((color) => !recent.includes(color));
  const swatches = (colors) => colors.map((color) => `<button class="color-swatch ${color === selected ? "selected" : ""}" type="button" data-color="${color}" style="--swatch:${colorValue(color)}" title="${color}"></button>`).join("");
  return `<label class="field wide">Couleur<input type="hidden" name="color" value="${selected}"><span class="color-picker-row"><button class="active-color-swatch" type="button" style="--swatch:${colorValue(selected)}" title="Couleur selectionnee"></button><input class="native-color-picker" type="color" value="${colorValue(selected)}" data-color-picker title="Choisir une couleur personnalisee">${recent.length ? `<span class="palette-caption">Recent</span>${swatches(recent)}` : ""}</span><span class="color-palette"><span class="palette-caption">Palette</span>${swatches(palette)}</span></label>`;
}

function renderAccessScreen() {
  app.innerHTML = `<main class="access-screen"><section class="access-panel"><div class="access-brand">time<span>line</span></div><h1>Creer vos timelines simplement</h1><p>Planifiez, explorez et partagez vos reperes.</p><div class="access-actions">${hasSupabaseConfig() ? `<button class="access-button google" data-action="login-google"><span aria-hidden="true">G</span>Continuer avec Google</button>` : `<p class="access-note">La connexion Google sera disponible apres la configuration Supabase.</p>`}<div class="access-divider"><span>ou</span></div><button class="access-button sandbox" data-action="start-sandbox"><span aria-hidden="true">&#9883;</span>Continuer en bac a sable</button></div><small>Decouvrez Timeline sans creer de compte.</small></section></main>`;
}
function renderPublicUnavailable(message) {
  app.innerHTML = `<main class="access-screen"><section class="access-panel"><div class="access-brand">time<span>line</span></div><h1>Frise indisponible</h1><p>${safe(message)}</p><div class="access-actions"><a class="access-button sandbox" href="${location.pathname}">Retour a Timeline</a></div></section></main>`;
}

function render() {
  const timeline = activeTimeline();
  if (!timeline) { renderWelcome(); return; }
  const scale = currentScale(timeline);
  const timelineItems = items();
  const layout = layoutTimeline(timelineItems, scale);
  const fullyZoomedOutLayout = layoutTimeline(timelineItems, createScale(timeline, minimumZoom(timeline)));
  const verticalOffset = 16 - fullyZoomedOutLayout.contentTop;
  const axisTop = layout.axisTop + verticalOffset;
  const calendarTop = layout.calendarTop + verticalOffset;
  const periodTop = layout.periodTop + verticalOffset;
  const annotationTop = layout.annotationTop + verticalOffset;
  const periods = layout.periods;
  const milestones = layout.milestones.map((item) => ({ ...item, cardTop: item.cardTop + verticalOffset }));
  const todayX = dateToX(new Date(), scale);
  const calendarContext = generateCalendarContext(scale);
  const ticks = generateTicks(scale);
  const calendarMode = ticks[0]?.mode || "quarter";
  const canvasHeight = fullyZoomedOutLayout.contentBottom - fullyZoomedOutLayout.contentTop + 32;
  app.innerHTML = `<div class="shell theme-${currentTheme()} ${state.readOnly ? "public-view" : ""}">
    ${state.readOnly ? "" : `<aside class="sidebar"><div>${state.mode === "sandbox" ? `<button class="brand" data-action="return-access" title="Revenir a l'accueil">time<span>line</span></button>` : `<div class="brand">time<span>line</span></div>`}<nav><div class="sidebar-label">Mes frises</div><div class="timeline-list">${state.store.timelines.map((entry) => `<button class="timeline-choice ${entry.id === timeline.id ? "active" : ""}" data-timeline="${entry.id}">${safe(entry.name)}</button>`).join("")}</div></nav></div><button class="new-timeline" data-action="new-timeline">+ Nouvelle frise</button></aside>`}
    <section class="workspace">${state.readOnly ? "" : `${state.mode === "sandbox" ? `<aside class="sandbox-banner"><span>&#9883; Mode bac a sable</span><span>Cette frise est enregistree uniquement dans ce navigateur. Elle ne sera pas sauvegardee dans votre compte.</span><button data-action="return-access">Se connecter pour sauvegarder dans votre compte</button></aside>` : ""}<header class="topbar"><div><div class="eyebrow">Editeur</div><div class="timeline-title"><h1>${safe(timeline.name)}</h1><button class="icon-btn edit-title" data-action="edit-timeline-title" title="Modifier le titre" aria-label="Modifier le titre">&#9998;</button></div><div class="range">${formatHumanDate(timeline.start_date)} - ${formatHumanDate(timeline.end_date)}</div></div><div class="controls"><label class="theme-picker" title="Apparence de la frise"><span>Theme</span><select data-theme-select aria-label="Theme visuel">${themeOptions()}</select></label><button class="icon-btn" data-action="zoom-out" title="Dezoomer">-</button><div class="zoom-readout">${Math.round(scale.pixelsPerDay)}px/j</div><button class="icon-btn" data-action="zoom-in" title="Zoomer">+</button><button class="command-btn" data-action="today">Aujourd'hui</button><button class="command-btn primary" data-action="save-timeline" ${state.isDirty ? "" : "disabled"}>Sauvegarder</button><button class="command-btn" data-action="share">Partager</button>${state.mode === "authenticated" ? `<span class="user-email" title="Compte connecte">${safe(state.user?.email || "")}</span><button class="command-btn" data-action="account">Compte</button><button class="command-btn" data-action="logout">Deconnexion</button>` : ""}</div></header>`}
    <div class="timeline-frame" id="timeline-frame"><div class="timeline-canvas calendar-${calendarMode}" id="timeline-canvas" style="width:${scale.width}px;height:${canvasHeight}px;--axis-top:${axisTop}px;--calendar-top:${calendarTop}px;--period-top:${periodTop}px;--annotation-top:${annotationTop}px">
      <aside class="hover-details" id="hover-details" aria-live="polite"></aside>
      ${ticks.map((tick) => `<div class="tick" style="left:${tick.x}px"><span class="tick-label ${tick.isWeekend ? "weekend" : ""}">${formatTick(tick)}</span></div>`).join("")}
      <div class="calendar-months">${calendarContext.months.map((month, index) => `<span class="calendar-context month" style="left:${month.x}px;width:${(calendarContext.months[index + 1]?.x || scale.width) - month.x}px">${month.label}</span>`).join("")}</div>
      <div class="calendar-weeks">${calendarContext.weeks.map((week, index) => `<span class="calendar-context week" style="left:${week.x}px;width:${(calendarContext.weeks[index + 1]?.x || scale.width) - week.x}px">${week.label}</span>`).join("")}</div>
      <div class="axis" style="width:${scale.width}px"></div>
      ${todayX >= 0 && todayX <= scale.width ? `<div class="today" style="left:${todayX}px"><span>Aujourd'hui</span></div>` : ""}
      ${milestones.map((item) => `<button class="milestone ${item.side} ${item.id === state.selectedItemId ? "selected" : ""}" style="left:${item.x}px;--card-top:${item.cardTop}px;--milestone-depth:${100 - item.level};color:${colorValue(item.color)};" title="Double-cliquez pour modifier ${safe(item.label)}"><span class="milestone-card" data-item="${item.id}" style="background:${colorValue(item.color)};width:${item.width}px">${safe(item.label)}</span><span class="milestone-stem"></span></button>`).join("")}
      ${periods.map((item) => renderPeriod(item, scale)).join("")}
      ${timelineItems.filter(({ type }) => type === "annotation").map((item) => renderAnnotation(item, scale)).join("")}
    </div></div>${state.readOnly ? "" : `<p class="hint">Clic droit sur la frise pour ajouter un element. Faites glisser une periode ou ses extremites pour modifier ses dates.</p><section class="element-list" aria-label="Elements de la frise"><div class="element-list-heading"><h2>Elements</h2><span>${timelineItems.length} element${timelineItems.length > 1 ? "s" : ""}</span></div>${chronologicalItems().map((item) => `<article class="element-row" data-item="${item.id}"><span class="element-color" style="--item-color:${colorValue(item.color)}"></span><div><strong>${safe(item.label)}</strong><span class="element-type">${item.type === "milestone" ? "Jalon" : item.type === "period" ? "Periode" : "Annotation"}</span></div><time>${itemDateLabel(item)}</time><div class="element-notes"><p>${safe(item.description || "Aucune description")}</p>${itemLink(item)}${raciEntries(item).length ? `<dl class="raci-summary">${raciEntries(item).map(([role, people]) => `<div><dt>${role}</dt><dd>${safe(people)}</dd></div>`).join("")}</dl>` : ""}</div></article>`).join("")}</section>`}</section></div>`;
}

function renderPeriod(item, scale) {
  const x = dateToX(item.start_date, scale);
  const width = Math.max(32, (daysBetween(item.start_date, item.end_date) + 1) * scale.pixelsPerDay);
  const labelFitsInside = width >= item.label.length * 7.5 + 28;
  return `<button class="period ${item.render_mode === "rectangle" ? "rectangle" : ""} ${item.id === state.selectedItemId ? "selected" : ""}" data-item="${item.id}" style="left:${x}px;width:${width}px;color:${colorValue(item.color)};--period-offset:${item.laneOffset}px" title="Double-cliquez pour modifier ${safe(item.label)}"><span class="resize-handle start" data-drag="start"></span><span class="period-label ${labelFitsInside ? "inside" : ""}">${safe(item.label)}</span><span class="resize-handle end" data-drag="end"></span></button>`;
}

function renderAnnotation(item, scale) {
  const x = dateToX(item.start_date, scale);
  const width = Math.max(115, (daysBetween(item.start_date, item.end_date) + 1) * scale.pixelsPerDay);
  return `<button class="annotation ${item.id === state.selectedItemId ? "selected" : ""}" data-item="${item.id}" style="left:${x}px;width:${width}px;background:${colorValue(item.color)}" title="Double-cliquez pour modifier ${safe(item.label)}">${safe(item.label)}</button>`;
}

function renderWelcome() {
  app.innerHTML = `<section class="workspace"><div class="modal" style="margin:8vh auto"><h2>Creer une timeline</h2>${timelineForm()}</div></section>`;
}

function itemForm(item, mode = "item") {
  const isPeriod = item.type === "period" || item.type === "annotation";
  const raci = parseRaci(item.raci);
  const raciFields = item.type === "milestone" ? `<fieldset class="raci-fields wide"><legend>RACI</legend><label class="field">Responsable (R)<input name="raci_responsible" value="${safe(raci.responsible)}" placeholder="Marie Dupont"></label><label class="field">Approbateur (A)<input name="raci_accountable" value="${safe(raci.accountable)}" placeholder="Paul Martin"></label><label class="field">Consulte (C)<input name="raci_consulted" value="${safe(raci.consulted)}" placeholder="Equipe produit, client"></label><label class="field">Informe (I)<input name="raci_informed" value="${safe(raci.informed)}" placeholder="Direction, support"></label></fieldset>` : "";
  return `<form data-form="item"><input type="hidden" name="id" value="${item.id || ""}"><input type="hidden" name="type" value="${item.type}"><div class="form-grid"><label class="field wide">Libelle<input required name="label" value="${safe(item.label || "")}" autofocus></label><label class="field wide">Description<textarea name="description" placeholder="Notes internes, contexte ou details...">${safe(item.description || "")}</textarea></label><label class="field">Alias du lien<input name="link_alias" maxlength="200" value="${safe(item.link_alias || "")}" placeholder="Documentation projet"></label><label class="field">Lien hypertexte<input type="url" name="link_url" maxlength="2000" value="${safe(item.link_url || "")}" placeholder="https://..."></label><label class="field">Date de debut<input required type="date" name="start_date" value="${item.start_date || state.contextDate}"></label>${isPeriod ? `<label class="field">Date de fin<input required type="date" name="end_date" value="${item.end_date || state.contextDate}"></label>` : ""}${raciFields}${item.type === "period" ? `<label class="field">Rendu<select name="render_mode"><option value="bracket" ${item.render_mode !== "rectangle" ? "selected" : ""}>Accolade</option><option value="rectangle" ${item.render_mode === "rectangle" ? "selected" : ""}>Rectangle</option></select></label>` : ""}${colorPalette(item.color || "blue")}</div><div class="modal-actions">${item.id ? `<button class="command-btn danger" type="button" data-action="delete-item" data-item="${item.id}">Supprimer</button>` : "<span></span>"}<div class="right"><button class="command-btn" type="button" data-action="close-modal">Annuler</button><button class="command-btn primary">${mode === "create" ? "Ajouter" : "Enregistrer"}</button></div></div></form>`;
}

function recurrenceForm(type) {
  return `<form data-form="recurrence"><input type="hidden" name="type" value="${type}"><div class="form-grid"><label class="field wide">Libelle<input required name="label" autofocus></label><label class="field">Premiere date<input required type="date" name="start_date" value="${state.contextDate}"></label><label class="field">Nombre<input required type="number" min="1" max="100" name="occurrences" value="6"></label>${type === "period" ? `<label class="field">Duree<input required type="number" min="1" name="duration" value="2"></label><label class="field">Unite de duree<select name="duration_unit"><option value="day">jours</option><option value="week" selected>semaines</option><option value="month">mois</option></select></label><label class="field">Rendu<select name="render_mode"><option value="bracket">Accolade</option><option value="rectangle">Rectangle</option></select></label>` : ""}<label class="field">Frequence<select name="frequency"><option value="day">jours</option><option value="week" selected>semaines</option><option value="month">mois</option></select></label><label class="field">Intervalle<input required type="number" min="0" name="interval" value="${type === "period" ? "0" : "2"}"></label>${colorPalette()}</div><div class="modal-actions"><span></span><div class="right"><button class="command-btn" type="button" data-action="close-modal">Annuler</button><button class="command-btn primary">Creer la serie</button></div></div></form>`;
}

function timelineForm() { return `<form data-form="timeline"><div class="form-grid"><label class="field wide">Nom<input required name="name" placeholder="Roadmap produit" autofocus></label><label class="field">Date de debut<input required type="date" name="start_date" value="2026-09-01"></label><label class="field">Date de fin<input required type="date" name="end_date" value="2027-01-31"></label></div><div class="modal-actions"><span></span><button class="command-btn primary">Creer</button></div></form>`; }
function timelineTitleForm(timeline) { return `<form data-form="timeline-title"><label class="field">Titre de la frise<input required name="name" maxlength="120" value="${safe(timeline.name)}" autofocus></label><div class="modal-actions"><span></span><div class="right"><button class="command-btn" type="button" data-action="close-modal">Annuler</button><button class="command-btn primary">Enregistrer</button></div></div></form>`; }
function openModal(title, content) { modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal"><button class="modal-close" type="button" data-action="close-modal" aria-label="Fermer la fenetre" title="Fermer">&times;</button><h2>${title}</h2>${content}</section></div>`; }
function closeModal() { modalRoot.innerHTML = ""; }
function openItem(id) { const item = state.store.items.find((entry) => entry.id === id); if (item) openModal("Modifier l'element", itemForm(item)); }
async function copyShareLink(button) {
  const input = button.closest(".share-link")?.querySelector("input");
  if (!input) return;
  try { await navigator.clipboard.writeText(input.value); }
  catch { input.select(); document.execCommand("copy"); input.setSelectionRange(0, 0); }
  button.title = "Lien copie";
  button.setAttribute("aria-label", "Lien copie");
}

function showContextMenu(event) {
  const canvas = document.querySelector("#timeline-canvas");
  const bounds = canvas.getBoundingClientRect();
  const scale = currentScale();
  state.contextDate = xToDate(event.clientX - bounds.left, scale);
  modalRoot.innerHTML = `<menu class="context-menu" style="left:${event.clientX}px;top:${event.clientY}px"><button data-create="milestone">Ajouter un jalon</button><button data-create="period">Ajouter une periode</button><button data-create="annotation">Ajouter une annotation</button><button data-series="period">Ajouter une serie de periodes</button><button data-series="milestone">Ajouter une serie de jalons</button></menu>`;
}

function scrollToToday() { const frame = document.querySelector("#timeline-frame"); if (frame) frame.scrollLeft = Math.max(0, dateToX(new Date(), currentScale()) - frame.clientWidth / 2); }
function selectTimelineItem(itemId) {
  state.selectedItemId = itemId;
  app.querySelectorAll(".selected").forEach((element) => element.classList.remove("selected"));
  const element = app.querySelector(`.milestone-card[data-item="${itemId}"], [data-item="${itemId}"]`);
  (element?.closest(".milestone") || element)?.classList.add("selected");
  showHoverDetails(itemId);
}
function centerTimelineItem(itemId) {
  const frame = document.querySelector("#timeline-frame");
  const element = app.querySelector(`.milestone-card[data-item="${itemId}"], [data-item="${itemId}"]`);
  const canvasItem = element?.closest(".milestone") || element;
  if (frame && canvasItem) frame.scrollLeft = Math.max(0, canvasItem.offsetLeft - frame.clientWidth / 2 + canvasItem.offsetWidth / 2);
}
function showHoverDetails(itemId) {
  const item = state.store.items.find(({ id }) => id === itemId);
  const details = document.querySelector("#hover-details");
  if (!item || !details) return;
  details.innerHTML = `<strong>${safe(item.label)}</strong><span>${itemDateLabel(item)}</span>${item.description ? `<p>${safe(item.description)}</p>` : ""}${itemLink(item, "hover-link")}${raciSummary(item) ? `<p class="hover-raci">${safe(raciSummary(item))}</p>` : ""}`;
  details.classList.add("visible");
}
function hideHoverDetails() { document.querySelector("#hover-details")?.classList.remove("visible"); }

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-item-link]")) return;
  const selectedColor = event.target.closest("[data-color]")?.dataset.color;
  if (selectedColor) {
    const palette = event.target.closest(".color-palette");
    palette.closest(".field").querySelector("input[name=\"color\"]").value = selectedColor;
    palette.closest(".field").querySelector(".active-color-swatch").style.setProperty("--swatch", colorValue(selectedColor));
    palette.closest(".field").querySelector("[data-color-picker]").value = colorValue(selectedColor);
    palette.querySelectorAll(".color-swatch").forEach((swatch) => swatch.classList.toggle("selected", swatch.dataset.color === selectedColor));
    return;
  }
  if (event.target.closest("#timeline-canvas") && !event.target.closest("[data-item]")) {
    state.selectedItemId = null;
    app.querySelectorAll(".selected").forEach((element) => element.classList.remove("selected"));
    hideHoverDetails();
  }
  const actionElement = event.target.closest("[data-action]");
  const action = actionElement?.dataset.action;
  if (action === "login-google") { loginWithGoogle().catch((error) => openModal("Connexion Google", `<p>${safe(error.message)}</p><div class="modal-actions"><span></span><button class="command-btn primary" data-action="close-modal">Fermer</button></div>`)); return; }
  if (action === "start-sandbox") { localStorage.setItem(ACCESS_MODE_KEY, "sandbox"); startSandbox(); return; }
  if (action === "return-access") { localStorage.removeItem(ACCESS_MODE_KEY); repository = null; state.mode = null; renderAccessScreen(); return; }
  if (action === "account") { const identity = state.user.user_metadata?.full_name || state.user.email || "Utilisateur connecte"; openModal("Compte", `<p>${safe(identity)}</p><div class="modal-actions"><span></span><button class="command-btn danger" data-action="logout">Se deconnecter</button></div>`); return; }
  if (action === "logout") { logout().then(() => { localStorage.removeItem(ACCESS_MODE_KEY); repository = null; state.mode = null; state.user = null; state.store = { timelines: [], items: [], recurrences: [] }; state.activeTimelineId = null; closeModal(); renderAccessScreen(); }).catch((error) => openModal("Deconnexion", `<p>${safe(error.message)}</p>`)); return; }
  if (action === "zoom-in") { state.zoom = Math.min(34, state.zoom + 2); render(); }
  if (action === "zoom-out") { state.zoom = Math.max(minimumZoom(), state.zoom - 2); render(); }
  if (action === "today") scrollToToday();
  if (action === "edit-timeline-title") openModal("Modifier le titre", timelineTitleForm(activeTimeline()));
  if (action === "save-timeline") {
    actionElement.textContent = "Sauvegarde...";
    actionElement.disabled = true;
    saveStore(state.store).then(() => {
      state.isDirty = false;
      actionElement.textContent = "Sauvegarde effectuee";
    }).catch((error) => {
      actionElement.textContent = "Sauvegarde impossible";
      openModal("Sauvegarde", `<p>${safe(error.message)}</p><div class="modal-actions"><span></span><button class="command-btn primary" data-action="close-modal">Fermer</button></div>`);
    }).finally(() => window.setTimeout(() => { actionElement.textContent = "Sauvegarder"; actionElement.disabled = !state.isDirty; }, 1800));
  }
  if (action === "new-timeline") openModal("Creer une timeline", timelineForm());
  if (action === "close-modal") closeModal();
  if (action === "delete-item") { deleteItem(state.store, event.target.dataset.item); closeModal(); render(); }
  if (action === "share") { const timeline = activeTimeline(); timeline.is_public = true; markDirty(); openModal("Lien de consultation", `<div class="share-link"><input readonly value="${location.origin}${location.pathname}?view=${timeline.public_token}"><button class="icon-btn copy-link-button" data-action="copy-share-link" title="Copier le lien" aria-label="Copier le lien"><span class="copy-link-icon" aria-hidden="true"></span></button><button class="command-btn" data-action="close-modal">Fermer</button></div>`); }
  if (action === "copy-share-link") copyShareLink(event.target.closest("button"));
  const timelineId = event.target.closest("[data-timeline]")?.dataset.timeline;
  if (timelineId) { state.activeTimelineId = timelineId; render(); }
  const itemElement = event.target.closest("[data-item]");
  const itemId = itemElement?.dataset.item;
  if (itemId && !state.readOnly) {
    if (itemElement.closest(".element-list")) {
      selectTimelineItem(itemId);
      centerTimelineItem(itemId);
      return;
    }
    if (state.skipNextItemClick) state.skipNextItemClick = false;
    else {
      const now = Date.now();
      if (lastItemClick.id === itemId && now - lastItemClick.time < 450) {
        lastItemClick = { id: null, time: 0 };
        openItem(itemId);
        return;
      }
      lastItemClick = { id: itemId, time: now };
      selectTimelineItem(itemId);
    }
  }
  const createType = event.target.closest("[data-create]")?.dataset.create;
  if (createType) { closeModal(); openModal(`Ajouter ${createType === "milestone" ? "un jalon" : createType === "period" ? "une periode" : "une annotation"}`, itemForm({ type: createType, color: createType === "annotation" ? "orange" : "blue" }, "create")); }
  const seriesType = event.target.closest("[data-series]")?.dataset.series;
  if (seriesType) { closeModal(); openModal(`Creer une serie de ${seriesType === "period" ? "periodes" : "jalons"}`, recurrenceForm(seriesType)); }
});

document.addEventListener("submit", (event) => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
  if (data.form === "") return;
  if (data.color) rememberColor(data.color);
  if (event.target.dataset.form === "timeline") { const timeline = createTimeline(state.store, data); state.activeTimelineId = timeline.id; closeModal(); render(); return; }
  if (event.target.dataset.form === "timeline-title") { activeTimeline().name = data.name.trim(); markDirty(); closeModal(); render(); return; }
  if (event.target.dataset.form === "item") { const raci = data.type === "milestone" ? JSON.stringify({ responsible: data.raci_responsible, accountable: data.raci_accountable, consulted: data.raci_consulted, informed: data.raci_informed }) : ""; delete data.raci_responsible; delete data.raci_accountable; delete data.raci_consulted; delete data.raci_informed; saveItem(state.store, { ...data, raci, id: data.id || crypto.randomUUID(), timeline_id: state.activeTimelineId, recurrence_id: null }); closeModal(); render(); return; }
  if (event.target.dataset.form === "recurrence") { const recurrence = { ...data, id: crypto.randomUUID(), timeline_id: state.activeTimelineId, occurrences: Number(data.occurrences), duration: Number(data.duration || 1), interval: Number(data.interval) }; state.store.recurrences.push(recurrence); generateOccurrences(recurrence).forEach((item) => saveItem(state.store, item)); markDirty(); closeModal(); render(); }
});
modalRoot.addEventListener("change", (event) => {
  if (!event.target.matches("[data-color-picker]")) return;
  const field = event.target.closest(".field");
  field.querySelector("input[name=\"color\"]").value = event.target.value;
  field.querySelector(".active-color-swatch").style.setProperty("--swatch", event.target.value);
  field.querySelectorAll(".color-swatch").forEach((swatch) => swatch.classList.remove("selected"));
});
app.addEventListener("change", (event) => {
  if (!event.target.matches("[data-theme-select]")) return;
  localStorage.setItem(THEME_KEY, event.target.value);
  render();
});

app.addEventListener("contextmenu", (event) => { if (!state.readOnly && event.target.closest("#timeline-canvas")) { event.preventDefault(); showContextMenu(event); } });
app.addEventListener("pointerover", (event) => {
  const itemId = event.target.closest("[data-item]")?.dataset.item;
  if (itemId && !state.selectedItemId) showHoverDetails(itemId);
});
app.addEventListener("pointerout", (event) => {
  const element = event.target.closest("[data-item]");
  if (element && !state.selectedItemId && !element.contains(event.relatedTarget)) hideHoverDetails();
});
document.addEventListener("click", (event) => { if (!event.target.closest(".context-menu") && !event.target.closest("#timeline-canvas")) { const menu = modalRoot.querySelector(".context-menu"); if (menu) menu.remove(); } });
let zoomWheelDelta = 0;
app.addEventListener("wheel", (event) => {
  const frame = event.target.closest("#timeline-frame");
  const canvas = event.target.closest("#timeline-canvas");
  if (!frame || !canvas) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  event.preventDefault();
  if (zoomWheelDelta !== 0 && Math.sign(zoomWheelDelta) !== Math.sign(event.deltaY)) zoomWheelDelta = 0;
  zoomWheelDelta += event.deltaY;
  if (Math.abs(zoomWheelDelta) < 12) return;

  const previousScale = currentScale();
  const canvasBounds = canvas.getBoundingClientRect();
  const frameBounds = frame.getBoundingClientRect();
  const focusDate = xToDate(event.clientX - canvasBounds.left, previousScale);
  const zoomStep = zoomWheelDelta < 0 ? 1 : -1;
  zoomWheelDelta = 0;
  const nextZoom = Math.max(minimumZoom(), Math.min(34, state.zoom + zoomStep));
  if (nextZoom === state.zoom) return;

  state.zoom = nextZoom;
  render();
  const nextFrame = document.querySelector("#timeline-frame");
  nextFrame.scrollLeft = Math.max(0, dateToX(focusDate, currentScale()) - (event.clientX - frameBounds.left));
}, { passive: false });

let drag;
app.addEventListener("pointerdown", (event) => {
  const milestoneCard = event.target.closest(".milestone-card[data-item]");
  const milestone = milestoneCard?.closest(".milestone");
  if (milestoneCard && !state.readOnly && milestoneCard.dataset.item === state.selectedItemId) {
    const item = state.store.items.find(({ id }) => id === milestoneCard.dataset.item);
    drag = { item, type: "milestone", element: milestone, startX: event.clientX, start: item.start_date, moved: false };
    milestone.setPointerCapture(event.pointerId);
    return;
  }

  const period = event.target.closest(".period"); if (!period || state.readOnly) return;
  if (period.dataset.item !== state.selectedItemId) return;
  const item = state.store.items.find(({ id }) => id === period.dataset.item); const handle = event.target.closest("[data-drag]")?.dataset.drag || "move";
  drag = { item, type: "period", element: period, handle, startX: event.clientX, start: item.start_date, end: item.end_date, moved: false };
  period.setPointerCapture(event.pointerId);
});
app.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const offset = event.clientX - drag.startX;
  if (Math.abs(offset) > 3) drag.moved = true;
  if (drag.type === "milestone" && drag.moved) {
    drag.element.style.transform = `translateX(calc(-50% + ${offset}px))`;
    drag.element.classList.add("dragging");
  }
  if (drag.type === "period" && drag.moved) {
    const scale = currentScale();
    const dayDelta = Math.round(offset / scale.pixelsPerDay);
    if (drag.handle === "move") drag.element.style.transform = `translateX(${dayDelta * scale.pixelsPerDay}px)`;
    if (drag.handle === "start") {
      const nextStart = Math.min(dayDelta, daysBetween(drag.start, drag.end));
      drag.element.style.left = `${dateToX(addDays(drag.start, nextStart), scale)}px`;
      drag.element.style.width = `${Math.max(32, (daysBetween(addDays(drag.start, nextStart), drag.end) + 1) * scale.pixelsPerDay)}px`;
    }
    if (drag.handle === "end") {
      const nextEnd = Math.max(dayDelta, -daysBetween(drag.start, drag.end));
      drag.element.style.width = `${Math.max(32, (daysBetween(drag.start, addDays(drag.end, nextEnd)) + 1) * scale.pixelsPerDay)}px`;
    }
    drag.element.classList.add("dragging");
  }
});
app.addEventListener("pointerup", (event) => {
  if (!drag) return;
  const scale = currentScale(); const delta = Math.round((event.clientX - drag.startX) / scale.pixelsPerDay); const item = drag.item;
  if (!drag.moved) {
    drag = null;
    state.skipNextItemClick = true;
    openItem(item.id);
    return;
  }
  drag.element.classList.remove("dragging");
  if (drag.type === "milestone") item.start_date = formatDate(addDays(drag.start, delta));
  if (drag.handle === "move") { item.start_date = formatDate(addDays(drag.start, delta)); item.end_date = formatDate(addDays(drag.end, delta)); }
  if (drag.handle === "start") item.start_date = formatDate(addDays(drag.start, Math.min(delta, daysBetween(drag.start, drag.end))));
  if (drag.handle === "end") item.end_date = formatDate(addDays(drag.end, Math.max(delta, -daysBetween(drag.start, drag.end))));
  saveItem(state.store, item); drag = null; state.skipNextItemClick = true; render();
});
bootstrap().then(() => { if (state.mode) setTimeout(scrollToToday, 0); }).catch((error) => { console.error("Initialisation Timeline impossible:", error); if (publicToken) renderPublicUnavailable(error.message); else renderAccessScreen(); });
window.addEventListener("resize", () => { if (state.mode && activeTimeline()) render(); });