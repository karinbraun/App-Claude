/**
 * store.js — Única camada que toca no localStorage.
 *
 * Mantém o estado em memória, persiste a cada mudança e avisa os "listeners"
 * (que re-renderizam a tela). Todas as ações do app passam por aqui.
 */

import { uid, todayKey } from './model.js';

const STORAGE_KEY = 'constancia:v1';
const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: { theme: 'system', notificationsEnabled: false, weekStart: 1 },
    habits: [],
    checkins: {},
  };
}

/** Garante que um objeto carregado tenha todos os campos esperados. */
function migrate(data) {
  const base = defaultState();
  if (!data || typeof data !== 'object') return base;
  const state = {
    version: SCHEMA_VERSION,
    settings: { ...base.settings, ...(data.settings || {}) },
    habits: Array.isArray(data.habits) ? data.habits : [],
    checkins: data.checkins && typeof data.checkins === 'object' ? data.checkins : {},
  };
  // Normaliza cada hábito (defensivo contra dados antigos/corrompidos).
  state.habits = state.habits.map((h, i) => ({
    id: h.id || uid(),
    name: String(h.name || 'Hábito'),
    emoji: h.emoji || '🎯',
    color: h.color || '#3b82f6',
    goalType: h.goalType === 'weekly' ? 'weekly' : 'daily',
    goalTarget: clampTarget(h.goalType, h.goalTarget),
    reminderTime: h.reminderTime || null,
    createdAt: h.createdAt || Date.now(),
    archived: !!h.archived,
    order: Number.isFinite(h.order) ? h.order : i,
  }));
  return state;
}

function clampTarget(goalType, target) {
  if (goalType === 'weekly') {
    const n = Math.round(Number(target) || 3);
    return Math.min(7, Math.max(1, n));
  }
  return 7;
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

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
// Ações — hábitos
// ----------------------------------------------------------------------------

export function activeHabits() {
  return state.habits
    .filter((h) => !h.archived)
    .sort((a, b) => a.order - b.order);
}

export function archivedHabits() {
  return state.habits
    .filter((h) => h.archived)
    .sort((a, b) => a.order - b.order);
}

export function getHabit(id) {
  return state.habits.find((h) => h.id === id) || null;
}

export function addHabit(data) {
  const id = uid();
  update((s) => {
    const maxOrder = s.habits.reduce((m, h) => Math.max(m, h.order), -1);
    s.habits.push({
      id,
      name: (data.name || 'Novo hábito').trim(),
      emoji: data.emoji || '🎯',
      color: data.color || '#3b82f6',
      goalType: data.goalType === 'weekly' ? 'weekly' : 'daily',
      goalTarget: clampTarget(data.goalType, data.goalTarget),
      reminderTime: data.reminderTime || null,
      createdAt: Date.now(),
      archived: false,
      order: maxOrder + 1,
    });
  });
  return id;
}

export function updateHabit(id, patch) {
  update((s) => {
    const h = s.habits.find((x) => x.id === id);
    if (!h) return;
    if ('name' in patch) h.name = String(patch.name).trim() || h.name;
    if ('emoji' in patch) h.emoji = patch.emoji || h.emoji;
    if ('color' in patch) h.color = patch.color || h.color;
    if ('goalType' in patch) h.goalType = patch.goalType === 'weekly' ? 'weekly' : 'daily';
    if ('goalTarget' in patch || 'goalType' in patch) {
      h.goalTarget = clampTarget(h.goalType, patch.goalTarget ?? h.goalTarget);
    }
    if ('reminderTime' in patch) h.reminderTime = patch.reminderTime || null;
  });
}

export function archiveHabit(id, archived = true) {
  update((s) => {
    const h = s.habits.find((x) => x.id === id);
    if (h) h.archived = archived;
  });
}

export function deleteHabit(id) {
  update((s) => {
    s.habits = s.habits.filter((h) => h.id !== id);
    delete s.checkins[id];
  });
}

/** Move um hábito para cima (-1) ou para baixo (+1) na lista de ativos. */
export function moveHabit(id, direction) {
  update((s) => {
    const list = s.habits
      .filter((h) => !h.archived)
      .sort((a, b) => a.order - b.order);
    const idx = list.findIndex((h) => h.id === id);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const a = list[idx];
    const b = list[swap];
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
  });
}

// ----------------------------------------------------------------------------
// Ações — check-ins
// ----------------------------------------------------------------------------

export function toggleCheck(habitId, key) {
  update((s) => {
    if (!s.checkins[habitId]) s.checkins[habitId] = {};
    if (s.checkins[habitId][key]) delete s.checkins[habitId][key];
    else s.checkins[habitId][key] = true;
  });
}

export function setCheck(habitId, key, value) {
  update((s) => {
    if (!s.checkins[habitId]) s.checkins[habitId] = {};
    if (value) s.checkins[habitId][key] = true;
    else delete s.checkins[habitId][key];
  });
}

/** Marca todos os hábitos ativos como feitos no dia informado (padrão: hoje). */
export function checkAll(key = todayKey()) {
  update((s) => {
    for (const h of s.habits) {
      if (h.archived) continue;
      if (!s.checkins[h.id]) s.checkins[h.id] = {};
      s.checkins[h.id][key] = true;
    }
  });
}

// ----------------------------------------------------------------------------
// Ações — configurações
// ----------------------------------------------------------------------------

export function setSetting(key, value) {
  update((s) => {
    s.settings[key] = value;
  });
}

// ----------------------------------------------------------------------------
// Backup — exportar / importar (importante num app só-local)
// ----------------------------------------------------------------------------

export function exportData() {
  return JSON.stringify(state, null, 2);
}

/** Substitui todo o estado por um backup importado. Retorna true se deu certo. */
export function importData(json) {
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    const next = migrate(parsed);
    update((s) => {
      s.settings = next.settings;
      s.habits = next.habits;
      s.checkins = next.checkins;
    });
    return true;
  } catch (e) {
    console.error('Backup inválido.', e);
    return false;
  }
}
