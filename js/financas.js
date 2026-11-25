// Controle financeiro: contas fixas, valores por mês, pagamentos, bancos e caixinhas.
import * as S from './store.js';
import { pad } from './rotina.js';

export const K = 'financas';
export const INICIO = '2026-12';   // a aba abre a partir de dezembro
export const PRIMEIRO = '2025-12'; // primeiro mês com dados (planilha)
const vazio = () => ({ contas: [], historico: {}, pagos: {}, liquido: {}, bancos: ['Inter', 'Pag', 'Itaú'], caixinhas: [{ id: 'emergencia', nome: 'Emergência', pct: 10 }, { id: 'contas', nome: 'Contas', pct: 10 }, { id: 'livre', nome: 'Gasto livre', pct: 10 }] });

export const dados = () => ({ ...vazio(), ...S.get(K, vazio) });
export const mesDe = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const mesMais = (m, n) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + n, 1); return mesDe(d); };
export const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const nomeMes = m => { const [y, mm] = m.split('-').map(Number); return `${NOME_MES[mm - 1]}/${String(y).slice(2)}`; };
export const brl = v => (v == null || isNaN(v)) ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function salvar(fn) { S.update(K, vazio, f => { const d = { ...vazio(), ...f }; fn(d); return d; }); }

// Valor da conta no mês: o registrado; se não houver e o mês for atual/futuro, o previsto.
export function valorNoMes(f, c, m) {
  const h = f.historico[m]?.[c.id];
  if (h != null && h !== '') return Number(h);
  return m >= mesDe() ? Number(c.valor) || 0 : null;
}
export const ativasNoMes = (f, m) => f.contas.filter(c => !c.desde || c.desde <= m).filter(c => !c.ate || c.ate >= m);
export const pago = (f, m, id) => !!f.pagos[m]?.[id];

export function resumo(f, m) {
  const contas = ativasNoMes(f, m);
  let total = 0, pagoT = 0;
  const bancos = {};
  for (const c of contas) {
    const v = valorNoMes(f, c, m) || 0;
    total += v;
    const b = (bancos[c.banco] ||= { total: 0, falta: 0 });
    b.total += v;
    if (pago(f, m, c.id)) pagoT += v; else b.falta += v;
  }
  const liquido = Number(f.liquido[m]) || 0;
  const caixinhas = f.caixinhas.map(x => ({ ...x, valor: liquido * (Number(x.pct) || 0) / 100 }));
  const sobra = liquido ? liquido - total - caixinhas.reduce((s, x) => s + x.valor, 0) : null;
  return { contas, total, pago: pagoT, falta: total - pagoT, bancos, liquido, caixinhas, sobra };
}

// Contas que vencem hoje ou já venceram neste mês e não foram pagas
export function vencendo(hoje = new Date()) {
  const f = dados(), m = mesDe(hoje), dia = hoje.getDate();
  return ativasNoMes(f, m).filter(c => c.dia && Number(c.dia) <= dia && !pago(f, m, c.id))
    .map(c => ({ c, valor: valorNoMes(f, c, m), atrasada: Number(c.dia) < dia }));
}
export function proxima(hoje = new Date()) {
  const f = dados(), m = mesDe(hoje), dia = hoje.getDate();
  return ativasNoMes(f, m).filter(c => c.dia && !pago(f, m, c.id)).sort((a, b) => a.dia - b.dia).find(c => Number(c.dia) >= dia) || null;
}

export function marcarPago(id, on, m = mesDe()) {
  salvar(f => { f.pagos[m] = { ...(f.pagos[m] || {}) }; if (on) f.pagos[m][id] = Date.now(); else delete f.pagos[m][id]; });
}

// Importação pelo link (#importar=...) — os dados vêm no próprio link e não ficam no código do site
export function importar(obj) {
  salvar(f => {
    for (const c of obj.contas || []) if (!f.contas.some(x => x.id === c.id)) f.contas.push(c);
    for (const [m, vals] of Object.entries(obj.historico || {})) f.historico[m] = { ...(f.historico[m] || {}), ...vals };
    for (const [m, vals] of Object.entries(obj.pagos || {})) f.pagos[m] = { ...(f.pagos[m] || {}), ...vals };
    if (obj.bancos) f.bancos = [...new Set([...f.bancos, ...obj.bancos])];
  });
}

const CORES_BANCO = { Inter: 'pessoal', Pag: 'faculdade', 'Itaú': 'trabalho' };
export const corBanco = b => CORES_BANCO[b] || 'neutro';
