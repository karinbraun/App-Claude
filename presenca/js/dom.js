/** dom.js — pequenos helpers de interface compartilhados pelas telas. */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
/** Mostra um aviso rápido (toast) no rodapé. */
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

export const STATUS_LABEL = { ok: 'Dentro do limite', limit: 'No limite', over: 'Reprovaria' };

/** Selo colorido de status. */
export function statusBadge(status, text = STATUS_LABEL[status]) {
  return `<span class="badge badge-${status}">${escapeHtml(text)}</span>`;
}

/** Leva o app para outra aba (tratado em app.js). */
export function go(route, detail = {}) {
  window.dispatchEvent(new CustomEvent('presenca:navigate', { detail: { route, ...detail } }));
}
