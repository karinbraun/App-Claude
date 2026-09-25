/**
 * model.js — Lógica pura do app Presença (sem APIs de navegador).
 *
 * Tudo aqui é testável no Node (`node --test`). Regras centrais:
 *  - A presença mínima é de 75% POR DISCIPLINA, contada em horas-aula.
 *  - Limite de faltas = 25% da carga horária nominal (40h → 10h; 80h → 20h).
 *  - As aulas são geradas a partir da grade semanal entre o início e o fim do
 *    semestre, menos feriados/recessos e cancelamentos, mais reposições.
 *  - Faltas registradas têm prioridade; aulas dentro de viagens entram como
 *    faltas previstas, sem contar duas vezes a mesma aula.
 * Datas usam a chave local 'YYYY-MM-DD' (nunca `toISOString()`, que é UTC).
 */

// ----------------------------------------------------------------------------
// Constantes
// ----------------------------------------------------------------------------

/** Fração mínima de presença exigida. */
export const MIN_ATTENDANCE = 0.75;
/** Fração máxima de faltas permitida (1 − presença mínima). */
export const MAX_ABSENCE = 1 - MIN_ATTENDANCE;

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
  return Math.round((keyToDate(bKey) - keyToDate(aKey)) / 86400000);
}

/** A chave é uma data válida no formato 'YYYY-MM-DD'? */
export function isDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return dateKey(keyToDate(key)) === key;
}

/** Dia da semana (0 = domingo .. 6 = sábado) de uma chave. */
export function weekdayOf(key) {
  return keyToDate(key).getDay();
}

/** A data está dentro do intervalo fechado [start, end]? (chaves comparam como texto) */
export function inRange(key, start, end) {
  return key >= start && key <= end;
}

/** Id curto e único o suficiente para uso local. */
export function uid(prefix = 'x') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Chave única de uma aula: disciplina + data. */
export function sessionKey(disciplineId, date) {
  return `${disciplineId}|${date}`;
}

// ----------------------------------------------------------------------------
// Geração das aulas
// ----------------------------------------------------------------------------

/** Limite de faltas (em horas-aula) de uma disciplina. */
export function limitHours(discipline) {
  return (Number(discipline.workload) || 0) * MAX_ABSENCE;
}

/** A data cai em algum feriado/recesso? */
export function isHoliday(holidays, key) {
  return (holidays || []).some((h) => inRange(key, h.start, h.end || h.start));
}

/**
 * Aulas de UMA disciplina no semestre, ordenadas por data.
 * Retorna [{ disciplineId, date, hours, key, extra }]. Vários horários no
 * mesmo dia da semana somam horas numa única aula daquele dia.
 */
export function disciplineSessions(state, discipline) {
  const { semester, holidays } = state;
  const byDate = new Map();
  if (semester && isDateKey(semester.start) && isDateKey(semester.end) && semester.start <= semester.end) {
    const hoursByWeekday = new Map();
    for (const slot of discipline.slots || []) {
      const h = Number(slot.hours) || 0;
      if (h <= 0) continue;
      hoursByWeekday.set(slot.weekday, (hoursByWeekday.get(slot.weekday) || 0) + h);
    }
    const cancelled = new Set(discipline.cancelled || []);
    for (let key = semester.start; key <= semester.end; key = addDaysKey(key, 1)) {
      const hours = hoursByWeekday.get(weekdayOf(key));
      if (!hours) continue;
      if (cancelled.has(key) || isHoliday(holidays, key)) continue;
      byDate.set(key, { hours, extra: false });
    }
  }
  // Reposições entram mesmo fora da grade (e somam se caírem num dia de aula).
  for (const ex of discipline.extra || []) {
    const h = Number(ex.hours) || 0;
    if (!isDateKey(ex.date) || h <= 0) continue;
    const cur = byDate.get(ex.date);
    byDate.set(ex.date, { hours: (cur ? cur.hours : 0) + h, extra: true });
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({
      disciplineId: discipline.id,
      date,
      hours: v.hours,
      extra: v.extra,
      key: sessionKey(discipline.id, date),
    }));
}

/** Todas as aulas de todas as disciplinas, ordenadas por data. */
export function generateSessions(state) {
  const all = [];
  for (const d of state.disciplines || []) all.push(...disciplineSessions(state, d));
  return all.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

// ----------------------------------------------------------------------------
// Faltas e viagens
// ----------------------------------------------------------------------------

/** Horas de falta registradas numa aula (0 se nenhuma). */
export function registeredHours(absences, disciplineId, date) {
  const map = absences && absences[disciplineId];
  return map && map[date] ? Number(map[date]) || 0 : 0;
}

/** Aulas de uma lista que caem no período da viagem (sem considerar exclusões). */
export function sessionsInTrip(sessions, trip) {
  if (!trip || !isDateKey(trip.start)) return [];
  const end = isDateKey(trip.end) && trip.end >= trip.start ? trip.end : trip.start;
  return sessions.filter((s) => inRange(s.date, trip.start, end));
}

/**
 * Aulas que as viagens transformam em falta prevista: dentro de alguma viagem,
 * não desmarcadas nela e ainda sem falta registrada. Uma aula coberta por duas
 * viagens conta uma vez. Retorna Map(sessionKey -> sessão).
 */
export function tripAbsenceSessions(sessions, trips, absences) {
  const out = new Map();
  for (const trip of trips || []) {
    const excluded = new Set(trip.excluded || []);
    for (const s of sessionsInTrip(sessions, trip)) {
      if (excluded.has(s.key)) continue;
      if (registeredHours(absences, s.disciplineId, s.date) > 0) continue;
      out.set(s.key, s);
    }
  }
  return out;
}

/**
 * Resumo por disciplina. `today` separa faltas previstas futuras de aulas de
 * viagens já passadas que ainda não foram registradas como falta.
 */
export function disciplineSummary(state, discipline, today = todayKey()) {
  const sessions = disciplineSessions(state, discipline);
  const workload = Number(discipline.workload) || 0;
  const limit = limitHours(discipline);

  const absMap = (state.absences && state.absences[discipline.id]) || {};
  let registered = 0;
  for (const h of Object.values(absMap)) registered += Number(h) || 0;

  let planned = 0; // viagens, datas a partir de hoje
  let pastTrip = 0; // viagens, datas passadas sem falta registrada
  for (const s of tripAbsenceSessions(sessions, state.trips, state.absences).values()) {
    if (s.date >= today) planned += s.hours;
    else pastTrip += s.hours;
  }

  const total = registered + planned + pastTrip;
  const balance = limit - total;
  const calendarHours = sessions.reduce((sum, s) => sum + s.hours, 0);
  const typical = typicalSessionHours(discipline, sessions);

  return {
    discipline,
    workload,
    limit,
    registered,
    planned,
    pastTrip,
    total,
    balance,
    status: statusFor(balance),
    attendance: workload > 0 ? (workload - total) / workload : 1,
    // Quantos encontros "típicos" ainda cabem no saldo.
    sessionsLeft: typical > 0 && balance > 0 ? Math.floor(balance / typical + 1e-9) : 0,
    typicalHours: typical,
    calendarHours,
    calendarMismatch: sessions.length > 0 && calendarHours !== workload,
    sessionCount: sessions.length,
  };
}

/** Resumo de todas as disciplinas, na ordem cadastrada. */
export function allSummaries(state, today = todayKey()) {
  return (state.disciplines || []).map((d) => disciplineSummary(state, d, today));
}

/** 'ok' (dentro do limite), 'limit' (saldo zerado) ou 'over' (reprovaria). */
export function statusFor(balance) {
  if (balance < -1e-9) return 'over';
  if (balance < 1e-9) return 'limit';
  return 'ok';
}

/** Horas de um encontro típico: a moda das horas das aulas; senão, da grade. */
export function typicalSessionHours(discipline, sessions) {
  const counts = new Map();
  for (const s of sessions) if (!s.extra) counts.set(s.hours, (counts.get(s.hours) || 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [h, c] of counts) {
    if (c > bestCount || (c === bestCount && h > best)) { best = h; bestCount = c; }
  }
  if (best) return best;
  const slotHours = (discipline.slots || []).map((s) => Number(s.hours) || 0).filter(Boolean);
  return slotHours.length ? Math.max(...slotHours) : 0;
}

/**
 * Simula o impacto de uma viagem (nova ou editada) antes de salvar.
 * Se `trip.id` já existir, a versão salva é substituída pela simulada.
 * Retorna, por disciplina afetada: aulas no período, horas perdidas, saldo
 * antes e depois e status depois; e o pior status geral.
 */
export function simulateTrip(state, trip, today = todayKey()) {
  const otherTrips = (state.trips || []).filter((t) => t.id !== trip.id);
  const before = { ...state, trips: otherTrips };
  const after = { ...state, trips: [...otherTrips, trip] };
  const excluded = new Set(trip.excluded || []);

  const rows = [];
  for (const d of state.disciplines || []) {
    const sessions = sessionsInTrip(disciplineSessions(state, d), trip);
    if (!sessions.length) continue;
    const a = disciplineSummary(before, d, today);
    const b = disciplineSummary(after, d, today);
    rows.push({
      discipline: d,
      sessions: sessions.map((s) => ({
        ...s,
        excluded: excluded.has(s.key),
        registered: registeredHours(state.absences, d.id, s.date),
      })),
      hoursLost: b.total - a.total,
      balanceBefore: a.balance,
      balanceAfter: b.balance,
      limit: b.limit,
      statusAfter: b.status,
    });
  }
  const rank = { ok: 0, limit: 1, over: 2 };
  const worst = rows.reduce((w, r) => (rank[r.statusAfter] > rank[w] ? r.statusAfter : w), 'ok');
  return { rows, worst, hoursLost: rows.reduce((s, r) => s + r.hoursLost, 0) };
}

// ----------------------------------------------------------------------------
// Formatação
// ----------------------------------------------------------------------------

/** Horas com no máximo 1 casa decimal e vírgula: 7.5 -> '7,5'. */
export function fmtHours(h) {
  const r = Math.round(h * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')) + 'h';
}

/** Percentual com 1 casa, truncado (74,99% aparece como 74,9%, nunca 75%). */
export function fmtPct(x) {
  return String(Math.floor(x * 1000 + 1e-9) / 10).replace('.', ',') + '%';
}

export const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** '2026-09-25' -> '25/09'. */
export function fmtDate(key) {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

/** '2026-09-25' -> 'sex, 25 set'. */
export function fmtDateLong(key) {
  const dt = keyToDate(key);
  return `${WEEKDAYS_SHORT[dt.getDay()]}, ${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`;
}

/** Período legível: '25/09' ou '25/09 a 28/09'. */
export function fmtRange(start, end) {
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} a ${fmtDate(end)}`;
}
