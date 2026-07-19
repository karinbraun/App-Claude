/**
 * charts.js — Geradores de SVG (sem nenhuma biblioteca).
 *
 * Cada função devolve uma string SVG que é inserida no DOM via innerHTML.
 * Por estar inline no DOM, o SVG herda as variáveis CSS do tema (claro/escuro),
 * então usamos var(--...) para as cores neutras e o hex do hábito para a cor viva.
 */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Anel de progresso (donut) mostrando `done`/`total`. */
export function progressRing(done, total, { size = 128, stroke = 12, color = 'var(--accent)', label = 'hoje' } = {}) {
  const pct = total > 0 ? done / total : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const c = size / 2;
  return `
  <svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"
       aria-label="${done} de ${total} concluídos ${esc(label)}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="${stroke}"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 ${c} ${c})" class="ring-progress"/>
    <text x="50%" y="46%" text-anchor="middle" dominant-baseline="middle" class="ring-num">${done}<tspan class="ring-den">/${total}</tspan></text>
    <text x="50%" y="64%" text-anchor="middle" dominant-baseline="middle" class="ring-label">${esc(label)}</text>
  </svg>`;
}

/**
 * Mapa de calor estilo "contribuições do GitHub".
 * `cols` = saída de model.heatmap (colunas de 7 dias).
 */
export function heatmapSVG(cols, color, { cell = 13, gap = 3 } = {}) {
  const weeks = cols.length;
  const width = weeks * (cell + gap) - gap;
  const height = 7 * (cell + gap) - gap;
  let rects = '';
  cols.forEach((col, x) => {
    col.forEach((day, y) => {
      const rx = x * (cell + gap);
      const ry = y * (cell + gap);
      let fill = 'var(--heat-empty)';
      let opacity = '1';
      // Um dia marcado sempre aparece na cor do hábito (inclusive dias passados
      // preenchidos na grade). Só esmaecemos dias vazios fora do período válido.
      if (day.checked) fill = color;
      else if (day.future || day.before) opacity = '0.4';
      rects += `<rect x="${rx}" y="${ry}" width="${cell}" height="${cell}" rx="3" fill="${fill}" opacity="${opacity}">`
        + `<title>${day.key}${day.checked ? ' ✓' : ''}</title></rect>`;
    });
  });
  return `<svg class="heatmap" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
    role="img" aria-label="Mapa de calor dos check-ins">${rects}</svg>`;
}

/** Barras de conclusão por dia da semana. `data` = [{done,total}], `labels` = ['S','T',...]. */
export function weekdayBars(data, labels, color, { bw = 30, height = 74 } = {}) {
  const width = data.length * bw;
  const top = 8;
  const bottom = 18;
  const usable = height - top - bottom;
  let out = '';
  data.forEach((d, i) => {
    const rate = d.total > 0 ? d.done / d.total : 0;
    const h = Math.max(2, rate * usable);
    const x = i * bw;
    out += `<rect x="${(x + bw * 0.22).toFixed(1)}" y="${(top + usable - h).toFixed(1)}" `
      + `width="${(bw * 0.56).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" class="bar">`
      + `<title>${esc(labels[i])}: ${Math.round(rate * 100)}%</title></rect>`;
    out += `<text x="${(x + bw / 2).toFixed(1)}" y="${height - 4}" text-anchor="middle" class="bar-label">${esc(labels[i])}</text>`;
  });
  return `<svg class="bars" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
    role="img" aria-label="Conclusões por dia da semana">${out}</svg>`;
}
