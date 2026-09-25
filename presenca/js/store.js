/**
 * store.js — Única camada que toca no localStorage.
 *
 * Mantém o estado em memória, persiste a cada mudança e avisa os "listeners"
 * (que re-renderizam a tela). Todas as ações do app passam por aqui.
 */

import { uid, isDateKey } from './model.js';

const STORAGE_KEY = 'presenca:v1';
const SCHEMA_VERSION = 1;

export const COLORS = ['#6d5efc', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: { theme: 'system' },
    semester: { start: '', end: '' },
    holidays: [],
    disciplines: [],
    absences: {},
    trips: [],
  };
}

const dates = (arr) => (Array.isArray(arr) ? arr.filter(isDateKey) : []);
const positive = (n, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

function normalizeDiscipline(d, i) {
  return {
    id: d.id || uid('d'),
    name: String(d.name || 'Disciplina').trim(),
    color: d.color || COLORS[i % COLORS.length],
    workload: positive(d.workload, 40),
    slots: (Array.isArray(d.slots) ? d.slots : [])
      .map((s) => ({ weekday: Math.min(6, Math.max(0, Math.round(Number(s.weekday) || 0))), hours: positive(s.hours, 2) })),
    cancelled: dates(d.cancelled),
    extra: (Array.isArray(d.extra) ? d.extra : [])
      .filter((e) => isDateKey(e.date))
      .map((e) => ({ date: e.date, hours: positive(e.hours, 2) })),
  };
}

function normalizeRange(r, prefix) {
  const start = isDateKey(r.start) ? r.start : null;
  if (!start) return null;
  const end = isDateKey(r.end) && r.end >= start ? r.end : start;
  return { id: r.id || uid(prefix), start, end, name: String(r.name || r.label || '').trim() };
}

/** Garante que um objeto carregado tenha todos os campos esperados. */
function migrate(data) {
  const base = defaultState();
  if (!data || typeof data !== 'object') return base;
  const absences = {};
  for (const [id, map] of Object.entries(data.absences || {})) {
    if (!map || typeof map !== 'object') continue;
    absences[id] = {};
    for (const [k, h] of Object.entries(map)) if (isDateKey(k) && Number(h) > 0) absences[id][k] = Number(h);
  }
  return {
    version: SCHEMA_VERSION,
    settings: { ...base.settings, ...(data.settings || {}) },
    semester: {
      start: isDateKey(data.semester?.start) ? data.semester.start : '',
      end: isDateKey(data.semester?.end) ? data.semester.end : '',
    },
    holidays: (Array.isArray(data.holidays) ? data.holidays : []).map((h) => normalizeRange(h, 'f')).filter(Boolean),
    disciplines: (Array.isArray(data.disciplines) ? data.disciplines : []).map(normalizeDiscipline),
    absences,
    trips: (Array.isArray(data.trips) ? data.trips : [])
      .map((t) => {
        const r = normalizeRange(t, 't');
        return r && { ...r, excluded: Array.isArray(t.excluded) ? t.excluded.map(String) : [] };
      })
      .filter(Boolean),
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Falha ao carregar dados; começando do zero.', e);
    return defaultState();
  }
}

function save(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (e) {
    console.error('Falha ao salvar dados.', e);
  }
}

// ----------------------------------------------------------------------------
// Estado reativo
// ----------------------------------------------------------------------------

let state = load();
const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

/** Aplica uma mutação no estado, persiste e notifica. */
function update(mutator) {
  mutator(state);
  save(state);
  emit();
}

// ----------------------------------------------------------------------------
// Semestre e feriados
// ----------------------------------------------------------------------------

export function setSemester(start, end) {
  update((s) => {
    s.semester = { start: isDateKey(start) ? start : '', end: isDateKey(end) ? end : '' };
  });
}

export function addHoliday(data) {
  const h = normalizeRange(data, 'f');
  if (!h) return false;
  update((s) => {
    s.holidays.push(h);
    s.holidays.sort((a, b) => (a.start < b.start ? -1 : 1));
  });
  return true;
}

export function removeHoliday(id) {
  update((s) => {
    s.holidays = s.holidays.filter((h) => h.id !== id);
  });
}

// ----------------------------------------------------------------------------
// Disciplinas
// ----------------------------------------------------------------------------

export function getDiscipline(id) {
  return state.disciplines.find((d) => d.id === id) || null;
}

/** Cria (sem id) ou substitui (com id) uma disciplina. Retorna o id. */
export function saveDiscipline(data) {
  const d = normalizeDiscipline(data, state.disciplines.length);
  update((s) => {
    const idx = s.disciplines.findIndex((x) => x.id === d.id);
    if (idx >= 0) s.disciplines[idx] = d;
    else s.disciplines.push(d);
  });
  return d.id;
}

export function deleteDiscipline(id) {
  update((s) => {
    s.disciplines = s.disciplines.filter((d) => d.id !== id);
    delete s.absences[id];
    const prefix = id + '|';
    for (const t of s.trips) t.excluded = t.excluded.filter((k) => !k.startsWith(prefix));
  });
}

// ----------------------------------------------------------------------------
// Faltas
// ----------------------------------------------------------------------------

/** Define as horas de falta numa aula (0 = presente). */
export function setAbsence(disciplineId, date, hours) {
  update((s) => {
    const h = Number(hours) || 0;
    if (!s.absences[disciplineId]) s.absences[disciplineId] = {};
    if (h > 0) s.absences[disciplineId][date] = h;
    else delete s.absences[disciplineId][date];
  });
}

/** Registra de uma vez as faltas previstas (aulas de viagens já passadas). */
export function registerAbsences(list) {
  update((s) => {
    for (const { disciplineId, date, hours } of list) {
      if (!s.absences[disciplineId]) s.absences[disciplineId] = {};
      s.absences[disciplineId][date] = hours;
    }
  });
}

// ----------------------------------------------------------------------------
// Viagens
// ----------------------------------------------------------------------------

export function getTrip(id) {
  return state.trips.find((t) => t.id === id) || null;
}

/** Cria (sem id) ou substitui (com id) uma viagem. Retorna o id ou null se inválida. */
export function saveTrip(data) {
  const r = normalizeRange(data, 't');
  if (!r) return null;
  const trip = { ...r, excluded: [...(data.excluded || [])] };
  update((s) => {
    const idx = s.trips.findIndex((t) => t.id === trip.id);
    if (idx >= 0) s.trips[idx] = trip;
    else s.trips.push(trip);
    s.trips.sort((a, b) => (a.start < b.start ? -1 : 1));
  });
  return trip.id;
}

export function deleteTrip(id) {
  update((s) => {
    s.trips = s.trips.filter((t) => t.id !== id);
  });
}

// ----------------------------------------------------------------------------
// Configurações e backup
// ----------------------------------------------------------------------------

export function setSetting(key, value) {
  update((s) => {
    s.settings[key] = value;
  });
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

/** Substitui todo o estado por um backup importado. Retorna true se deu certo. */
export function importData(json) {
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.disciplines)) return false;
    const next = migrate(parsed);
    update((s) => Object.assign(s, next));
    return true;
  } catch (e) {
    console.error('Backup inválido.', e);
    return false;
  }
}

export function resetAll() {
  update((s) => Object.assign(s, defaultState()));
}
