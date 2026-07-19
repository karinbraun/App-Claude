/**
 * constants.js — Dados de apoio à interface (paleta, emojis, sugestões).
 * Puro dado, sem lógica.
 */

/** Paleta de cores para os hábitos (acessível em tema claro e escuro). */
export const COLORS = [
  '#ef4444', // vermelho
  '#f97316', // laranja
  '#f59e0b', // âmbar
  '#22c55e', // verde
  '#10b981', // esmeralda
  '#06b6d4', // ciano
  '#3b82f6', // azul
  '#6366f1', // índigo
  '#8b5cf6', // violeta
  '#ec4899', // rosa
];

/** Emojis sugeridos no seletor ao criar/editar um hábito. */
export const EMOJIS = [
  '💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '🚭',
  '✍️', '🎯', '🧠', '☀️', '🙏', '💊', '🦷', '🚶',
  '🎸', '🌱', '💰', '📵', '🧹', '🍎', '⏰', '❤️',
];

/**
 * Hábitos sugeridos para o estado vazio (onboarding com 1 toque).
 * goalType 'daily' = todo dia; 'weekly' = N vezes por semana.
 */
export const SUGGESTED_HABITS = [
  { name: 'Beber água', emoji: '💧', color: '#06b6d4', goalType: 'daily', goalTarget: 7 },
  { name: 'Exercício', emoji: '🏃', color: '#22c55e', goalType: 'weekly', goalTarget: 4 },
  { name: 'Ler', emoji: '📚', color: '#8b5cf6', goalType: 'daily', goalTarget: 7 },
  { name: 'Meditar', emoji: '🧘', color: '#f59e0b', goalType: 'daily', goalTarget: 7 },
  { name: 'Dormir cedo', emoji: '😴', color: '#6366f1', goalType: 'daily', goalTarget: 7 },
];
