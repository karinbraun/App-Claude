/**
 * model.js — Lógica pura do app (sem APIs de navegador).
 *
 * Tudo aqui é testável no Node (`node --test`) porque não toca em
 * localStorage, DOM, Notification, etc. Cuidado especial: todas as datas
 * trabalham com o horário LOCAL e usam a chave 'YYYY-MM-DD' para evitar o
 * clássico bug de fuso horário do `toISOString()` (que usa UTC).
 */

// ----------------------------------------------------------------------------
// Utilidades de data (chave local 'YYYY-MM-DD')
// ----------------------------------------------------------------------------

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD' usando componentes LOCAIS. */
export function dateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Chave 'YYYY-MM-DD' do dia de hoje (local). */
export function todayKey(now = new Date()) {
  return dateKey(now);
}

/** 'YYYY-MM-DD' -> Date na meia-noite local. */
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Nova Date somando `n` dias (n pode ser negativo). Normaliza para meia-noite. */
export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

/** Soma dias direto na chave. */
export function addDaysKey(key, n) {
  return dateKey(addDays(keyToDate(key), n));
}

/** Diferença em dias inteiros (bKey - aKey). Robusto a horário de verão. */
export function diffDays(aKey, bKey) {
  const a = keyToDate(aKey);
  const b = keyToDate(bKey);
  return Math.round((b - a) / 86400000);
}

/**
 * Início da semana da data informada. weekStart: 1 = segunda-feira (padrão BR),
 * 0 = domingo. Retorna Date na meia-noite local.
 */
export function startOfWeek(date, weekStart = 1) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=domingo .. 6=sábado
  const diff = (day - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** Os 7 dias (Date) da semana que contém `refDate`. */
export function weekDays(refDate, weekStart = 1) {
  const start = startOfWeek(refDate, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ----------------------------------------------------------------------------
// Consulta de check-ins
// ----------------------------------------------------------------------------

/** Um hábito está marcado nessa data? */
export function isChecked(checkins, habitId, key) {
  const map = checkins[habitId];
  return !!(map && map[key]);
}

/** Quantos check-ins o hábito tem na semana de `refDate`. */
export function weekCheckCount(checkins, habitId, refDate, weekStart = 1) {
  let count = 0;
  for (const d of weekDays(refDate, weekStart)) {
    if (isChecked(checkins, habitId, dateKey(d))) count++;
  }
  return count;
}

/** Total de check-ins de um hábito (todos os tempos). */
export function totalChecks(checkins, habitId) {
  const map = checkins[habitId];
  if (!map) return 0;
  let c = 0;
  for (const k in map) if (map[k]) c++;
  return c;
}

// ----------------------------------------------------------------------------
// Metas
// ----------------------------------------------------------------------------

/** Alvo semanal do hábito: metas diárias equivalem a 7x/semana. */
export function weeklyTarget(habit) {
  return habit.goalType === 'weekly' ? habit.goalTarget : 7;
}

/** Progresso da semana atual: { done, target }. */
export function weeklyProgress(habit, checkins, now = new Date(), weekStart = 1) {
  return {
    done: weekCheckCount(checkins, habit.id, now, weekStart),
    target: weeklyTarget(habit),
  };
}

/** A meta do dia de hoje já foi cumprida? (para metas diárias = marcado hoje) */
export function isGoalMetToday(habit, checkins, now = new Date(), weekStart = 1) {
  if (habit.goalType === 'weekly') {
    return weekCheckCount(checkins, habit.id, now, weekStart) >= habit.goalTarget;
  }
  return isChecked(checkins, habit.id, dateKey(now));
}

// ----------------------------------------------------------------------------
// Sequências (streaks)
// ----------------------------------------------------------------------------

/**
 * Streak de meta diária: dias consecutivos marcados terminando hoje.
 * Regra de carência: se hoje ainda não foi marcado, a sequência que terminou
 * ontem continua valendo até o dia acabar (não zera na hora).
 */
export function currentStreakDaily(checkins, habitId, todayK) {
  let count = 0;
  let key = todayK;
  if (!isChecked(checkins, habitId, key)) {
    key = addDaysKey(key, -1); // carência: olha a sequência que terminou ontem
  }
  while (isChecked(checkins, habitId, key)) {
    count++;
    key = addDaysKey(key, -1);
  }
  return count;
}

/**
 * Streak de meta semanal: semanas consecutivas que bateram o alvo.
 * A semana atual só conta se já bateu o alvo; se ainda não bateu, não zera
 * (carência), mas também não soma.
 */
export function currentStreakWeekly(checkins, habitId, target, now = new Date(), weekStart = 1) {
  let count = 0;
  let ref = startOfWeek(now, weekStart);
  if (weekCheckCount(checkins, habitId, ref, weekStart) >= target) count++;
  ref = addDays(ref, -7);
  while (weekCheckCount(checkins, habitId, ref, weekStart) >= target) {
    count++;
    ref = addDays(ref, -7);
  }
  return count;
}

/** Streak atual respeitando o tipo de meta. */
export function currentStreak(habit, checkins, now = new Date(), weekStart = 1) {
  if (habit.goalType === 'weekly') {
    return currentStreakWeekly(checkins, habit.id, habit.goalTarget, now, weekStart);
  }
  return currentStreakDaily(checkins, habit.id, dateKey(now));
}

/** Maior sequência diária já alcançada (recorde). */
export function bestStreakDaily(checkins, habitId) {
  const map = checkins[habitId] || {};
  const keys = Object.keys(map).filter((k) => map[k]).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && diffDays(prev, k) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

/** Maior sequência semanal já alcançada (recorde). */
export function bestStreakWeekly(checkins, habitId, target, weekStart = 1) {
  const map = checkins[habitId] || {};
  const keys = Object.keys(map).filter((k) => map[k]).sort();
  if (!keys.length) return 0;
  let ref = startOfWeek(keyToDate(keys[0]), weekStart);
  const end = startOfWeek(keyToDate(keys[keys.length - 1]), weekStart);
  let best = 0;
  let run = 0;
  while (ref.getTime() <= end.getTime()) {
    if (weekCheckCount(checkins, habitId, ref, weekStart) >= target) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
    ref = addDays(ref, 7);
  }
  return best;
}

/** Recorde de sequência respeitando o tipo de meta. */
export function bestStreak(habit, checkins, weekStart = 1) {
  if (habit.goalType === 'weekly') {
    return bestStreakWeekly(checkins, habit.id, habit.goalTarget, weekStart);
  }
  return bestStreakDaily(checkins, habit.id);
}

// ----------------------------------------------------------------------------
// Estatísticas
// ----------------------------------------------------------------------------

/**
 * Taxa de adesão nos últimos `days` dias (0..1). Para metas semanais, compara
 * o número de check-ins com o alvo proporcional ao período.
 */
export function adherence(habit, checkins, days, now = new Date()) {
  const todayK = dateKey(now);
  const fromKey = addDaysKey(todayK, -(days - 1));
  let done = 0;
  for (let i = 0; i < days; i++) {
    if (isChecked(checkins, habit.id, addDaysKey(fromKey, i))) done++;
  }
  const expected = habit.goalType === 'weekly'
    ? Math.max(1, Math.round((habit.goalTarget * days) / 7))
    : days;
  return Math.min(1, done / expected);
}

/**
 * Grade do mapa de calor: array de colunas (semanas), cada coluna com 7 dias.
 * Cada célula: { key, checked, future, before }.
 */
export function heatmap(habit, checkins, weeks, now = new Date(), weekStart = 1) {
  const currentWeekStart = startOfWeek(now, weekStart);
  const firstWeekStart = addDays(currentWeekStart, -7 * (weeks - 1));
  const todayK = dateKey(now);
  const createdK = habit.createdAt ? dateKey(new Date(habit.createdAt)) : null;
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const colStart = addDays(firstWeekStart, w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const key = dateKey(addDays(colStart, d));
      days.push({
        key,
        checked: isChecked(checkins, habit.id, key),
        future: key > todayK,
        before: createdK ? key < createdK : false,
      });
    }
    cols.push(days);
  }
  return cols;
}

/**
 * Conclusões por dia da semana ao longo das últimas `weeks` semanas.
 * Retorna 7 posições na ordem definida por weekStart, cada uma { done, total }.
 */
export function byWeekday(habit, checkins, weeks, now = new Date(), weekStart = 1) {
  const result = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
  const todayK = dateKey(now);
  const createdK = habit.createdAt ? dateKey(new Date(habit.createdAt)) : null;
  const start = addDays(startOfWeek(now, weekStart), -7 * (weeks - 1));
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    const key = dateKey(date);
    if (key > todayK) continue; // futuro não conta
    const checked = isChecked(checkins, habit.id, key);
    // Antes de o hábito existir só ignoramos os dias SEM check; um dia marcado
    // (ex: preenchido na grade) sempre conta.
    if (createdK && key < createdK && !checked) continue;
    const idx = (date.getDay() - weekStart + 7) % 7;
    result[idx].total++;
    if (checked) result[idx].done++;
  }
  return result;
}

// ----------------------------------------------------------------------------
// Diversos
// ----------------------------------------------------------------------------

/** Gera um id único e curto para um hábito. */
export function uid() {
  return 'h_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Rótulos curtos dos dias da semana (ordem depende de weekStart). */
export function weekdayLabels(weekStart = 1) {
  const base = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // domingo..sábado
  return Array.from({ length: 7 }, (_, i) => base[(i + weekStart) % 7]);
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const DIAS = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
];

/** "sábado, 19 de julho" */
export function formatLongDate(date) {
  return `${DIAS[date.getDay()]}, ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

/** "19 jul" */
export function formatShortDate(date) {
  return `${date.getDate()} ${MESES[date.getMonth()].slice(0, 3)}`;
}
