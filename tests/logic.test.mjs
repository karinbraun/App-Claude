/**
 * Testes das funções puras de model.js — rode com: `node --test`
 * Cobrem os pontos delicados: datas seguras contra fuso, streaks diários e
 * semanais (incluindo carência), recorde, metas e adesão.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../js/model.js';

// Helper: monta um objeto checkins marcando as chaves informadas para um hábito.
function checks(habitId, keys) {
  const map = {};
  for (const k of keys) map[k] = true;
  return { [habitId]: map };
}

test('dateKey usa data local e faz roundtrip', () => {
  const d = new Date(2026, 6, 19); // 19/07/2026 local
  assert.equal(m.dateKey(d), '2026-07-19');
  assert.equal(m.dateKey(m.keyToDate('2026-07-19')), '2026-07-19');
});

test('addDaysKey atravessa virada de mês e de ano', () => {
  assert.equal(m.addDaysKey('2026-01-31', 1), '2026-02-01');
  assert.equal(m.addDaysKey('2026-12-31', 1), '2027-01-01');
  assert.equal(m.addDaysKey('2026-03-01', -1), '2026-02-28');
});

test('diffDays conta dias inteiros', () => {
  assert.equal(m.diffDays('2026-07-01', '2026-07-19'), 18);
  assert.equal(m.diffDays('2026-07-19', '2026-07-19'), 0);
});

test('startOfWeek com segunda-feira retorna uma segunda contendo a data', () => {
  const now = new Date(2026, 6, 19);
  const start = m.startOfWeek(now, 1);
  assert.equal(start.getDay(), 1, 'início deve ser segunda-feira');
  const diff = m.diffDays(m.dateKey(start), m.dateKey(now));
  assert.ok(diff >= 0 && diff <= 6, 'a data cai dentro da semana');
});

test('streak diário conta dias consecutivos terminando hoje', () => {
  const c = checks('a', ['2026-07-17', '2026-07-18', '2026-07-19']);
  assert.equal(m.currentStreakDaily(c, 'a', '2026-07-19'), 3);
});

test('streak diário: carência quando hoje ainda não foi marcado', () => {
  const c = checks('a', ['2026-07-17', '2026-07-18']); // hoje (19) não marcado
  assert.equal(m.currentStreakDaily(c, 'a', '2026-07-19'), 2, 'sequência de ontem continua valendo');
});

test('streak diário: buraco quebra a sequência', () => {
  const c = checks('a', ['2026-07-17', '2026-07-19']); // pulou o dia 18
  assert.equal(m.currentStreakDaily(c, 'a', '2026-07-19'), 1);
});

test('streak diário zera sem dados recentes', () => {
  const c = checks('a', ['2026-07-01']);
  assert.equal(m.currentStreakDaily(c, 'a', '2026-07-19'), 0);
});

test('bestStreak diário encontra a maior sequência histórica', () => {
  const c = checks('a', [
    '2026-06-01', '2026-06-02', // run de 2
    '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', // run de 4
    '2026-06-20', // run de 1
  ]);
  const habit = { id: 'a', goalType: 'daily', goalTarget: 7 };
  assert.equal(m.bestStreak(habit, c), 4);
});

test('streak semanal conta semanas consecutivas que bateram o alvo', () => {
  const now = new Date(2026, 6, 19);
  const cur = m.startOfWeek(now, 1);
  const prev = m.addDays(cur, -7);
  const keys = [
    m.dateKey(cur), m.dateKey(m.addDays(cur, 1)), m.dateKey(m.addDays(cur, 2)), // 3 na semana atual
    m.dateKey(prev), m.dateKey(m.addDays(prev, 1)), m.dateKey(m.addDays(prev, 2)), // 3 na anterior
  ];
  const c = checks('a', keys);
  assert.equal(m.currentStreakWeekly(c, 'a', 3, now, 1), 2);
});

test('streak semanal: semana atual incompleta não quebra o histórico (carência)', () => {
  const now = new Date(2026, 6, 19);
  const cur = m.startOfWeek(now, 1);
  const prev = m.addDays(cur, -7);
  const prev2 = m.addDays(cur, -14);
  const three = (start) => [m.dateKey(start), m.dateKey(m.addDays(start, 1)), m.dateKey(m.addDays(start, 2))];
  const c = checks('a', [
    m.dateKey(cur), m.dateKey(m.addDays(cur, 1)), // só 2 na atual (alvo 3, não bateu ainda)
    ...three(prev), ...three(prev2), // duas semanas anteriores bateram
  ]);
  assert.equal(m.currentStreakWeekly(c, 'a', 3, now, 1), 2, 'conta as 2 anteriores, sem zerar');
});

test('weeklyProgress e isGoalMetToday', () => {
  const now = new Date(2026, 6, 19);
  const cur = m.startOfWeek(now, 1);
  const c = checks('a', [m.dateKey(cur), m.dateKey(m.addDays(cur, 1))]);
  const habit = { id: 'a', goalType: 'weekly', goalTarget: 4 };
  const p = m.weeklyProgress(habit, c, now, 1);
  assert.deepEqual(p, { done: 2, target: 4 });
  assert.equal(m.isGoalMetToday(habit, c, now, 1), false);

  const habit2 = { id: 'a', goalType: 'daily', goalTarget: 7 };
  const c2 = checks('a', ['2026-07-19']);
  assert.equal(m.isGoalMetToday(habit2, c2, now, 1), true);
});

test('adherence: 100% quando todos os dias do período estão marcados (meta diária)', () => {
  const now = new Date(2026, 6, 19);
  const keys = [];
  for (let i = 0; i < 7; i++) keys.push(m.addDaysKey('2026-07-19', -i));
  const c = checks('a', keys);
  const habit = { id: 'a', goalType: 'daily', goalTarget: 7 };
  assert.equal(m.adherence(habit, c, 7, now), 1);
});

test('heatmap devolve a grade certa e marca a célula de hoje', () => {
  const now = new Date(2026, 6, 19);
  const habit = { id: 'a', createdAt: new Date(2026, 0, 1).getTime() };
  const c = checks('a', ['2026-07-19']);
  const grid = m.heatmap(habit, c, 4, now, 1);
  assert.equal(grid.length, 4, '4 semanas');
  assert.ok(grid.every((col) => col.length === 7), 'cada semana com 7 dias');
  const flat = grid.flat();
  const today = flat.find((cell) => cell.key === '2026-07-19');
  assert.ok(today && today.checked, 'hoje aparece marcado');
  assert.equal(today.future, false, 'hoje não é futuro');
  // O flag `future` deve valer exatamente para chaves posteriores a hoje.
  assert.ok(flat.every((cell) => cell.future === (cell.key > '2026-07-19')), 'flag future correto');
});

test('byWeekday soma conclusões por dia da semana', () => {
  const now = new Date(2026, 6, 19);
  const habit = { id: 'a', createdAt: new Date(2026, 6, 1).getTime() };
  const cur = m.startOfWeek(now, 1);
  const c = checks('a', [m.dateKey(cur)]); // segunda-feira marcada
  const data = m.byWeekday(habit, c, 4, now, 1);
  assert.equal(data.length, 7);
  assert.equal(data[0].done, 1, 'a segunda (índice 0 com weekStart=1) tem 1 conclusão');
});

test('byWeekday conta um dia marcado mesmo antes da criação do hábito (backfill)', () => {
  const now = new Date(2026, 6, 19);
  const habit = { id: 'a', createdAt: new Date(2026, 6, 19).getTime() }; // criado "hoje"
  const cur = m.startOfWeek(now, 1);
  const lastWeekMonday = m.addDays(cur, -7);
  const c = checks('a', [m.dateKey(lastWeekMonday)]); // check retroativo
  const data = m.byWeekday(habit, c, 4, now, 1);
  assert.equal(data[0].done, 1, 'check retroativo conta mesmo antes da criação');
});

test('uid gera identificadores diferentes', () => {
  assert.notEqual(m.uid(), m.uid());
});
