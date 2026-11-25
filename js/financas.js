// Controle financeiro: contas fixas, valores por mês, pagamentos, bancos e caixinhas.
import * as S from './store.js';
import { pad } from './rotina.js';

export const K = 'financas';
export const INICIO = '2026-12';   // a aba abre a partir de dezembro
export const PRIMEIRO = '2025-12'; // primeiro mês com dados (planilha)
const vazio = () => ({ contas: [], historico: {}, pagos: {}, liquido: {}, receitas: {}, extras: [], caixaBase: 'anny', bancos: ['Inter', 'Pag', 'Itaú'], caixinhas: [{ id: 'emergencia', nome: 'Emergência', pct: 10 }, { id: 'contas', nome: 'Contas', pct: 10 }, { id: 'livre', nome: 'Gasto livre', pct: 10 }] });

export const dados = () => ({ ...vazio(), ...S.get(K, vazio) });
export const mesDe = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const mesMais = (m, n) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + n, 1); return mesDe(d); };
export const NOME_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const nomeMes = m => { const [y, mm] = m.split('-').map(Number); return `${NOME_MES[mm - 1]}/${String(y).slice(2)}`; };
export const brl = v => { if (v == null || isNaN(v)) return '—'; const n = Math.round(Number(v) * 100) / 100, d = Number.isInteger(n) ? 0 : 2; return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); };

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

// ---------- Rendas, gastos extras e análise ----------
export const CATEGORIAS = ['Mercado', 'Delivery e restaurante', 'Transporte', 'Saúde', 'Bebê', 'Casa', 'Pets', 'Compras', 'Lazer', 'Beleza', 'Presentes', 'Outros'];
export const FORMAS = { credito: 'Cartão de crédito', debito: 'Débito', pix: 'Pix', caju: 'Caju', dinheiro: 'Dinheiro' };

export function receitas(f, m) {
  const r = { anny: null, irad: null, caju: null, ...(f.receitas?.[m] || {}) };
  if (r.anny == null && f.liquido?.[m] != null) r.anny = Number(f.liquido[m]); // valor antigo do "líquido do mês"
  return r;
}

// Gastos extras que caem no mês (parcelas do crédito se espalham pelos meses seguintes)
export function extrasNoMes(f, m) {
  const out = [];
  for (const e of f.extras || []) {
    const m0 = e.data.slice(0, 7), n = Math.max(1, Number(e.parcelas) || 1);
    for (let i = 0; i < n; i++) if (mesMais(m0, i) === m) out.push({ ...e, valorMes: Number(e.valor) / n, parcela: n > 1 ? `${i + 1}/${n}` : null });
  }
  return out.sort((a, b) => b.data.localeCompare(a.data));
}

export function painel(f, m) {
  const r = resumo(f, m), rec = receitas(f, m);
  const renda = (Number(rec.anny) || 0) + (Number(rec.irad) || 0);
  const caju = Number(rec.caju) || 0;
  const extras = extrasNoMes(f, m);
  const extrasTotal = extras.reduce((s, e) => s + e.valorMes, 0);
  const extrasCaju = extras.filter(e => e.forma === 'caju').reduce((s, e) => s + e.valorMes, 0);
  const extrasDinheiro = extrasTotal - extrasCaju;
  const base = (f.caixaBase || 'anny') === 'casal' ? renda : (Number(rec.anny) || 0);
  const caixinhas = f.caixinhas.map(x => ({ ...x, valor: base * (Number(x.pct) || 0) / 100 }));
  const caixasTotal = caixinhas.reduce((s, x) => s + x.valor, 0);
  const sobra = renda ? renda - r.total - extrasDinheiro - caixasTotal : null;
  const porCat = {};
  for (const e of extras) porCat[e.cat || 'Outros'] = (porCat[e.cat || 'Outros'] || 0) + e.valorMes;
  const credito = extras.filter(e => e.forma === 'credito').reduce((s, e) => s + e.valorMes, 0);
  return { ...r, rec, renda, caju, extras, extrasTotal, extrasCaju, extrasDinheiro, caixinhas, caixasTotal, sobra, porCat, credito, gastos: r.total + extrasTotal, base };
}

// Parcelas que já estão comprometidas nos próximos meses
export function parcelasFuturas(f, m) {
  let total = 0;
  for (let i = 1; i <= 12; i++) total += extrasNoMes(f, mesMais(m, i)).filter(e => e.parcela).reduce((s, e) => s + e.valorMes, 0);
  return total;
}

const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
export function analise(f, m) {
  const p = painel(f, m), out = [];
  if (!p.renda) out.push({ tom: 'info', txt: 'Coloque as rendas do mês (seu salário com comissão e o do Irad) para eu calcular a sobra e o quanto da renda está comprometido.' });
  else {
    const fx = pct(p.total, p.renda);
    out.push({ tom: fx > 60 ? 'alerta' : fx > 45 ? 'atencao' : 'ok', txt: `As contas fixas levam ${fx}% da renda do casal${fx > 60 ? ', acima do recomendado (até 50–60%). Vale revisar o que dá pra cortar ou renegociar.' : fx > 45 ? '. Está no limite: cuidado com gastos novos.' : '. Está saudável.'}` });
    if (p.sobra != null) out.push({ tom: p.sobra < 0 ? 'alerta' : 'ok', txt: p.sobra < 0 ? `O mês fecha no negativo em ${brl(-p.sobra)} depois das contas, extras e caixinhas. Dá pra reduzir as caixinhas este mês ou segurar extras.` : `Depois de tudo, sobram ${brl(p.sobra)} (${pct(p.sobra, p.renda)}% da renda).` });
  }
  const ant = [1, 2, 3].map(i => painel(f, mesMais(m, -i)).extrasTotal).filter(v => v > 0);
  if (ant.length && p.extrasTotal) {
    const media = ant.reduce((a, b) => a + b, 0) / ant.length, dif = Math.round((p.extrasTotal / media - 1) * 100);
    if (Math.abs(dif) >= 15) out.push({ tom: dif > 0 ? 'atencao' : 'ok', txt: `Os gastos extras estão ${Math.abs(dif)}% ${dif > 0 ? 'acima' : 'abaixo'} da média dos últimos meses (${brl(media)}).` });
  }
  const cats = Object.entries(p.porCat).sort((a, b) => b[1] - a[1]);
  if (cats.length) out.push({ tom: 'info', txt: `Maior gasto extra: ${cats[0][0]}, com ${brl(cats[0][1])}${p.extrasTotal ? ` (${pct(cats[0][1], p.extrasTotal)}% dos extras)` : ''}.` });
  if (p.caju) { const resta = p.caju - p.extrasCaju; out.push({ tom: resta < 0 ? 'atencao' : 'ok', txt: resta < 0 ? `O Caju acabou: os gastos no Caju passaram ${brl(-resta)} do saldo do mês.` : `Ainda restam ${brl(resta)} no Caju este mês. Use no mercado antes de usar o cartão.` }); }
  if (p.credito) out.push({ tom: 'info', txt: `${brl(p.credito)} em compras no crédito caem neste mês.` });
  const fut = parcelasFuturas(f, m);
  if (fut) out.push({ tom: 'atencao', txt: `Já existem ${brl(fut)} em parcelas comprometidas para os próximos meses.` });
  const recAnt = receitas(f, mesMais(m, -1));
  if (p.rec.anny && recAnt.anny) { const d = Math.round((p.rec.anny / recAnt.anny - 1) * 100); if (Math.abs(d) >= 10) out.push({ tom: d > 0 ? 'ok' : 'atencao', txt: `Seu salário com comissão ${d > 0 ? 'subiu' : 'caiu'} ${Math.abs(d)}% em relação ao mês passado.` }); }
  return out;
}
