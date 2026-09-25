/**
 * Testes das funções puras de presenca/js/model.js — rode com: `node --test`
 * Cobrem: geração de aulas (grade, feriados, cancelamentos, reposições),
 * limites de 10h/20h, faltas parciais, viagens (exclusões, sobreposição,
 * sem contagem dupla) e simulação.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../presenca/js/model.js';

// Semestre curto de exemplo: 03/08/2026 (segunda) a 30/08/2026 (domingo) = 4 semanas.
function baseState(extra = {}) {
  return {
    semester: { start: '2026-08-03', end: '2026-08-30' },
    holidays: [],
    disciplines: [
      // 40h: 2h-aula às terças.
      { id: 'a', name: 'Psicologia Social', workload: 40, slots: [{ weekday: 2, hours: 2 }], cancelled: [], extra: [] },
      // 80h: 2h segunda + 2h quinta.
      { id: 'b', name: 'Psicopatologia', workload: 80, slots: [{ weekday: 1, hours: 2 }, { weekday: 4, hours: 2 }], cancelled: [], extra: [] },
    ],
    absences: {},
    trips: [],
    ...extra,
  };
}

test('limite de faltas é 25% da carga', () => {
  assert.equal(m.limitHours({ workload: 40 }), 10);
  assert.equal(m.limitHours({ workload: 80 }), 20);
  assert.equal(m.limitHours({ workload: 60 }), 15);
});

test('gera aulas pela grade semanal dentro do semestre', () => {
  const s = baseState();
  const a = m.disciplineSessions(s, s.disciplines[0]);
  assert.deepEqual(a.map((x) => x.date), ['2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25']);
  assert.ok(a.every((x) => x.hours === 2));
  const b = m.disciplineSessions(s, s.disciplines[1]);
  assert.equal(b.length, 8);
  assert.equal(b[0].date, '2026-08-03');
  assert.equal(b[1].date, '2026-08-06');
});

test('dois horários no mesmo dia somam horas numa aula', () => {
  const s = baseState();
  s.disciplines[1].slots = [{ weekday: 3, hours: 2 }, { weekday: 3, hours: 2 }];
  const b = m.disciplineSessions(s, s.disciplines[1]);
  assert.equal(b.length, 4);
  assert.ok(b.every((x) => x.hours === 4));
});

test('feriado (inclusive recesso em período), cancelamento e reposição', () => {
  const s = baseState({ holidays: [{ start: '2026-08-11', end: '2026-08-11', label: 'Feriado' }, { start: '2026-08-24', end: '2026-08-28', label: 'Recesso' }] });
  s.disciplines[0].cancelled = ['2026-08-18'];
  s.disciplines[0].extra = [{ date: '2026-08-29', hours: 2 }];
  const a = m.disciplineSessions(s, s.disciplines[0]);
  assert.deepEqual(a.map((x) => x.date), ['2026-08-04', '2026-08-29']);
  assert.equal(a[1].extra, true);
});

test('semestre inválido não gera aulas da grade, mas mantém reposições', () => {
  const s = baseState({ semester: { start: '2026-08-30', end: '2026-08-03' } });
  s.disciplines[0].extra = [{ date: '2026-08-10', hours: 2 }];
  assert.deepEqual(m.disciplineSessions(s, s.disciplines[0]).map((x) => x.date), ['2026-08-10']);
});

test('faltas registradas (inclusive parciais) reduzem o saldo', () => {
  const s = baseState({ absences: { a: { '2026-08-04': 2, '2026-08-11': 1 } } });
  const r = m.disciplineSummary(s, s.disciplines[0], '2026-08-20');
  assert.equal(r.registered, 3);
  assert.equal(r.balance, 7);
  assert.equal(r.status, 'ok');
  assert.equal(r.sessionsLeft, 3); // 7h / 2h por encontro
  assert.equal(r.attendance, 37 / 40);
});

test('viagem transforma aulas do período em falta prevista', () => {
  // Viagem de segunda 10/08 a quarta 12/08: pega seg (b) e ter (a).
  const s = baseState({ trips: [{ id: 't1', name: 'SP', start: '2026-08-10', end: '2026-08-12', excluded: [] }] });
  const a = m.disciplineSummary(s, s.disciplines[0], '2026-08-01');
  const b = m.disciplineSummary(s, s.disciplines[1], '2026-08-01');
  assert.equal(a.planned, 2);
  assert.equal(b.planned, 2);
  assert.equal(a.balance, 8);
  assert.equal(b.balance, 18);
});

test('aula desmarcada na viagem não conta como falta', () => {
  const s = baseState({ trips: [{ id: 't1', start: '2026-08-10', end: '2026-08-12', excluded: [m.sessionKey('a', '2026-08-11')] }] });
  assert.equal(m.disciplineSummary(s, s.disciplines[0], '2026-08-01').planned, 0);
});

test('falta registrada e viagem na mesma aula não contam duas vezes', () => {
  const s = baseState({
    absences: { a: { '2026-08-11': 1 } },
    trips: [{ id: 't1', start: '2026-08-10', end: '2026-08-12', excluded: [] }],
  });
  const r = m.disciplineSummary(s, s.disciplines[0], '2026-08-01');
  assert.equal(r.registered, 1);
  assert.equal(r.planned, 0);
  assert.equal(r.total, 1);
});

test('viagens sobrepostas contam a aula uma vez', () => {
  const s = baseState({
    trips: [
      { id: 't1', start: '2026-08-10', end: '2026-08-12', excluded: [] },
      { id: 't2', start: '2026-08-11', end: '2026-08-11', excluded: [] },
    ],
  });
  assert.equal(m.disciplineSummary(s, s.disciplines[0], '2026-08-01').planned, 2);
});

test('aula de viagem já passada e não registrada fica separada', () => {
  const s = baseState({ trips: [{ id: 't1', start: '2026-08-10', end: '2026-08-12', excluded: [] }] });
  const r = m.disciplineSummary(s, s.disciplines[0], '2026-08-20');
  assert.equal(r.planned, 0);
  assert.equal(r.pastTrip, 2);
  assert.equal(r.total, 2);
});

test('status: dentro, no limite e reprovaria', () => {
  assert.equal(m.statusFor(0.5), 'ok');
  assert.equal(m.statusFor(0), 'limit');
  assert.equal(m.statusFor(-1), 'over');
  const s = baseState({ absences: { a: { '2026-08-04': 2, '2026-08-11': 2, '2026-08-18': 2, '2026-08-25': 2, '2026-08-26': 2 } } });
  const r = m.disciplineSummary(s, s.disciplines[0], '2026-08-30');
  assert.equal(r.balance, 0);
  assert.equal(r.status, 'limit');
});

test('aviso quando as horas do calendário diferem da carga nominal', () => {
  const s = baseState();
  const r = m.disciplineSummary(s, s.disciplines[0]);
  assert.equal(r.calendarHours, 8);
  assert.equal(r.calendarMismatch, true);
});

test('simulateTrip mostra horas perdidas e saldo antes/depois', () => {
  const s = baseState({ absences: { a: { '2026-08-04': 2 } } });
  const trip = { id: 'novo', start: '2026-08-17', end: '2026-08-20', excluded: [] };
  const sim = m.simulateTrip(s, trip, '2026-08-01');
  const ra = sim.rows.find((r) => r.discipline.id === 'a');
  const rb = sim.rows.find((r) => r.discipline.id === 'b');
  assert.equal(ra.hoursLost, 2);
  assert.equal(ra.balanceBefore, 8);
  assert.equal(ra.balanceAfter, 6);
  assert.equal(rb.hoursLost, 4); // seg 17 + qui 20
  assert.equal(rb.sessions.length, 2);
  assert.equal(sim.hoursLost, 6);
  assert.equal(sim.worst, 'ok');
});

test('simulateTrip ao editar substitui a versão salva da viagem', () => {
  const s = baseState({ trips: [{ id: 't1', start: '2026-08-10', end: '2026-08-12', excluded: [] }] });
  const edited = { id: 't1', start: '2026-08-10', end: '2026-08-10', excluded: [] };
  const sim = m.simulateTrip(s, edited, '2026-08-01');
  // Só a segunda (b) fica dentro; a terça (a) sai da viagem.
  assert.deepEqual(sim.rows.map((r) => r.discipline.id), ['b']);
  assert.equal(sim.rows[0].hoursLost, 2);
});

test('simulateTrip aponta reprovação quando estoura o limite', () => {
  const s = baseState();
  s.disciplines[0].workload = 8; // limite 2h
  const sim = m.simulateTrip(s, { id: 'x', start: '2026-08-03', end: '2026-08-12', excluded: [] }, '2026-08-01');
  const ra = sim.rows.find((r) => r.discipline.id === 'a');
  assert.equal(ra.balanceAfter, -2);
  assert.equal(sim.worst, 'over');
});

test('formatação de horas, percentuais e datas', () => {
  assert.equal(m.fmtHours(10), '10h');
  assert.equal(m.fmtHours(7.5), '7,5h');
  assert.equal(m.fmtPct(0.7499), '74,9%');
  assert.equal(m.fmtPct(0.75), '75%');
  assert.equal(m.fmtDate('2026-09-25'), '25/09');
  assert.equal(m.fmtDateLong('2026-09-25'), 'sex, 25 set');
  assert.equal(m.fmtRange('2026-09-25', '2026-09-28'), '25/09 a 28/09');
});

test('isDateKey rejeita datas inválidas', () => {
  assert.ok(m.isDateKey('2026-02-28'));
  assert.ok(!m.isDateKey('2026-02-30'));
  assert.ok(!m.isDateKey('25/09/2026'));
});
