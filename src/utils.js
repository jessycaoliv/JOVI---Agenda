import { PMAP } from './data.js';

export const pad = n => String(n).padStart(2, '0');
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const todayISO = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth() + 1, n.getDate()); };
export const ymOf = s => s.slice(0, 7);
export const dim = (y, m) => new Date(y, m, 0).getDate();
export const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d + n); return iso(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
export const fmtBR = s => { if (!s) return '—'; const [, m, d] = s.split('-'); return `${d}/${m}`; };
export const fmtBRy = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
export const fmtDT = s => s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
export const wdOf = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
export const shiftYm = (ym, n) => { let [y, m] = ym.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; };
export const pc = id => `var(--p${(PMAP[id] || PMAP.outro).c})`;
export const isDone = v => v === true || !!(v && (v.at || v.ok));
export const isOpen = d => d.status !== 'concluida' && d.status !== 'cancelada';
export const isBD = s => { const w = wdOf(s); return w !== 0 && w !== 6; };
export function nthBD(start, n) { let cur = start, c = isBD(cur) ? 1 : 0; while (c < n) { cur = addDays(cur, 1); if (isBD(cur)) c++; } return cur; }

/** Ocorrências de uma rotina num mês. Prazos no fim de semana são antecipados para a sexta. */
export function occs(r, y, m) {
  if (r.ativo === false) return [];
  const ym = `${y}-${pad(m)}`, n = dim(y, m);
  let days = [];
  if (r.freq === 'mensal') days = [r.dia];
  else if (r.freq === 'quinzenal') days = [r.dia, r.dia2].filter(Boolean);
  else if (r.freq === 'anual') days = Number(r.mes) === m ? [r.dia] : [];
  else if (r.freq === 'semanal') {
    for (let d = 1; d <= n; d++) if (new Date(y, m - 1, d).getDay() === Number(r.dia)) days.push(d);
    return days.map(d => ({ r, data: iso(y, m, d), key: `${ym}_${r.id}_${d}`, ym, moved: false }));
  }
  return days.map(Number).filter(Boolean).map(d0 => {
    let d = Math.min(d0, n), wd = new Date(y, m - 1, d).getDay(), moved = false;
    if (wd === 6) { d = d - 1 >= 1 ? d - 1 : d + 2; moved = true; }
    else if (wd === 0) { d = d - 2 >= 1 ? d - 2 : d + 1; moved = true; }
    return { r, data: iso(y, m, d), key: `${ym}_${r.id}_${d0}`, ym, moved };
  });
}
export function monthOccs(rotinas, ym) {
  const [y, m] = ym.split('-').map(Number);
  return rotinas.flatMap(r => occs(r, y, m)).sort((a, b) => a.data.localeCompare(b.data));
}
export function freqTxt(r, WD) {
  if (r.freq === 'mensal') return `dia ${r.dia >= 31 ? 'último' : pad(r.dia)}`;
  if (r.freq === 'quinzenal') return `dias ${pad(r.dia)} e ${r.dia2 >= 31 ? 'último' : pad(r.dia2)}`;
  if (r.freq === 'semanal') return `toda ${WD[r.dia] || ''}`;
  if (r.freq === 'anual') return `${pad(r.dia)}/${pad(r.mes)}`;
  return 'diária';
}
export const nextStep = d => { const p = PMAP[d.processo] || PMAP.outro; const i = p.etapas.findIndex((e, k) => !isDone((d.etapas || [])[k])); return i < 0 ? null : p.etapas[i][0]; };
